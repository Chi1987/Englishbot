const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Buffer } = require("buffer");

/**
 * LINEから音声データを取得してWhisper APIで文字起こし
 * @param {string} messageId - LINE音声メッセージID
 * @param {string} accessToken - LINEアクセストークン
 * @returns {Promise<string>}
 */
async function speechToText(messageId, accessToken) {
  try {
    // LINEから音声データを取得
    const audioResponse = await axios.get(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      responseType: 'arraybuffer'
    });

    const audioBuffer = Buffer.from(audioResponse.data);
    const tempFilePath = path.join(__dirname, `temp_${messageId}.m4a`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    // OpenAI Whisper APIで文字起こし（英語のまま出力）
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
      language: "en"
    });

    // 一時ファイルを削除
    fs.unlinkSync(tempFilePath);
    return response.text.trim();
  } catch (error) {
    console.error("音声処理エラー:", error);
    throw error;
  }
}

module.exports = {speechToText};
