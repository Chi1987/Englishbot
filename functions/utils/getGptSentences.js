const { ChatGPTAPI } = require("chatgpt"); // chatgptライブラリ使用
require("dotenv").config(); // ← ここ！

const api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getGptSentences(userText) {
  const prompt = `
次のテキストから意味の通る日本語の文を最大3つ抽出してください。
文末に句点がなくても構いません。文の終わりを意味で判断してください。

【例】
入力：今日は友達とごはんを食べた とてもおいしかった あのレストランにまた行きたいと思った
出力：
[
  "今日は友達とごはんを食べた",
  "とてもおいしかった",
  "あのレストランにまた行きたいと思った"
]

入力：${userText}
出力：
`;

  const res = await api.sendMessage(prompt);

  try {
    // JSONとして返されることを想定してパース
    const match = res.text.match(/\[([\s\S]+?)\]/);
    if (!match) return [];

    const jsonString = `[${match[1]}]`.replace(/“|”/g, '"');
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("GPT応答のパース失敗:", e);
    return [];
  }
}

module.exports = { getGptSentences };
