// handlers/checkEnglishGrammar.js
const { chatCompletion } = require("../utils/openaiClient");

/**
 * 英文の文法チェックを行い、問題がないかとフィードバックを返す
 * @param {string} english - チェック対象の英文
 * @returns {Promise<{ isCorrect: boolean, feedback: string }>}
 */
module.exports = async function checkEnglishGrammar(english) {
  console.log("english:", english);
  const prompt = [
    "以下の英文をネイティブ視点で見て、文法的・自然さに問題があれば簡潔に指摘してください。",
    "問題がない場合は「問題なし」とだけ返答してください。",
    "",
    `英文: ${english}`
  ].join("\n");

  const res = await chatCompletion([
    { role: "system", content: "あなたは英語の先生です。" },
    { role: "user", content: prompt }
  ]);

  const content = res.content.trim();

  console.log("content:", content);

  if (content === "問題なし") {
    return { isCorrect: true, feedback: "" };
  }

  return { isCorrect: false, feedback: content };
};
