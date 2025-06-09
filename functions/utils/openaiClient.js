// utils/openaiClient.js
const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * messages形式（system, user）のChat API
 */
async function chatCompletion(messages) {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages
  });
  return res.choices[0].message;
}

/**
 * string型のプロンプトで応答を取得する汎用メソッド
 */
async function getGptResponse(prompt) {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });
  return res.choices[0].message.content;
}

module.exports = {
  chatCompletion,
  getGptResponse  // ← ✅ これがなかったのでエラー
};
