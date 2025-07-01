// handlers/checkEnglishGrammar.js
const { chatCompletion } = require("../utils/openaiClient");

/**
 * 英文の文法チェックを行い、問題がないかとフィードバックを返す
 * @param {string} english - チェック対象の英文
 * @param {string} japaneseSentence - 元の日本文
 * @returns {Promise<{ isCorrect: boolean, feedback: string, errorCounts: { subjectMissing: number, tenseErrors: number, articleErrors: number, others: number } }>}
 */
module.exports = async function checkEnglishGrammar(english, japaneseSentence) {
  console.log("english:", english);
  const prompt = [
    "元の日本文に対して以下の英文をネイティブ視点で文法チェックし、以下のJSON形式で回答してください：",
    "{",
    '  "isCorrect": true/false,',
    '  "feedback": "日本語でのフィードバック（問題がない場合は空文字）",',
    '  "errorCounts": {',
    '    "subjectMissing": 主語抜けの回数,',
    '    "tenseErrors": 時制ミスの回数,',
    '    "articleErrors": 冠詞ミスの回数,',
    '    "others": その他の文法エラーの回数',
    "  }",
    "}",
    "",
    "各エラーカテゴリの回数を正確にカウントしてください。問題がない場合はすべて0にしてください。",
    "",
    `英文: ${english}`,
    `元の日本文: ${japaneseSentence}`
  ].join("\n");

  const res = await chatCompletion([
    { role: "system", content: "あなたは英語の先生です。JSON形式で正確に回答してください。" },
    { role: "user", content: prompt }
  ]);

  const content = res.content.trim();

  console.log("content:", content);

  try {
    const result = JSON.parse(content);
    
    // 必要なプロパティが存在することを確認
    if (typeof result.isCorrect === 'boolean' && 
        typeof result.feedback === 'string' &&
        result.errorCounts &&
        typeof result.errorCounts.subjectMissing === 'number' &&
        typeof result.errorCounts.tenseErrors === 'number' &&
        typeof result.errorCounts.articleErrors === 'number' &&
        typeof result.errorCounts.others === 'number') {
      
      return result;
    } else {
      throw new Error('Invalid JSON structure');
    }
  } catch (error) {
    console.error('JSON parse error:', error);
    console.error('Raw content:', content);
    
    // フォールバック: 従来の形式で返す
    const isCorrect = content.includes("問題なし") || content.includes("isCorrect\": true");
    return {
      isCorrect: isCorrect,
      feedback: isCorrect ? "" : content,
      errorCounts: {
        subjectMissing: 0,
        tenseErrors: 0,
        articleErrors: 0,
        others: isCorrect ? 0 : 1
      }
    };
  }
};
