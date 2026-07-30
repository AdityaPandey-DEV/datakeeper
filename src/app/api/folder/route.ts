import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath } from '@/lib/db';
import { deleteR2Keys } from '@/lib/blob';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!path) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400 }
      );
    }

    const parts = path.split('/').filter(Boolean);
    const folderName = parts.pop();
    const parentPath = parts.join('/');
    const parentId = await getFolderIdByPath(parentPath);

    if (folderName) {
      await sql`
        INSERT INTO nodes (parent_id, name, type)
        VALUES (${parentId}, ${folderName}, 'folder')
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { path, id } = await request.json(); // UI passes id for folders now

    if (id) {
      // Find all nested files to delete from R2
      const recursiveFiles = await sql`
        WITH RECURSIVE folder_tree AS (
          SELECT id, r2_key, type FROM nodes WHERE id = ${id}
          UNION ALL
          SELECT n.id, n.r2_key, n.type FROM nodes n
          INNER JOIN folder_tree ft ON ft.id = n.parent_id
        )
        SELECT r2_key FROM folder_tree WHERE type = 'file' AND r2_key IS NOT NULL
      `;
      
      const r2Keys = recursiveFiles.map(r => r.r2_key);

      // Delete in DB (Cascade deletes children automatically!)
      await sql`DELETE FROM nodes WHERE id = ${id}`;

      // Then delete in R2
      await deleteR2Keys(r2Keys);
    } else if (path) {
      // Fallback
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
