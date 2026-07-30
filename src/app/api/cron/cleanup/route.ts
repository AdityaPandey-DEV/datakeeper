import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { deleteR2Keys } from '@/lib/blob';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Validate cron secret if using Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find expired files
    const expiredNodes = await sql`SELECT id, r2_key FROM nodes WHERE expires_at < NOW() AND r2_key IS NOT NULL`;
    
    const r2Keys = expiredNodes.map(n => n.r2_key).filter(Boolean);
    if (r2Keys.length > 0) {
      await deleteR2Keys(r2Keys);
    }

    // Delete all expired nodes (files and folders)
    await sql`DELETE FROM nodes WHERE expires_at < NOW()`;

    return NextResponse.json({ success: true, deleted: r2Keys.length });
  } catch (error: any) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
