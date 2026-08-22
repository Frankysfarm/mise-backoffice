import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Sendet Bon-Link per E-Mail an Kunden.
 * Keine Auth erforderlich — Token schützt den Zugriff.
 */
export async function POST(req: NextRequest) {
  const { bon_token, email } = await req.json() as { bon_token: string; email: string };
  if (!bon_token || !email) return NextResponse.json({ ok: false, error: 'Fehlende Daten' }, { status: 400 });

  const svc = createServiceClient();
  const { data: tx } = await svc.from('pos_transactions')
    .select('id, tenant_id, brutto_gesamt, created_at, tenant:tenants(name, resend_api_key, resend_from_email, resend_verified_at)')
    .eq('bon_token', bon_token).maybeSingle();

  if (!tx) return NextResponse.json({ ok: false, error: 'Bon nicht gefunden' }, { status: 404 });

  const tenant = (tx as any).tenant;
  if (!tenant?.resend_api_key || !tenant?.resend_verified_at) {
    return NextResponse.json({ ok: false, error: 'E-Mail-Versand noch nicht konfiguriert (Resend fehlt)' });
  }

  const origin = req.nextUrl.origin;
  const bonUrl = `${origin}/bon/${bon_token}`;
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
      const err = await res.text();
      return NextResponse.json({ ok: false, error: `Resend: ${err.slice(0, 200)}` });
    }

    // Markiere Bon als versendet
    await svc.from('pos_transactions')
      .update({ beleg_email: email, beleg_ausgegeben_am: new Date().toISOString() })
      .eq('id', tx.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Fehler',
    });
  }
}
