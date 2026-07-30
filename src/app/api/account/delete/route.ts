import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { deleteR2Keys } from '@/lib/blob';
import { getAuthContext } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.type !== 'user') {
      return NextResponse.json({ error: 'Unauthorized or invalid account type' }, { status: 401 });
    }

    // 1. Get all file keys for this user
    const userEmail = auth.value;
    const files = await sql`SELECT r2_key FROM nodes WHERE user_email = ${userEmail} AND r2_key IS NOT NULL`;
    
    // 2. Delete from Cloudflare R2 in chunks if needed, or all at once
    const keysToDelete = files.map(f => f.r2_key).filter(Boolean);
    if (keysToDelete.length > 0) {
      // deleteR2Keys can handle multiple keys, but if it's too large, it might need chunking.
      // Assuming deleteR2Keys handles chunking or the number of files is reasonable.
      await deleteR2Keys(keysToDelete);
    }

    // 3. Delete all database records for this user
    await sql`DELETE FROM nodes WHERE user_email = ${userEmail}`;

    return NextResponse.json({ success: true, deletedFiles: keysToDelete.length });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
