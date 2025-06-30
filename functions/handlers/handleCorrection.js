 
const { saveSession } = require("../utils/session");
const checkEnglishGrammar = require("../utils/checkEnglishGrammar");
const checkPronunciation = require("../utils/checkPronunciation");

module.exports = async function handleCorrection({ event, client, session }, audioScript = null) {
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
  const { isCorrect, feedback } = await checkEnglishGrammar(userSentence, fullSentence);
  
  // ✅ 発音チェック（音声入力の場合のみ）
  let pronunciationFeedback = null;
  if (audioScript) {
    const pronunciationResult = await checkPronunciation(userSentence);
    pronunciationFeedback = pronunciationResult;
  }

  if (isCorrect) {
    const messages = [];
    if(segmentStep === "done"){
      await saveSession(userId, {
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
      await saveSession(userId, {
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
    let correctionText = [
      "まだ修正点があります。",
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
    correctionText.push("もう一度トライしてみてください。");

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: correctionText.join("\n")
    });
  }
};
