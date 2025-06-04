/* eslint-disable */
// handlers/segmentJapanese.js
const { chatCompletion } = require("../utils/openaiClient");

/**
 * 文ごとに日本語文を英訳用の文節に分割する
 * @param {string[]} sentences - 日本語3文
 * @returns {Promise<string[]>} - 文節の配列（例：「私は」「テレビを」「見ました」）
 */
module.exports = async function segmentJapanese(sentences) {
  const prompt = [
    "以下の日本語文を、それぞれ英語に翻訳しやすい形で文節に分けてください。",
    "出力は全ての文節を1つの配列として返してください（重複不可）。",
    "",
    `文1: ${sentences[0]}`,
    `文2: ${sentences[1]}`,
    `文3: ${sentences[2]}`,
    "",
    "出力形式: [\"私は\", \"テレビを\", \"見ました\"] のように"
  ].join("\n");

  const result = await chatCompletion([
    { role: "system", content: "あなたはプロの日本語教師です。" },
    { role: "user", content: prompt }
  ]);

  try {
    const parsed = JSON.parse(result.content);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.error("文節分割のJSON解析に失敗:", e);
  }

  throw new Error("文節の抽出に失敗しました。");
};
