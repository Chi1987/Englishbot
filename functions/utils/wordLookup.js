// utils/wordLookup.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
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
    ],
    temperature: 0
  });

  const jsonResponse = JSON.parse(res.choices[0].message.content.trim());
  const { englishWord, explanation } = jsonResponse;
  
  return { englishWord, explanation };
}

module.exports = { getEnglishWordFor };
