import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Kassen-Nachschau §146b AO: Finanzbeamter lädt DSFinV-K-Export via Token.
 * Proxy auf /api/pos/dsfinvk/export mit Pruefung-Token-Header.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const from = req.nextUrl.searchParams.get('from') ?? '';
  const to = req.nextUrl.searchParams.get('to') ?? '';
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  qs.set('pruefung_token', token);

  const url = new URL(`/api/pos/dsfinvk/export?${qs.toString()}`, req.url);
  return NextResponse.redirect(url, { status: 307 });
}
