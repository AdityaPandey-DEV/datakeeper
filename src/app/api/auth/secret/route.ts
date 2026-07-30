import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { secretCode } = await request.json();

    if (!secretCode || secretCode.length < 3) {
      return NextResponse.json({ error: 'Secret code too short' }, { status: 400 });
    }

    const cookieStore = cookies();
    cookieStore.set('secret_code', secretCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
