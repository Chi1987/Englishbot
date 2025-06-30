const admin = require("./firebaseAdmin");

const db = admin.firestore();

/**
 * Firestore からセッションを取得
 * @param {string} userId - LINEユーザーID
 * @returns {Promise<object>} セッションデータ（なければ空オブジェクト）
 */
async function getSession(userId) {
  const doc = await db.collection("sessions").doc(userId).get();
  return doc.exists ? doc.data() : {};
}

/**
 * セッションを Firestore に保存（マージ）
 * @param {string} userId - LINEユーザーID
 * @param {object} sessionData - 保存するセッション内容
 */
async function saveSession(userId, sessionData) {
  await db.collection("sessions").doc(userId).set(sessionData, { merge: true });
}

/**
 * セッションを安全に更新（トランザクション使用）
 * 競合状態を防ぐため、複数のリクエストが同時に実行されても安全
 * @param {string} userId - LINEユーザーID
 * @param {function} updateFunction - セッションデータを更新する関数
 * @returns {Promise<object>} 更新後のセッションデータ
 */
async function updateSessionSafely(userId, updateFunction) {
  const sessionRef = db.collection("sessions").doc(userId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(sessionRef);
      const currentSession = doc.exists ? doc.data() : {};
      
      // 更新関数を実行
      const updatedSession = updateFunction(currentSession);
      
      // 更新されたセッションにタイムスタンプを追加
      const sessionWithTimestamp = {
        ...updatedSession,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        version: (currentSession.version || 0) + 1
      };
      
      transaction.set(sessionRef, sessionWithTimestamp);
      return sessionWithTimestamp;
    });
  } catch (error) {
    console.error("❌ Session transaction failed:", error);
    
    // トランザクションが失敗した場合は従来の方法にフォールバック
    console.log("🔄 Falling back to non-transactional update");
    const currentSession = await getSession(userId);
    const updatedSession = updateFunction(currentSession);
    await saveSession(userId, updatedSession);
    return updatedSession;
  }
}

/**
 * セッション更新のヘルパー関数群
 */
const sessionUpdaters = {
  /**
   * ステップを更新
   */
  updateStep: (newStep, additionalData = {}) => (session) => ({
    ...session,
    currentStep: newStep,
    ...additionalData
  }),
  
  /**
   * 日本語入力を追加
   */
  addJapaneseInput: (input) => (session) => ({
    ...session,
    japaneseInput: [...(session.japaneseInput || []), input]
  }),
  
  /**
   * 翻訳された単語を追加
   */
  addTranslatedWord: (word) => (session) => ({
    ...session,
    translatedWords: [...(session.translatedWords || []), word]
  }),
  
  /**
   * セグメントインデックスを更新
   */
  updateSegmentIndex: (index, sentence) => (session) => ({
    ...session,
    currentSegmentIndex: index,
    currentSentence: sentence
  })
};

/**
 * セッションを Firestore から削除
 * @param {string} userId - LINEユーザーID
 */
async function deleteSession(userId) {
  await db.collection("sessions").doc(userId).delete();
}

module.exports = { 
  getSession, 
  saveSession, 
  deleteSession, 
  updateSessionSafely, 
  sessionUpdaters 
};
