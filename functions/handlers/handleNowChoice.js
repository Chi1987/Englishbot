/* eslint-disable */
const { getNextPrompt } = require("../utils/getNextPrompt");
const { saveSession } = require("../utils/session");

module.exports = async function handleNowChoice({ event, client, userId }) {
  const { text: promptText } = await getNextPrompt(userId);

  await saveSession(userId, {
    currentStep: "awaitingJapanese",
    currentPrompt: promptText,
  });

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: [
      "では、1題目を始めましょう！",
      `お題：${promptText}`,
      "",
      "このお題について、日本語で3文書いてください。",
      "【ルール】",
      "① 主語を必ず書くこと。",
      "② 端折らずに、できるだけ正しく書くこと。",
      "③ 「ヤバイ」など抽象的な表現ではなく、できるだけ具体的に書くこと。"
    ].join("\n")
  });
};
