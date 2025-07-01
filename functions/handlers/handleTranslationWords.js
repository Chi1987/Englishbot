// handlers/handleTranslationWords.js
const { saveSession } = require("../utils/session");
const { getEnglishWordFor } = require("../utils/wordLookup"); // 英単語を返す関数
const saveScoreAndUpdateSession = require("../utils/saveScoreAndUpdateSession");
const admin = require("../utils/firebaseAdmin");

module.exports = async function handleTranslationWords({ event, client, session }) {
  const userId = event.source.userId;
  const userInput = event.message.text.trim();
  const segmentIndex = session.currentSegmentIndex || 0;
  const sentence = session.currentSentence || "sentence1";
  const segments = session.translationSegments || [];
  const translated = session.translatedWords || [];

  const currentSegment = segments[sentence][segmentIndex];

  let englishWord;
  let explanation;
  let unknownFlag = false;
  if (userInput === "わからない") {
    // 英単語を取得してそのまま提示（ヒントではなく答え）
    const fullSentence = segments[sentence].join('');
    const { englishWord: word, explanation: exp } = await getEnglishWordFor(currentSegment, fullSentence);
    englishWord = word;
    explanation = exp;
    unknownFlag = true;
  } else {
    englishWord = userInput;
  }

  translated.push(englishWord);

  // わからなかった単語を記録
  if (unknownFlag) {
    const today = new Date();
    const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, "");
    const scoreData = {
      unknownWords: [currentSegment], // わからなかった日本語単語を保存
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // 非同期でスコア保存（メイン処理をブロックしない）
    saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {}).catch(error => {
      console.error('Failed to save unknown word:', error);
    });
  }

  const nextIndex = segmentIndex + 1;

  if (nextIndex >= segments[sentence].length) {
    // 全ての単語が入力された
    if(sentence == "sentence3"){
      await saveSession(userId, {
        ...session,
        translatedWords: translated,
        currentStep: "awaitingEnglish",
        segmentStep: "done",
        currentSentence: "complete"
      });
    }else{
      let nextSentence = "sentence1";
      if(sentence === "sentence1"){
        nextSentence = "sentence2";
      }else if(sentence === "sentence2"){
        nextSentence = "sentence3";
      }
      await saveSession(userId, {
        ...session,
        translatedWords: translated,
        currentStep: "awaitingEnglish",
        segmentStep: "continue",
        currentSegmentIndex: 0,
        currentSentence: nextSentence
      });
    }
    if(unknownFlag){
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: [
          `「${currentSegment}」は英語で「${englishWord}」です。`,
          explanation,
          "単語の入力が完了しました！",
          "これらを並べて英文を作ってください。1文にまとめて送ってください。"
        ].join("\n")
      });
    }else{
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: [
          "単語の入力が完了しました！",
          "これらを並べて英文を作ってください。1文にまとめて送ってください。"
        ].join("\n")
      });
    }
  } else {
    await saveSession(userId, {
      ...session,
      translatedWords: translated,
      currentSegmentIndex: nextIndex
    });
    if(unknownFlag){
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: [
          `「${currentSegment}」は英語で「${englishWord}」です。`,
          explanation,
          "",
          "次の単語にいきます。",
          `「${segments[sentence][segmentIndex + 1]}」を英語にすると？`
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
    }else{
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `「${segments[sentence][nextIndex]}」を英語にすると？`,
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
  }
};
