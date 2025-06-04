const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function isEnglishQuestion(messageText) {
  const prompt = `
あなたは英語学習Botです。
以下のユーザー発言が「英語に関する質問」かどうかだけを判断してください。
「英単語が知りたい」「英文が正しいか」「文法・表現に関する内容」はすべてOKです。
日常的な感想・雑談・人生相談・愚痴はすべてNGです。

返答は "true" または "false" のどちらかだけで返してください。
ユーザーの発言：
${messageText}
  `;

  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  const answer = res.choices[0].message.content.trim().toLowerCase();
  return answer.includes("true");
}

module.exports = { isEnglishQuestion };
