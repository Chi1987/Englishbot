const { chatCompletion } = require("../utils/openaiClient");

module.exports = async function segmentJapanese(sentences) {
  const prompt = [
    "以下の日本語文を、それぞれ英語に翻訳しやすい形で文節に分けてください。",
    "各文ごとに文節を分けて、1文ごとに配列として格納してください。",
    "",
    `文1: ${sentences[0]}`,
    `文2: ${sentences[1]}`,
    `文3: ${sentences[2]}`,
    "",
    "必ず以下のJSON形式で返してください：",
    "{",
    '  "sentence1": ["文節1", "文節2", ...],',
    '  "sentence2": ["文節1", "文節2", ...],',
    '  "sentence3": ["文節1", "文節2", ...]',
    "}",
    "",
    "JSON形式以外では回答しないでください。"
  ].join("\n");

  const result = await chatCompletion([
    { role: "system", content: "あなたはプロの日本語教師です。" },
    { role: "user", content: prompt }
  ]);

  const raw = result?.content?.trim();

  console.log("📦 segmentJapanese result.content:", raw);

  try {
    // JSONが余分なテキスト付きで返ることがあるため正規化
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    
    if (jsonStart >= 0 && jsonEnd >= 0) {
      const jsonLike = raw.substring(jsonStart, jsonEnd + 1);
      
      try {
        const parsed = JSON.parse(jsonLike);
        
        // Validate structure
        if (parsed && typeof parsed === 'object' && 
            parsed.sentence1 && Array.isArray(parsed.sentence1) &&
            parsed.sentence2 && Array.isArray(parsed.sentence2) &&
            parsed.sentence3 && Array.isArray(parsed.sentence3)) {
          console.log("✅ Parsed Segment JSON:", parsed);
          return parsed;
        } else {
          throw new Error("Invalid JSON structure: missing required sentence arrays");
        }
      } catch (parseError) {
        console.error("❌ JSON parsing failed in segmentJapanese:", parseError);
        console.error("Raw JSON string:", jsonLike);
        
        // Fallback: simple word splitting
        return {
          sentence1: sentences[0] ? sentences[0].split(/[\s、。]+/).filter(s => s.length > 0) : ["文節分割失敗"],
          sentence2: sentences[1] ? sentences[1].split(/[\s、。]+/).filter(s => s.length > 0) : ["文節分割失敗"],
          sentence3: sentences[2] ? sentences[2].split(/[\s、。]+/).filter(s => s.length > 0) : ["文節分割失敗"]
        };
      }
    }
    
    // If no valid JSON structure found, return fallback
    console.error("❌ No valid JSON found in segment response");
    console.error("Raw response:", raw);
    
    return {
      sentence1: sentences[0] ? sentences[0].split(/[\s、。]+/).filter(s => s.length > 0) : ["文節分割失敗"],
      sentence2: sentences[1] ? sentences[1].split(/[\s、。]+/).filter(s => s.length > 0) : ["文節分割失敗"],
      sentence3: sentences[2] ? sentences[2].split(/[\s、。]+/).filter(s => s.length > 0) : ["文節分割失敗"]
    };
  } catch (e) {
    console.error("❌ 文節分割のJSON解析に失敗:", e);
    
    // Return fallback structure
    return {
      sentence1: sentences[0] ? sentences[0].split(/[\s、。]+/).filter(s => s.length > 0) : ["エラー"],
      sentence2: sentences[1] ? sentences[1].split(/[\s、。]+/).filter(s => s.length > 0) : ["エラー"],
      sentence3: sentences[2] ? sentences[2].split(/[\s、。]+/).filter(s => s.length > 0) : ["エラー"]
    };
  }
};
