// utils/wordLookup.js
const { chatCompletion } = require("./openaiClient");

async function getEnglishWordFor(japanesePhrase, currentPrompt) {
  const prompt = [
    "あなたは英語講師であり、初心者にもわかりやすく説明する役割です。",
    "質問者は元文に対して各文節に分けた日本語単語について質問します。",
    "お題の中にある日本語単語または表現について、英語での自然な言い回しを説明してください。",
    "",
    "必ず以下のJSON形式で回答してください：",
    "{",
    "  \"englishWord\": \"英単語\",",
    "  \"explanation\": \"その英語表現が持つニュアンスや使い分け、日本語との微妙な意味の違い、使う場面の例や補足情報を初心者が理解しやすいように、簡潔かつ丁寧に日本語で説明\"",
    "}",
    "",
    "JSON形式以外では回答しないでください。元文を英訳して解答を教えるのはやめてください。あくまで自主性を重んじます。",
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
          `「${japanesePhrase}」は英語で何と言いますか？`,
          `元文は「${currentPrompt}」です`
        ].join("\n")
      }
    ]);

    const responseContent = res?.content?.trim();
    if (!responseContent) {
      throw new Error("Empty response from OpenAI API");
    }

    // Safe JSON parsing with fallback
    try {
      const jsonResponse = JSON.parse(responseContent);
      const { englishWord, explanation } = jsonResponse;
      
      // Validate required fields
      if (!englishWord || !explanation) {
        throw new Error("Missing required fields in API response");
      }
      
      return { englishWord, explanation };
    } catch (parseError) {
      console.error("JSON parsing failed for wordLookup:", parseError);
      console.error("Raw response:", responseContent);
      
      // Fallback response
      return {
        englishWord: japanesePhrase,
        explanation: "申し訳ございません。翻訳処理中にエラーが発生しました。もう一度お試しください。"
      };
    }
  } catch (apiError) {
    console.error("OpenAI API error in wordLookup:", apiError);
    
    // Fallback response for API errors
    return {
      englishWord: japanesePhrase,
      explanation: "現在、翻訳サービスに接続できません。しばらく時間をおいてからお試しください。"
    };
  }
}

module.exports = { getEnglishWordFor };
