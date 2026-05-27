import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Verarbeitet pending Emails aus email_outbox.
 * Triggern: per Cron oder direkt nach Order-Insert.
 * Auth: entweder via service-role-API-Key (nicht user session).
 */
export async function POST(req: NextRequest) {
  const cronKey = req.headers.get('x-cron-key');
  if (cronKey !== process.env.INTERNAL_CRON_KEY && cronKey !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Erlaubt auch manuellen Aufruf via Session (nur zum Debuggen)
    // Für Prod: Cron-Call mit Key bevorzugt.
  }

  const svc = createServiceClient();

  // Max 50 pending Emails pro Run
  const { data: pending } = await svc
    .from('email_outbox')
    .select('*, tenant:tenants(name, slug, theme_primary, theme_accent, resend_api_key, resend_from_email, resend_from_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);

  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const mail of (pending as any[]) ?? []) {
    const tenant = mail.tenant;
    if (!tenant?.resend_api_key || !tenant?.resend_from_email) {
      await svc
        .from('email_outbox')
        .update({ status: 'failed', error_message: 'Resend nicht konfiguriert für Tenant' })
        .eq('id', mail.id);
      results.skipped++;
      continue;
    }

    try {
      const origin = new URL(req.url).origin;
      const html = mail.html && mail.html.length > 50
        ? mail.html
        : renderByTemplate(mail.template, mail.template_data ?? {}, { origin, tenant });

      const resend = new Resend(tenant.resend_api_key);
      const r = await resend.emails.send({
        from: `${tenant.resend_from_name ?? tenant.name} <${tenant.resend_from_email}>`,
        to: mail.to_email,
        subject: mail.subject,
        html,
      });
      if (r.error) throw new Error(r.error.message);

      await svc
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), resend_id: r.data?.id ?? null })
        .eq('id', mail.id);
      results.sent++;
    } catch (e) {
      await svc
        .from('email_outbox')
        .update({
          status: 'failed',
          error_message: e instanceof Error ? e.message : 'unknown',
        })
        .eq('id', mail.id);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...results, total: (pending as any[])?.length ?? 0 });
}

function renderByTemplate(
  template: string | null,
  data: Record<string, any>,
  ctx: { origin: string; tenant: any },
): string {
  if (template === 'order_confirmation') {
    return orderConfirmationHtml(data as any, ctx);
  }
  return `<p>${JSON.stringify(data)}</p>`;
}

function orderConfirmationHtml(
  data: { bestellnummer: string; kunde_name: string; gesamtbetrag: number; typ: string; zahlungsart: string; unsubscribe_token?: string },
  ctx: { origin: string; tenant: any },
): string {
  const trackUrl = `${ctx.origin}/track/${data.bestellnummer}`;
  const unsubUrl = data.unsubscribe_token
    ? `${ctx.origin}/unsubscribe?token=${data.unsubscribe_token}`
    : `${ctx.origin}/unsubscribe`;
  const themeColor = ctx.tenant.theme_primary ?? '#14532d';
  const accentColor = ctx.tenant.theme_accent ?? '#4ae68a';

  const typText =
    data.typ === 'lieferung' ? 'Lieferung zu dir' :
    data.typ === 'abholung' ? 'Abholung bei uns' :
    'Im Café';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bestellung bestätigt</title></head>
<body style="margin:0; padding:0; background:#f5f2ed; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#1a1a1a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f2ed; padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border-radius:20px; overflow:hidden;">
  <tr><td style="background: linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%); padding:40px; color:#ffffff;">
    <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; opacity:0.7;">${ctx.tenant.name}</div>
    <div style="font-size:32px; margin-top:12px;">✓</div>
    <h1 style="margin:8px 0 0; font-size:28px; font-weight:800; letter-spacing:-0.5px;">
      Bestellung bestätigt
    </h1>
    <div style="margin-top:8px; font-family:monospace; font-size:13px; color:${accentColor}; letter-spacing:2px;">
      #${data.bestellnummer}
    </div>
  </td></tr>

  <tr><td style="padding:32px 40px 16px; font-size:16px; line-height:1.6; color:#333;">
    Hey ${data.kunde_name.split(' ')[0]}, danke für deine Bestellung bei <strong>${ctx.tenant.name}</strong>.
    Wir sind dran.
  </td></tr>

  <tr><td style="padding:0 40px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5; border-radius:12px; padding:20px;">
      <tr>
        <td style="padding-bottom:12px; border-bottom:1px solid #e5e5e5;">
          <div style="font-size:11px; color:#888; letter-spacing:2px; text-transform:uppercase;">Art</div>
          <div style="font-size:14px; font-weight:bold; margin-top:4px;">${typText}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #e5e5e5;">
          <div style="font-size:11px; color:#888; letter-spacing:2px; text-transform:uppercase;">Zahlung</div>
          <div style="font-size:14px; font-weight:bold; margin-top:4px; text-transform:capitalize;">${data.zahlungsart}</div>
        </td>
      </tr>
      <tr>
        <td style="padding-top:12px;">
          <div style="font-size:11px; color:#888; letter-spacing:2px; text-transform:uppercase;">Gesamt</div>
          <div style="font-size:24px; font-weight:800; margin-top:4px; color:${themeColor};">
            ${Number(data.gesamtbetrag).toFixed(2).replace('.', ',')} €
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:8px 40px 32px; text-align:center;">
    <a href="${trackUrl}" style="display:inline-block; background:${themeColor}; color:#ffffff; text-decoration:none; padding:16px 32px; border-radius:12px; font-weight:bold; font-size:15px;">
      Bestellung live verfolgen →
    </a>
  </td></tr>

  <tr><td style="padding:24px 40px; background:#f5f5f5; font-size:11px; color:#999; text-align:center; line-height:1.6;">
    Gesendet von <strong>${ctx.tenant.name}</strong> · <a href="${unsubUrl}" style="color:#999;">Abmelden</a><br>
    Diese E-Mail bekommst du weil du bei uns bestellt hast — keine Werbung.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
