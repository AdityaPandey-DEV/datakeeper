import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { moves } = await request.json();

    if (!moves || !Array.isArray(moves)) {
      return NextResponse.json({ error: 'Moves array is required' }, { status: 400 });
    }

    const results = [];

    // Helper to get or create folders on the fly
    const getOrCreateFolder = async (folderPath: string) => {
        if (!folderPath || folderPath === '') return null;
        const parentParts = folderPath.replace(/\/$/, '').split('/');
        let currParentId = null;
        for (const part of parentParts) {
            const res: any[] = await sql`SELECT id FROM nodes WHERE parent_id ${currParentId === null ? sql`IS NULL` : sql`= ${currParentId}`} AND name = ${part} AND type = 'folder'`;
            if (res.length > 0) {
                currParentId = res[0].id;
            } else {
                const insertRes: any[] = await sql`INSERT INTO nodes (parent_id, name, type) VALUES (${currParentId}, ${part}, 'folder') RETURNING id`;
                currParentId = insertRes[0].id;
            }
        }
        return currParentId;
    };

    // We can do this serially, it will be extremely fast because it's just DB queries
    for (const move of moves) {
      if (!move.old_path || !move.new_path || !move.id) continue;

      try {
        const parts = move.new_path.split('/');
        const name = parts.pop();
        const parentPath = parts.join('/');
        
        const parentId = await getOrCreateFolder(parentPath);
        
        // Update the file's parent_id and name
        await sql`
            UPDATE nodes 
            SET parent_id = ${parentId}, name = ${name}
            WHERE id = ${move.id}
        `;

        results.push({ ...move, success: true });
      } catch (err: any) {
        console.error(`Failed to move ${move.old_path} to ${move.new_path}:`, err);
        results.push({ ...move, success: false, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Execute error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
