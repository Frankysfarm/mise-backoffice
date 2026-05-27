import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(`/api/pos/meldepaket?pruefung_token=${encodeURIComponent(token)}`, req.url);
  return NextResponse.redirect(url, { status: 307 });
}
