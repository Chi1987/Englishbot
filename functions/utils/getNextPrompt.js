const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function getNextPrompt(userId) {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};

  const currentIndex = userData.currentPrompt || 1;
  const docId = String(currentIndex).padStart(3, "0"); // ← 001, 002... に対応！

  const promptDoc = await db.collection("prompts").doc(docId).get();

  if (!promptDoc.exists) {
    return { text: "お題が見つかりませんでした。", nextIndex: currentIndex };
  }

  const promptText = promptDoc.data().prompt;

  await userRef.set({ currentPrompt: currentIndex + 1 }, { merge: true });

  return { text: promptText, nextIndex: currentIndex + 1 };
}

module.exports = { getNextPrompt };
