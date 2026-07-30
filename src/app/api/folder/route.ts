import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath } from '@/lib/db';
import { deleteR2Keys } from '@/lib/blob';
import { getAuthContext } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path } = await request.json();
    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;
    const authCol = auth.type === 'user' ? sql`user_email` : sql`secret_code`;

    const parts = path.split('/').filter(Boolean);
    let currentParentId = null;

    for (const part of parts) {
      let res;
      if (currentParentId === null) {
        res = await sql`SELECT id FROM nodes WHERE parent_id IS NULL AND name = ${part} AND type = 'folder' AND ${authCondition}`;
      } else {
        res = await sql`SELECT id FROM nodes WHERE parent_id = ${currentParentId} AND name = ${part} AND type = 'folder' AND ${authCondition}`;
      }

      if (res.length > 0) {
        currentParentId = res[0].id;
      } else {
        // Compute expiration if secret
        let expiresAt = null;
        if (auth.type === 'secret') {
            const date = new Date();
            date.setHours(date.getHours() + 24);
            expiresAt = date;
        }

        const insertRes = await sql`
          INSERT INTO nodes (parent_id, name, type, ${authCol}, expires_at) 
          VALUES (${currentParentId}, ${part}, 'folder', ${auth.value}, ${expiresAt}) 
          RETURNING id
        `;
        currentParentId = insertRes[0].id;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Create folder error:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;

    // Verify ownership
    const check = await sql`SELECT id FROM nodes WHERE id = ${id} AND ${authCondition}`;
    if (check.length === 0) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    // Get all children R2 keys to delete them physically
    const rows = await sql`
      WITH RECURSIVE folder_tree AS (
        SELECT id, r2_key FROM nodes WHERE id = ${id}
        UNION ALL
        SELECT n.id, n.r2_key FROM nodes n
        INNER JOIN folder_tree ft ON ft.id = n.parent_id
      )
      SELECT r2_key FROM folder_tree WHERE r2_key IS NOT NULL
    `;

    const keysToDelete = rows.map(r => r.r2_key).filter(Boolean);
    if (keysToDelete.length > 0) {
      await deleteR2Keys(keysToDelete);
    }

    await sql`
      WITH RECURSIVE folder_tree AS (
        SELECT id FROM nodes WHERE id = ${id}
        UNION ALL
        SELECT n.id FROM nodes n
        INNER JOIN folder_tree ft ON ft.id = n.parent_id
      )
      DELETE FROM nodes WHERE id IN (SELECT id FROM folder_tree)
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
