import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown = {};
  try { body = await req.json(); } catch { /* noop */ }
  console.log('[PUSH-DEBUG]', JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
