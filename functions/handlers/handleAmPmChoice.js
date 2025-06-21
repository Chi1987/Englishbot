const { saveSession } = require("../utils/session");

module.exports = async function handleAmPmChoice({ event, client, session }) {
  const text = event.message.text;
  const userId = event.source.userId;
  if (text !== "午前" && text !== "午後") {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "「午前」か「午後」でお答えください。"
    });
    return;
  }

  await saveSession(userId, {
    ...session,
    tempAmPm: text,
    currentStep: "chooseHour"
  });

  const hourStart = text === "午前" ? 0 : 12;
  const hourEnd = text === "午前" ? 11 : 23;

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: `${session.tempResumeDay}の${text}は何時がいいですか？`,
    quickReply: {
      items: Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => {
        const hour = hourStart + i;
        return {
          type: "action",
          action: {
            type: "message",
            label: `${hour}時`,
            text: `${hour}時`
          }
        };
      })
    }
  });
};
