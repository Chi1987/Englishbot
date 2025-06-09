const { saveSession } = require("../utils/session");
const checkJapaneseGrammar = require("../utils/checkJapaneseGrammar");

module.exports = async function handleJapaneseInput({ event, client, session }) {
  const userId = event.source.userId;
  const input = event.message.text.trim();

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
  const grammarFeedbackLines = await checkJapaneseGrammar(inputs);
  const grammarFeedbackText = [
    "3文すべて受け取りました！では確認してみましょう。",
    "",
    ...grammarFeedbackLines
  ].join("\n");

  // セッションを更新（次ステップへ）
  updatedSession.currentStep = "awaitingTranslationWords";
  updatedSession.currentSegmentIndex = 0;
  updatedSession.translatedWords = [];
  updatedSession.translationSegments = [];

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

  return await client.replyMessage(event.replyToken, messages);
};
