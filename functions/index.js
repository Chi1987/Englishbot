// 環境変数の読み込み
require('dotenv').config();

// Firebase Functions & Admin
const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("./utils/firebaseAdmin");

// 外部モジュール
const express = require("express");
const { middleware } = require("@line/bot-sdk");
const line = require("@line/bot-sdk");
const cors = require("cors")({ origin: true });

// ユーザ定義
const routeMessage = require("./handlers/routeMessage");
const { generateMonthlyReport } = require("./tasks/generateMonthlyReport");
const { checkResumableSessions } = require("./tasks/checkResumableSessions");

// ✅ Secretsの定義
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// LINE Bot 設定
let config;
try {
    config = {
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
        channelSecret: process.env.LINE_CHANNEL_SECRET
    };
} catch (error) {
    console.error('Failed to load configuration:', error);
    config = {
        channelAccessToken: '',
        channelSecret: '',
    };
}

// 設定チェック
if (!config.channelAccessToken || !config.channelSecret) {
    console.error('LINE Bot configuration missing.');
    console.error('Please set environment variables in .env file:');
    console.error('LINE_CHANNEL_ACCESS_TOKEN=your_access_token');
    console.error('LINE_CHANNEL_SECRET=your_secret');
}

let client;
try {
    client = new line.Client(config);
    console.log('LINE Bot initialized:', {
        hasAccessToken: !!config.channelAccessToken,
        hasSecret: !!config.channelSecret
    });
} catch (error) {
    console.error('Failed to initialize LINE client:', error);
}

const app = express();

// ✅ Stripe Webhook/API用にrawBodyを保持するための設定
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

// --- 共通ヘルパー：トークンからUserIDを特定する (POCより移植) ---
async function getUserIdFromToken(token) {
  if (!token) return null;
  const tokenRef = admin.firestore().collection("temp_tokens").doc(token);
  const snap = await tokenRef.get();
  if (!snap.exists) {
    console.warn(`⚠️ Token not found in Firestore: ${token}`);
    return null;
  }
  const data = snap.data();
  await tokenRef.delete(); // ワンタイム

  // 1分40秒（100,000ms）以上経過していたら無効
  if (Date.now() - data.createdAt > 100000){ 
    console.warn(`⏰ Token expired: ${token}`);
    await tokenRef.delete(); // 期限切れなら削除
    return null; 
  }
  return data.userId;
}

/**
 * 1. LINE Webhookエントリーポイント (既存ロジック維持)
 */
app.post("/", middleware(config), async (req, res) => {
    const events = req.body.events;
    if (!events || events.length === 0) {
        return res.status(200).send("No events");
    }
    
    let replyToken = events[0].replyToken;
    console.log("replyToken:", replyToken);
    
    try {
        for (const event of events) {
            console.log("📨 Processing event:", {
              type: event.type,
              messageId: event.message?.id,
              userId: event.source?.userId,
              isRedelivery: event.deliveryContext?.isRedelivery
            });
            
            replyToken = event.replyToken;
            
            // 再配信チェック
            if (event.deliveryContext?.isRedelivery) {
                console.log("🔄 LINE redelivery detected, skipping:", event.message?.text);
                continue;
            }
            
            // メッセージ処理
            if (event.type === "message") {
                await routeMessage({ event, client });
            }
        }
        
        console.log("✅ イベント処理完了");
        res.status(200).send("OK");
    } catch(error) {
        console.error("❌ エラーが発生しました:", error);
        
        if (error.originalError?.response) {
            console.error("📄 レスポンス:", error.originalError.response);
        }
        if (error.originalError?.response?.data) {
            console.error("📋 レスポンス詳細:", error.originalError.response.data);
        }
        
        // エラー時の安全な応答
        try {
            if (replyToken && !replyToken.startsWith('00000000')) {
                await client.replyMessage(replyToken, {
                    type: "text",
                    text: "ごめんね、ちょっと調子が悪いみたい💦もう一度話しかけてね！",
                });
            }
        } catch (replyError) {
            console.error("❌ Error sending error reply:", replyError);
        }
        
        res.status(200).send("OK but error");
    }
});

// ✅ LINE Webhook エクスポート
exports.webhook = functions.https.onRequest({
  region: 'asia-northeast1',
  cors: true,
  timeoutSeconds: 60,
  memory: '256MiB',
  invoker: 'public'
}, app);

/**
 * 2. Stripe Checkout Session作成 (価格ID更新済み)
 */
exports.createCheckoutSession = functions.https.onRequest({ 
    region: "asia-northeast1",
    secrets: [STRIPE_SECRET_KEY] 
}, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
      const { token } = req.body;
      const userId = await getUserIdFromToken(token);

      if (!userId) return res.status(403).json({ error: "Invalid or expired token" });

      const stripe = require("stripe")(STRIPE_SECRET_KEY.value());
      const baseUrl = "https://stripe-payment-server-10493.web.app"; 

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        // ✅ 最新の価格IDに更新
        line_items: [{ price: "price_1T92qc3A9c9y8xF3CvnqcYLy", quantity: 1 }],
        metadata: { userId },
        success_url: `${baseUrl}/success.html`,
        cancel_url: `${baseUrl}/cancel.html`,
      });
      return res.json({ url: session.url });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "internal_error" });
    }
  });
});

/**
 * 3. Stripe Customer Portal作成
 */
exports.createPortalSession = functions.https.onRequest({ 
    region: "asia-northeast1",
    secrets: [STRIPE_SECRET_KEY]
}, async (req, res) => {
  cors(req, res, async () => {
    try {
      const { token } = req.body;
      const userId = await getUserIdFromToken(token);
      if (!userId) return res.status(403).json({ error: "Invalid token" });

      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      const userData = userDoc.data();
      if (!userData?.stripeCustomerId) return res.status(400).send("Customer not found");

      const stripe = require("stripe")(STRIPE_SECRET_KEY.value());
      const session = await stripe.billingPortal.sessions.create({
        customer: userData.stripeCustomerId,
        return_url: "https://stripe-payment-server-10493.web.app/cancel.html", 
      });
      return res.json({ url: session.url });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "internal_error" });
    }
  });
});

/**
 * 4. Stripe Webhook (自動更新・解約同期)
 */
exports.stripeWebhook = functions.https.onRequest({ 
    region: "asia-northeast1",
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]
}, async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const stripe = require("stripe")(STRIPE_SECRET_KEY.value());
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    
    const session = event.data.object;
    const db = admin.firestore();

    switch (event.type) {
      case "checkout.session.completed":
        if (session.metadata?.userId) {
          await db.collection("users").doc(session.metadata.userId).set({
            plan: "full",
            purchased: true,
            status: "active",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          
          await client.pushMessage(session.metadata.userId, {
            type: "text",
            //フルプラン
            text: "Butterfly Effect へようこそ！🦋\n今日から音声入力を含むすべての機能がご利用いただけます。"
          });
        }
        break;

      case "invoice.paid":
        const userQuery = await db.collection("users").where("stripeCustomerId", "==", session.customer).limit(1).get();
        if (!userQuery.empty) {
          await userQuery.docs[0].ref.update({
            status: "active",
            purchased: true,
            plan: "full",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        break;

      case "customer.subscription.deleted":
        const subQuery = await db.collection("users").where("stripeSubscriptionId", "==", session.id).limit(1).get();
        if (!subQuery.empty) {
            const userDoc = subQuery.docs[0];
            // ここで userId を定義します
            const userId = userDoc.id;

            await userDoc.ref.update({ status: "canceled", purchased: false, plan: "lite" });
            
            // 3. ✅ LINE Appへメッセージを即時送信
            try {
                await client.pushMessage(userId, {
                        type: "text",
                        text: "解約手続きが完了しました。\nこれまでButterfly Effectをご利用いただき、ありがとうございました。🦋\n\nあなたが踏み出した一歩を、心から尊敬します。\nこれからも、あなたの英語学習を応援しています。\n\nまたいつでも、再開をお待ちしております。"
                        });
                        console.log(`✅ Cancellation message sent to: ${userId}`);
            } catch (lineError) {
                    console.error("❌ LINE Push Error:", lineError);
            }
            
        }
        break;
    }
    return res.status(200).send("ok");
  } catch (e) {
    console.error("⚠️ Stripe Webhook Error:", e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
});

/**
 * 5. スケジューラー系 (既存ロジック維持)
 */
exports.scheduledSessionResume = functions.scheduler.onSchedule({
  schedule: "0 * * * *",
  timeZone: "Asia/Tokyo",
  region: "asia-northeast1"
}, async () => {
  console.log("⏰ Running scheduled session check...");
  await checkResumableSessions(client);
});

exports.scheduledMonthlyReport = functions.scheduler.onSchedule({
  schedule: "0 8 1 * *",
  timeZone: "Asia/Tokyo",
  region: "asia-northeast1"
}, async () => {
  console.log("📅 Running monthly report generation...");
  await generateMonthlyReport();
});