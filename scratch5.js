const { GoogleGenAI } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const models = await ai.models.list();
    for await (const m of models) {
        console.log(m.name);
    }
  } catch (err) {
    console.error("ERROR 1.5:", err.message);
  }
}

main();
