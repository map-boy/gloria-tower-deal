const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const IREMBO_WEBHOOK_SECRET = defineSecret("IREMBO_WEBHOOK_SECRET");
const IREMBO_API_KEY = defineSecret("IREMBO_API_KEY");

// --- Notification on payment recorded ---
exports.notifyOnPayment = onDocumentWritten("usageEntries/{entryId}", async (event) => {
  const after = event.data && event.data.after ? event.data.after.data() : null;
  if (!after) return;
  const before = event.data && event.data.before ? event.data.before.data() : null;
  const isNewPayment = !before || before.amountPaid !== after.amountPaid;
  if (!isNewPayment || !after.amountPaid || after.amountPaid <= 0) return;

  const buildingSnap = await db.doc("voltraTower/building").get();
  const rooms = buildingSnap.exists ? buildingSnap.data().rooms || [] : [];
  const room = rooms.find((r) => r.id === after.roomId);
  const roomNumber = room ? room.roomNumber : after.roomId;

  const tokensSnap = await db.collection("deviceTokens").get();
  const adminTokens = [];
  const tenantTokens = [];
  tokensSnap.forEach((docSnap) => {
    const t = docSnap.data();
    if (t.role === "admin") adminTokens.push(t.token);
    if (t.role === "tenant" && t.roomId === after.roomId) tenantTokens.push(t.token);
  });
  const allTokens = [...adminTokens, ...tenantTokens];
  if (allTokens.length === 0) return;

  try {
    await messaging.sendEachForMulticast({
      notification: {
        title: "Payment Logged",
        body: `Room ${roomNumber}: ${after.unitsUsed} kWh, ${after.amountPaid} paid.`,
      },
      tokens: allTokens,
    });
  } catch (e) {
    console.error("Failed to send notification", e);
  }
});

// --- Monthly invoice generation ---
async function generateInvoicesForMonth(year, month) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const buildingSnap = await db.doc("voltraTower/building").get();
  if (!buildingSnap.exists) return { created: 0 };
  const rooms = buildingSnap.data().rooms || [];
  const rateConfigs = buildingSnap.data().rateConfigs || [];

  const usageSnap = await db
    .collection("usageEntries")
    .where("date", ">=", `${yearMonth}-01`)
    .where("date", "<=", `${yearMonth}-31`)
    .get();

  // Sum usage-based units (electricity, water) per room, per utility type.
  const unitsByRoomAndUtility = { electricity: {}, water: {} };
  usageSnap.forEach((docSnap) => {
    const e = docSnap.data();
    const utilityType = e.utilityType || "electricity";
    if (utilityType !== "electricity" && utilityType !== "water") return;
    unitsByRoomAndUtility[utilityType][e.roomId] =
      (unitsByRoomAndUtility[utilityType][e.roomId] || 0) + (e.unitsUsed || 0);
  });

  function getRate(utilityType, room) {
    const buildingRate = (rateConfigs.find(
      (r) => r.scope === "building" && (r.utilityType || "electricity") === utilityType
    ) || {}).ratePerUnit ?? (utilityType === "electricity" ? 350 : undefined);
    const floorRate = (rateConfigs.find(
      (r) => r.scope === "floor" && r.floorNumber === room.floorNumber && (r.utilityType || "electricity") === utilityType
    ) || {}).ratePerUnit;
    return room.rateOverride ?? floorRate ?? buildingRate;
  }

  const UTILITY_CODES = { electricity: "ELEC", water: "WATR", rent: "RENT" };

  let created = 0;
  const batchPromises = [];

  for (const room of rooms) {
    if (!room.tenantId) continue;

    for (const utilityType of ["electricity", "water", "rent"]) {
      let units;
      if (utilityType === "rent") {
        // Rent is a fixed monthly charge, not usage-based.
        units = 1;
      } else {
        units = unitsByRoomAndUtility[utilityType][room.id] || 0;
        if (units <= 0) continue;
      }

      const rate = getRate(utilityType, room);
      if (!rate) continue; // no rate configured for this utility â€” skip instead of invoicing $0

      const amount = Math.round(units * rate * 100) / 100;

      const referenceCode = `VT-${room.roomNumber.replace(/\s+/g, "")}-${yearMonth}-${UTILITY_CODES[utilityType]}`.toUpperCase();
      const invoiceId = `invoice-${room.id}-${yearMonth}-${utilityType}`;

      const existing = await db.doc(`invoices/${invoiceId}`).get();
      if (existing.exists) continue;

      batchPromises.push(
        db.doc(`invoices/${invoiceId}`).set({
          roomId: room.id,
          roomNumber: room.roomNumber,
          month: yearMonth,
          utilityType,
          unitsUsed: units,
          amount,
          amountPaid: 0,
          referenceCode,
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
        })
      );
      created++;
    }
  }

  await Promise.all(batchPromises);
  return { created };
}

exports.generateMonthlyInvoices = onSchedule(
  { schedule: "0 2 1 * *", timeZone: "Africa/Kigali" },
  async () => {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const result = await generateInvoicesForMonth(prevYear, prevMonth);
    console.log(`Generated ${result.created} invoices for ${prevYear}-${prevMonth}`);
  }
);

exports.generateInvoicesNow = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Must be signed in");
  }
  const adminDoc = await db.doc(`admins/${request.auth.uid}`).get();
  if (!adminDoc.exists) {
    throw new Error("Admin only");
  }
  const { year, month } = request.data || {};
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || now.getMonth() + 1;
  return generateInvoicesForMonth(y, m);
});

// --- Irembo Pay: initiate push prompt ---
// PLACEHOLDER: replace the fetch() call below with the real Irembo Pay
// merchant API endpoint, auth scheme, and payload once credentials exist.
exports.initiateIremboPayment = onCall(
  { secrets: [IREMBO_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new Error("Must be signed in");
    }
    const { invoiceId, phoneNumber } = request.data || {};
    if (!invoiceId || !phoneNumber) {
      throw new Error("invoiceId and phoneNumber required");
    }

    const invoiceRef = db.doc(`invoices/${invoiceId}`);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
      throw new Error("Invoice not found");
    }
    const invoice = invoiceSnap.data();
    if (invoice.status === "paid") {
      throw new Error("Invoice already paid");
    }

    // PLACEHOLDER call Ã¢â‚¬â€ replace with real Irembo Pay API request.

    await invoiceRef.update({
      status: "push_initiated",
      pushInitiatedAt: FieldValue.serverTimestamp(),
      pushPhoneNumber: phoneNumber,
    });

    return { ok: true, message: "Payment prompt sent to phone (placeholder)" };
  }
);

// --- Irembo/BK payment webhook ---
// PLACEHOLDER: signature verification below is not real yet.
// Replace verifySignature() once real Irembo/BK merchant credentials
// and their actual signing scheme are available. Do NOT deploy to
// production before that is implemented.
function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret) return false;
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signatureHeader, "utf8")
    );
  } catch (e) {
    return false;
  }
}

exports.iremboPaymentWebhook = onRequest(
  { secrets: [IREMBO_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const signature = req.get("X-Irembo-Signature") || req.get("X-Signature") || "";
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);

    const isValid = verifySignature(rawBody, signature, IREMBO_WEBHOOK_SECRET.value());
    if (!isValid) {
      console.error("Rejected webhook: invalid or missing signature");
      res.status(401).send("Invalid signature");
      return;
    }

    const payload = req.body || {};
    const referenceCode = payload.referenceCode || payload.reference || null;
    const incomingAmount = Number(payload.amount);
    const status = payload.status;
    const transactionId = payload.transactionId || payload.transaction_id || null;

    if (!referenceCode || !incomingAmount || incomingAmount <= 0 || !transactionId) {
      res.status(400).send("Missing required fields");
      return;
    }

    if (status !== "SUCCESS" && status !== "COMPLETED") {
      console.log(`Ignoring non-success payment status: ${status}`);
      res.status(200).send("Ignored");
      return;
    }

    const invoiceSnap = await db
      .collection("invoices")
      .where("referenceCode", "==", referenceCode)
      .limit(1)
      .get();

    if (invoiceSnap.empty) {
      console.error(`No invoice found for reference code ${referenceCode}`);
      res.status(404).send("Invoice not found");
      return;
    }

    const invoiceDoc = invoiceSnap.docs[0];
    const invoice = invoiceDoc.data();

    const existingPaymentSnap = await db
      .collection("payments")
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();
    if (!existingPaymentSnap.empty) {
      console.log(`Duplicate webhook for transaction ${transactionId}, ignoring`);
      res.status(200).send("Already processed");
      return;
    }

    await db.collection("payments").add({
      invoiceId: invoiceDoc.id,
      provider: "irembo",
      transactionId,
      amount: incomingAmount,
      rawCallbackPayload: payload,
      receivedAt: FieldValue.serverTimestamp(),
    });

    const previousPaid = invoice.amountPaid || 0;
    const totalPaidNow = previousPaid + incomingAmount;
    const expectedAmount = invoice.amount || 0;
    const shortfall = Math.round((expectedAmount - totalPaidNow) * 100) / 100;

    let newStatus;
    if (shortfall <= 0.01) {
      newStatus = "paid";
    } else {
      newStatus = "partial";
    }

    await invoiceDoc.ref.update({
      status: newStatus,
      lastPaymentAt: FieldValue.serverTimestamp(),
      amountPaid: totalPaidNow,
      shortfall: Math.max(0, shortfall),
      underpaid: shortfall > 0.01,
    });

    if (newStatus === "partial") {
      const adminTokensSnap = await db.collection("deviceTokens").where("role", "==", "admin").get();
      const adminTokens = adminTokensSnap.docs.map((d) => d.data().token);
      if (adminTokens.length > 0) {
        try {
          await messaging.sendEachForMulticast({
            notification: {
              title: "Underpayment Detected",
              body: `Room ${invoice.roomNumber}: paid ${incomingAmount}, still owes ${shortfall}. Ref ${referenceCode}.`,
            },
            tokens: adminTokens,
          });
        } catch (e) {
          console.error("Failed to send underpayment alert", e);
        }
      }
    }

    if (invoice.roomId && invoice.month) {
      const utilityType = invoice.utilityType || "electricity";
      const entryId = `entry-${invoice.roomId}-${invoice.month}-${utilityType}-payment`;
      await db.doc(`usageEntries/${entryId}`).set(
        {
          id: entryId,
          roomId: invoice.roomId,
          date: invoice.month,
          utilityType,
          unitsUsed: invoice.unitsUsed || 0,
          amountPaid: totalPaidNow,
          note: newStatus === "partial"
            ? `Partial Irembo/BK payment, ref ${referenceCode}, still owes ${shortfall}`
            : `Verified Irembo/BK payment, ref ${referenceCode}`,
          createdBy: "system:irembo-webhook",
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    res.status(200).send("OK");
  }
);
