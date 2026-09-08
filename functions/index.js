const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { CloudBillingClient } = require("@google-cloud/billing");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const crypto = require("crypto");

// Hard ceiling on what this project can ever cost. maxInstances is the one
// that matters: without it a bug or an abusive client can spin up hundreds of
// containers and bill for every one. With it, the worst case is that requests
// queue and eventually fail -- the building's admin sees errors instead of an
// invoice, which is the trade this project wants.
// No region here on purpose: the Firestore trigger has to live in the same
// region as the database (africa-south1 on this project), and pinning one
// region globally would break it.
setGlobalOptions({
  maxInstances: 3,
  memory: "256MiB",
  timeoutSeconds: 60,
});

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Hard-coded owners. These cannot be removed from inside the app, which is
// what stops one admin from locking everyone else out.
const BOOTSTRAP_ADMIN_EMAILS = [
  "techubwenge@gmail.com",
  "uwimbabazigloria05@gmail.com",
  "abdullazackniyigaba@gmail.com",
];

// Rooms are never hard-coded. A room doc is born the moment a tenant types
// its number on the door, so the building can be any shape and grow freely.
// The room number as typed is display only; this is what a login matches on,
// so "12 B", "12b" and "12-B" all find the same room. The admin can rename a
// room freely because the document id never changes -- only this key does.
// Must stay identical to normalizeRoomKey in src/1_core/domain/types.ts.
function normalizeRoomKey(roomNumber) {
  return String(roomNumber).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugifyRoomNumber(roomNumber) {
  return String(roomNumber)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Room passwords. A tenant's browser identity is thrown away when they clear
// their data or pick up a different phone, so the password is what actually
// proves "this is my room" -- without it a logged-out tenant is locked out
// forever and only the admin can rescue them.
//
// Hashes live in roomSecrets/{roomId}, a collection no client can read at all,
// so not even the admin sees a tenant's password.
const MIN_PASSWORD_LENGTH = 4;

const SERVICE_LABELS = {
  electricity: "Cash power",
  water: "Water",
  rent: "Rent",
};

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function buildSecret(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt), updatedAt: new Date().toISOString() };
}

// Phones get typed differently every time (+250..., 07..., spaces), so compare
// only the last 9 digits -- the part that actually identifies the line.
function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function passwordMatches(password, secret) {
  if (!secret || !secret.salt || !secret.hash) return false;
  const candidate = Buffer.from(hashPassword(password, secret.salt), "hex");
  const stored = Buffer.from(secret.hash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Access is granted to an email, not to a uid: the person being added has no
// uid until the first time they sign in with Google. Their grant is waiting
// for them when they do.
async function isAdmin(auth) {
  if (!auth) return false;
  const email = auth.token ? normalizeEmail(auth.token.email) : "";
  if (email && BOOTSTRAP_ADMIN_EMAILS.includes(email)) return true;
  if (email && (await db.doc(`adminEmails/${email}`).get()).exists) return true;
  const snap = await db.doc(`admins/${auth.uid}`).get();
  return snap.exists;
}

// --- Tenant enters a room: number on the door, their name, and a password ---
// No admin approval. The first person to claim a room number owns it and sets
// its password; coming back later -- from any phone, after any logout -- means
// typing that same password, which re-points the room at the new browser.
exports.claimRoom = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }
  const uid = request.auth.uid;
  const {
    roomNumber,
    tenantName,
    tenantPhone,
    hasElectricity,
    hasWater,
    hasRent,
    password,
  } = request.data || {};

  if (!roomNumber || !String(roomNumber).trim()) {
    throw new HttpsError("invalid-argument", "Room number is required");
  }
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  if (!normalizePhone(tenantPhone)) {
    throw new HttpsError("invalid-argument", "Phone number is required");
  }

  const roomKey = normalizeRoomKey(roomNumber);
  if (!roomKey) {
    throw new HttpsError("invalid-argument", "Room number is not usable");
  }
  const slug = slugifyRoomNumber(roomNumber) || roomKey;
  const now = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    // Find the room by its key, not by document id, so a room the admin
    // renamed is still found under its new number.
    const byKey = await tx.get(
      db.collection("rooms").where("roomKey", "==", roomKey).limit(1)
    );

    let roomRef;
    let roomSnap = null;
    if (!byKey.empty) {
      roomSnap = byKey.docs[0];
      roomRef = roomSnap.ref;
    } else {
      // Rooms created before roomKey existed have no key to match on, so try
      // the two ids such a room could be sitting at. Missing this would let
      // "12-B" create a second room beside the existing "12B".
      const slugRef = db.doc(`rooms/${slug}`);
      const keyRef = db.doc(`rooms/${roomKey}`);
      const [slugSnap, keySnap] = await tx.getAll(slugRef, keyRef);

      if (slugSnap.exists) {
        roomRef = slugRef;
        roomSnap = slugSnap;
      } else if (keySnap.exists) {
        roomRef = keyRef;
        roomSnap = keySnap;
      } else {
        roomRef = slugRef;
        roomSnap = null;
      }
    }

    const secretRef = db.doc(`roomSecrets/${roomRef.id}`);
    const secretSnap = await tx.get(secretRef);

    const existing = roomSnap ? roomSnap.data() : null;
    const name = String(tenantName || "").trim() || (existing ? existing.tenantName : "");
    if (!name) {
      throw new HttpsError("invalid-argument", "Your name is required");
    }

    // On the way back in the tenant does not re-answer the service questions,
    // so keep whatever the room already has unless a value was sent.
    const pick = (sent, current, fallback) =>
      sent === undefined ? (existing ? !!current : fallback) : sent !== false;

    const fields = {
      roomKey,
      roomNumber: String(roomNumber).trim(),
      tenantName: name,
      tenantPhone: String(tenantPhone).trim(),
      hasElectricity: pick(hasElectricity, existing && existing.hasElectricity, true),
      hasWater: pick(hasWater, existing && existing.hasWater, false),
      hasRent: pick(hasRent, existing && existing.hasRent, false),
      updatedAt: now,
    };

    // Nobody has this room number yet -- claim it and set its password.
    if (!roomSnap) {
      tx.set(roomRef, {
        id: roomRef.id,
        ...fields,
        tenantUid: uid,
        active: true,
        createdAt: now,
      });
      tx.set(secretRef, buildSecret(password));
      return { ok: true, roomId: roomRef.id, created: true };
    }

    const room = existing;

    // A room claimed before passwords existed. Only the browser that already
    // owns it can set one; anyone else still has to see the admin.
    if (!secretSnap.exists) {
      if (room.tenantUid && room.tenantUid !== uid) {
        return { ok: false, roomId: roomRef.id, reason: "taken_by_other" };
      }
      tx.update(roomRef, { ...fields, tenantUid: uid, active: true });
      tx.set(secretRef, buildSecret(password));
      return { ok: true, roomId: roomRef.id };
    }

    // Coming back needs two things they know: the phone on the room and the
    // password. The room number alone is public -- it is written on the door.
    // A room with no phone on file can only be checked on the password.
    const storedPhone = normalizePhone(room.tenantPhone);
    const phoneOk = !storedPhone || storedPhone === normalizePhone(tenantPhone);

    if (!passwordMatches(password, secretSnap.data()) || !phoneOk) {
      return { ok: false, roomId: roomRef.id, reason: "wrong_credentials" };
    }

    // Checks out: hand the room to whatever browser they are on now.
    tx.update(roomRef, { ...fields, tenantUid: uid, active: true });
    return { ok: true, roomId: roomRef.id };
  });
});

// Admin resets a room password for a tenant who forgot theirs.
exports.setRoomPassword = onCall(async (request) => {
  if (!(await isAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  const { roomId, password } = request.data || {};
  if (!roomId) {
    throw new HttpsError("invalid-argument", "roomId required");
  }
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  const roomSnap = await db.doc(`rooms/${roomId}`).get();
  if (!roomSnap.exists) {
    throw new HttpsError("not-found", "Room not found");
  }
  await db.doc(`roomSecrets/${roomId}`).set(buildSecret(password));
  return { ok: true };
});

// Any admin can make another email an admin. There is no owner tier above
// admin on purpose -- the building has a few trusted people, and waiting on
// one specific person to be reachable is the kind of overhead this app exists
// to remove. The hard-coded owners above are the floor that keeps that safe.
exports.addAdmin = onCall(async (request) => {
  if (!(await isAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  const email = normalizeEmail((request.data || {}).email);
  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "That does not look like an email address");
  }
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    return { ok: true, alreadyAdmin: true };
  }

  await db.doc(`adminEmails/${email}`).set({
    email,
    addedBy: normalizeEmail(request.auth.token.email) || request.auth.uid,
    addedAt: new Date().toISOString(),
  });
  return { ok: true };
});

exports.removeAdmin = onCall(async (request) => {
  if (!(await isAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  const email = normalizeEmail((request.data || {}).email);
  const caller = normalizeEmail(request.auth.token.email);

  // Built-in owners are the floor: nothing in the app can take them away.
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    throw new HttpsError(
      "failed-precondition",
      "This is a built-in admin and cannot be removed here"
    );
  }
  // Removing yourself would drop you out of the panel mid-click.
  if (email && email === caller) {
    throw new HttpsError("failed-precondition", "You cannot remove your own access");
  }

  await db.doc(`adminEmails/${email}`).delete();
  return { ok: true };
});

// Admin deletes a room outright: the room, its password, every submission it
// ever had, and the photos behind them. Nothing is left pointing at a room
// that no longer exists.
exports.deleteRoom = onCall(async (request) => {
  if (!(await isAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  const { roomId } = request.data || {};
  if (!roomId) {
    throw new HttpsError("invalid-argument", "roomId required");
  }

  const bucket = getStorage().bucket();
  const submissionsSnap = await db
    .collection("submissions")
    .where("roomId", "==", roomId)
    .get();

  for (const docSnap of submissionsSnap.docs) {
    const path = docSnap.data().screenshotPath;
    if (path) {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
      } catch (e) {
        console.error(`Could not delete ${path}`, e);
      }
    }
  }

  const notificationsSnap = await db
    .collection("notifications")
    .where("roomId", "==", roomId)
    .get();

  // Batches cap at 500 writes, so chunk rather than assume a small room.
  const refs = [
    ...submissionsSnap.docs.map((d) => d.ref),
    ...notificationsSnap.docs.map((d) => d.ref),
    db.doc(`roomSecrets/${roomId}`),
    db.doc(`rooms/${roomId}`),
  ];
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return { ok: true, deletedSubmissions: submissionsSnap.size };
});

// --- Admin gets a bell + a push the moment a tenant submits ---
exports.onSubmissionCreated = onDocumentCreated("submissions/{submissionId}", async (event) => {
  const submission = event.data ? event.data.data() : null;
  if (!submission) return;

  const service = submission.serviceType || "electricity";
  const reading = submission.meterReading || submission.cashPowerReading || "";
  const serviceLabel = SERVICE_LABELS[service] || service;

  await db.doc(`notifications/${event.params.submissionId}`).set({
    id: event.params.submissionId,
    type: "submission_created",
    title: `Room ${submission.roomNumber} sent a ${serviceLabel.toLowerCase()} payment`,
    body: `${submission.tenantName} reports ${submission.amountReported} RWF paid.` +
      (reading ? ` Reading: ${reading}.` : ""),
    roomId: submission.roomId,
    roomNumber: submission.roomNumber,
    tenantName: submission.tenantName,
    submissionId: event.params.submissionId,
    amountReported: submission.amountReported || 0,
    serviceType: service,
    read: false,
    createdAt: submission.createdAt || new Date().toISOString(),
  });

  const tokensSnap = await db.collection("deviceTokens").where("role", "==", "admin").get();
  const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
  if (tokens.length === 0) return;

  try {
    await messaging.sendEachForMulticast({
      notification: {
        title: `Room ${submission.roomNumber} sent a ${serviceLabel.toLowerCase()} payment`,
        body: `${submission.tenantName} reports ${submission.amountReported} RWF paid.` +
          (reading ? ` Reading: ${reading}.` : ""),
      },
      tokens,
    });
  } catch (e) {
    console.error("Failed to send admin notification", e);
  }
});

// --- Free-tier housekeeping: photos die at 14 days, the record lives on ---
// The submission doc keeps what was paid and what the meter read, so the
// admin still has the history -- only the image bytes go away.
async function deleteExpiredScreenshots() {
  const nowIso = new Date().toISOString();
  const snap = await db
    .collection("submissions")
    .where("screenshotExpiresAt", "<=", nowIso)
    .limit(400)
    .get();

  const bucket = getStorage().bucket();
  let deleted = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.screenshotDeleted || !data.screenshotPath) continue;
    try {
      await bucket.file(data.screenshotPath).delete({ ignoreNotFound: true });
    } catch (e) {
      console.error(`Failed to delete ${data.screenshotPath}`, e);
      continue;
    }
    await docSnap.ref.update({
      screenshotDeleted: true,
      screenshotPath: FieldValue.delete(),
      screenshotExpiresAt: FieldValue.delete(),
    });
    deleted++;
  }

  return { deleted };
}

// --- Free tier watch ---
// Warns the admin before Google's free allowances run out, because passing
// them is what turns this project from free into billable. Only what can be
// measured cheaply from inside the project is checked: bytes in the photo
// bucket and stored document counts. Function invocations and daily read
// counts are not visible here -- those live in Cloud Monitoring.
const FREE_TIER_STORAGE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB of Cloud Storage
const FREE_TIER_DOCS = 50000; // stand-in for the 1 GiB Firestore allowance
const WARN_AT = 0.8; // shout once usage passes 80% of an allowance

async function measureUsage() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ maxResults: 5000 });
  const storageBytes = files.reduce(
    (total, file) => total + Number((file.metadata && file.metadata.size) || 0),
    0
  );

  const [submissions, rooms] = await Promise.all([
    db.collection("submissions").count().get(),
    db.collection("rooms").count().get(),
  ]);

  return {
    storageBytes,
    photoCount: files.length,
    submissionCount: submissions.data().count,
    roomCount: rooms.data().count,
    storageRatio: storageBytes / FREE_TIER_STORAGE_BYTES,
    docRatio: (submissions.data().count + rooms.data().count) / FREE_TIER_DOCS,
    measuredAt: new Date().toISOString(),
  };
}

async function warnAdmins(id, title, body) {
  // One document id per day per warning, so a daily check cannot spam the bell.
  const ref = db.doc(`notifications/${id}`);
  if ((await ref.get()).exists) return false;

  await ref.set({
    id,
    type: "free_tier_warning",
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  });

  const tokensSnap = await db.collection("deviceTokens").where("role", "==", "admin").get();
  const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
  if (tokens.length > 0) {
    try {
      await messaging.sendEachForMulticast({ notification: { title, body }, tokens });
    } catch (e) {
      console.error("Failed to send free tier warning", e);
    }
  }
  return true;
}

async function checkFreeTier() {
  const usage = await measureUsage();
  await db.doc("usage/current").set(usage);

  const today = usage.measuredAt.slice(0, 10);
  const gb = (usage.storageBytes / (1024 * 1024 * 1024)).toFixed(2);

  if (usage.storageRatio >= WARN_AT) {
    await warnAdmins(
      `free-tier-storage-${today}`,
      "Photo storage is nearly full",
      `${gb} GB of the free 5 GB is used across ${usage.photoCount} photos. ` +
        `Past 5 GB the project starts costing money. Old photos delete themselves ` +
        `after 14 days, so this usually means a sudden burst of uploads.`
    );
  }

  if (usage.docRatio >= WARN_AT) {
    await warnAdmins(
      `free-tier-docs-${today}`,
      "Database is filling up",
      `${usage.submissionCount} submissions and ${usage.roomCount} rooms stored, ` +
        `close to the free allowance. Consider deleting rooms that have moved out.`
    );
  }

  return usage;
}

// Lets the admin check usage on demand instead of waiting for the daily run.
exports.checkFreeTierNow = onCall(async (request) => {
  if (!(await isAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  return checkFreeTier();
});

exports.cleanupExpiredScreenshots = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Africa/Kigali",
    maxInstances: 1,
    timeoutSeconds: 300,
    retryCount: 0,
  },
  async () => {
    const { deleted } = await deleteExpiredScreenshots();
    console.log(`Deleted ${deleted} expired payment screenshots`);
    // Measure after the cleanup, so the number reflects what is actually kept.
    const usage = await checkFreeTier();
    console.log(
      `Storage ${(usage.storageRatio * 100).toFixed(1)}% of free tier, ` +
        `${usage.submissionCount} submissions`
    );
  }
);

// Manual trigger, so the cleanup still works on a project where Cloud
// Scheduler has not been enabled.
exports.cleanupScreenshotsNow = onCall(async (request) => {
  if (!(await isAdmin(request.auth))) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  return deleteExpiredScreenshots();
});

// --- Billing kill switch: never spend money, full stop ---
// A Cloud Billing budget publishes to the Pub/Sub topic below every time it
// re-evaluates spend. The moment actual spend goes over the budget, this
// detaches the billing account from the project.
//
// That is a hard stop, not a throttle: functions stop serving, tenants cannot
// submit, and the admin cannot log in. Nothing turns itself back on -- the
// project stays dead until a human re-attaches billing in the console. That
// is the intent. Crashing is the desired outcome; a bill is not.
//
// Setup this needs (once, outside this file):
//   1. A Pub/Sub topic named exactly BUDGET_TOPIC below.
//   2. A budget in Cloud Billing wired to publish to that topic.
//   3. The function's runtime service account granted Billing Account
//      Administrator on the billing account, or it cannot detach it.
const BUDGET_TOPIC = "billing-kill-switch";

exports.stopBillingWhenBudgetExceeded = onMessagePublished(
  { topic: BUDGET_TOPIC, maxInstances: 1, retryCount: 0 },
  async (event) => {
    const notice = event.data.message.json || {};
    const spend = Number(notice.costAmount || 0);
    const budget = Number(notice.budgetAmount || 0);

    // The budget publishes on every evaluation, most of them well under the
    // limit. Only act when real spend has actually passed it.
    if (!budget || spend <= budget) {
      console.log(`Spend ${spend} of ${budget} -- under budget, billing left on.`);
      return;
    }

    const projectName = `projects/${process.env.GCLOUD_PROJECT}`;
    const billing = new CloudBillingClient();

    const [info] = await billing.getProjectBillingInfo({ name: projectName });
    if (!info.billingEnabled) {
      console.log("Billing is already disabled, nothing to do.");
      return;
    }

    // Empty billingAccountName is what detaches the account.
    await billing.updateProjectBillingInfo({
      name: projectName,
      projectBillingInfo: { billingAccountName: "" },
    });

    console.warn(
      `BILLING DISABLED: spend ${spend} passed budget ${budget}. ` +
        `The project is now stopped and must be re-enabled by hand.`
    );
  }
);
