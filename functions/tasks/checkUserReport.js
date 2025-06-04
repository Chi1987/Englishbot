const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

module.exports = async function checkUserReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshot = await db.collection("users").get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const joinedAt = data.joinedAt ? new Date(data.joinedAt) : null;

    if (joinedAt) {
      const diffDays = Math.floor((today - joinedAt) / (1000 * 60 * 60 * 24));

      if (diffDays === 30) {
        console.log(`📊 集計対象ユーザー: ${doc.id}`);

        // 成績データを取得
        const scoresSnap = await db.collection(`scores/${doc.id}/daily`).get();
        let total = 0;
        let count = 0;

        scoresSnap.forEach(s => {
          const d = s.data();
          total += (d.correctCount || 0);
          count++;
        });

        const average = count ? total / count : 0;

        // 管理者通知（仮：ログ出力）
        console.log(`📝 ユーザー ${doc.id} の平均正解数: ${average.toFixed(2)} / day`);
        // TODO: LINE Notify などで通知も可能
      }
    }
  }
};
