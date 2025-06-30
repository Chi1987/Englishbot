// utils/checkPronunciation.js
const { chatCompletion } = require("./openaiClient");

/**
 * 文字起こし結果から発音フィードバックを生成
 * @param {string} transcript - Whisperで文字起こしされたテキスト
 * @param {string} expectedText - 期待される正しいテキスト（オプション）
 * @returns {Promise<{ feedback: string, tips: string }>}
 */
module.exports = async function checkPronunciation(transcript) {
  console.log("発音チェック開始 - transcript:", transcript);
  
  let prompt;
  // 一般的な発音フィードバック
  prompt = [
    "以下の英語音声認識結果から、発音の特徴や改善点を分析してください。",
    "日本人学習者向けに、発音のコツやアドバイスを日本語で簡潔に提供してください。",
    "",
    `音声認識結果: ${transcript}`,
    "",
    "以下の観点でフィードバックしてください:",
    "・単語の発音で気をつけるポイント",
    "・イントネーションやリズムのアドバイス",
    "・日本人が苦手な音があれば具体的なコツ"
  ].join("\n");

  const res = await chatCompletion([
    { 
      role: "system", 
      content: "あなたは英語発音指導の専門家です。日本人学習者の発音改善を支援し、建設的で励ましのあるフィードバックを提供してください。"
    },
    { role: "user", content: prompt }
  ]);

  const feedback = res.content.trim();
  
  // 簡単な発音Tips生成
  const tipsPrompt = [
    "以下の英文について、日本人が発音しやすくなる具体的なコツを1-2個、簡潔に教えてください。",
    "",
    `英文: ${transcript}`,
    "",
    "例: 「think」の「th」は舌を軽く噛んで息を吐く"
  ].join("\n");

  const tipsRes = await chatCompletion([
    { 
      role: "system", 
      content: "発音指導の専門家として、実践的なコツを日本語で簡潔に教えてください。"
    },
    { role: "user", content: tipsPrompt }
  ]);

  return {
    feedback: feedback,
    tips: tipsRes.content.trim()
  };
};