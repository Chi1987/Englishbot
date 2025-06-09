const { getGptResponse } = require("../utils/openaiClient");

module.exports = async function checkJapaneseGrammar(sentences) {
  const prompt = [
    "以下の日本語3文について、主語の有無・具体性・文法の観点からチェックしてください。",
    "",
    "【必須ルール】",
    "・主語がない場合は必ず「主語がありません」とだけ書いてください。",
    "・あいまいな語（例：お茶、テレビなど）は「何茶？どんな番組？」のように必ず具体性を求めてください。",
    "・問題がない文には『問題ありません』の一文だけで返してください。",
    "・指摘がある文には、最後に『※正しくは〜』と修正例をつけてください。",
    "・それ以外の余計な説明、理由、補足は禁止です。",
    "",
    "【出力フォーマット】",
    "【文1】〇〇〇",
    "【フィードバック1】〇〇〇",
    "【文2】〇〇〇",
    "【フィードバック2】〇〇〇",
    "【文3】〇〇〇",
    "【フィードバック3】〇〇〇",
    "",
    "以下の3文を確認してください：",
    ...sentences.map((s, i) => `【文${i + 1}】${s}`)
  ].join("\n");

  console.log("📨 Grammar Check Prompt:\n", prompt);

  let result;
  try {
    result = await getGptResponse(prompt);

    console.log("📩 GPT Raw Response:\n", result);

    if (!result || typeof result !== "string") {
      throw new Error("GPTから空の応答または不正な形式が返されました。");
    }

    const lines = result
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    console.log("✅ Parsed Feedback Lines:", lines);
    return lines.length > 0
      ? lines
      : ["文法フィードバックが取得できませんでした。"];

  } catch (e) {
    console.error("❌ 文法チェック中にエラー:", e);
    return ["文法チェック中にエラーが発生しました。"];
  }
};
