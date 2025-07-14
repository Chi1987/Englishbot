const { getGptResponse } = require("./openaiClient");
require("dotenv").config();

async function isEnglishQuestion(messageText) {
  const prompt = `
あなたは英語学習Botです。
以下のユーザー発言が「英語に関する質問」かどうかを判断してください。
「英単語が知りたい」「英文が正しいか」「文法・表現に関する内容」はすべてOKです。
ただし質問回答へのお礼のようなカジュアルなやり取りが来た場合には、OKとしてください。

返答は "true" または "false" のどちらかだけで返してください。
ユーザーの発言：
${messageText}
  `;

  const answer = await getGptResponse(prompt);
  const normalizedAnswer = answer.trim().toLowerCase();
  return normalizedAnswer.includes("true");
}

module.exports = { isEnglishQuestion };
