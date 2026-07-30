import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath } from '@/lib/db';
import { getAuthContext } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;
    const authCol = auth.type === 'user' ? sql`user_email` : sql`secret_code`;

    const { moves } = await request.json();

    if (!moves || !Array.isArray(moves)) {
      return NextResponse.json({ error: 'Moves array is required' }, { status: 400 });
    }

    const results = [];

    const getOrCreateFolder = async (folderPath: string) => {
        if (!folderPath || folderPath === '') return null;
        const parentParts = folderPath.replace(/\/$/, '').split('/');
        let currParentId = null;
        for (const part of parentParts) {
            let res: any[];
            if (currParentId === null) {
              res = await sql`SELECT id FROM nodes WHERE parent_id IS NULL AND name = ${part} AND type = 'folder' AND ${authCondition}`;
            } else {
              res = await sql`SELECT id FROM nodes WHERE parent_id = ${currParentId} AND name = ${part} AND type = 'folder' AND ${authCondition}`;
            }
            
            if (res.length > 0) {
                currParentId = res[0].id;
            } else {
                let expiresAt = null;
                if (auth.type === 'secret') {
                  const d = new Date(); d.setHours(d.getHours() + 24); expiresAt = d;
                }
                const insertRes: any[] = await sql`INSERT INTO nodes (parent_id, name, type, ${authCol}, expires_at) VALUES (${currParentId}, ${part}, 'folder', ${auth.value}, ${expiresAt}) RETURNING id`;
                currParentId = insertRes[0].id;
            }
        }
        return currParentId;
    };

    for (const move of moves) {
      if (!move.old_path || !move.new_path || !move.id) continue;
      try {
        const parts = move.new_path.split('/');
        const name = parts.pop();
        const parentPath = parts.join('/');
        
        const parentId = await getOrCreateFolder(parentPath);
        
        await sql`
            UPDATE nodes 
            SET parent_id = ${parentId}, name = ${name}
            WHERE id = ${move.id} AND ${authCondition}
        `;

        results.push({ ...move, success: true });
      } catch (err: any) {
        results.push({ ...move, success: false, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
