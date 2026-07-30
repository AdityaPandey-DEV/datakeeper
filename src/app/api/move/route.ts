import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath } from '@/lib/db';
import { getAuthContext } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, id, newName, destinationPath } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    
    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;

    if (action === 'list-folders') {
      // Fetch all folders using recursive CTE
      const foldersResult = await sql`
        WITH RECURSIVE folder_tree AS (
            SELECT id, parent_id, name, name::text AS path
            FROM nodes
            WHERE parent_id IS NULL AND type = 'folder' AND ${authCondition}
          UNION ALL
            SELECT n.id, n.parent_id, n.name, ft.path || '/' || n.name
            FROM nodes n
            INNER JOIN folder_tree ft ON n.parent_id = ft.id
            WHERE n.type = 'folder' AND ${authCondition}
        )
        SELECT path FROM folder_tree ORDER BY path;
      `;
      
      const folders = Array.from(new Set(foldersResult.map(r => r.path)));
      // The root email folder is always at index 0 because it has no parent.
      return NextResponse.json({ folders: folders });
    }

    if (!id) {


    // Verify ownership
    const check = await sql`SELECT id FROM nodes WHERE id = ${id} AND ${authCondition}`;
    if (check.length === 0) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    if (action === 'rename') {
      if (!newName) return NextResponse.json({ error: 'newName required' }, { status: 400 });
      await sql`UPDATE nodes SET name = ${newName} WHERE id = ${id} AND ${authCondition}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'move-file' || action === 'move-folder') {
      const parentId = await getFolderIdByPath(destinationPath || '', auth);
      await sql`UPDATE nodes SET parent_id = ${parentId} WHERE id = ${id} AND ${authCondition}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Move/Rename error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
