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
