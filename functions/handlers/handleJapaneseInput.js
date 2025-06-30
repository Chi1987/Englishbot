const { saveSession } = require("../utils/session");
const checkJapaneseGrammar = require("../utils/checkJapaneseGrammar");
const segmentJapanese = require("./segmentJapanese");

module.exports = async function handleJapaneseInput({ event, client, session }) {
  const userId = event.source.userId;
  const input = event.message.text.trim();
  const currentPrompt = session.currentPrompt;
  const inputs = session.japaneseInput || [];
  inputs.push(input);

  const updatedSession = {
    ...session,
    japaneseInput: inputs,
  };

  const remaining = 3 - inputs.length;

  if (remaining > 0) {
    await saveSession(userId, updatedSession);
    return await client.replyMessage(event.replyToken, {
      type: "text",
      text: `受け取りました。あと ${remaining} 文です。`
    });
  }

  // ✅ 3文揃った：文法チェックフェーズへ
  const grammarFeedbackData = await checkJapaneseGrammar(inputs, currentPrompt);
  
  // フィードバックテキストを組み立て
  const grammarFeedbackLines = [
    "3文すべて受け取りました！では確認してみましょう。",
    "",
    `【文1】${grammarFeedbackData.sentence1.correctedSentence}`,
    `【フィードバック1】${grammarFeedbackData.sentence1.feedback}`,
    `【文2】${grammarFeedbackData.sentence2.correctedSentence}`,
    `【フィードバック2】${grammarFeedbackData.sentence2.feedback}`,
    `【文3】${grammarFeedbackData.sentence3.correctedSentence}`,
    `【フィードバック3】${grammarFeedbackData.sentence3.feedback}`
  ];
  
  const grammarFeedbackText = grammarFeedbackLines.join("\n");
  
  // 修正後の文を文節分割用に使用
  const correctedSentences = [
    grammarFeedbackData.sentence1.correctedSentence,
    grammarFeedbackData.sentence2.correctedSentence,
    grammarFeedbackData.sentence3.correctedSentence
  ];

  // 文節分割（修正後の文を使用）
  const segments = await segmentJapanese(correctedSentences);

  // セッションを更新（次ステップへ）
  updatedSession.currentStep = "awaitingTranslationWords";
  updatedSession.currentSegmentIndex = 0;
  updatedSession.currentSentence = "sentence1";
  updatedSession.translatedWords = [];
  updatedSession.translationSegments = segments;

  await saveSession(userId, updatedSession);

  // ✅ メッセージを分割して返信（LINEは500文字まで）
  const messages = [];
  const MAX_LENGTH = 400;
  for (let i = 0; i < grammarFeedbackText.length; i += MAX_LENGTH) {
    messages.push({
      type: "text",
      text: grammarFeedbackText.slice(i, i + MAX_LENGTH)
    });
  }
  messages.push({
    type: "text",
    text: [
      "次に英訳をしていきます。 ",
      "1単語ずつ、日本語を英単語に直しましょう。"  ,
      "※対象は「文1」だけです。文ごとに区切って進めていきます。",
      "まずは、文1から始めます。",
    ].join("\n")
  });
  messages.push({
    type: "text",
    text: `「${segments["sentence1"][0]}」を英語にすると？`,
    quickReply: {
      items: [
        {
          type: "action",
          action: { type: "message", label: "わからない", text: "わからない" }
        }
      ]
    }
  });

  return await client.replyMessage(event.replyToken, messages);
};
