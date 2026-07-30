const { GoogleGenAI, Type } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: "hello",
    });

    console.log("RESPONSE 3.5:", response.text);
  } catch (err) {
    console.error("ERROR 3.5:", err.message);
  }
}

main();
