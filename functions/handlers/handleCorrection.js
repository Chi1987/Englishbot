/* eslint-disable */
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

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "完璧です！これでこのお題は終了です。お疲れ様でした！"
    });
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
