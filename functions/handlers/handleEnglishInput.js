 
const { saveSession, updateSessionSafely } = require("../utils/session");
const checkEnglishGrammar = require("../utils/checkEnglishGrammar");
const checkPronunciation = require("../utils/checkPronunciation");
const admin = require("../utils/firebaseAdmin");

module.exports = async function handleEnglishInput({ event, client, session }, audioScript = null) {
  const userId = event.source.userId;
  const segmentStep = session.segmentStep;
  const sentence = session.currentSentence || "sentence1";
  const segments = session.translationSegments || [];
  let userSentence = null;
  if(audioScript){
    userSentence = audioScript;
  }else{
    userSentence = event.message.text.trim();
  }
  let beforeSentence = "sentence1";
  if(sentence === "sentence2"){
    beforeSentence = "sentence1"
  }else if(sentence === "sentence3"){
    beforeSentence = "sentence2"
  }else if(sentence === "complete"){
    beforeSentence = "sentence3"
  }
  const fullSentence = segments[beforeSentence].join('');
  // ✅ 文法チェック（GPT）
  const { isCorrect, feedback } = await checkEnglishGrammar(userSentence, fullSentence);
  
  // ✅ 発音チェック（音声入力の場合のみ）
  let pronunciationFeedback = null;
  if (audioScript) {
    const pronunciationResult = await checkPronunciation(userSentence);
    pronunciationFeedback = pronunciationResult;
  }

  // ✅ スコアデータの準備
  const today = new Date();
  const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const scoreData = {
    userSentence,
    isCorrect,
    feedback: feedback || null,
    pronunciationFeedback: pronunciationFeedback || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };

  // ✅ セッション更新＆返信
  if (isCorrect) {
    const messages = [];
    if(segmentStep === "done"){
      // アトミックなスコア保存とセッション更新
      await saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {
        ...session,
        currentStep: null
      });
      let successText = "よくできました！この英文は正しく書けています。";
      if (pronunciationFeedback) {
        successText += "\n\n【発音フィードバック】\n" + pronunciationFeedback.feedback;
        if (pronunciationFeedback.tips) {
          successText += "\n\n【発音のコツ】\n" + pronunciationFeedback.tips;
        }
      }
      messages.push({
        type: "text",
        text: successText
      });
      messages.push({
        type: "text",
        text: "次のお題はいつやりますか？",
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
    }else if(segmentStep === "continue"){
      const segmentIndex = session.currentSegmentIndex || 0;
      const sentenceIndex = session.currentSentence || "sentence1";
      const segments = session.translationSegments || [];
      const currentSegment = segments[sentenceIndex][segmentIndex];
      
      // アトミックなスコア保存とセッション更新
      await saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {
        ...session,
        currentStep: "awaitingTranslationWords"
      });
      let successText = "よくできました！この英文は正しく書けています。";
      if (pronunciationFeedback) {
        successText += "\n\n【発音フィードバック】\n" + pronunciationFeedback.feedback;
        if (pronunciationFeedback.tips) {
          successText += "\n\n【発音のコツ】\n" + pronunciationFeedback.tips;
        }
      }
      messages.push({
        type: "text",
        text: successText
      });
      messages.push({
        type: "text",
        text: [
          "次の文を英訳していきましょう",
          `「${currentSegment}」を英語にすると？`
        ].join("\n"),
        quickReply: {
          items: [
            {
              type: "action",
              action: { type: "message", label: "わからない", text: "わからない" }
            }
          ]
        }
      });
    }

    await client.replyMessage(event.replyToken, messages);
  } else {
    // アトミックなスコア保存とセッション更新
    await saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {
      ...session,
      currentStep: "done",
      finalEnglish: userSentence,
      englishFeedback: feedback
    });

    let correctionText = [
      "英文に修正点があります。",
      "【文法フィードバック】",
      feedback
    ];
    
    if (pronunciationFeedback) {
      correctionText.push("");
      correctionText.push("【発音フィードバック】");
      correctionText.push(pronunciationFeedback.feedback);
      if (pronunciationFeedback.tips) {
        correctionText.push("");
        correctionText.push("【発音のコツ】");
        correctionText.push(pronunciationFeedback.tips);
      }
    }
    
    correctionText.push("");
    correctionText.push("もう一度修正してみてください。");

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: correctionText.join("\n")
    });
  }
};

/**
 * スコア保存とセッション更新をアトミックに実行
 * @param {string} userId - ユーザーID
 * @param {object} scoreData - スコアデータ
 * @param {string} yyyyMMdd - 日付文字列
 * @param {object} sessionData - セッションデータ
 */
async function saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, sessionData) {
  const db = admin.firestore();
  
  try {
    await db.runTransaction(async (transaction) => {
      // スコア参照とセッション参照
      const scoreRef = db.doc(`scores/${userId}/daily/${yyyyMMdd}`);
      const sessionRef = db.doc(`sessions/${userId}`);
      
      // 現在のデータを取得
      const currentSession = await transaction.get(sessionRef);
      const currentScore = await transaction.get(scoreRef);
      
      // スコアデータをマージ
      const existingScoreData = currentScore.exists ? currentScore.data() : {};
      const mergedScoreData = {
        ...existingScoreData,
        ...scoreData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // セッションデータをマージ
      const existingSessionData = currentSession.exists ? currentSession.data() : {};
      const mergedSessionData = {
        ...existingSessionData,
        ...sessionData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        version: (existingSessionData.version || 0) + 1
      };
      
      // アトミックに更新
      transaction.set(scoreRef, mergedScoreData);
      transaction.set(sessionRef, mergedSessionData);
    });
    
    console.log("✅ Score and session updated atomically");
  } catch (error) {
    console.error("❌ Atomic update failed:", error);
    
    // フォールバック: 非アトミック更新
    console.log("🔄 Falling back to non-atomic updates");
    try {
      const scoreRef = db.doc(`scores/${userId}/daily/${yyyyMMdd}`);
      await scoreRef.set(scoreData, { merge: true });
      await saveSession(userId, sessionData);
    } catch (fallbackError) {
      console.error("❌ Fallback update also failed:", fallbackError);
      throw fallbackError;
    }
  }
}
