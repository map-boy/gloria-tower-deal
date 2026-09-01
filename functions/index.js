const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

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

  const message = {
    notification: {
      title: "Payment Logged",
      body: `Room ${roomNumber}: ${after.unitsUsed} kWh, $${after.amountPaid} paid.`,
    },
    tokens: allTokens,
  };

  try {
    await messaging.sendEachForMulticast(message);
  } catch (e) {
    console.error("Failed to send notification", e);
  }
});
