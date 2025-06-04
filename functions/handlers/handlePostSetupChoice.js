/* eslint-disable */
module.exports = function handlePostSetupChoice(userText) {
  const lower = userText.trim().toLowerCase();

  if (lower.includes("あとで") || lower === "あとでやる") {
    return "later"; // あとでやる（時間指定へ）
  }
  if (lower.includes("今") || lower.includes("やる") || lower === "今やる") {
    return "now"; // 今すぐお題
  }
  return null; // 無効入力
};
