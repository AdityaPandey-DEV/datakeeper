import { NextRequest, NextResponse } from 'next/server';
import { sql, getFolderIdByPath } from '@/lib/db';
import { getAuthContext } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key, size, clientPathname } = await request.json();
    if (!key || !clientPathname) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // authCondition and authCol for folder auto-creation and file insertion
    const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;
    const authCol = auth.type === 'user' ? sql`user_email` : sql`secret_code`;

    // Extract file name and logical parent path from clientPathname (e.g. "Course-Uploads/file.mp4" -> "Course-Uploads")
    const parts = clientPathname.split('/');
    const name = parts.pop();
    const parentPath = parts.join('/');

    let parentId = await getFolderIdByPath(parentPath, auth);

    // Auto-create folders if they don't exist
    if (parentPath && !parentId) {
      const parentParts = parentPath.split('/');
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
      parentId = currParentId;
    }

    if (name) {
      let expiresAt = null;
      if (auth.type === 'secret') {
        const d = new Date(); d.setHours(d.getHours() + 24); expiresAt = d;
      }
      await sql`
        INSERT INTO nodes (parent_id, name, type, r2_key, size, ${authCol}, expires_at)
        VALUES (${parentId}, ${name}, 'file', ${key}, ${size || 0}, ${auth.value}, ${expiresAt})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Upload complete error:', error);
    return NextResponse.json({ error: 'Failed to complete upload' }, { status: 500 });
  }
}
