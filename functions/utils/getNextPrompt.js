const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * お題を取得
 * @param {string} userId
 * @param {number} [indexFromSession] - セッションで管理された次のお題インデックス
 */
async function getNextPrompt(userId) {
  const userRef = db.collection("sessions").doc(userId);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : {};

  // セッション側の値を優先、それがなければユーザーデータ、それもなければ1
  const currentIndex = userData.nextPromptIndex ?? null;
  if(currentIndex > 30){
    return { text: userData.topics, nextIndex:  currentIndex + 1};
  }else{
    const docId = String(currentIndex).padStart(3, "0");

    console.log("📘 getNextPrompt: loading prompt ID:", docId);

    const promptDoc = await db.collection("prompts").doc(docId).get();

    if (!promptDoc.exists || !promptDoc.data()?.prompt) {
      console.warn(`⚠️ prompt ${docId} not found or missing 'prompt' field`);
      return { text: "お題が見つかりませんでした。", nextIndex: currentIndex };
    }

    const promptText = promptDoc.data()?.prompt;

    return { text: promptText, nextIndex: currentIndex + 1 };
  }
  
}

module.exports = { getNextPrompt };
