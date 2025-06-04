/* eslint-disable */
const { saveSession } = require("../utils/session");
const checkJapaneseGrammar = require("../utils/checkJapaneseGrammar");
const segmentJapanese = require("./segmentJapanese"); // ✅ handlers配下にあるのでOK（このままで良い）


module.exports = async function handleJapaneseInput({ event, client, session }) {
  const userId = event.source.userId;
  const input = Array.isArray(session.japaneseInput) ? session.japaneseInput : [];
  const updated = [...input, event.message.text];

  // 🔁 まだ3文未満なら保存してリプライ
  if (updated.length < 3) {
    await saveSession(userId, {
      ...session,
      currentStep: "awaitingJapanese",
      japaneseInput: updated
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: `受け取りました。あと ${3 - updated.length} 文です。`
    });

    return;
  }

  // ✅ 3文揃ったらフィードバック・文節分解して次へ
  const feedback = await checkJapaneseGrammar(updated);
  const allSegments = await segmentJapanese(updated);

  await saveSession(userId, {
    ...session,
    currentStep: "awaitingTranslationWords",
    japaneseInput: updated,
    translationSegments: allSegments,
    translatedWords: [],
    currentSegmentIndex: 0
  });

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: [
      "3文受け取りました！",
      "【フィードバック】",
      ...feedback,
      "",
      `「${allSegments[0]}」を英語にすると？`
    ].join("\n")
  });
};

