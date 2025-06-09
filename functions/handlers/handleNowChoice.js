
module.exports = async function handleNowChoice({ event, client, userId }) {
  console.log("[DEBUG] handleNowChoice triggered for:", userId);

  let promptText;
  try {
    const result = await getNextPrompt(userId);
    promptText = result?.text;

    if (!promptText) {
      console.error("❌ getNextPrompt returned empty or undefined");
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: "お題の取得に失敗しました。もう一度お試しください。"
      });
    }

  } catch (err) {
    console.error("🔥 Error in getNextPrompt:", err);
    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "お題の取得中にエラーが発生しました。しばらくしてから再試行してください。"
    });
  }

const { getNextPrompt } = require("../utils/getNextPrompt");
const { saveSession } = require("../utils/session");

module.exports = async function handleNowChoice({ event, client, session }) {
  const userId = event.source.userId;
  console.log("[DEBUG] handleNowChoice triggered for:", userId);

  let promptText;
  let nextIndex;

  try {
    const result = await getNextPrompt(userId);
    promptText = result?.text;
    nextIndex = result?.nextIndex;

    if (!promptText) {
      console.error("❌ getNextPrompt returned empty or undefined");
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: "お題の取得に失敗しました。もう一度お試しください。"
      });
    }
  } catch (err) {
    console.error("🔥 Error in getNextPrompt:", err);
    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "お題の取得中にエラーが発生しました。しばらくしてから再試行してください。"
    });
  }

  // 🔄 セッションを初期化して保存（誤上書き防止のためpostSetupを強制true）
  await saveSession(userId, {
    currentStep: "awaitingJapanese",
    currentPrompt: promptText,
    nextPromptIndex: nextIndex,
    postSetup: true,
    japaneseInput: [],
    translatedWords: [],
    translationSegments: [],
    currentSegmentIndex: 0
  });

  return await client.replyMessage(event.replyToken, {
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
