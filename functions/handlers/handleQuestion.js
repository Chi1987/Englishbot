const { saveSession } = require("../utils/session");

module.exports = async function handleQuestion({ event, client, session }, type = 1) {
  const userId = event.source.userId;
  if(type === 1) {
    await saveSession(userId, {
      ...session,
      questionFlag: true
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "もちろんです！\nどんな質問でもお気軽にどうぞ！"
    });
  } else if(type === 2) {
    await saveSession(userId, {
      ...session,
      questionFlag: false
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "質問を終わります。"
    });
  }
};
