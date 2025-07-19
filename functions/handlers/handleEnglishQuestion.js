const { chatCompletion } = require("../utils/openaiClient");
const admin = require("firebase-admin");
const { saveSession } = require("../utils/session");
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

会話が終わったら、endflagをtrueにしてください。
必ずJSON形式で返答してください。
{
  "answer": "返答内容",
  "endflag": "true" or "false"
}
JSON形式以外では返答しないでください。
`;

    const res = await chatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userQuestion }
    ]);

    const replyText = res.content.trim();
    const result = JSON.parse(replyText);

    if(result.endflag === "true"){
      await saveSession(userId, {
        ...session,
        questionFlag: false
      });
    }

    // ✅ Firestoreに保存
    await db.collection("english_questions").doc(userId).collection("logs").add({
      question: userQuestion,
      answer: result.answer,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: result.answer,
    });

  } catch (error) {
    console.error("❌ handleEnglishQuestion error:", error);
    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "ごめんなさい。今ちょっと答えられませんでした。もう一度聞いてみてください🙏",
    });
  }
};
