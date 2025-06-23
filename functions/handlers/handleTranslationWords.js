// handlers/handleTranslationWords.js
const { saveSession } = require("../utils/session");
const { getEnglishWordFor } = require("../utils/wordLookup"); // 英単語を返す関数

module.exports = async function handleTranslationWords({ event, client, session }) {
  const userId = event.source.userId;
  const userInput = event.message.text.trim();
  const index = session.currentSegmentIndex || 0;
  const segments = session.translationSegments || [];
  const translated = session.translatedWords || [];

  const currentSegment = segments[index];

  let englishWord;
  let unknownFlag = false;
  if (userInput === "わからない") {
    // 英単語を取得してそのまま提示（ヒントではなく答え）
    englishWord = await getEnglishWordFor(currentSegment);
    unknownFlag = true;
  } else {
    englishWord = userInput;
  }

  translated.push(englishWord);

  const nextIndex = index + 1;

  if (nextIndex >= segments.length) {
    // 全ての単語が入力された
    await saveSession(userId, {
      ...session,
      translatedWords: translated,
      currentStep: "awaitingEnglish"
    });
    if(unknownFlag){
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: [
          `「${currentSegment}」は英語で「${englishWord}」です。`,
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
          `「${segments[index + 1]}」を英語にすると？`
        ].join("\n")
  
      });
    }else{
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `「${segments[nextIndex]}」を英語にすると？`
      });
    }
  }
};
