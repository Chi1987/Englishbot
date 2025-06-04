/* eslint-disable */
// handlers/handleTimeTrigger.js
const { saveSession } = require("../utils/session");

module.exports = async function handleTimeTrigger({ event, client, session }) {
  const userId = event.source.userId;

  await saveSession(userId, {
    ...session,
    currentStep: "chooseDay"
  });

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "いつ再開しますか？",
    quickReply: {
      items: [
        { type: "action", action: { type: "message", label: "今日", text: "今日" } },
        { type: "action", action: { type: "message", label: "明日", text: "明日" } },
        { type: "action", action: { type: "message", label: "予定がまだわからない", text: "予定がまだわからない" } }
      ]
    }
  });
};
