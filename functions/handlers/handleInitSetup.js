const admin = require("../utils/firebaseAdmin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function handleInitSetup({ event, client, session }, type = 1) {
  const userId = event.source.userId;
  const userText = event.message.text.trim();
  const step = session.step || "awaiting_name";

  // すでに初期設定が終わっていれば修正モード
  if (session.postSetup && type === 2) {
    await db.collection("sessions").doc(userId).set({
      resetPostSetup: false
    }, { merge: true });

    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: [
        "登録情報の修正を行います。",
        "✍️ まずはお名前を教えてください",
        "ローマ字でフルネームを入力してください（例：Sakura Tanaka）",
        "※トレーニング時に使用します"
      ].join("\n")
    });
  };
  
  if(!session.resetPostSetup && step === "awaiting_name") {
    await db.collection("sessions").doc(userId).set({
      name: userText,
      step: "awaiting_birthday"
    }, { merge: true });

    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "誕生日を8桁の数字で教えてください（例：19980123）"
    });
  }

  if (!session.resetPostSetup && step === "awaiting_birthday") {
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
      resetPostSetup: true,
      step: null,
      currentStep: "awaitingJapanese", // 念のため
      japaneseInput: [],
      translatedWords: [],
      translationSegments: []
    }, { merge: true });

    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: "登録の修正が完了しました！",
    });
  }

  if (step === "awaiting_name") {
    const isValidName = /^[a-zA-Z]+(\s[a-zA-Z]+)*$/.test(userText);
    if (!isValidName) {
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: [
          "🦋 Welcome to Butterfly Effect",
          "あなたの “英語アウトプット力” を羽ばたかせる旅が、いま始まります。",
          "",
          "⸻",
          "",
          "📘 Butterfly Effect の英文化トレーニングとは？",
          "これは「話す」ための英会話ではありません。",
          "あなたの「思考」や「気持ち」を、正しく・自然に“英語で表現する”力を育てる訓練です。",
          "✅ 毎日1トピック・3分でOK",
          "✅ 日本語で書いて → 英語で表す",
          "✅ GPTがあなたの表現を添削・アドバイス",
          "",
          "翻訳ではなく「英語で考えられる脳」を作る。",
          "それが、Butterfly Effectの目指す英語アウトプット力です。",
          "",
          "⸻",
          "",
          "✍️ まずはお名前を教えてください",
          "ローマ字でフルネームを入力してください（例：Sakura Tanaka）",
          "※トレーニング時に使用します"
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
      resetPostSetup: true,
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
