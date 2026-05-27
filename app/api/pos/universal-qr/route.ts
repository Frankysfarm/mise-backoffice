import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const svc = createServiceClient();
  const { data: emp } = await svc.from('employees').select('tenant_id,location_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.location_id) return new NextResponse('No location', { status: 400 });

  const { data: location } = await svc.from('locations')
    .select('id, universal_qr_token, name')
    .eq('id', emp.location_id).single();

  let token = (location as any)?.universal_qr_token;
  if (!token) {
    const { data: updated } = await svc.from('locations')
      .update({ universal_qr_token: crypto.randomUUID() })
      .eq('id', emp.location_id)
      .select('universal_qr_token').single();
    token = (updated as any)?.universal_qr_token;
  }

  const { data: tenant } = await svc.from('tenants').select('name, theme_primary, theme_accent').eq('id', emp.tenant_id).single();

  const origin = req.nextUrl.origin;
  const url = `${origin}/here/${token}`;
  const qrSvg = await QRCode.toString(url, {
    type: 'svg', margin: 1, width: 500,
    color: { dark: '#0d1f16', light: '#ffffff' },
  });

  const primary = (tenant as any)?.theme_primary ?? '#14532d';
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<title>Universal Tisch-QR</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media print { @page { size: A5 portrait; margin: 0; } body { margin: 0; } .no-print { display: none; } }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #f5f5f0; padding: 2rem; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { background: white; border-radius: 2rem; padding: 2.5rem 2rem; max-width: 420px; text-align: center; box-shadow: 0 4px 30px rgba(0,0,0,.08); border: 3px solid ${primary}; }
  .brand { font-size: .75rem; letter-spacing: .3em; text-transform: uppercase; color: ${primary}; font-weight: 800; }
  .name { font-size: 1.75rem; font-weight: 900; margin: .25rem 0 1.25rem; color: #0d1f16; line-height: 1; }
  .qr { background: white; padding: 1rem; border-radius: 1.5rem; display: inline-block; border: 2px solid #f3f4f6; }
  .qr svg { width: 300px; height: 300px; display: block; }
  .big { margin-top: 1.5rem; font-size: 2rem; font-weight: 900; color: ${primary}; line-height: 1.1; }
  .hint { margin-top: .5rem; font-size: .95rem; color: #444; line-height: 1.4; }
  .steps { margin-top: 2rem; text-align: left; background: #f9fafb; border-radius: 1rem; padding: 1rem 1.25rem; font-size: .85rem; }
  .steps li { margin: .4rem 0; }
  .print-btn { position: fixed; bottom: 2rem; right: 2rem; background: ${primary}; color: white; padding: .75rem 1.5rem; border-radius: 999px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,.15); }
</style>
</head>
<body>
<div class="card">
  <div class="brand">${(tenant as any)?.name ?? 'Restaurant'}</div>
  <div class="name">Scanne. Bestelle.</div>
  <div class="qr">${qrSvg}</div>
  <div class="big">Tisch-Bestellung</div>
  <div class="hint">So einfach geht's</div>
  <ol class="steps">
    <li><strong>📱 Scan</strong> den QR-Code mit deiner Handy-Kamera</li>
    <li><strong>🔢 Tippe</strong> deine Tisch-Nummer ein</li>
    <li><strong>🍽 Wähle</strong> aus der Karte, was du willst</li>
    <li><strong>💳 Zahle</strong> bequem per Apple/Google Pay oder an der Kasse</li>
  </ol>
</div>
<button class="no-print print-btn" onclick="window.print()">🖨 Drucken</button>
</body></html>`;

  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
