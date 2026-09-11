const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const { CloudBillingClient } = require("@google-cloud/billing");
const crypto = require("crypto");

// Ceiling on what this project can ever cost. Past the cap requests queue and
// then fail: errors rather than an invoice, which is the trade this building
// wants. No global region -- the Firestore trigger must sit in the database's
// own region (africa-south1 here).
setGlobalOptions({ maxInstances: 3, memory: "256MiB", timeoutSeconds: 60 });

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// SMS Connect credential.  firebase functions:secrets:set MIC_API_KEY
//
// A dashboard-generated key authenticates with the X-API-Key header on its
// own, so that is the only required credential. The provider also documents
// an older account-level scheme needing an Authorization bearer plus an
// X-API-SECRET; that one is read from a plain env var rather than
// defineSecret, because a declared secret must exist in Secret Manager at
// deploy time and this one legitimately does not.
const MIC_API_KEY = defineSecret("MIC_API_KEY");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Owners of last resort. Cannot be removed from inside the app, so the
// building can never lock itself out of its own system.
const BOOTSTRAP_ADMIN_EMAILS = [
  "techubwenge@gmail.com",
  "uwimbabazigloria05@gmail.com",
  "abdullazackniyigaba@gmail.com",
];

const MIN_PASSWORD_LENGTH = 4;
const PAYMENT_WINDOW_DAYS = 5;
const SECOND_REMINDER_DAY = 3;
const PROOF_LIFETIME_DAYS = 7;

const SERVICE_LABELS = {
  electricity: "Electricity",
  water: "Water",
  rent: "Rent",
};

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Room number as typed is display only; this is what a login matches on, so
// "12 B", "12b" and "12-B" all find the same room, and staff can rename a room
// without stranding its client. Mirrors normalizeRoomKey in src/1_core.
function normalizeRoomKey(roomNumber) {
  return String(roomNumber).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugifyRoomNumber(roomNumber) {
  return String(roomNumber).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// Phones are typed differently every time (+250..., 07..., spaces), so compare
// only the last 9 digits -- the part that identifies the line.
function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function buildSecret(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt), updatedAt: new Date().toISOString() };
}

function passwordMatches(password, secret) {
  if (!secret || !secret.salt || !secret.hash) return false;
  const candidate = Buffer.from(hashPassword(password, secret.salt), "hex");
  const stored = Buffer.from(secret.hash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
// Staff access is granted to an email, not a uid: the person being added has
// no uid until the first time they sign in with Google, and their grant is
// waiting for them when they do.

async function staffRoleOf(auth) {
  if (!auth) return null;
  const email = auth.token ? normalizeEmail(auth.token.email) : "";
  if (!email) return null;
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) return "admin";
  const snap = await db.doc(`staff/${email}`).get();
  return snap.exists ? snap.data().role || null : null;
}

async function requireRole(auth, ...allowed) {
  const role = await staffRoleOf(auth);
  if (!role || !allowed.includes(role)) {
    throw new HttpsError("permission-denied", `Requires ${allowed.join(" or ")} access`);
  }
  return role;
}

exports.setStaffRole = onCall(async (request) => {
  await requireRole(request.auth, "admin");
  const email = normalizeEmail((request.data || {}).email);
  const role = (request.data || {}).role;

  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "That does not look like an email address");
  }
  if (!["admin", "recovery", "technician"].includes(role)) {
    throw new HttpsError("invalid-argument", "Role must be admin, recovery or technician");
  }
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    return { ok: true, alreadyBuiltIn: true };
  }

  await db.doc(`staff/${email}`).set({
    email,
    role,
    addedBy: normalizeEmail(request.auth.token.email),
    addedAt: new Date().toISOString(),
  });
  return { ok: true };
});

exports.removeStaff = onCall(async (request) => {
  await requireRole(request.auth, "admin");
  const email = normalizeEmail((request.data || {}).email);
  const caller = normalizeEmail(request.auth.token.email);

  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    throw new HttpsError("failed-precondition", "Built-in owners cannot be removed here");
  }
  if (email === caller) {
    throw new HttpsError("failed-precondition", "You cannot remove your own access");
  }

  await db.doc(`staff/${email}`).delete();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Rates -- set by the recovery agent
// ---------------------------------------------------------------------------

exports.setRates = onCall(async (request) => {
  await requireRole(request.auth, "recovery", "admin");
  const { electricityPerUnit, waterPerUnit, rentAmount } = request.data || {};

  const nums = { electricityPerUnit, waterPerUnit, rentAmount };
  for (const [key, value] of Object.entries(nums)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new HttpsError("invalid-argument", `${key} must be zero or more`);
    }
  }

  await db.doc("config/rates").set({
    ...nums,
    updatedBy: normalizeEmail(request.auth.token.email),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
});

async function currentRates() {
  const snap = await db.doc("config/rates").get();
  if (!snap.exists) return { electricityPerUnit: 0, waterPerUnit: 0, rentAmount: 0 };
  const d = snap.data();
  return {
    electricityPerUnit: Number(d.electricityPerUnit || 0),
    waterPerUnit: Number(d.waterPerUnit || 0),
    rentAmount: Number(d.rentAmount || 0),
  };
}

// ---------------------------------------------------------------------------
// Technician: register a client, then record readings
// ---------------------------------------------------------------------------

exports.registerRoom = onCall(async (request) => {
  await requireRole(request.auth, "technician", "admin");
  const {
    roomNumber,
    tenantName,
    tenantPhone,
    hasElectricity,
    hasWater,
    hasRent,
    startElectricityReading,
    startWaterReading,
  } = request.data || {};

  if (!roomNumber || !String(roomNumber).trim()) {
    throw new HttpsError("invalid-argument", "Room number is required");
  }
  if (!tenantName || !String(tenantName).trim()) {
    throw new HttpsError("invalid-argument", "Client name is required");
  }
  if (!normalizePhone(tenantPhone)) {
    throw new HttpsError("invalid-argument", "Phone number is required");
  }

  const roomKey = normalizeRoomKey(roomNumber);
  if (!roomKey) throw new HttpsError("invalid-argument", "Room number is not usable");

  const existing = await db.collection("rooms").where("roomKey", "==", roomKey).limit(1).get();
  if (!existing.empty) {
    throw new HttpsError("already-exists", `Room ${roomNumber} is already in the system`);
  }

  const id = slugifyRoomNumber(roomNumber) || roomKey;
  const now = new Date().toISOString();

  await db.doc(`rooms/${id}`).set({
    id,
    roomKey,
    roomNumber: String(roomNumber).trim(),
    tenantName: String(tenantName).trim(),
    tenantPhone: String(tenantPhone).trim(),
    hasElectricity: hasElectricity !== false,
    hasWater: hasWater === true,
    hasRent: hasRent === true,
    startElectricityReading: Number(startElectricityReading) || 0,
    startWaterReading: Number(startWaterReading) || 0,
    active: true,
    registeredBy: normalizeEmail(request.auth.token.email),
    createdAt: now,
  });

  return { ok: true, roomId: id };
});

// The last reading taken for a service tells the next bill where to measure
// from; with no bills yet that is the reading the technician wrote down at
// registration.
async function lastReadingFor(roomId, serviceType, room) {
  const snap = await db
    .collection("bills")
    .where("roomId", "==", roomId)
    .where("serviceType", "==", serviceType)
    .orderBy("issuedAt", "desc")
    .limit(1)
    .get();

  if (!snap.empty) return Number(snap.docs[0].data().currentReading || 0);
  if (serviceType === "electricity") return Number(room.startElectricityReading || 0);
  if (serviceType === "water") return Number(room.startWaterReading || 0);
  return 0;
}

exports.submitReading = onCall(async (request) => {
  await requireRole(request.auth, "technician", "admin");
  const { roomId, serviceType, currentReading, note } = request.data || {};

  if (!roomId) throw new HttpsError("invalid-argument", "roomId required");
  if (!["electricity", "water", "rent"].includes(serviceType)) {
    throw new HttpsError("invalid-argument", "Unknown service");
  }

  const roomSnap = await db.doc(`rooms/${roomId}`).get();
  if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found");
  const room = roomSnap.data();

  const rates = await currentRates();
  const unitPrice =
    serviceType === "electricity"
      ? rates.electricityPerUnit
      : serviceType === "water"
      ? rates.waterPerUnit
      : rates.rentAmount;

  // Billing at a zero price would quietly issue a bill for nothing and the
  // client would think they owe nothing at all.
  if (!unitPrice) {
    throw new HttpsError(
      "failed-precondition",
      `No price set for ${SERVICE_LABELS[serviceType]}. The recovery agent must set rates first.`
    );
  }

  const previousReading = await lastReadingFor(roomId, serviceType, room);
  let reading = Number(currentReading);
  let units;

  if (serviceType === "rent") {
    reading = previousReading;
    units = 1;
  } else {
    if (!Number.isFinite(reading) || reading < 0) {
      throw new HttpsError("invalid-argument", "Reading must be a number of zero or more");
    }
    // A reading that goes backwards means a misread or a replaced meter.
    // Billing it silently as zero would bury a mistake the technician has to
    // see and fix on the spot.
    if (reading < previousReading) {
      throw new HttpsError(
        "invalid-argument",
        `New reading ${reading} is lower than the last one ${previousReading}. Check the meter.`
      );
    }
    units = reading - previousReading;
  }

  const now = new Date().toISOString();
  const id = `bill-${roomId}-${serviceType}-${Date.now()}`;

  const bill = {
    id,
    roomId,
    roomNumber: room.roomNumber,
    tenantName: room.tenantName,
    tenantPhone: room.tenantPhone || "",
    serviceType,
    previousReading,
    currentReading: reading,
    unitsUsed: units,
    unitPrice,
    amountDue: Math.round(units * unitPrice),
    amountPaid: 0,
    status: "unpaid",
    issuedAt: now,
    dueDate: addDays(now, PAYMENT_WINDOW_DAYS),
    secondReminderAt: addDays(now, SECOND_REMINDER_DAY),
    readingBy: normalizeEmail(request.auth.token.email),
    note: note ? String(note).trim() : "",
    createdAt: now,
  };

  await db.doc(`bills/${id}`).set(bill);
  return { ok: true, billId: id, amountDue: bill.amountDue, unitsUsed: units };
});

// ---------------------------------------------------------------------------
// Client: claim a room, send proof, ask questions
// ---------------------------------------------------------------------------

exports.claimRoom = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  const uid = request.auth.uid;
  const { roomNumber, tenantPhone, password } = request.data || {};

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
  const found = await db.collection("rooms").where("roomKey", "==", roomKey).limit(1).get();

  // Clients no longer create their own rooms -- a technician registers them
  // with a starting meter reading, without which nothing can be billed.
  if (found.empty) {
    return { ok: false, reason: "not_registered" };
  }

  const roomRef = found.docs[0].ref;
  const room = found.docs[0].data();
  const secretRef = db.doc(`roomSecrets/${roomRef.id}`);
  const now = new Date().toISOString();

  // The phone the technician wrote down is the client's identity here.
  if (normalizePhone(room.tenantPhone) !== normalizePhone(tenantPhone)) {
    return { ok: false, reason: "wrong_credentials" };
  }

  return db.runTransaction(async (tx) => {
    const secretSnap = await tx.get(secretRef);

    // First time in: the phone matched, so let them set their password.
    if (!secretSnap.exists) {
      tx.set(secretRef, buildSecret(password));
      tx.update(roomRef, { tenantUid: uid, updatedAt: now });
      return { ok: true, roomId: roomRef.id, firstTime: true };
    }

    if (!passwordMatches(password, secretSnap.data())) {
      return { ok: false, reason: "wrong_credentials" };
    }

    // Right phone and password: hand the room to whatever device they are on.
    tx.update(roomRef, { tenantUid: uid, updatedAt: now });
    return { ok: true, roomId: roomRef.id };
  });
});

exports.setRoomPassword = onCall(async (request) => {
  await requireRole(request.auth, "admin", "recovery", "technician");
  const { roomId, password } = request.data || {};
  if (!roomId) throw new HttpsError("invalid-argument", "roomId required");
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  if (!(await db.doc(`rooms/${roomId}`).get()).exists) {
    throw new HttpsError("not-found", "Room not found");
  }
  await db.doc(`roomSecrets/${roomId}`).set(buildSecret(password));
  return { ok: true };
});

exports.submitProof = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  const { billId, amountReported, proofPath, proofNote } = request.data || {};
  if (!billId) throw new HttpsError("invalid-argument", "billId required");

  const billRef = db.doc(`bills/${billId}`);
  const billSnap = await billRef.get();
  if (!billSnap.exists) throw new HttpsError("not-found", "Bill not found");
  const bill = billSnap.data();

  const roomSnap = await db.doc(`rooms/${bill.roomId}`).get();
  const staff = await staffRoleOf(request.auth);
  // A client may only send proof against their own room's bill.
  if (!staff && (!roomSnap.exists || roomSnap.data().tenantUid !== request.auth.uid)) {
    throw new HttpsError("permission-denied", "This is not your bill");
  }

  const amount = Number(amountReported);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpsError("invalid-argument", "Enter the amount you paid");
  }

  const now = new Date().toISOString();
  await billRef.update({
    status: "awaiting_review",
    proofPath: proofPath || FieldValue.delete(),
    proofExpiresAt: proofPath ? addDays(now, PROOF_LIFETIME_DAYS) : FieldValue.delete(),
    proofDeleted: false,
    proofSubmittedAt: now,
    proofNote: proofNote ? String(proofNote).trim() : "",
    amountReported: amount,
    updatedAt: now,
  });

  await notifyStaff({
    id: `proof-${billId}`,
    type: "proof_submitted",
    audience: "recovery",
    severity: "info",
    title: `Room ${bill.roomNumber} sent payment proof`,
    body: `${bill.tenantName} reports ${amount} RWF for ${SERVICE_LABELS[bill.serviceType]}.`,
    roomId: bill.roomId,
    roomNumber: bill.roomNumber,
    billId,
  });

  return { ok: true };
});

exports.postMessage = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  const { roomId, text } = request.data || {};
  if (!roomId || !text || !String(text).trim()) {
    throw new HttpsError("invalid-argument", "Message cannot be empty");
  }

  const roomSnap = await db.doc(`rooms/${roomId}`).get();
  if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found");
  const room = roomSnap.data();

  const staffRole = await staffRoleOf(request.auth);
  if (!staffRole && room.tenantUid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "This is not your room");
  }

  const now = new Date().toISOString();
  const id = `msg-${roomId}-${Date.now()}`;
  const fromClient = !staffRole;

  await db.doc(`messages/${id}`).set({
    id,
    roomId,
    roomNumber: room.roomNumber,
    tenantName: room.tenantName,
    text: String(text).trim().slice(0, 2000),
    authorRole: staffRole || "client",
    authorLabel: staffRole ? normalizeEmail(request.auth.token.email) : room.tenantName,
    readByStaff: !fromClient,
    readByClient: fromClient,
    createdAt: now,
  });

  if (fromClient) {
    await notifyStaff({
      id: `question-${id}`,
      type: "question_asked",
      audience: "recovery",
      severity: "info",
      title: `Room ${room.roomNumber} asked a question`,
      body: String(text).trim().slice(0, 160),
      roomId,
      roomNumber: room.roomNumber,
    });
  }

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Recovery: review, mark paid, download proof
// ---------------------------------------------------------------------------

exports.reviewBill = onCall(async (request) => {
  await requireRole(request.auth, "recovery", "admin");
  const { billId, status, amountPaid, recoveryNote } = request.data || {};
  if (!billId) throw new HttpsError("invalid-argument", "billId required");
  if (!["unpaid", "awaiting_review", "partial", "paid"].includes(status)) {
    throw new HttpsError("invalid-argument", "Unknown status");
  }

  const paid = Number(amountPaid);
  if (!Number.isFinite(paid) || paid < 0) {
    throw new HttpsError("invalid-argument", "Amount paid must be zero or more");
  }

  await db.doc(`bills/${billId}`).update({
    status,
    amountPaid: paid,
    recoveryNote: recoveryNote ? String(recoveryNote).trim() : "",
    reviewedBy: normalizeEmail(request.auth.token.email),
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
});

// Recovery downloading a proof is what makes the 7-day deletion safe: the
// image goes, their copy stays.
exports.markProofDownloaded = onCall(async (request) => {
  await requireRole(request.auth, "recovery", "admin");
  const { billId } = request.data || {};
  if (!billId) throw new HttpsError("invalid-argument", "billId required");
  await db.doc(`bills/${billId}`).update({
    proofDownloadedAt: new Date().toISOString(),
  });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Admin: edit anything
// ---------------------------------------------------------------------------

exports.deleteRoom = onCall(async (request) => {
  await requireRole(request.auth, "admin");
  const { roomId } = request.data || {};
  if (!roomId) throw new HttpsError("invalid-argument", "roomId required");

  const bucket = getStorage().bucket();
  const [bills, messages, notifications] = await Promise.all([
    db.collection("bills").where("roomId", "==", roomId).get(),
    db.collection("messages").where("roomId", "==", roomId).get(),
    db.collection("notifications").where("roomId", "==", roomId).get(),
  ]);

  for (const docSnap of bills.docs) {
    const path = docSnap.data().proofPath;
    if (path) {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
      } catch (e) {
        console.error(`Could not delete ${path}`, e);
      }
    }
  }

  const refs = [
    ...bills.docs.map((d) => d.ref),
    ...messages.docs.map((d) => d.ref),
    ...notifications.docs.map((d) => d.ref),
    db.doc(`roomSecrets/${roomId}`),
    db.doc(`rooms/${roomId}`),
  ];
  // Batches cap at 500 writes, so chunk rather than assume a small room.
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return { ok: true, deletedBills: bills.size, deletedMessages: messages.size };
});

// ---------------------------------------------------------------------------
// Notifications: in-app for staff, SMS for clients
// ---------------------------------------------------------------------------

async function notifyStaff({ id, type, audience, severity, title, body, roomId, roomNumber, billId }) {
  const ref = db.doc(`notifications/${id}`);
  if ((await ref.get()).exists) return false;

  await ref.set({
    id,
    type,
    audience,
    severity: severity || "info",
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
    ...(roomId ? { roomId } : {}),
    ...(roomNumber ? { roomNumber } : {}),
    ...(billId ? { billId } : {}),
  });

  const tokensSnap = await db.collection("deviceTokens").get();
  const tokens = tokensSnap.docs
    .filter((d) => {
      const role = d.data().role;
      if (audience === "all_staff") return ["admin", "recovery", "technician"].includes(role);
      if (audience === "admin") return role === "admin";
      return role === "recovery" || role === "admin";
    })
    .map((d) => d.data().token)
    .filter(Boolean);

  if (tokens.length > 0) {
    try {
      await messaging.sendEachForMulticast({ notification: { title, body }, tokens });
    } catch (e) {
      console.error("Push failed", e);
    }
  }
  return true;
}

// --- SMS Connect (https://smsconnect.tech) -------------------------------
// Every message is billed 10 RWF from a prepaid wallet, and the provider
// appends its own 48-character brand link inside the same 160-character SMS.
// Both facts shape the code below: bodies are capped so the brand link cannot
// push a message into a second SMS, and a drained wallet raises an alert
// rather than letting reminders fail in silence.
// The dashboard documents /api/... while the older docs page documents
// /api/v1/... . Rather than bet on one, the first path that answers is
// remembered and reused, and smsDiagnostics reports which it was.
const SMS_BASE_CANDIDATES = (process.env.MIC_SMS_BASE_URL
  ? [process.env.MIC_SMS_BASE_URL]
  : ["https://smsconnect.tech/api", "https://smsconnect.tech/api/v1"]);

const SMS_SENDER_ID = process.env.MIC_SENDER_ID || "MICTOWER";

// 160 total, minus "\n\nPowered by SMSConnect: https://smsconnect.tech".
const SMS_BODY_LIMIT = 112;

// At 10 RWF a message this is 50 messages of warning, which is enough time to
// top up before clients stop hearing from us.
const LOW_BALANCE_RWF = 500;

// The API accepts 2507XXXXXXXX or 07XXXXXXXX. Our stored phones are typed
// every which way (+250..., 07..., spaces), so normalise to the 250 form.
function toSmsRecipient(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.length > 9 ? digits.slice(-9) : digits;
  if (local.length !== 9) return "";
  return `250${local}`;
}

function capSmsBody(text) {
  const clean = String(text || "").trim();
  if (clean.length <= SMS_BODY_LIMIT) return clean;
  return `${clean.slice(0, SMS_BODY_LIMIT - 1).trimEnd()}\u2026`;
}

function smsHeaders() {
  const apiKey = MIC_API_KEY.value() || process.env.MIC_API_KEY || "";
  const apiSecret = process.env.MIC_API_SECRET || "";
  const headers = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // Only meaningful for the account-level key/secret pair; a dashboard key
  // authenticates on X-API-Key alone.
  if (apiSecret) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-SECRET"] = apiSecret;
  }
  return { headers, apiKey };
}

// Remembered for the life of the instance so we stop probing once something
// answers.
let workingSmsBase = null;

async function smsFetch(path, options) {
  const bases = workingSmsBase ? [workingSmsBase] : SMS_BASE_CANDIDATES;
  let lastError = null;

  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, options);
      // A 404 means this base is not where the API lives; anything else is a
      // real answer, including a 401 or a 400 we must surface.
      if (res.status === 404 && bases.length > 1) {
        lastError = new Error(`404 at ${base}${path}`);
        continue;
      }
      workingSmsBase = base;
      return res;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("No SMS endpoint answered");
}

async function sendSms(phone, text, context) {
  const recipient = toSmsRecipient(phone);
  const message = capSmsBody(text);
  const { headers, apiKey } = smsHeaders();

  const record = {
    to: recipient || String(phone || ""),
    text: message,
    context: context || "",
    sentAt: new Date().toISOString(),
  };

  if (!recipient) {
    await db.collection("smsLog").add({
      ...record,
      status: "skipped",
      error: "phone number is not a usable Rwandan number",
    });
    return false;
  }
  if (!apiKey) {
    await db.collection("smsLog").add({
      ...record,
      status: "not_configured",
      error: "MIC_API_KEY is not set",
    });
    console.warn(`SMS not sent (no API key): ${recipient}`);
    return false;
  }

  try {
    const res = await smsFetch("/sms/send", {
      method: "POST",
      headers,
      body: JSON.stringify({ recipient, message, sender_id: SMS_SENDER_ID }),
    });

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    const ok = res.ok && payload && payload.success;
    const data = (payload && payload.data) || {};

    await db.collection("smsLog").add({
      ...record,
      status: ok ? "sent" : "failed",
      httpStatus: res.status,
      messageId: data.message_id ?? null,
      cost: data.cost ?? null,
      balance: data.balance ?? null,
      error: ok ? null : (payload && payload.message) || `HTTP ${res.status}`,
    });

    if (ok && typeof data.balance === "number") {
      await db.doc("health/sms").set(
        { balance: data.balance, checkedAt: new Date().toISOString() },
        { merge: true }
      );
      if (data.balance <= LOW_BALANCE_RWF) {
        await notifyStaff({
          id: `sms-balance-${new Date().toISOString().slice(0, 10)}`,
          type: "system_alert",
          audience: "recovery",
          severity: "critical",
          title: "SMS wallet almost empty",
          body:
            `${data.balance} RWF left at 10 RWF per message. ` +
            `Top up at smsconnect.tech or clients stop getting reminders.`,
        });
      }
    }

    // A rejected send is the failure nobody sees: the client simply never
    // hears from us, and the 5 day clock runs anyway.
    if (!ok) {
      const reason = (payload && payload.message) || `HTTP ${res.status}`;
      console.error(`SMS failed for ${recipient}: ${reason}`);
      await notifyStaff({
        id: `sms-fail-${new Date().toISOString().slice(0, 13)}`,
        type: "system_alert",
        audience: "recovery",
        severity: "warning",
        title: "SMS sending is failing",
        body: `${reason}. Clients are not receiving their reminders.`,
      });
    }

    return !!ok;
  } catch (e) {
    await db.collection("smsLog").add({ ...record, status: "failed", error: String(e) });
    console.error("SMS send failed", e);
    return false;
  }
}

// Reads the wallet directly rather than waiting for a send to report it, so
// an empty balance is caught before a reminder silently fails.
async function readSmsBalance() {
  const { headers, apiKey } = smsHeaders();
  if (!apiKey) return null;
  try {
    const res = await smsFetch("/wallet/balance", { method: "GET", headers });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload) return null;
    const data = payload.data || payload;
    const balance = Number(data.balance ?? data.wallet_balance);
    return Number.isFinite(balance) ? balance : null;
  } catch (e) {
    console.error("Could not read SMS balance", e);
    return null;
  }
}

// Sends one real message and reports exactly what came back: which base URL
// answered, the HTTP status, and the provider's own message. The provider's
// dashboard and its docs page disagree about the path and the auth headers,
// so this settles it with evidence instead of a guess.
exports.smsDiagnostics = onCall(
  { secrets: [MIC_API_KEY] },
  async (request) => {
    await requireRole(request.auth, "admin", "recovery");
    const { phone } = request.data || {};
    const recipient = toSmsRecipient(phone);
    if (!recipient) {
      throw new HttpsError("invalid-argument", "Enter a Rwandan phone number to test with");
    }

    const { headers, apiKey } = smsHeaders();
    const attempts = [];

    if (!apiKey) {
      return {
        ok: false,
        recipient,
        attempts,
        summary: "MIC_API_KEY is not set. Run: firebase functions:secrets:set MIC_API_KEY",
      };
    }

    // Probe every candidate so the result shows which one works, even when
    // the first already succeeds.
    for (const base of SMS_BASE_CANDIDATES) {
      try {
        const res = await fetch(`${base}/sms/send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            recipient,
            message: "MIC Tower test message. If you got this, SMS is working.",
            sender_id: SMS_SENDER_ID,
          }),
        });
        const payload = await res.json().catch(() => null);
        attempts.push({
          base,
          httpStatus: res.status,
          ok: !!(res.ok && payload && payload.success),
          providerMessage: (payload && payload.message) || null,
          balance: (payload && payload.data && payload.data.balance) ?? null,
        });
        if (res.ok && payload && payload.success) {
          workingSmsBase = base;
          break;
        }
      } catch (e) {
        attempts.push({ base, httpStatus: null, ok: false, providerMessage: String(e) });
      }
    }

    const winner = attempts.find((a) => a.ok);
    const balance = await readSmsBalance();

    return {
      ok: !!winner,
      recipient,
      usingSecret: !!process.env.MIC_API_SECRET,
      workingBase: winner ? winner.base : null,
      balance,
      attempts,
      summary: winner
        ? `Sent via ${winner.base}. Check the phone.`
        : `No endpoint accepted the message. ${attempts.map((a) => `${a.base}: ${a.httpStatus ?? "no response"} ${a.providerMessage ?? ""}`).join(" | ")}`,
    };
  }
);

// Reminder 1 of 2: fires the moment the technician's reading becomes a bill.
exports.onBillCreated = onDocumentCreated(
  { document: "bills/{billId}", secrets: [MIC_API_KEY] },
  async (event) => {
    const bill = event.data ? event.data.data() : null;
    if (!bill) return;

    const label = SERVICE_LABELS[bill.serviceType] || bill.serviceType;
    const due = new Date(bill.dueDate).toISOString().slice(0, 10);
    const text =
      `Room ${bill.roomNumber}: ${label} bill ${bill.amountDue} RWF ` +
      `(${bill.unitsUsed} units). Pay by ${due}.`;

    await sendSms(bill.tenantPhone, text, `bill_issued:${bill.id}`);
    await db.doc(`bills/${bill.id}`).update({ firstReminderSentAt: new Date().toISOString() });

    await notifyStaff({
      id: `bill-${bill.id}`,
      type: "bill_issued",
      audience: "all_staff",
      severity: "info",
      title: `Room ${bill.roomNumber}: ${label} bill raised`,
      body: `${bill.amountDue} RWF due by ${due}.`,
      roomId: bill.roomId,
      roomNumber: bill.roomNumber,
      billId: bill.id,
    });
  }
);

// Reminder 2 of 2 on day 3, then the overdue sweep once the 5 days are up.
exports.dailyBillingSweep = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Africa/Kigali",
    maxInstances: 1,
    timeoutSeconds: 300,
    retryCount: 0,
    secrets: [MIC_API_KEY],
  },
  async () => {
    const nowIso = new Date().toISOString();

    // --- second reminder ---
    const dueForReminder = await db
      .collection("bills")
      .where("status", "in", ["unpaid", "partial"])
      .where("secondReminderAt", "<=", nowIso)
      .limit(200)
      .get();

    let reminded = 0;
    for (const docSnap of dueForReminder.docs) {
      const bill = docSnap.data();
      if (bill.secondReminderSentAt) continue;
      const label = SERVICE_LABELS[bill.serviceType] || bill.serviceType;
      const due = new Date(bill.dueDate).toISOString().slice(0, 10);
      const owed = Math.max(0, (bill.amountDue || 0) - (bill.amountPaid || 0));
      await sendSms(
        bill.tenantPhone,
        `Reminder: Room ${bill.roomNumber} ${label} ${owed} RWF is due by ${due}.`,
        `reminder:${bill.id}`
      );
      await docSnap.ref.update({ secondReminderSentAt: new Date().toISOString() });
      reminded++;
    }

    // --- overdue ---
    const overdue = await db
      .collection("bills")
      .where("status", "in", ["unpaid", "partial", "awaiting_review"])
      .where("dueDate", "<", nowIso)
      .limit(200)
      .get();

    if (!overdue.empty) {
      const total = overdue.docs.reduce(
        (sum, d) => sum + Math.max(0, (d.data().amountDue || 0) - (d.data().amountPaid || 0)),
        0
      );
      await notifyStaff({
        id: `overdue-${nowIso.slice(0, 10)}`,
        type: "overdue",
        audience: "recovery",
        severity: "warning",
        title: `${overdue.size} bill${overdue.size === 1 ? "" : "s"} past the 5 day limit`,
        body: `${total} RWF still outstanding. Open the Overdue tab to chase them.`,
      });
    }

    console.log(`Sweep: ${reminded} reminders, ${overdue.size} overdue`);
  }
);

// ---------------------------------------------------------------------------
// Retention: proofs live 7 days
// ---------------------------------------------------------------------------

async function deleteExpiredProofs() {
  const nowIso = new Date().toISOString();
  const snap = await db
    .collection("bills")
    .where("proofExpiresAt", "<=", nowIso)
    .limit(400)
    .get();

  const bucket = getStorage().bucket();
  let deleted = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.proofDeleted || !data.proofPath) continue;
    try {
      await bucket.file(data.proofPath).delete({ ignoreNotFound: true });
    } catch (e) {
      console.error(`Failed to delete ${data.proofPath}`, e);
      continue;
    }
    // The image goes; what was paid, when, and who approved it stays.
    await docSnap.ref.update({
      proofDeleted: true,
      proofPath: FieldValue.delete(),
      proofExpiresAt: FieldValue.delete(),
    });
    deleted++;
  }
  return { deleted };
}

exports.cleanupExpiredProofs = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Africa/Kigali",
    maxInstances: 1,
    timeoutSeconds: 300,
    retryCount: 0,
  },
  async () => {
    const { deleted } = await deleteExpiredProofs();
    console.log(`Deleted ${deleted} expired proofs`);
  }
);

exports.cleanupProofsNow = onCall(async (request) => {
  await requireRole(request.auth, "admin", "recovery");
  return deleteExpiredProofs();
});

// Warns recovery a day before proofs vanish, so anything not yet downloaded
// can be saved while it still exists.
exports.warnBeforeProofDeletion = onSchedule(
  { schedule: "0 7 * * *", timeZone: "Africa/Kigali", maxInstances: 1, retryCount: 0 },
  async () => {
    const cutoff = addDays(new Date().toISOString(), 1);
    const snap = await db
      .collection("bills")
      .where("proofExpiresAt", "<=", cutoff)
      .limit(200)
      .get();

    const undownloaded = snap.docs.filter(
      (d) => d.data().proofPath && !d.data().proofDownloadedAt && !d.data().proofDeleted
    );
    if (undownloaded.length === 0) return;

    await notifyStaff({
      id: `proof-expiry-${new Date().toISOString().slice(0, 10)}`,
      type: "system_alert",
      audience: "recovery",
      severity: "warning",
      title: `${undownloaded.length} payment photo${undownloaded.length === 1 ? "" : "s"} delete tomorrow`,
      body: "Download them from the Bills tab today or they are gone. The payment record stays either way.",
    });
  }
);

// ---------------------------------------------------------------------------
// Watchdog: is the app healthy, and is it costing money?
// ---------------------------------------------------------------------------

const FREE_TIER_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;
const WARN_AT = 0.8;

async function measureUsage() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ maxResults: 5000 });
  const storageBytes = files.reduce(
    (total, f) => total + Number((f.metadata && f.metadata.size) || 0),
    0
  );
  const [bills, rooms] = await Promise.all([
    db.collection("bills").count().get(),
    db.collection("rooms").count().get(),
  ]);
  return {
    storageBytes,
    photoCount: files.length,
    billCount: bills.data().count,
    roomCount: rooms.data().count,
    storageRatio: storageBytes / FREE_TIER_STORAGE_BYTES,
  };
}

async function runHealthCheck() {
  const notes = [];
  let ok = true;
  const checkedAt = new Date().toISOString();

  // 1. Is billing still attached? If the kill switch fired, the project is
  //    dead and somebody needs to know why.
  let billingEnabled = true;
  try {
    const billing = new CloudBillingClient();
    const [info] = await billing.getProjectBillingInfo({
      name: `projects/${process.env.GCLOUD_PROJECT}`,
    });
    billingEnabled = !!info.billingEnabled;
    if (!billingEnabled) {
      ok = false;
      notes.push("Billing is DISABLED. The kill switch fired and the app is down.");
    }
  } catch (e) {
    notes.push(`Could not read billing state: ${e.message || e}`);
  }

  // 2. Free tier headroom.
  let usage = null;
  try {
    usage = await measureUsage();
    if (usage.storageRatio >= WARN_AT) {
      ok = false;
      notes.push(
        `Photo storage at ${(usage.storageRatio * 100).toFixed(0)}% of the free 5 GB.`
      );
    }
  } catch (e) {
    notes.push(`Could not measure storage: ${e.message || e}`);
  }

  // 3. Can we actually read and write Firestore right now? This is the check
  //    that catches "the app looks up but nothing works".
  try {
    await db.doc("health/heartbeat").set({ at: checkedAt });
    const back = await db.doc("health/heartbeat").get();
    if (!back.exists) {
      ok = false;
      notes.push("Firestore write succeeded but read came back empty.");
    }
  } catch (e) {
    ok = false;
    notes.push(`Firestore is not answering: ${e.message || e}`);
  }

  // 4. The SMS wallet. Reminders are prepaid, so an empty wallet stops them
  //    dead while the 5 day clock keeps running.
  let smsBalance = null;
  try {
    smsBalance = await readSmsBalance();
    if (smsBalance !== null && smsBalance <= LOW_BALANCE_RWF) {
      ok = false;
      notes.push(
        `SMS wallet down to ${smsBalance} RWF (about ${Math.floor(smsBalance / 10)} messages).`
      );
    }
  } catch (e) {
    notes.push(`Could not read the SMS wallet: ${e.message || e}`);
  }

  // 5. Bills that never got their first SMS -- the sign the SMS provider or
  //    the trigger is broken, which clients would feel as silence.
  let smsFailures = 0;
  try {
    const recent = await db
      .collection("smsLog")
      .where("sentAt", ">=", addDays(checkedAt, -1))
      .limit(200)
      .get();
    smsFailures = recent.docs.filter((d) =>
      ["failed", "not_configured"].includes(d.data().status)
    ).length;
    if (smsFailures > 0) {
      ok = false;
      notes.push(`${smsFailures} SMS failed or were not configured in the last 24h.`);
    }
  } catch (e) {
    notes.push(`Could not read the SMS log: ${e.message || e}`);
  }

  const report = {
    checkedAt,
    ok,
    billingEnabled,
    storageBytes: usage ? usage.storageBytes : 0,
    storageRatio: usage ? usage.storageRatio : 0,
    billCount: usage ? usage.billCount : 0,
    roomCount: usage ? usage.roomCount : 0,
    smsFailures,
    smsBalance,
    notes,
  };

  await db.doc("health/latest").set(report);

  if (!ok) {
    await notifyStaff({
      id: `health-${checkedAt.slice(0, 13)}`,
      type: "system_alert",
      audience: "recovery",
      severity: "critical",
      title: "System check failed",
      body: notes.join(" "),
    });
  }

  return report;
}

exports.watchdog = onSchedule(
  {
    schedule: "0 */6 * * *",
    timeZone: "Africa/Kigali",
    maxInstances: 1,
    retryCount: 0,
    secrets: [MIC_API_KEY],
  },
  async () => {
    const report = await runHealthCheck();
    console.log(`Health: ${report.ok ? "OK" : "PROBLEM"} ${report.notes.join(" | ")}`);
  }
);

exports.runHealthCheckNow = onCall(
  { secrets: [MIC_API_KEY] },
  async (request) => {
    await requireRole(request.auth, "admin", "recovery");
    return runHealthCheck();
  }
);

// ---------------------------------------------------------------------------
// Billing kill switch
// ---------------------------------------------------------------------------
// A Cloud Billing budget publishes spend to this topic; passing the budget
// detaches the billing account. A hard stop, not a throttle: the project goes
// dead and stays dead until a human re-attaches billing by hand.

const BUDGET_TOPIC = "billing-kill-switch";

exports.stopBillingWhenBudgetExceeded = onMessagePublished(
  { topic: BUDGET_TOPIC, maxInstances: 1, retryCount: 0 },
  async (event) => {
    const notice = event.data.message.json || {};
    const spend = Number(notice.costAmount || 0);
    const budget = Number(notice.budgetAmount || 0);

    if (!budget || spend <= budget) {
      console.log(`Spend ${spend} of ${budget} -- under budget, billing left on.`);
      return;
    }

    const projectName = `projects/${process.env.GCLOUD_PROJECT}`;
    const billing = new CloudBillingClient();
    const [info] = await billing.getProjectBillingInfo({ name: projectName });
    if (!info.billingEnabled) return;

    await billing.updateProjectBillingInfo({
      name: projectName,
      projectBillingInfo: { billingAccountName: "" },
    });

    console.warn(`BILLING DISABLED: spend ${spend} passed budget ${budget}.`);
  }
);
