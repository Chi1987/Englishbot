// handlers/handleVoiceInput.js
const { saveSession } = require("../utils/session");
const { speechToText } = require("../utils/speechToText");
const handleJapaneseInput = require("./handleJapaneseInput");

module.exports = async function handleVoiceInput({ event, client, session }) {
  const userId = event.source.userId;
  const messageId = event.message.id;

  try {
    console.log("🎤 音声入力処理開始:", messageId);

    // Whisperで音声を文字起こし
    const transcript = await speechToText(messageId, process.env.LINE_CHANNEL_ACCESS_TOKEN);
    console.log("📝 文字起こし結果:", transcript);

    // ステップ確認
    if (session.currentStep !== "awaitingJapanese") {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "このステップでは音声入力は使えません。"
      });
    }

    // 3文中の追加処理
    const input = session.japaneseInput || [];
    const updated = [...input, transcript];

    await saveSession(userId, {
      ...session,
      japaneseInput: updated
    });

    if (updated.length >= 3) {
      // 3文揃ったので handleJapaneseInput に委譲
      return await handleJapaneseInput({ event, client, session: { ...session, japaneseInput: updated } });
    } else {
      const remaining = 3 - updated.length;
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: `音声を受け取りました（「${transcript}」）。あと${remaining}文です。`
      });
    }

  } catch (err) {
    console.error("🔴 handleVoiceInput error:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "音声の処理中にエラーが発生しました。もう一度試してください。"
    });
  }
};
