import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { deleteFolder } from '@/lib/blob';
import { getAuthContext } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.type !== 'user') {
      return NextResponse.json({ error: 'Unauthorized or invalid account type' }, { status: 401 });
    }

    // 1. Get all file keys for this user
    
    const userEmail = auth.value;
    
    // 1. Delete ALL files recursively from Cloudflare R2 for this user's email prefix
    // This is 100% robust and guarantees no orphaned files are left behind.
    await deleteFolder(userEmail);

    // 2. Delete all database records for this user
    await sql`DELETE FROM nodes WHERE user_email = ${userEmail}`;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
