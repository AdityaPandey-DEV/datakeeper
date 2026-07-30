import { NextRequest, NextResponse } from 'next/server';
import { sql, getPathByFolderId, getFolderIdByPath } from '@/lib/db';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { getAuthContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;

    const { path } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    const folderId = await getFolderIdByPath(path || '', auth);
    
    const rows = folderId === null 
      ? await sql`
        WITH RECURSIVE folder_tree AS (
          SELECT id, parent_id, name, type FROM nodes WHERE parent_id IS NULL AND ${authCondition}
          UNION ALL
          SELECT n.id, n.parent_id, n.name, n.type FROM nodes n
          INNER JOIN folder_tree ft ON ft.id = n.parent_id
        )
        SELECT * FROM folder_tree WHERE type = 'file'
      `
      : await sql`
        WITH RECURSIVE folder_tree AS (
          SELECT id, parent_id, name, type FROM nodes WHERE id = ${folderId} AND ${authCondition}
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
You are an expert file organizer. Look at these flat file paths and group them into logical folders based on topics/subjects.
Files:
${JSON.stringify(filePaths, null, 2)}
Return the list of moves in JSON format. Keep prefix "${targetPrefix}".`;

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
    
    const moves = rawMoves.map((m: any) => ({
      ...m,
      id: idMap.get(m.old_path),
    })).filter((m: any) => m.id);

    return NextResponse.json({ moves });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
