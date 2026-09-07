const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");

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

const BOOTSTRAP_ADMIN_EMAILS = [
  "techubwenge@gmail.com",
  "uwimbabazigloria05@gmail.com",
];

// Rooms are never hard-coded. A room doc is born the moment a tenant types
// its number on the door, so the building can be any shape and grow freely.
function slugifyRoomNumber(roomNumber) {
  return String(roomNumber)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function isAdmin(auth) {
  if (!auth) return false;
  const email = auth.token && auth.token.email ? auth.token.email.toLowerCase() : null;
  if (email && BOOTSTRAP_ADMIN_EMAILS.includes(email)) return true;
  const snap = await db.doc(`admins/${auth.uid}`).get();
  return snap.exists;
}

// --- Tenant enters a room: number on the door + their name, nothing else ---
// No admin approval step. The first anonymous uid to claim a room number owns
// it; anyone else typing the same number is told to talk to the admin.
exports.claimRoom = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }
  const uid = request.auth.uid;
  const { roomNumber, tenantName, tenantPhone, hasElectricity } = request.data || {};

  if (!roomNumber || !String(roomNumber).trim()) {
    throw new HttpsError("invalid-argument", "Room number is required");
  }
  if (!tenantName || !String(tenantName).trim()) {
    throw new HttpsError("invalid-argument", "Your name is required");
  }

  const roomId = slugifyRoomNumber(roomNumber);
  if (!roomId) {
    throw new HttpsError("invalid-argument", "Room number is not usable");
  }

  const roomRef = db.doc(`rooms/${roomId}`);
  const now = new Date().toISOString();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    const fields = {
      roomNumber: String(roomNumber).trim(),
      tenantName: String(tenantName).trim(),
      tenantPhone: tenantPhone ? String(tenantPhone).trim() : "",
      hasElectricity: hasElectricity !== false,
      updatedAt: now,
    };

    if (!snap.exists) {
      tx.set(roomRef, {
        id: roomId,
        ...fields,
        tenantUid: uid,
        active: true,
        createdAt: now,
      });
      return { ok: true, roomId };
    }

    const room = snap.data();

    // Someone else is living in this room number right now.
    if (room.active && room.tenantUid && room.tenantUid !== uid) {
      return { ok: false, roomId, reason: "taken_by_other" };
    }

    // Same tenant coming back (new phone, cleared browser is a new uid but
    // an admin-freed room is claimable again) -- refresh their details.
    tx.update(roomRef, { ...fields, tenantUid: uid, active: true });
    return { ok: true, roomId };
  });

  return result;
});

// --- Admin gets a bell + a push the moment a tenant submits ---
exports.onSubmissionCreated = onDocumentCreated("submissions/{submissionId}", async (event) => {
  const submission = event.data ? event.data.data() : null;
  if (!submission) return;

  await db.doc(`notifications/${event.params.submissionId}`).set({
    id: event.params.submissionId,
    type: "submission_created",
    roomId: submission.roomId,
    roomNumber: submission.roomNumber,
    tenantName: submission.tenantName,
    submissionId: event.params.submissionId,
    amountReported: submission.amountReported || 0,
    cashPowerReading: submission.cashPowerReading || "",
    read: false,
    createdAt: submission.createdAt || new Date().toISOString(),
  });

  const tokensSnap = await db.collection("deviceTokens").where("role", "==", "admin").get();
  const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
  if (tokens.length === 0) return;

  const reading = submission.cashPowerReading
    ? ` Cash power reading: ${submission.cashPowerReading}.`
    : "";

  try {
    await messaging.sendEachForMulticast({
      notification: {
        title: `Room ${submission.roomNumber} submitted a payment`,
        body: `${submission.tenantName} reports ${submission.amountReported} RWF paid.${reading}`,
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
