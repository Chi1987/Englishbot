// utils/getUserPlan.js
const admin = require("firebase-admin");
const db = admin.firestore();

/**
 * Firestoreからユーザーのプランを取得
 * @param {string} userId - LINEユーザーID
 * @returns {Promise<string>} "lite" または "full"
 */
module.exports = async function getUserPlan(userId) {
  const doc = await db.collection("users").doc(userId).get();
  return doc.exists && doc.data().plan ? doc.data().plan : "lite"; // デフォルトはlite
};
