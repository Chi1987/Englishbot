const { getGptResponse } = require("../utils/openaiClient");

module.exports = async function checkJapaneseGrammar(sentences, currentPrompt) {
  const prompt = [
    "お題に対して回答された3つの日本語文があります。",
    "以下の3つの日本語文を、それぞれ英語に翻訳しやすい形にまたお題に沿って修正してください。問題ない場合は問題なしと回答してください",
    "",
    "ただし、日本語として自然かどうかよりも「英語にしやすい構造」になっているかを重視してください。",
    "主語（私は／彼は／私の〜など）・目的語・所有格などが明確に含まれているかを確認し、",
    "たとえ日本語として少し不自然でも、英語の語順・意味要素が揃うように整えてください。",
    "",
    "例:",
    "・「仕事してます」→「私は私の仕事をしています」",
    "・「見てます」→「私はテレビを見ています」",
    "",
    "必ず以下のJSON形式で回答してください：",
    "{",
    '  "sentence1": {',
    '    "correctedSentence": "修正後の文",',
    '    "feedback": "修正理由とフィードバック"',
    '  },',
    '  "sentence2": {',
    '    "correctedSentence": "修正後の文",',
    '    "feedback": "修正理由とフィードバック"',
    '  },',
    '  "sentence3": {',
    '    "correctedSentence": "修正後の文",',
    '    "feedback": "修正理由とフィードバック"',
    '  }',
    "}",
    "",
    "JSON形式以外では回答しないでください。",
    "",
    "お題は以下です",
    `${currentPrompt}`,
    "以下の3文を確認してください：",
    ...sentences.map((s, i) => `文${i + 1}: ${s}`)
  ].join("\n");

  console.log("📨 Grammar Check Prompt:\n", prompt);

  let result;
  try {
    result = await getGptResponse(prompt);

    console.log("📩 GPT Raw Response:\n", result);

    if (!result || typeof result !== "string") {
      throw new Error("GPTから空の応答または不正な形式が返されました。");
    }

    // JSONが余分なテキスト付きで返ることがあるため正規化
    const jsonStart = result.indexOf("{");
    const jsonEnd = result.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd >= 0) {
      const jsonLike = result.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonLike);
      if (parsed && typeof parsed === 'object') {
        console.log("✅ Parsed Grammar Check JSON:", parsed);
        return parsed;
      }
    }
    
    throw new Error("JSON形式でのレスポンスの解析に失敗しました。");

  } catch (e) {
    console.error("❌ 文法チェック中にエラー:", e);
    return ["文法チェック中にエラーが発生しました。"];
  }
};
