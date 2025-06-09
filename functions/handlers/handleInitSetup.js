const admin = require("../utils/firebaseAdmin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function handleInitSetup({ event, client, session }) {
  const userId = event.source.userId;
  const userText = event.message.text.trim();

  // すでに初期設定が終わっていればスキップ
  if (session.postSetup) return;

  const step = session.step || "awaiting_name";

  if (step === "awaiting_name") {
    const isValidName = /^[a-zA-Z]+(?:\s[a-zA-Z]+)*$/.test(userText);
    if (!isValidName) {
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: [
          "TalkMasterにご登録ありがとうございます！",
          "ローマ字でフルネームを入力してください（例：Sakura Tanaka）"
        ].join("\n")
      });
    }

    await db.collection("sessions").doc(userId).set({
      name: userText,
      step: "awaiting_birthday"
    }, { merge: true });

    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "誕生日を8桁の数字で教えてください（例：19980123）"
    });
  }

  if (step === "awaiting_birthday") {
    const isValidDate = /^[0-9]{8}$/.test(userText);
    if (!isValidDate) {
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: "誕生日は8桁の数字で入力してください（例：19980123）"
      });
    }

    const sessionRef = db.collection("sessions").doc(userId);
    const sessionSnap = await sessionRef.get();
    const name = sessionSnap.exists ? sessionSnap.data().name : "unknown";

    // 🔴 usersコレクションにも保存
    await db.collection("users").doc(userId).set({
      name,
      birthday: userText,
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 🔵 セッションのpostSetupも更新
    await sessionRef.set({
      birthday: userText,
      postSetup: true,
      step: null,
      currentStep: "awaitingJapanese", // 念のため
      japaneseInput: [],
      translatedWords: [],
      translationSegments: []
    }, { merge: true });

    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "登録が完了しました！今日のお題を今すぐやりますか？それとも、あとでやりますか？",
      quickReply: {
        items: [
          {
            type: "action",
            action: { type: "message", label: "今やる", text: "今やる" }
          },
          {
            type: "action",
            action: { type: "message", label: "あとでやる", text: "あとでやる" }
          }
        ]
      }
    });
  }
}

module.exports = handleInitSetup;
