const { GoogleGenAI, Type } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const filePaths = [
    "Course-Uploads/00. Topic List (1).jpg",
    "Course-Uploads/01. Conditional Statements in Python.mp4",
    "Course-Uploads/01. Course Objective.mp4",
    "Course-Uploads/01. Matrix Concepts (Basic Math).mp4",
    "Course-Uploads/01. Our First Program.mp4",
    "Course-Uploads/13. Average of 2 Nums.mp4",
    "Course-Uploads/13. Practice Problem (Part c).mp4",
    "Course-Uploads/13. Sum of N numbers.mp4",
    "Course-Uploads/13. Types of Inheritance (1).mp4",
  ];

  const targetPrefix = "Course-Uploads/";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      moves: {
        type: Type.ARRAY,
        description: 'List of files to move. Only include files that should be moved into a subfolder.',
        items: {
          type: Type.OBJECT,
          properties: {
            old_path: { type: Type.STRING, description: 'The current exact file path.' },
            new_path: { type: Type.STRING, description: 'The new suggested file path, grouped logically into nested folders.' }
          },
          required: ['old_path', 'new_path']
        }
      }
    },
    required: ['moves']
  };

  const prompt = `
You are an expert file organizer and archivist.
Your job is to look at a list of flat file paths and group them into a logical, clean folder hierarchy based on their topics, subjects, or file types.

Here are the files:
${JSON.stringify(filePaths, null, 2)}

Instructions:
1. Extract the implicit topics from the filenames (e.g., "Python", "Loops", "MCM", "Installation Guide").
2. Group files that belong together into subfolders.
3. Keep the target prefix "${targetPrefix}" as the root folder.
4. For example, if a file is "${targetPrefix}06. Loops using while.mp4", you might move it to "${targetPrefix}Python Loops/06. Loops using while.mp4".
5. Only suggest moves that actually place a file into a new subfolder. If it's already well-placed, ignore it.
6. Return the list of moves in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    console.log("RESPONSE:", response.text);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

main();
