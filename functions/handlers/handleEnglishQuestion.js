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
ユーザーが英語についての質問をしてくるので、優しく丁寧に答えてください。
以下のようなカジュアルなやり取りが来た場合には、簡単な返答をしてください。

ユーザー：「ありがとう」
→「どういたしまして！またいつでも質問してくださいね😊」

ユーザー：「分かりました！」
→「それは良かったです✨引き続き頑張ってください！」

ただし、恋愛・プライベートなど学習目的から逸脱した内容（例：「彼氏が〜」）には「それはちょっと答えられません🙏」と返してください。
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
