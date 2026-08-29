import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { TableQrPdfDocument } from '@/lib/pdf/table-qr-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id || !actor.location_id) return NextResponse.json({ error: 'Standort fehlt' }, { status: 400 });
  const requested = request.nextUrl.searchParams.get('design');
  const design = requested === 'sticker' || requested === 'aufsteller' ? requested : 'karte';
  const service = createServiceClient();
  const [{ data: tenant }, { data: tables }] = await Promise.all([
    service.from('tenants').select('name').eq('id', actor.tenant_id).maybeSingle(),
    service.from('restaurant_tables').select('id,nummer,name,bereich,qr_token').eq('tenant_id', actor.tenant_id)
      .eq('location_id', actor.location_id).eq('aktiv', true).is('qr_disabled_at', null).order('sort_order'),
  ]);
  const origin = request.nextUrl.origin;
  const cards = await Promise.all((tables ?? []).map(async (table) => ({
    ...table,
    qrDataUrl: await QRCode.toDataURL(`${origin}/t/${table.qr_token}`, { margin: 1, width: 600 }),
  })));
  const buffer = await renderToBuffer(TableQrPdfDocument({ brand: tenant?.name ?? 'Restaurant', cards, design }) as any);
  return new NextResponse(new Uint8Array(buffer), { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="tisch-qr-codes-${design}.pdf"`,
    'Cache-Control': 'private, no-store',
  } });
}
