const { db } = require("../firebase");
const { client } = require("../lineClient"); // 既存のMessagingAPI client使える前提

async function checkResumableSessions() {
  const now = new Date();

  const snapshot = await db.collection("sessions")
    .where("paused", "==", true)
    .where("resumeAt", "<=", now.toISOString())
    .get();

  if (snapshot.empty) {
    console.log("No resumable sessions found.");
    return;
  }

  const promises = [];

  snapshot.forEach(doc => {
    const session = doc.data();
    const userId = doc.id;

    // LINE通知を送信
    const msg = {
      type: "text",
      text: `そろそろ再開しませんか？\n「${session.currentPrompt}」のお題が残っています。`
    };

    promises.push(client.pushMessage(userId, msg));

    // セッション状態を更新（paused解除、ステップ復元）
    promises.push(doc.ref.update({
      paused: false,
      currentStep: "awaitingJapanese"
    }));
  });

  await Promise.all(promises);
  console.log(`✅ Resumed ${snapshot.size} sessions`);
}

module.exports = { checkResumableSessions };
