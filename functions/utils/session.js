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
 * セッションを Firestore から削除
 * @param {string} userId - LINEユーザーID
 */
async function deleteSession(userId) {
  await db.collection("sessions").doc(userId).delete();
}

module.exports = { getSession, saveSession, deleteSession };
