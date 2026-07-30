const { GoogleGenAI } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: "hello",
    });

    console.log("RESPONSE 1.5:", response.text);
  } catch (err) {
    console.error("ERROR 1.5:", err.message);
  }
}

main();
