/* eslint-disable */
const admin = require("../utils/firebaseAdmin");
const { getSession } = require("../utils/session");
const getUserPlan = require("../utils/getUserPlan");
const { isEnglishQuestion } = require("../utils/isEnglishQuestion");
const handleEnglishQuestion = require("./handleEnglishQuestion");

const handleInitSetup = require("./handleInitSetup");
const handleNowChoice = require("./handleNowChoice");
const handleLaterChoice = require("./handleLaterChoice");
const handleDateChoice = require("./handleDateChoice");
const handleAmPmChoice = require("./handleAmPmChoice");
const handleHourChoice = require("./handleHourChoice");
const handleJapaneseInput = require("./handleJapaneseInput");
const handleTranslationWords = require("./handleTranslationWords");
const handleEnglishInput = require("./handleEnglishInput");
const handleCorrection = require("./handleCorrection");
const handleVoiceInput = require("./handleVoiceInput");

module.exports = async function routeMessage({ event, client }) {
  try {
    if (event.type !== "message") return;

    const userId = event.source.userId;
    const session = await getSession(userId);
    const step = session?.currentStep;
    const plan = await getUserPlan(userId);
    const messageType = event.message.type;
    const userText = messageType === "text" ? event.message.text.trim() : "";

    // ✅ 強制リセット（初期化）
    if (userText === "こんにちは" || userText === "初期化") {
      const resetSession = {
        step: "awaiting_name",
        postSetup: false
      };

      await admin.firestore().collection("sessions").doc(userId).set(resetSession, { merge: true });
      return await handleInitSetup({ event, client, session: resetSession });
    }

    // ✅ 「今やる」はどのステップでも機能させる
    if (userText === "今やる") {
      return await handleNowChoice({ event, client, session });
    }

    // ✅ 初期設定（名前・誕生日）がまだなら
    if (!session?.postSetup) {
      return await handleInitSetup({ event, client, session });
    }

    // ✅ フルプランなら音声対応
    if (plan === "full" && messageType === "audio") {
      return await handleVoiceInput({ event, client, session });
    }

    // ✅ テキスト以外は拒否（フル以外）
    if (messageType !== "text") {
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: "テキストまたは音声（フルプランのみ）で入力してください。"
      });
    }

    // ✅ 「あとでやる」はここで処理
    if (userText === "あとでやる") {
      return await handleLaterChoice({ event, client, session });
    }

    // ✅ 英語に関する質問を処理（stepが未設定 or paused の場合）
    if (!step || step === "paused") {
      const isAllowed = await isEnglishQuestion(userText);
      if (!isAllowed) {
        return await client.replyMessage(event.replyToken, {
          type: "text",
          text:
            "ごめんなさい。このBotでは英語に関する質問だけを受け付けています🙏\nたとえば：\n・「“撫でる”って英語で何て言うの？」\n・「“頑張って”って英語でどう言うの？」\nなど、お気軽に聞いてください！",
        });
      }

      return await handleEnglishQuestion({ event, client, session });
    }

    // ✅ 段階ごとの処理
    if (step === "chooseDay") return await handleDateChoice({ event, client, session });
    if (step === "chooseAmPm") return await handleAmPmChoice({ event, client, session });
    if (step === "chooseHour") return await handleHourChoice({ event, client, session });
    if (step === "awaitingJapanese") return await handleJapaneseInput({ event, client, session });
    if (step === "awaitingTranslationWords") return await handleTranslationWords({ event, client, session });
    if (step === "awaitingEnglish") return await handleEnglishInput({ event, client, session });
    if (step === "done") return await handleCorrection({ event, client, session });

    // ✅ fallback（未定義ステップ）
    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: `受け取ったよ：「${userText}」`
    });

  } catch (err) {
    console.error("🔥 routeMessage error:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "エラーが発生しました。もう一度試してください。"
    });
  }
};
