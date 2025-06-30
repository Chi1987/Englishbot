const { chatCompletion } = require("../utils/openaiClient");
const admin = require("firebase-admin");
require("dotenv").config();

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

module.exports = async function handleEnglishQuestion({ event, client, session }) {
  const userId = event.source.userId;
  const userQuestion = event.message.text;

  try {
    const systemPrompt = `
あなたは優しい英語の先生です。
ユーザーが日常生活で「これって英語でどう言うの？」と聞いた時に、単語やフレーズを教えてください。
できればその言葉の使い方や例文も簡単に教えてあげてください。
難しい説明や文法用語は避けて、初心者にもわかりやすく答えてください。
`;

    const res = await chatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userQuestion }
    ]);

    const replyText = res.content.trim();

    // ✅ Firestoreに保存
    await db.collection("english_questions").doc(userId).collection("logs").add({
      question: userQuestion,
      answer: replyText,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText,
    });

  } catch (error) {
    console.error("❌ handleEnglishQuestion error:", error);
    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "ごめんなさい。今ちょっと答えられませんでした。もう一度聞いてみてください🙏",
    });
  }
};
