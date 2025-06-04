const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function chatCompletion(messages) {
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages
  });
  return res.choices[0].message;
}

module.exports = { chatCompletion };
