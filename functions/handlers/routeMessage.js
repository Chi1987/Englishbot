/* eslint-disable */
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
    const plan = await getUserPlan(userId); // "lite" or "full"

    const messageType = event.message.type;
    const userText = messageType === "text" ? event.message.text.trim() : "";

    console.log("📩 routeMessage triggered:", { userText, step, plan, messageType });

    // ✅ 初期設定（名前・誕生日）
    if (!session?.postSetup) {
      return await handleInitSetup({ event, client, session });
    }

    // ✅ フルプラン：音声入力対応
    if (plan === "full" && messageType === "audio") {
      return await handleVoiceInput({ event, client, session });
    }

    // ✅ テキスト入力のみ対応
    if (messageType !== "text") {
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: "テキストまたは音声（フルプランのみ）で入力してください。"
      });
    }

    // ✅ お題の選択（今やる／あとでやる）＋ 英語に関する質問のみ受付
    if (!step || step === "paused") {
      if (userText === "今やる") {
        return await handleNowChoice({ event, client, session });
      }
      if (userText === "あとでやる") {
        return await handleLaterChoice({ event, client, session });
      }

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

    // ✅ 「あとでやる」→ 日付選択
    if (step === "chooseDay") {
      return await handleDateChoice({ event, client, session });
    }

    // ✅ 午前／午後選択
    if (step === "chooseAmPm") {
      return await handleAmPmChoice({ event, client, session });
    }

    // ✅ 時間選択（0〜23時）
    if (step === "chooseHour") {
      return await handleHourChoice({ event, client, session });
    }

    // ✅ 日本語3文入力
    if (step === "awaitingJapanese") {
      return await handleJapaneseInput({ event, client, session });
    }

    // ✅ 文節ごとの英訳
    if (step === "awaitingTranslationWords") {
      return await handleTranslationWords({ event, client, session });
    }

    // ✅ 英文作成
    if (step === "awaitingEnglish") {
      return await handleEnglishInput({ event, client, session });
    }

    // ✅ 添削後の再挑戦
    if (step === "done") {
      return await handleCorrection({ event, client, session });
    }

    // ✅ 未対応メッセージ（catch-all）
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
