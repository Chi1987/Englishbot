const admin = require("./firebaseAdmin");
const { saveSession } = require("./session");

/**
 * スコア保存とセッション更新をアトミックに実行
 * @param {string} userId - ユーザーID
 * @param {object} scoreData - スコアデータ
 * @param {string} yyyyMMdd - 日付文字列
 * @param {object} sessionData - セッションデータ
 */
async function saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, sessionData) {
  const db = admin.firestore();
  
  try {
    await db.runTransaction(async (transaction) => {
      // スコア参照とセッション参照
      const scoreRef = db.doc(`scores/${userId}/daily/${yyyyMMdd}`);
      const sessionRef = db.doc(`sessions/${userId}`);
      
      // 現在のデータを取得
      const currentSession = await transaction.get(sessionRef);
      const currentScore = await transaction.get(scoreRef);
      
      // スコアデータをマージ
      const existingScoreData = currentScore.exists ? currentScore.data() : {};
      const mergedScoreData = {
        ...existingScoreData,
        ...scoreData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // セッションデータをマージ
      const existingSessionData = currentSession.exists ? currentSession.data() : {};
      const mergedSessionData = {
        ...existingSessionData,
        ...sessionData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        version: (existingSessionData.version || 0) + 1
      };
      
      // アトミックに更新
      transaction.set(scoreRef, mergedScoreData);
      transaction.set(sessionRef, mergedSessionData);
    });
    
    console.log("✅ Score and session updated atomically");
  } catch (error) {
    console.error("❌ Atomic update failed:", error);
    
    // フォールバック: 非アトミック更新
    console.log("🔄 Falling back to non-atomic updates");
    try {
      const scoreRef = db.doc(`scores/${userId}/daily/${yyyyMMdd}`);
      await scoreRef.set(scoreData, { merge: true });
      await saveSession(userId, sessionData);
    } catch (fallbackError) {
      console.error("❌ Fallback update also failed:", fallbackError);
      throw fallbackError;
    }
  }
}

module.exports = saveScoreAndUpdateSession;