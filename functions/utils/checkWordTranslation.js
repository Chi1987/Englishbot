// utils/checkWordTranslation.js
const { chatCompletion } = require("./openaiClient");

/**
 * ユーザーの単語翻訳が正解かどうかを判定し、フィードバックを返す
 * @param {string} japaneseWord - 日本語の単語
 * @param {string} userTranslation - ユーザーの翻訳
 * @param {string} fullSentence - 元の文全体（文脈用）
 * @returns {Promise<{isCorrect: boolean, correctAnswer: string, explanation: string, feedback: string}>}
 */
async function checkWordTranslation(japaneseWord, userTranslation, fullSentence) {
  const prompt = [
    "あなたは英語講師です。日本語単語の英語翻訳が正解かどうかを判定してください。",
    "文脈を考慮して、適切な翻訳かどうかを判断してください。",
    "",
    "必ず以下のJSON形式で回答してください：",
    "{",
    "  \"isCorrect\": true/false,",
    "  \"correctAnswer\": \"正解の英単語\",", 
    "  \"explanation\": \"正解の単語の意味や使い方の説明\",",
    "  \"feedback\": \"ユーザーへのフィードバック\"",
    "}",
    "",
    "判定基準：",
    "- 完全に正解でなくても、文脈的に適切であれば正解とする",
    "- 品詞や形が少し違っても意味が通じれば正解とする",
    "- 明らかに意味が違う場合は不正解とする",
    "フェードバック:",
    "1. 単語が正しい：◎の記号を付けて「正しい単語です」と表示",
    "2. 単語が意味的に不適切：✖の記号を付けて、正しい表現と理由を説明",
    "3. 単語が微妙（文脈次第）：△の記号を付けて、適切な文脈を説明",
    "以下はフィードバックの例です。",
    "ユーザー：food",
    "AI：",
    "✖「food」はやや不自然な表現です。食事を意味する場合、\"lunch\"や\"dinner\"のように、時間帯に応じた語を使うと自然です😊",
    "",
    "JSON形式以外では回答しないでください。"
  ].join("\n");

  try {
    const res = await chatCompletion([
      {
        role: "system",
        content: prompt
      },
      {
        role: "user",
        content: [
          `日本語単語：「${japaneseWord}」`,
          `ユーザーの翻訳：「${userTranslation}」`,
          `文脈：「${fullSentence}」`
        ].join("\n")
      }
    ]);

    const responseContent = res?.content?.trim();
    if (!responseContent) {
      throw new Error("Empty response from OpenAI API");
    }

    try {
      const jsonResponse = JSON.parse(responseContent);
      const { isCorrect, correctAnswer, explanation, feedback } = jsonResponse;
      
      // Validate required fields
      if (typeof isCorrect !== 'boolean' || !correctAnswer || !explanation || !feedback) {
        throw new Error("Missing required fields in API response");
      }
      
      return { isCorrect, correctAnswer, explanation, feedback };
    } catch (parseError) {
      console.error("JSON parsing failed for checkWordTranslation:", parseError);
      console.error("Raw response:", responseContent);
      
      // Fallback response
      return {
        isCorrect: false,
        correctAnswer: userTranslation,
        explanation: "翻訳の判定中にエラーが発生しました。",
        feedback: "申し訳ございません。もう一度お試しください。"
      };
    }
  } catch (apiError) {
    console.error("OpenAI API error in checkWordTranslation:", apiError);
    
    // Fallback response for API errors
    return {
      isCorrect: false,
      correctAnswer: userTranslation,
      explanation: "翻訳判定サービスに接続できません。",
      feedback: "しばらく時間をおいてからお試しください。"
    };
  }
}

module.exports = { checkWordTranslation };