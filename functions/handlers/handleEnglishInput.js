 
const saveScoreAndUpdateSession = require("../utils/saveScoreAndUpdateSession");
const checkEnglishGrammar = require("../utils/checkEnglishGrammar");
const checkPronunciation = require("../utils/checkPronunciation");
const admin = require("../utils/firebaseAdmin");
const analyzeUserTopics = require("../utils/analyzeUserTopics");
const generateTopicsByCategory = require("../utils/generateTopicsByCategory");
const saveCustomTopics = require("../utils/saveCustomTopics");
const createSuccessMessage = require("../utils/createSuccessMessage");

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
  const { isCorrect, feedback, errorCounts } = await checkEnglishGrammar(userSentence, fullSentence);
  
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
    errorCounts: errorCounts || null,
    englishMistakes: isCorrect ? 0 : 1,
    pronunciationFeedback: pronunciationFeedback || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };

  // ✅ セッション更新＆返信
  if (isCorrect) {
    const messages = [];
    if(segmentStep === "done"){
      // 正解だった場合
      let nextPromptIndex = session.nextPromptIndex;
      let topics = "";

      // 30問完了後の自動生成フェーズ
      if (nextPromptIndex > 30) {
        const category = await analyzeUserTopics(userId);
        const generatedTopics = await generateTopicsByCategory(category);
        await saveCustomTopics(userId, generatedTopics[0], category);

        topics = generatedTopics[0];
      }
      // アトミックなスコア保存とセッション更新
      await saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {
        ...session,
        currentStep: null,
        topics: topics,
        questionFlag: true
      });
      const successMessages = createSuccessMessage(pronunciationFeedback);
      messages.push(...successMessages);
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
      const successMessages = createSuccessMessage(pronunciationFeedback);
      messages.push(...successMessages);
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

