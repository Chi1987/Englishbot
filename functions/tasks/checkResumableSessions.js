const admin = require("../utils/firebaseAdmin");
const { getNextPrompt } = require("../utils/getNextPrompt");
const db = admin.firestore();

async function checkResumableSessions(client) {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setSeconds(0);
  jst.setMilliseconds(0);
  const isoTime = jst.toISOString(); // resumeAt に等しく使える形式


  const snapshot = await db.collection("sessions")
    .where("paused", "==", true)
    .where("resumeAt", "==", isoTime)
    .get();

  if (snapshot.empty) {
    console.log("No resumable sessions found.");
    return;
  }

  const promises = snapshot.docs.map(async doc => {
    const userId = doc.id;
    const result = await getNextPrompt(userId);

    // LINE通知を送信
    const msg = {
      type: "text",
      text: `そろそろ再開しませんか？\n「${result?.text}」のお題が残っています。`,
      quickReply: {
        items: [
          {
            type: "action",
            action: { type: "message", label: "今やる", text: "今やる" }
          },
          {
            type: "action",
            action: { type: "message", label: "あとでやる", text: "あとでやる" }
          }
        ]
      }
    };

    await client.pushMessage(userId, msg);

    // セッション状態を更新（paused解除、ステップ復元）
    await doc.ref.update({
      paused: false,
      currentStep: "awaitingJapanese"
    });
  });

  try {
    await Promise.all(promises);
    console.log(`✅ Resumed ${snapshot.size} sessions`);
  } catch (error) {
    console.error('❌ Error processing sessions:', error);
    throw error;
  }
}

module.exports = { checkResumableSessions };
