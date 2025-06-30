// ファイル1: utils/analyzeUserTopics.js
const admin = require("./firebaseAdmin");
const db = admin.firestore();

/**
 * ユーザーの過去のお題を分析して、頻出ジャンルを特定
 * @param {string} userId - LINEユーザーID
 * @returns {Promise<string>} ジャンル名（例："旅行"）
 */
module.exports = async function analyzeUserTopics(userId) {
  const logsSnapshot = await db
    .collection("topicsLog")
    .doc(userId)
    .get();

  const topicCounts = {};
  const docData = logsSnapshot.data();
  if (docData && docData.category && Array.isArray(docData.category)) {
    docData.category.forEach((cat) => {
      topicCounts[cat] = (topicCounts[cat] || 0) + 1;
    });
  }

  // 最も多く出現したカテゴリーを選ぶ
  let maxCategory = "旅行"; // デフォルト
  let maxCount = 0;
  for (const [category, count] of Object.entries(topicCounts)) {
    if (count > maxCount) {
      maxCategory = category;
      maxCount = count;
    }
  }

  return maxCategory;
};