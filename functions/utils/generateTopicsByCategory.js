// utils/generateTopicsByCategory.js
const { chatCompletion } = require("../utils/openaiClient");

module.exports = async function generateTopicsByCategory(category) {
  const prompt = [
    `英語学習者向けに、カテゴリ「${category}」に関連する話題を1つ、質問形式で日本語で生成してください。`,
    "例：旅行 → 『空港でのトラブルを教えてください』『おすすめ観光地を紹介してください』『ホテルの予約ミスを教えてください』",
    "フォーマット：質問だけを配列形式で出力してください。"
  ].join("\n");

  const result = await chatCompletion([
    { role: "system", content: "あなたはプロの英語講師です。" },
    { role: "user", content: prompt }
  ]);

  try {
    const topics = JSON.parse(result.content.trim());
    if (Array.isArray(topics)) return topics;
    throw new Error("配列ではありません");
  } catch (e) {
    console.error("トピック生成エラー:", e);
    return ["カテゴリに基づくお題①", "カテゴリに基づくお題②", "カテゴリに基づくお題③"];
  }
};
