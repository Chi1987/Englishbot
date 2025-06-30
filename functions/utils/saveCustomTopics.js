// utils/saveCustomTopics.js
const admin = require("firebase-admin");
const db = admin.firestore();

/**
 * ユーザーに生成したトピックをFirestoreに保存（サブコレクション構造）
 * @param {string} userId - LINEのユーザーID
 * @param {string[]} topics - 生成されたお題リスト
 */
module.exports = async function saveCustomTopics(userId, topics, category) {
  const logRef = db
    .collection("sessions")
    .doc(userId)

  const data = {
    topics,
    createdAt: new Date().toISOString(),
    category: category,
  };

  await logRef.set(data);
};
