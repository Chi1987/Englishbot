/* eslint-disable */
const { saveSession } = require("../utils/session");

module.exports = async function handleDateChoice({ event, client, userId, session }) {
  const text = event.message.text;

  if (text === "予定がまだわからない") {
    await saveSession(userId, {
      ...session,
      paused: true,
      resumeAt: null,
      currentStep: "paused"
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "わかりました。リッチメニューからいつでも再開時間を設定できます！"
    });
    return;
  }

  if (text === "今日" || text === "明日") {
    await saveSession(userId, {
      ...session,
      tempResumeDay: text,
      currentStep: "chooseAmPm"
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: `${text}の午前と午後どちらが良いですか？`,
      quickReply: {
        items: [
          {
            type: "action",
            action: { type: "message", label: "午前", text: "午前" }
          },
          {
            type: "action",
            action: { type: "message", label: "午後", text: "午後" }
          }
        ]
      }
    });
    return;
  }

  // その他の不正入力
  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "「今日」「明日」「予定がまだわからない」のいずれかでお答えください。"
  });
};
