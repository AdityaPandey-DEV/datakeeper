import { NextRequest, NextResponse } from 'next/server';
import { sql, getPathByFolderId, getFolderIdByPath } from '@/lib/db';
import { GoogleGenAI, Type, Schema } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    // List all files starting from this path recursively
    const folderId = await getFolderIdByPath(path || '');
    
    // We will do a recursive fetch of files
    const rows = folderId === null 
      ? await sql`
        WITH RECURSIVE folder_tree AS (
          SELECT id, parent_id, name, type FROM nodes WHERE parent_id IS NULL
          UNION ALL
          SELECT n.id, n.parent_id, n.name, n.type FROM nodes n
          INNER JOIN folder_tree ft ON ft.id = n.parent_id
        )
        SELECT * FROM folder_tree WHERE type = 'file'
      `
      : await sql`
        WITH RECURSIVE folder_tree AS (
          SELECT id, parent_id, name, type FROM nodes WHERE id = ${folderId}
          UNION ALL
          SELECT n.id, n.parent_id, n.name, n.type FROM nodes n
          INNER JOIN folder_tree ft ON ft.id = n.parent_id
        )
        SELECT * FROM folder_tree WHERE type = 'file' AND id != ${folderId}
      `;
    
    const idMap = new Map<string, string>();
    const filePaths = [];
    
    for (const row of rows) {
      const itemPath = await getPathByFolderId(row.parent_id);
      const fullPath = itemPath ? `${itemPath}/${row.name}` : row.name;
      filePaths.push(fullPath);
      idMap.set(fullPath, row.id);
    }

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
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    const result = JSON.parse(response.text || '{}');
    const rawMoves = result.moves || [];
    
    // Inject the DB IDs into the moves array so the execute route doesn't have to look them up by path
    const moves = rawMoves.map((m: any) => ({
      ...m,
      id: idMap.get(m.old_path),
    })).filter((m: any) => m.id);

    return NextResponse.json({ moves });
  } catch (error) {
    console.error('Error generating organization plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate organization plan' },
      { status: 500 }
    );
  }
}
