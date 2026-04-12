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
const crypto = require("crypto"); // Stripeトークン用に追加



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

/**
 * Stripe遷移用のトークン発行
 */
async function issueToken(userId) {
  // 防御：userIdがundefinedだとFirestoreがエラーを出すため
  if (!userId) {
    throw new Error("userId is required for issueToken");
  }
  const token = crypto.randomBytes(16).toString("hex");
  await admin.firestore().collection("temp_tokens").doc(token).set({
    userId: userId,
    createdAt: Date.now()
  });
  return token;
}

/**
 * ✅ 登録案内メッセージ送信メソッド
 */
async function replyRegistrationMenu({ event, client, userId }) {
  const token = await issueToken(userId);
  const registrationUrl = `https://stripe-payment-server-10493.web.app/?token=${token}`;
  
  return await client.replyMessage(event.replyToken, {
    type: "flex",
    altText: "【Butterfly Effect】登録のご案内",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: "https://stripe-payment-server-10493.web.app/image_505d3a.jpg",
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "「英語、続かなかった」\nそんな経験、ありませんか？", wrap: true, weight: "bold", size: "md" },
          { type: "text", text: "Butterfly Effectは、続けられるを大切にした英語学習です。ご利用にはプラン登録が必要です。", wrap: true, size: "sm", color: "#666666" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", color: "#2CBAB2", action: { type: "uri", label: "登録して始める", uri: registrationUrl }, height: "sm" }
        ]
      }
    }
  });
}

module.exports = async function routeMessage({ event, client }) {
  try {
    if (event.type !== "message") return;

    // 冒頭でuserIdを確定
    const userId = event?.source?.userId;
    
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

    // ✅ ユーザー情報と課金状態の確認 (最優先)
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const userData = userDoc.data();
    // status が "active" であるかどうかが全ての利用条件
    const isActive = userDoc.exists && userData?.status === "active";

    // 🛑 未課金ユーザーの処理
    if (!isActive) {
      const messageType = event.message.type;
      let userText = "";
      if (messageType === "text") {
        userText = event.message.text;
      }

      // 解約コマンドが含まれる場合のみ、管理ポータルを案内（例外処理）
      if (userText.includes("解約") && userData?.stripeCustomerId) {
        const token = await issueToken(userId);
        const portalUrl = `https://stripe-payment-server-10493.web.app/portal.html?token=${token}`;
        return await client.replyMessage(event.replyToken, {
          type: "text",
          text: `プランの管理・解約はこちらからお手続きいただけます：\n${portalUrl}`
        });
      }

      // ✅ 別メソッドを呼び出して登録案内を表示
      return await replyRegistrationMenu({ event, client, userId });
    }
    
    // --- 💡 ここから下は status: "active" のユーザーのみが到達できる領域 ---

    const session = await getSession(userId);
    const step = session?.currentStep;
    const questionFlag = session?.questionFlag;
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
      if(userText === "登録情報の修正") {
        const resetSession = {
          step: "awaiting_name",
          postSetup: true,
        };
        await admin.firestore().collection("sessions").doc(userId).set(resetSession, { merge: true });
        return await handleInitSetup({ event, client, session: resetSession }, 2);
      } else {
        const resetSession = {
          step: "awaiting_name",
          postSetup: false
        };
        await admin.firestore().collection("sessions").doc(userId).set(resetSession, { merge: true });
        return await handleInitSetup({ event, client, session: resetSession });
      }
    }

    // 1. 解約コマンド (Activeユーザー用)
    if (userText.includes("解約")) {
      if (!userData?.stripeCustomerId) {
        return client.replyMessage(event.replyToken, { 
          type: "text", 
          text: "有効なサブスクが見つかりません。" 
        });
      }

      const token = await issueToken(userId); 
      const portalUrl = `https://stripe-payment-server-10493.web.app/portal.html?token=${token}`;

      return client.replyMessage(event.replyToken, {
        type: "flex",
        altText: "【Butterfly Effect】解約手続きのご案内",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "Butterfly Effectをご利用いただきありがとうございます。",
                wrap: true,
                margin: "md",
                size: "sm"
              },
              {
                type: "text",
                text: "解約をご検討中ですか？\n解約される前に、以下をご確認ください。",
                wrap: true,
                margin: "sm",
                size: "sm"
              },
              {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "sm",
                contents: [
                  // {
                  //   type: "text",
                  //   text: "・解約後も、現在の請求期間終了日まではすべての機能をご利用いただけます。",
                  //   wrap: true,
                  //   size: "xs",
                  //   color: "#666666"
                  // },
                  // {
                  //   type: "text",
                  //   text: "・次回の請求は発生しません",
                  //   wrap: true,
                  //   size: "xs",
                  //   color: "#666666"
                  // },
                  {
                    type: "text",
                    text: "・学習履歴は解約後も保存されます（再登録時に引き継げます）",
                    wrap: true,
                    size: "xs",
                    color: "#666666"
                  }
                ]
              },
              {
                type: "text",
                text: "解約を進める場合は、下のボタンをタップしてください。",
                wrap: true,
                margin: "xxl",
                size: "sm",
                align: "center"
              }
            ]
          },
          footer: {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "link",
                height: "sm",
                action: {
                  type: "uri",
                  label: "解約する",
                  uri: portalUrl
                },
                color: "#aaaaaa"
              },
              {
                type: "button",
                style: "primary",
                color: "#06C755",
                height: "sm",
                action: {
                  type: "message",
                  label: "やっぱり続ける",
                  text: "やっぱり続ける"
                }
              }
            ]
          }
        }
      });
    }

    // ✅ 「やっぱり続ける」の処理
    if (userText === "やっぱり続ける") {
      return await client.replyMessage(event.replyToken, {
        type: "text",
        text: "ありがとうございます！✨\n引き続き、あなたの「一歩」を全力でサポートさせていただきます。よろしくお願いします！"
      });
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

    // ✅ 英語に関する質問を処理
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
    if (!session?.postSetup || !session?.resetPostSetup) {
      return await handleInitSetup({ event, client, session });
    }

    // ✅ 音声入力
    if (messageType === "audio") {
      return await handleVoiceInput({ event, client, session });
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
      text: "Butterfly Effectをご利用いただき、ありがとうございます！\n今は学習が一段落されているようですね？\nまた英語の練習を始める際は「今やる」と送ってください。\n何か分からないことがあれば「質問する」と話しかけていただければ、すぐにお答えしますよ！"
      //text: `受け取ったよ：「${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}」`
    });

  } catch (err) {
    console.error("🔥 routeMessage error:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "エラーが発生しました。もう一度試してください。"
    });
  }
};