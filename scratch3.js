const { GoogleGenAI, Type } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const filePaths = [
    "Course-Uploads/00. Topic List (1).jpg",
    "Course-Uploads/01. Conditional Statements in Python.mp4",
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: "hello",
    });

    console.log("RESPONSE 2.0:", response.text);
  } catch (err) {
    console.error("ERROR 2.0:", err.message);
  }
}

main();
