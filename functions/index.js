/* eslint-disable */
// 環境変数の読み込み
require('dotenv').config();

// Firebase Functions v2のインポート
const {onRequest, onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const functions = require("firebase-functions");

// ユーザ定義
const routeMessage = require("./handlers/routeMessage");
const { generateMonthlyReport } = require("./tasks/generateMonthlyReport");
const express = require("express");
const { middleware, Client } = require("@line/bot-sdk");
const dotenv = require("dotenv");
dotenv.config();

const line = require("@line/bot-sdk");
const admin = require("firebase-admin");

// ✅ Firebase初期化（重複防止）
if (!admin.apps.length) {
  admin.initializeApp();
}

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
    console.error('Or use Firebase config: firebase functions:config:set line.access_token="YOUR_TOKEN" line.secret="YOUR_SECRET"');
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

// ✅ LINE Webhookエントリーポイント修正済み！
app.post("/webhook", middleware(config), async (req, res) => {
    const events = req.body.events;
    if (!events || events.length === 0) {
        return res.status(200).send("No events");
    }

    for (const event of events) {
        if (event.type === "message") {
            await routeMessage({ event, client });
        }
    }
    res.status(200).send("OK");
});

// ✅ Cloud Functions エクスポート
exports.webhook = functions.https.onRequest({
    region: 'asia-northeast1',
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    invoker: 'public'
}, app);

// ✅ （任意）スケジュール関数
// exports.generateMonthlyReport = functions.pubsub
//     .schedule("0 3 * * *")
//     .timeZone("Asia/Tokyo")
//     .onRun(async () => {
//         await generateMonthlyReport();
//     });
