import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const svc = createServiceClient();
  const { data: table } = await svc.from('restaurant_tables')
    .select('id, nummer, name, bereich, aktiv, tenant_id')
    .eq('qr_token', token).maybeSingle();

  if (!table || !table.aktiv) return new NextResponse('Not found', { status: 404 });

  const { data: tenant } = await svc.from('tenants').select('name, slug, theme_primary, theme_accent, logo_url').eq('id', table.tenant_id).single();

  const origin = req.nextUrl.origin;
  const url = `${origin}/t/${token}`;
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 400, color: { dark: '#0d1f16', light: '#ffffff' } });

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<title>Tisch ${table.nummer} · QR-Code</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media print { @page { size: A6 portrait; margin: 5mm; } body { margin: 0; } .no-print { display: none; } }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #f5f5f0; padding: 2rem; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { background: white; border-radius: 1.5rem; padding: 2rem; max-width: 360px; text-align: center; box-shadow: 0 4px 30px rgba(0,0,0,.08); border: 2px solid ${tenant?.theme_primary ?? '#14532d'}; }
  .brand { font-size: .75rem; letter-spacing: .25em; text-transform: uppercase; color: ${tenant?.theme_primary ?? '#14532d'}; font-weight: 800; }
  .name { font-size: 1.5rem; font-weight: 800; margin: .25rem 0 1rem; color: #0d1f16; }
  .qr { background: white; padding: 1rem; border-radius: 1rem; display: inline-block; }
  .qr svg { width: 280px; height: 280px; display: block; }
  .tisch { margin-top: 1.5rem; font-size: 3rem; font-weight: 900; color: ${tenant?.theme_primary ?? '#14532d'}; letter-spacing: -.02em; }
  .tisch-label { font-size: .75rem; text-transform: uppercase; letter-spacing: .2em; color: #666; font-weight: 700; }
  .hint { margin-top: 1.5rem; font-size: .875rem; color: #333; line-height: 1.4; }
  .print-btn { position: fixed; bottom: 2rem; right: 2rem; background: ${tenant?.theme_primary ?? '#14532d'}; color: white; padding: .75rem 1.5rem; border-radius: 999px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,.15); }
</style>
</head>
<body>
<div class="card">
  <div class="brand">${tenant?.name ?? 'Restaurant'}</div>
  ${table.name ? `<div class="name">${table.name}</div>` : ''}
  <div class="qr">${qrSvg}</div>
  <div class="tisch-label">Tisch</div>
  <div class="tisch">${table.nummer}</div>
  <div class="hint">
    <strong>Scanne den QR-Code</strong><br>
    Karte ansehen · Bestellen · Zahlen
  </div>
</div>
<button class="print-btn no-print" onclick="window.print()">🖨 Drucken</button>
</body></html>`;

  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
