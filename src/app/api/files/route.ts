import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath, getPathByFolderId } from '@/lib/db';
import { deleteFile as r2DeleteFile } from '@/lib/blob';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    const search = searchParams.get('search') || '';

    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
    let items = [];

    if (search) {
      // Very basic recursive search using ILIKE
      const searchPattern = `%${search}%`;
      const rows = await sql`
        SELECT id, parent_id, name, type, r2_key, size, created_at 
        FROM nodes 
        WHERE name ILIKE ${searchPattern}
      `;
      
      for (const row of rows) {
        const itemPath = await getPathByFolderId(row.parent_id);
        const fullPath = itemPath ? `${itemPath}/${row.name}` : row.name;
        
        items.push({
          name: row.name,
          type: row.type,
          path: fullPath,
          url: row.type === 'file' ? `${R2_PUBLIC_URL}/${encodeURI(row.r2_key)}` : undefined,
          size: row.size,
          uploadedAt: row.created_at,
          id: row.id,
        });
      }
    } else {
      const folderId = await getFolderIdByPath(path);
      
      let rows;
      if (folderId === null) {
        rows = await sql`SELECT * FROM nodes WHERE parent_id IS NULL ORDER BY type ASC, name ASC`;
      } else {
        rows = await sql`SELECT * FROM nodes WHERE parent_id = ${folderId} ORDER BY type ASC, name ASC`;
      }

      for (const row of rows) {
        const fullPath = path ? `${path}/${row.name}` : row.name;
        items.push({
          name: row.name,
          type: row.type,
          path: fullPath,
          url: row.type === 'file' && row.r2_key ? `${R2_PUBLIC_URL}/${encodeURI(row.r2_key)}` : undefined,
          size: row.size,
          uploadedAt: row.created_at,
          id: row.id,
        });
      }
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error listing files:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { url, id } = await request.json(); // Front-end needs to send id

    if (id) {
      // Find the node
      const rows = await sql`SELECT * FROM nodes WHERE id = ${id}`;
      if (rows.length > 0) {
        const node = rows[0];
        // Delete from R2 if file
        if (node.type === 'file' && node.r2_key) {
          await r2DeleteFile(node.r2_key); // Use a new simple delete function
        }
        // Delete from DB
        await sql`DELETE FROM nodes WHERE id = ${id}`;
      }
    } else if (url) {
      // Fallback: finding by url logic
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
