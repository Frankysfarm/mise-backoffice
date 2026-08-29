import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id || !actor.location_id || !['manager', 'backoffice', 'admin'].includes(actor.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }
  const { token } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse('Not found', { status: 404 });
  const service = createServiceClient();
  const { data: table } = await service.from('restaurant_tables').select('nummer,qr_token,aktiv,qr_disabled_at')
    .eq('qr_token', token).eq('tenant_id', actor.tenant_id).eq('location_id', actor.location_id).maybeSingle();
  if (!table?.aktiv || table.qr_disabled_at) return new NextResponse('Not found', { status: 404 });
  const url = `${request.nextUrl.origin}/t/${table.qr_token}`;
  const format = request.nextUrl.searchParams.get('format') === 'svg' ? 'svg' : 'png';
  if (format === 'svg') {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 1000 });
    return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="tisch-${safeName(table.nummer)}-qr.svg"`, 'Cache-Control': 'private, no-store' } });
  }
  const png = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 1200 });
  return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="tisch-${safeName(table.nummer)}-qr.png"`, 'Cache-Control': 'private, no-store' } });
}

function safeName(value: string) { return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'qr'; }
