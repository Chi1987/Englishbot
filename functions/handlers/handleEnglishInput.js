/* eslint-disable */
const { saveSession } = require("../utils/session");
const checkEnglishGrammar = require("../utils/checkEnglishGrammar");
const admin = require("../utils/firebaseAdmin");

module.exports = async function handleEnglishInput({ event, client, session }) {
  const userId = event.source.userId;
  const userSentence = event.message.text.trim();

  // ✅ 文法チェック（GPT）
  const { isCorrect, feedback } = await checkEnglishGrammar(userSentence);

  // ✅ スコア保存用の Firestore 参照
  const db = admin.firestore();
  const today = new Date();
  const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const scoreRef = db.doc(`scores/${userId}/daily/${yyyyMMdd}`);

  // ✅ Firestoreに保存する内容（例）
  const scoreData = {
    userSentence,
    isCorrect,
    feedback: feedback || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };

  await scoreRef.set(scoreData, { merge: true });

  // ✅ セッション更新＆返信
  if (isCorrect) {
    await saveSession(userId, {
      ...session,
      currentStep: "done",
      finalEnglish: userSentence
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "よくできました！この英文は正しく書けています。"
    });
  } else {
    await saveSession(userId, {
      ...session,
      currentStep: "done",
      finalEnglish: userSentence,
      englishFeedback: feedback
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: [
        "英文に修正点があります。",
        "【フィードバック】",
        feedback,
        "",
        "もう一度修正してみてください。"
      ].join("\n")
    });
  }
};
