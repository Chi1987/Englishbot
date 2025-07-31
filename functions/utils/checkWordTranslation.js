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
    "あなたは英語学習をサポートするLINE Botです。",
    "ユーザーは、日本語の単語・短い表現・文章を英語に訳すタスクに取り組んでいます。",
    "ユーザーの回答が、完全な英文でなくても否定してはいけません。",
    "",
    "必ず以下のJSON形式で回答してください：",
    "{",
    "  \"isCorrect\": true/false,",
    "  \"correctAnswer\": \"正解の英単語\",", 
    "  \"explanation\": \"正解の単語の意味や使い方の説明\",",
    "  \"feedback\": \"ユーザーへのフィードバック\"",
    "}",
    "",
    "【Botの振る舞いルール】",
    "1. 出題は「単語」または「短い表現の変換」であると仮定してください。",
    "2. ユーザーが入力した英語が意味として正しいなら、「◎正解です」と肯定してください。",
    "3. 文として未完成でも「主語がないから不正解」とは判定しないでください。",
    "4. 補足が必要な場合は、「文として使うなら…」「自然な表現としては…」など丁寧に案内してください。",
    "5. 不正解のときも「❌」ではなく、「より適切なのは…」という柔らかい言い回しで誘導してください。",
    "6. 最後は、出題された語をもとにユーザーが英文を作る指示で締めてください。",
    "フェードバック:",
    "1. 単語が正しい：◎の記号を付けて「正しい単語です」と表示",
    "2. 単語が意味的に不適切：✖の記号を付けて、正しい表現と理由を説明",
    "3. 単語が微妙（文脈次第）：△の記号を付けて、適切な文脈を説明",
    "以下はフィードバックの例です。",
    "",
    "Q：「食べ物」を英語にすると?。",
    "ユーザー：food",
    "Bot：",
    "✖「food」はやや不自然な表現です。食事を意味する場合、\"lunch\"や\"dinner\"のように、時間帯に応じた語を使うと自然です😊",
    "Q：「飲んでいます」を英語にすると？",
    "ユーザー：drinking",
    "Bot：◎「drinking」は正しい単語です！現在進行形の一部として使われます。文として使うなら「I am drinking」のようになりますね。",
    "Q：「思っています」を英語にすると？",
    "ユーザー：Think",
    "Bot：◎「think」は意味として正しい動詞です！文として使うなら「I think」や「I’m thinking」のようになります。",
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