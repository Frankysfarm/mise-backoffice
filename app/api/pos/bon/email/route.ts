import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

/** Sendet einen existierenden Bon-Link aus einer eingeloggten Kassenschicht. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ ok: false, error: 'Origin nicht erlaubt' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401, headers: PRIVATE_HEADERS });

  const body = await req.json().catch(() => null) as { bon_token?: unknown; email?: unknown } | null;
  const bon_token = String(body?.bon_token ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!bon_token || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Bon oder E-Mail-Adresse prüfen' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const svc = createServiceClient();
  const { data: employee } = await svc.from('employees')
    .select('tenant_id,location_id').eq('auth_user_id', user.id).maybeSingle();
  if (!employee?.tenant_id || !employee.location_id) {
    return NextResponse.json({ ok: false, error: 'Kein POS-Zugriff' }, { status: 403, headers: PRIVATE_HEADERS });
  }
  const { data: tx } = await svc.from('pos_transactions')
    .select('id, tenant_id, brutto_gesamt, created_at, tenant:tenants(name, resend_api_key, resend_from_email, resend_verified_at)')
    .eq('bon_token', bon_token)
    .eq('tenant_id', employee.tenant_id)
    .eq('location_id', employee.location_id)
    .maybeSingle();

  if (!tx) return NextResponse.json({ ok: false, error: 'Bon nicht gefunden' }, { status: 404, headers: PRIVATE_HEADERS });

  const tenant = (tx as any).tenant;
  if (!tenant?.resend_api_key || !tenant?.resend_verified_at) {
    return NextResponse.json({ ok: false, error: 'E-Mail-Versand ist noch nicht eingerichtet' }, { status: 503, headers: PRIVATE_HEADERS });
  }

  const publicOrigin = req.nextUrl.origin;
  const bonUrl = `${publicOrigin}/bon/${bon_token}`;
  const summe = Number(tx.brutto_gesamt).toFixed(2).replace('.', ',');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant.resend_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: tenant.resend_from_email ?? `${tenant.name} <noreply@mise.app>`,
        to: email,
        subject: `Dein Beleg von ${tenant.name} · ${summe} €`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:2rem;background:#fafaf5;border-radius:1rem">
            <h1 style="font-size:1.5rem;color:#0d1f16;margin:0 0 1rem">Dein Kassenbeleg</h1>
            <p style="color:#333;line-height:1.5">
              Hi,<br>vielen Dank für deinen Besuch bei <strong>${tenant.name}</strong>.
              Hier dein Beleg über <strong>${summe} €</strong>:
            </p>
            <a href="${bonUrl}" style="display:inline-block;margin:1rem 0;background:#0d1f16;color:white;padding:.75rem 1.5rem;border-radius:.75rem;text-decoration:none;font-weight:700">
              Beleg ansehen
            </a>
            <p style="color:#666;font-size:.875rem;margin-top:2rem">
              Du kannst den Beleg dort auch als PDF drucken oder als Bewirtungsbeleg für deine Steuererklärung ausstellen lassen.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      console.error('POS receipt email provider rejected request', { status: res.status });
      return NextResponse.json({ ok: false, error: 'E-Mail konnte nicht gesendet werden' }, { status: 502, headers: PRIVATE_HEADERS });
    }

    // Markiere Bon als versendet
    await svc.from('pos_transactions')
      .update({ beleg_email: email, beleg_ausgegeben_am: new Date().toISOString() })
      .eq('id', tx.id);

    return NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
  } catch (e) {
    console.error('POS receipt email failed', { message: e instanceof Error ? e.message : 'unknown' });
    return NextResponse.json({ ok: false, error: 'E-Mail konnte nicht gesendet werden' }, { status: 502, headers: PRIVATE_HEADERS });
  }
}
