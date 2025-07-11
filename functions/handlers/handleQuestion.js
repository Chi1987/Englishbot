const { saveSession } = require("../utils/session");

module.exports = async function handleQuestion({ event, client, session }) {
  const userId = event.source.userId;
  await saveSession(userId, {
    ...session,
    currentStep: "question"
  });

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "もちろんです！\nどんな質問でもお気軽にどうぞ！"
  });
};
