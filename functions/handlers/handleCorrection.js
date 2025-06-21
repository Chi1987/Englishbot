 
const { saveSession } = require("../utils/session");
const checkEnglishGrammar = require("../utils/checkEnglishGrammar");

module.exports = async function handleCorrection({ event, client, session }) {
  const userId = event.source.userId;
  const userSentence = event.message.text.trim();

  const { isCorrect, feedback } = await checkEnglishGrammar(userSentence);

  if (isCorrect) {
    await saveSession(userId, {
      ...session,
      currentStep: null
    });

    const messages = [];
    messages.push({
      type: "text",
      text: "完璧です！これでこのお題は終了です。お疲れ様でした！"
    });
    messages.push({
      type: "text",
      text: "次のお題はいつやりますか？",
      quickReply: {
        items: [
          {
            type: "action",
            action: { type: "message", label: "今やる", text: "今やる" }
          },
          {
            type: "action",
            action: { type: "message", label: "あとでやる", text: "あとでやる" }
          }
        ]
      }
    });

    await client.replyMessage(event.replyToken, messages);
  } else {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: [
        "まだ修正点があります。",
        "【フィードバック】",
        feedback,
        "",
        "もう一度トライしてみてください。"
      ].join("\n")
    });
  }
};
