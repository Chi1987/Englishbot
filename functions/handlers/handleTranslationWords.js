// handlers/handleTranslationWords.js
const { saveSession } = require("../utils/session");
const { getEnglishWordFor } = require("../utils/wordLookup"); // 英単語を返す関数
const { checkWordTranslation } = require("../utils/checkWordTranslation"); // 単語の正解判定機能
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
  const fullSentence = segments[sentence].join('');

  let englishWord;
  let explanation;
  let feedback;
  let unknownFlag = false;
  let isCorrect = false;
  
  if (userInput === "わからない") {
    // 英単語を取得してそのまま提示（ヒントではなく答え）
    const { englishWord: word, explanation: exp } = await getEnglishWordFor(currentSegment, fullSentence);
    englishWord = word;
    explanation = exp;
    feedback = `「${currentSegment}」は英語で「${englishWord}」です。\n${explanation}`;
    unknownFlag = true;
  } else {
    // ユーザーの翻訳を正解判定
    const result = await checkWordTranslation(currentSegment, userInput, fullSentence);
    isCorrect = result.isCorrect;
    englishWord = result.correctAnswer; // 正解の単語を保存
    explanation = result.explanation;
    feedback = result.feedback;
    
    if (!isCorrect) {
      // 不正解の場合、正解を含めたフィードバック
      feedback = [
        `「${userInput}」は惜しいです！`,
        `正解は「${englishWord}」です。`,
        explanation,
        result.feedback
      ].join("\n");
    }
  }

  translated.push(englishWord);

  // スコア記録用の今日の日付
  const today = new Date();
  const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, "");
  
  // 結果に応じてスコア保存
  if (unknownFlag) {
    const scoreData = {
      unknownWords: [currentSegment], // わからなかった日本語単語を保存
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // 非同期でスコア保存（メイン処理をブロックしない）
    saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {}).catch(error => {
      console.error('Failed to save unknown word:', error);
    });
  } else if (isCorrect) {
    const scoreData = {
      correctWords: [currentSegment], // 正解した日本語単語を保存
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // 非同期でスコア保存（メイン処理をブロックしない）
    saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {}).catch(error => {
      console.error('Failed to save correct word:', error);
    });
  } else {
    const scoreData = {
      incorrectWords: [{ japanese: currentSegment, userAnswer: userInput, correctAnswer: englishWord }], // 不正解の詳細を保存
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // 非同期でスコア保存（メイン処理をブロックしない）
    saveScoreAndUpdateSession(userId, scoreData, yyyyMMdd, {}).catch(error => {
      console.error('Failed to save incorrect word:', error);
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
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: [
        feedback,
        "",
        "単語の入力が完了しました！",
        "これらを並べて英文を作ってください。1文にまとめて送ってください。"
      ].join("\n")
    });
  } else {
    await saveSession(userId, {
      ...session,
      translatedWords: translated,
      currentSegmentIndex: nextIndex
    });
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: [
        feedback,
        "",
        "次の単語にいきます。",
        `「${segments[sentence][nextIndex]}」を英語にすると？`
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
};
