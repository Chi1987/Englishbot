const { chatCompletion } = require("../utils/openaiClient");

module.exports = async function segmentJapanese(sentences) {
  const prompt = [
    "以下の日本語文を、それぞれ英語に翻訳しやすい形で文節に分けてください。",
    "各文ごとに文節を分けて、1文ごとに配列として格納してください。",
    "",
    `文1: ${sentences[0]}`,
    `文2: ${sentences[1]}`,
    `文3: ${sentences[2]}`,
    "",
    "必ず以下のJSON形式で返してください：",
    "{",
    '  "sentence1": ["文節1", "文節2", ...],',
    '  "sentence2": ["文節1", "文節2", ...],',
    '  "sentence3": ["文節1", "文節2", ...]',
    "}",
    "",
    "JSON形式以外では回答しないでください。"
  ].join("\n");

  const result = await chatCompletion([
    { role: "system", content: "あなたはプロの日本語教師です。" },
    { role: "user", content: prompt }
  ]);

  const raw = result?.content?.trim();

  console.log("📦 segmentJapanese result.content:", raw);

  try {
    // JSONが余分なテキスト付きで返ることがあるため正規化
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd >= 0) {
      const jsonLike = raw.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonLike);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error("❌ 文節分割のJSON解析に失敗:", e);
  }

  throw new Error("文節の抽出に失敗しました。形式を確認してください。");
};
