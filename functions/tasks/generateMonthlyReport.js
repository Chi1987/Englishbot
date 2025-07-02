// functions/tasks/generateMonthlyReport.js
const admin = require("../utils/firebaseAdmin");
const nodemailer = require("nodemailer");
const dayjs = require("dayjs");
require("dayjs/locale/ja");
dayjs.locale("ja");

const db = admin.firestore();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function generateMonthlyReport() {
  const today = dayjs();
  const sessionsSnapshot = await db.collection("sessions").get();
  const usersToReport = [];

  for (const doc of sessionsSnapshot.docs) {
    const data = doc.data();
    const userId = doc.id;
    
    // セッションデータが存在しない場合をチェック
    if (!data) continue;
    
    const userdata = await db
      .collection("users")
      .doc(userId)
      .get();
    const userData = userdata.data();
    if (!userdata.exists || !userData?.joinedAt || userData?.plan !== "full") continue;

    // joinedAtのデータ形式を確実に処理（Firestore Timestamp型と文字列型の両方に対応）
    let joinedAt;
    if (userData.joinedAt && typeof userData.joinedAt.toDate === 'function') {
      // Firestore Timestamp型の場合
      joinedAt = dayjs(userData.joinedAt.toDate());
    } else if (userData.joinedAt) {
      // 文字列型の場合
      joinedAt = dayjs(userData.joinedAt);
    } else {
      continue; // joinedAtが無効な場合はスキップ
    }
    
    const daysPassed = today.diff(joinedAt, "day");
    
    // 先月の範囲を計算
    const lastMonth = today.subtract(1, 'month');
    const lastMonthStart = lastMonth.startOf('month');
    const lastMonthEnd = lastMonth.endOf('month');
    
    // ユーザーが先月開始前に参加していることを確認
    if (joinedAt.isAfter(lastMonthEnd)) continue;

    // 先月のデータのみを取得
    const lastMonthStartStr = lastMonthStart.format('YYYYMMDD');
    const lastMonthEndStr = lastMonthEnd.format('YYYYMMDD');
    
    const scoresSnapshot = await db
      .collection("scores")
      .doc(userId)
      .collection("daily")
      .where(admin.firestore.FieldPath.documentId(), '>=', lastMonthStartStr)
      .where(admin.firestore.FieldPath.documentId(), '<=', lastMonthEndStr)
      .get();

    // スコアデータが存在しない場合をチェック
    if (scoresSnapshot.empty) continue;
    
    const scoreDocs = scoresSnapshot.docs.map((d) => d.data()).filter(Boolean);
    const totalEntries = scoreDocs.length;
    
    // 有効なスコアデータがない場合はスキップ
    if (totalEntries === 0) continue;

    const grammarStats = {
      noSubject: 0,
      tense: 0,
      article: 0,
      other: 0,
    };
    let englishMistakes = 0;
    let unknownWordCount = 0;
    const unknownWordSet = new Set();

    for (const entry of scoreDocs) {
      // entryがnullまたはundefinedの場合をチェック
      if (!entry) continue;
      
      // 新しいerrorCounts構造から文法統計を集計
      if (entry.errorCounts && typeof entry.errorCounts === 'object') {
        grammarStats.noSubject += entry.errorCounts.subjectMissing || 0;
        grammarStats.tense += entry.errorCounts.tenseErrors || 0;
        grammarStats.article += entry.errorCounts.articleErrors || 0;
        grammarStats.other += entry.errorCounts.others || 0;
      }

      // 英文ミス回数を累積
      if (entry.englishMistakes && typeof entry.englishMistakes === 'number') {
        englishMistakes += entry.englishMistakes;
      }

      // unknownWordsが配列であることを確認
      const unknown = Array.isArray(entry.unknownWords) ? entry.unknownWords : [];
      unknownWordCount += unknown.length;
      unknown.forEach((w) => {
        if (w && typeof w === 'string') {
          unknownWordSet.add(w);
        }
      });
    }

    usersToReport.push({
      userId,
      name: data.name || "(no name)",
      birthday: data.birthday || "(未設定)",
      daysPassed,
      totalEntries,
      grammarStats: grammarStats || { noSubject: 0, tense: 0, article: 0, other: 0 },
      englishMistakes: englishMistakes || 0,
      unknownWordCount: unknownWordCount || 0,
      unknownWords: Array.from(unknownWordSet) || [],
    });
  }

  if (usersToReport.length === 0) {
    console.log("No users to report today.");
    return;
  }

  const report = usersToReport
    .map((u) => {
      return [
        `・ ${u.name}（${u.userId}）`,
        `誕生日: ${u.birthday}`,
        `参加日数: ${u.daysPassed}日`,
        `記録日数: ${u.totalEntries}日`,
        "",
        "■ よくある文法ミス：",
        `・主語抜け：${u.grammarStats.noSubject}回`,
        `・時制ミス：${u.grammarStats.tense}回`,
        `・冠詞ミス：${u.grammarStats.article}回`,
        `・その他：${u.grammarStats.other}回`,
        "",
        `■ 英文作成の誤り：${u.englishMistakes}回`,
        `■ 単語が分からなかった回数：「わからない」${u.unknownWordCount}回`,
        "",
        u.unknownWords.length > 0
          ? `わからなかった単語:\n- ${u.unknownWords.join("\n- ")}`
          : "わからなかった単語: なし",
      ].join("\n");
    })
    .join("\n------------------\n\n");

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: "【月次レポート】30日経過ユーザー成績",
    text: report,
  });

  console.log("✅ Monthly report sent.");
}

module.exports = { generateMonthlyReport };
