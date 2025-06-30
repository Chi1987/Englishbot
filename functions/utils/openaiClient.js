// utils/openaiClient.js
const { OpenAI } = require("openai");
require("dotenv").config();

// API key validation
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout
  maxRetries: 2 // Retry failed requests up to 2 times
});

// Rate limiting configuration
const API_RATE_LIMIT = {
  requestsPerMinute: 50,
  requestQueue: [],
  lastRequestTime: 0
};

/**
 * Rate limiting helper
 */
function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - API_RATE_LIMIT.lastRequestTime;
  const minInterval = 60000 / API_RATE_LIMIT.requestsPerMinute; // ms between requests
  
  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  API_RATE_LIMIT.lastRequestTime = now;
  return Promise.resolve();
}

/**
 * messages形式（system, user）のChat API
 */
async function chatCompletion(messages) {
  await waitForRateLimit();
  
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      temperature: 0,
      max_tokens: 2000
    });
    
    if (!res.choices || !res.choices[0] || !res.choices[0].message) {
      throw new Error("Invalid response structure from OpenAI API");
    }
    
    return res.choices[0].message;
  } catch (error) {
    console.error("❌ OpenAI API error in chatCompletion:", error);
    
    // Return fallback response
    return {
      role: "assistant",
      content: "申し訳ございません。AIサービスに一時的に接続できません。しばらく時間をおいてからお試しください。"
    };
  }
}

/**
 * string型のプロンプトで応答を取得する汎用メソッド
 */
async function getGptResponse(prompt) {
  await waitForRateLimit();
  
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 2000
    });
    
    if (!res.choices || !res.choices[0] || !res.choices[0].message) {
      throw new Error("Invalid response structure from OpenAI API");
    }
    
    return res.choices[0].message.content;
  } catch (error) {
    console.error("❌ OpenAI API error in getGptResponse:", error);
    
    // Return fallback response
    return "申し訳ございません。AIサービスに一時的に接続できません。しばらく時間をおいてからお試しください。";
  }
}

/**
 * Whisper API for speech-to-text
 */
async function speechToText(audioStream) {
  await waitForRateLimit();
  
  try {
    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "en"
    });
    
    if (!response || !response.text) {
      throw new Error("Empty response from Whisper API");
    }
    
    return response.text.trim();
  } catch (error) {
    console.error("❌ Whisper API error:", error);
    throw error; // Re-throw for proper error handling in caller
  }
}

module.exports = {
  chatCompletion,
  getGptResponse,
  speechToText
};
