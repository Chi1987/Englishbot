const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

/**
 * LINEの音声データを文字起こし（Whisper API）
 * @param {Buffer} audioBuffer
 * @returns {Promise<string>}
 */
async function speechToText(audioBuffer) {
  const tempFilePath = path.join(__dirname, "temp.m4a");
  fs.writeFileSync(tempFilePath, audioBuffer);

  const form = new FormData();
  form.append("file", fs.createReadStream(tempFilePath));
  form.append("model", "whisper-1");

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(tempFilePath),
    model: "whisper-1"
  });

  fs.unlinkSync(tempFilePath);
  return response.text.trim();
}

module.exports = speechToText;
