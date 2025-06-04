// functions/tasks/generateMonthlyReport.js
const admin = require("../utils/firebaseAdmin");
const nodemailer = require("nodemailer");
const dayjs = require("dayjs");
require("dayjs/locale/ja");
dayjs.locale("ja");
require("dotenv").config();

// ✅ initializeApp を重複させない
if (!admin.apps.length) {
  admin.initializeApp();
}

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
    if (!data.joinedAt) continue;

    const joinedAt = dayjs(data.joinedAt);
    const daysPassed = today.diff(joinedAt, "day");
    if (daysPassed < 30) continue;

    const scoresSnapshot = await db
      .collection("scores")
      .doc(userId)
      .collection("daily")
      .get();

    const scoreDocs = scoresSnapshot.docs.map((d) => d.data());
    const totalEntries = scoreDocs.length;

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
      const g = entry.grammarIssues || {};
      grammarStats.noSubject += g.noSubject || 0;
      grammarStats.tense += g.tense || 0;
      grammarStats.article += g.article || 0;
      grammarStats.other += g.other || 0;

      if (entry.englishMistake) englishMistakes++;

      const unknown = entry.unknownWords || [];
      unknownWordCount += unknown.length;
      unknown.forEach((w) => unknownWordSet.add(w));
    }

    usersToReport.push({
      userId,
      name: data.name || "(no name)",
      birthday: data.birthday || "",
      daysPassed,
      totalEntries,
      grammarStats,
      englishMistakes,
      unknownWordCount,
      unknownWords: Array.from(unknownWordSet),
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
