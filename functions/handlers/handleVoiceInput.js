// handlers/handleVoiceInput.js
const { speechToText } = require("../utils/speechToText");
const handleEnglishInput = require("./handleEnglishInput");
const handleCorrection = require("./handleCorrection");

module.exports = async function handleVoiceInput({ event, client, session }) {
  const messageId = event.message.id;

  try {
    console.log("🎤 音声入力処理開始:", messageId);

    // ステップ確認
    if (session.currentStep !== "awaitingEnglish" && session.currentStep !== "done") {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "このステップでは音声入力は使えません。"
      });
    }

    // Whisperで音声を文字起こし
    const transcript = await speechToText(messageId, process.env.LINE_CHANNEL_ACCESS_TOKEN);
    console.log("📝 文字起こし結果:", transcript);
    if(session.currentStep === "awaitingEnglish"){
      await handleEnglishInput({ event, client, session }, transcript);
    }else if(session.currentStep === "done"){
      await handleCorrection({ event, client, session }, transcript);
    }

  } catch (err) {
    console.error("🔴 handleVoiceInput error:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "音声の処理中にエラーが発生しました。もう一度試してください。"
    });
  }
};
