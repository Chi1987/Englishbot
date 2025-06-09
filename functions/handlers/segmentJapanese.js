const { chatCompletion } = require("../utils/openaiClient");

module.exports = async function segmentJapanese(sentences) {
  const prompt = [
    "以下の日本語文を、それぞれ英語に翻訳しやすい形で文節に分けてください。",
    "出力は全ての文節を1つの配列として返してください（重複不可）。",
    "",
    `文1: ${sentences[0]}`,
    `文2: ${sentences[1]}`,
    `文3: ${sentences[2]}`,
    "",
    "出力形式: [\"私は\", \"テレビを\", \"見ました\"] のように、前後に何もつけずに配列だけを返してください。"
  ].join("\n");

  const result = await chatCompletion([
    { role: "system", content: "あなたはプロの日本語教師です。" },
    { role: "user", content: prompt }
  ]);

  const raw = result?.content?.trim();

  console.log("📦 segmentJapanese result.content:", raw);

  try {
    // JSONが余分なテキスト付きで返ることがあるため正規化
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    if (jsonStart >= 0 && jsonEnd >= 0) {
      const jsonLike = raw.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonLike);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("❌ 文節分割のJSON解析に失敗:", e);
  }

  throw new Error("文節の抽出に失敗しました。形式を確認してください。");
};
