// handlers/checkJapaneseGrammar.js
const { getGptResponse } = require("../utils/openaiClient");

module.exports = async function checkJapaneseGrammar(sentences) {
  const prompt = [
    "以下の日本語文の文法をチェックしてください。不自然な点があればフィードバックを返してください。",
    "",
    ...sentences.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n");

  const result = await getGptResponse(prompt);
  return result.split("\n").filter(line => line.trim());
};
