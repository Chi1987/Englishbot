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
const handleQuestion = require("./handleQuestion");
const { saveSession } = require("../utils/session");

/**
 * ユーザー入力の検証とサニタイゼーション
 */
function validateAndSanitizeInput(text, maxLength = 1000) {
  if (!text || typeof text !== 'string') {
    return { isValid: false, sanitized: '', error: '無効な入力です。' };
  }
  
  // 長さチェック
  if (text.length > maxLength) {
    return { 
      isValid: false, 
      sanitized: '', 
      error: `入力が長すぎます。${maxLength}文字以内で入力してください。` 
    };
  }
  
  // 基本的なサニタイゼーション
  let sanitized = text
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 制御文字除去
    .replace(/\s+/g, ' '); // 連続する空白を一つに
  
  // 悪意のあるパターンをチェック
  const maliciousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /eval\s*\(/i,
    /function\s*\(/i
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(sanitized)) {
      return { 
        isValid: false, 
        sanitized: '', 
        error: '無効な文字が含まれています。' 
      };
    }
  }
  
  return { isValid: true, sanitized, error: null };
}

/**
 * ユーザーIDの検証
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  
  // LINEユーザーIDの基本フォーマットチェック
  const userIdPattern = /^[a-zA-Z0-9]{33}$/;
  return userIdPattern.test(userId);
}

/**
 * レート制限チェック用のキャッシュ
 */
const userRequestCache = new Map();
const REQUEST_LIMIT = 10; // 1分間に10リクエストまで
const RATE_LIMIT_WINDOW = 60000; // 1分間

/**
 * レート制限チェック
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const userRequests = userRequestCache.get(userId) || [];
  
  // 古いリクエストを清理
  const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= REQUEST_LIMIT) {
    return false;
  }
  
  // 新しいリクエストを記録
  recentRequests.push(now);
  userRequestCache.set(userId, recentRequests);
  
  return true;
}

module.exports = async function routeMessage({ event, client }) {
  try {
    if (event.type !== "message") return;

    const userId = event.source.userId;
    
    // ユーザーID検証
    if (!validateUserId(userId)) {
      console.error('❌ Invalid userId:', userId);
      return;
    }
    
    // レート制限チェック
    if (!checkRateLimit(userId)) {
      console.log(`⏱️ Rate limit exceeded for user: ${userId}`);
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: "リクエストが多すぎます。しばらく時間をおいてからお試しください。"
      });
    }
    
    const session = await getSession(userId);
    const step = session?.currentStep;
    const questionFlag = session?.questionFlag;
    const plan = await getUserPlan(userId);
    const messageType = event.message.type;
    
    let userText = "";
    if (messageType === "text") {
      const validation = validateAndSanitizeInput(event.message.text);
      if (!validation.isValid) {
        return await client.replyMessage(event.replyToken, {
          type: "text",
          text: validation.error
        });
      }
      userText = validation.sanitized;
    }

    // ✅ 強制リセット（初期化）
    if (userText === "こんにちは" || userText === "初期化" || userText === "登録情報の修正") {
      const resetSession = {
        step: "awaiting_name",
        postSetup: false
      };

      await admin.firestore().collection("sessions").doc(userId).set(resetSession, { merge: true });
      if(userText === "登録情報の修正") {
        return await handleInitSetup({ event, client, session: resetSession }, 2);
      } else {
        return await handleInitSetup({ event, client, session: resetSession });
      }
    }

    // ✅ 「質問する」はここで処理
    if(userText === "質問する") {
      return await handleQuestion({ event, client, session }, 1);
    } else if(userText === "質問を終わる") {
      return await handleQuestion({ event, client, session }, 2);
    }

    // ✅ 「今やる」はどのステップでも機能させる
    if (userText === "今やる") {
      if(questionFlag) {
        await saveSession(userId, {
          ...session,
          questionFlag: false
        });
      }
      return await handleNowChoice({ event, client, session });
    }

    // ✅ 英語に関する質問を処理（stepが未設定 or paused の場合）
    if (questionFlag) {
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

    // ✅ 初期設定（名前・誕生日）がまだなら
    if (!session?.postSetup && !session?.resetPostSetup) {
      return await handleInitSetup({ event, client, session });
    }

    // ✅ フルプランなら音声対応それ以外は拒否
    if (messageType === "audio") {
      if (plan === "full") {
        return await handleVoiceInput({ event, client, session });
      } else if (plan !== "full") {
        return await client.replyMessage(event.replyToken, {
          type: "text",
          text: "テキストまたは音声（フルプランのみ）で入力してください。"
        });
      }
    }

    // ✅ 「あとでやる」はここで処理
    if (userText === "あとでやる") {
      return await handleLaterChoice({ event, client, session });
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
      text: `受け取ったよ：「${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}」`
    });

  } catch (err) {
    console.error("🔥 routeMessage error:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "エラーが発生しました。もう一度試してください。"
    });
  }
};
