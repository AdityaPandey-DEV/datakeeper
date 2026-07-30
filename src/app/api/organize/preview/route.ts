import { NextRequest, NextResponse } from 'next/server';
import { searchFiles } from '@/lib/blob';
import { GoogleGenAI, Type, Schema } from '@google/genai';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    // List all files starting from this path recursively
    const items = await searchFiles(path || '', '');
    
    // Only send the paths of actual files (not folders)
    const filePaths = items
      .filter(i => i.type === 'file')
      .map(i => i.path);

    if (filePaths.length === 0) {
      return NextResponse.json({ moves: [] });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const responseSchema: Schema = {
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

    const targetPrefix = path ? (path.endsWith('/') ? path : path + '/') : '';

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    const result = JSON.parse(response.text || '{}');
    const moves = result.moves || [];

    return NextResponse.json({ moves });
  } catch (error) {
    console.error('Error generating organization plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate organization plan' },
      { status: 500 }
    );
  }
}
