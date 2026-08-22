import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

const TOKEN_TTL_MIN = 15;

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

async function getOrigin(req: Request): Promise<string> {
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'mise-gastro.de';
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const { data: empRow } = await sb.from('employees')
    .select('tenant_id, location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id || !empRow?.location_id) {
    return NextResponse.json({ error: 'Tenant/Location nicht zugeordnet' }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: kiosk } = await svc.from('employees')
    .select('id, email, auth_user_id')
    .eq('tenant_id', empRow.tenant_id)
    .eq('location_id', empRow.location_id)
    .eq('position_typ', 'kiosk-lieferservice')
    .maybeSingle();

  if (!kiosk?.id || !kiosk?.auth_user_id) {
    return NextResponse.json({
      error: 'Kein Kiosk-Account vorhanden — bitte zuerst Account erstellen.',
    }, { status: 404 });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);

  const { error: insErr } = await svc.from('kiosk_login_tokens').insert({
    token,
    employee_id: kiosk.id,
    tenant_id: empRow.tenant_id,
    location_id: empRow.location_id,
    expires_at: expiresAt.toISOString(),
    created_by: emp.id,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const origin = await getOrigin(req);
  const url = `${origin}/auth/qr-login?t=${encodeURIComponent(token)}`;

  const qrPngDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
    color: { dark: '#0d1f16', light: '#ffffff' },
  });

  return NextResponse.json({
    ok: true,
    qrUrl: url,
    qrPngDataUrl,
    expiresAt: expiresAt.toISOString(),
    ttlMinutes: TOKEN_TTL_MIN,
  });
}
