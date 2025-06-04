/* eslint-disable */
const { saveSession } = require("../utils/session");

module.exports = async function handleHourChoice({ event, client, userId, session }) {
  const text = event.message.text.trim();
  const match = text.match(/^(\d{1,2})時$/);

  if (!match) {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "時刻が認識できませんでした。「8時」や「20時」などの形式で教えてください。"
    });
    return;
  }

  const hour = parseInt(match[1]);
  const target = new Date();

  if (session.tempResumeDay === "明日") {
    target.setDate(target.getDate() + 1);
  }

  target.setHours(hour, 0, 0, 0);

  await saveSession(userId, {
    paused: true,
    resumeAt: target.toISOString(),
    currentStep: "paused"
  });

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: `${session.tempResumeDay}の${hour}時に再開しますね！`
  });
};
