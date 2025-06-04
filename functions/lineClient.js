const { Client } = require("@line/bot-sdk");

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

module.exports = { client };
