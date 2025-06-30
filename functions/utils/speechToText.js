const { speechToText: whisperTranscription } = require("./openaiClient");

const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { Buffer } = require("buffer");

/**
 * LINEから音声データを取得してWhisper APIで文字起こし
 * @param {string} messageId - LINE音声メッセージID
 * @param {string} accessToken - LINEアクセストークン
 * @returns {Promise<string>}
 */
async function speechToText(messageId, accessToken) {
  // Sanitize messageId to prevent path traversal
  const sanitizedId = messageId.replace(/[^a-zA-Z0-9]/g, '');
  const tempFilePath = path.join(os.tmpdir(), `temp_${sanitizedId}.m4a`);
  
  try {
    // Validate inputs
    if (!messageId || !accessToken) {
      throw new Error("messageId and accessToken are required");
    }
    
    // LINEから音声データを取得
    const audioResponse = await axios.get(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });

    if (!audioResponse.data || audioResponse.data.byteLength === 0) {
      throw new Error("Empty audio data received from LINE");
    }

    const audioBuffer = Buffer.from(audioResponse.data);
    
    // Write file safely
    fs.writeFileSync(tempFilePath, audioBuffer);
    console.log(`📁 Temporary audio file created: ${tempFilePath}`);

    // OpenAI Whisper APIで文字起こし（英語のまま出力）
    const transcriptionResult = await whisperTranscription(fs.createReadStream(tempFilePath));
    
    return transcriptionResult;
  } catch (error) {
    console.error("❌ 音声処理エラー:", error);
    throw error;
  } finally {
    // 一時ファイルを必ず削除（エラーが発生しても）
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`🗑️ Temporary file cleaned up: ${tempFilePath}`);
      }
    } catch (cleanupError) {
      console.error("❌ 一時ファイルの削除に失敗:", cleanupError);
    }
  }
}

module.exports = {speechToText};
