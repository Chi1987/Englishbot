// utils/wordLookup.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getEnglishWordFor(japanesePhrase) {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "あなたは日本語の単語を適切な英語の単語に変換する翻訳者です。"
      },
      {
        role: "user",
        content: `「${japanesePhrase}」は英語で何と言いますか？1単語で答えてください。`
      }
    ],
    temperature: 0
  });

  return res.choices[0].message.content.trim().split("\n")[0];
}

module.exports = { getEnglishWordFor };
