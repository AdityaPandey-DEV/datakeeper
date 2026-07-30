import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath, getPathByFolderId } from '@/lib/db';
import { FileItem } from '@/lib/blob';
import { getAuthContext } from '@/lib/auth';
import { deleteR2Keys } from '@/lib/blob';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    const query = searchParams.get('query') || '';

    let items: FileItem[] = [];

    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;

    if (query) {
      // Global search for this user
      const res = await sql`
        SELECT id, parent_id, name, type, r2_key, size, created_at 
        FROM nodes 
        WHERE name ILIKE ${'%' + query + '%'} AND ${authCondition}
      `;
      for (const row of res) {
        const itemPath = await getPathByFolderId(row.parent_id);
        const fullPath = itemPath ? `${itemPath}/${row.name}` : row.name;
        items.push({
          id: row.id,
          name: row.name,
          type: row.type as 'file' | 'folder',
          path: fullPath,
          url: row.r2_key ? `https://pub-8dff9b3e1e694fb48ad0d8a5de25e9a3.r2.dev/${row.r2_key}` : undefined,
          size: row.size ? parseInt(row.size) : undefined,
          uploadedAt: row.created_at,
        });
      }
    } else {
      // List specific folder
      const folderId = await getFolderIdByPath(path, auth);
      
      let res;
      if (folderId === null) {
        res = await sql`SELECT id, parent_id, name, type, r2_key, size, created_at FROM nodes WHERE parent_id IS NULL AND ${authCondition}`;
      } else {
        res = await sql`SELECT id, parent_id, name, type, r2_key, size, created_at FROM nodes WHERE parent_id = ${folderId} AND ${authCondition}`;
      }

      for (const row of res) {
        const fullPath = path ? `${path}/${row.name}` : row.name;
        items.push({
          id: row.id,
          name: row.name,
          type: row.type as 'file' | 'folder',
          path: fullPath,
          url: row.r2_key ? `https://pub-8dff9b3e1e694fb48ad0d8a5de25e9a3.r2.dev/${row.r2_key}` : undefined,
          size: row.size ? parseInt(row.size) : undefined,
          uploadedAt: row.created_at,
        });
      }
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in GET /api/files:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
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

    const { url, id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;

    // Verify ownership
    const check = await sql`SELECT r2_key FROM nodes WHERE id = ${id} AND ${authCondition}`;
    if (check.length === 0) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    const r2Key = check[0].r2_key;
    if (r2Key) {
       await deleteR2Keys([r2Key]);
    }

    await sql`DELETE FROM nodes WHERE id = ${id} AND ${authCondition}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
