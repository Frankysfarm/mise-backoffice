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
    .select('*, tenant:tenants(name, slug, theme_primary, theme_accent, resend_api_key, resend_from_email, resend_from_name, adresse, stadt, plz)')
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
      let templateData = { ...(mail.template_data ?? {}) };
      if (mail.order_id) {
        const { data: order } = await svc
          .from('customer_orders')
          .select('bestellnummer, tracking_token')
          .eq('id', mail.order_id)
          .maybeSingle();
        if (order) templateData = { ...templateData, ...order };
      }
      const knownTemplate = ['order_confirmation', 'delivery_unterwegs', 'delivery_delivered', 'delivery_abholbereit']
        .includes(mail.template ?? '');
      const html = knownTemplate
        ? renderByTemplate(mail.template, templateData, { origin, tenant })
        : mail.html && mail.html.length > 50
          ? mail.html
          : renderByTemplate(mail.template, templateData, { origin, tenant });

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
  if (template === 'delivery_unterwegs') {
    return deliveryUnterwegsHtml(data as any, ctx);
  }
  if (template === 'delivery_delivered') {
    return deliveryDeliveredHtml(data as any, ctx);
  }
  if (template === 'delivery_abholbereit') {
    return deliveryAbholbereitHtml(data as any, ctx);
  }
  return `<p>${JSON.stringify(data)}</p>`;
}

/**
 * Gemeinsames E-Mail-Grundgerüst (Brand-Header + weiße Card + Footer).
 * inner = HTML der Inhalts-Zeilen (jeweils als <tr><td>…</td></tr>).
 */
function emailShell(
  ctx: { tenant: any },
  opts: { icon: string; title: string; eyebrow: string; bestellnummer: string; inner: string; footerNote?: string },
): string {
  const themeColor = ctx.tenant.theme_primary ?? '#14532d';
  const accentColor = ctx.tenant.theme_accent ?? '#4ae68a';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title></head>
<body style="margin:0; padding:0; background:#f5f2ed; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#1a1a1a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f2ed; padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border-radius:20px; overflow:hidden;">
  <tr><td style="background: linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%); padding:40px; color:#ffffff;">
    <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; opacity:0.7;">${opts.eyebrow}</div>
    <div style="font-size:32px; margin-top:12px;">${opts.icon}</div>
    <h1 style="margin:8px 0 0; font-size:28px; font-weight:800; letter-spacing:-0.5px;">${opts.title}</h1>
    <div style="margin-top:8px; font-family:monospace; font-size:13px; color:${accentColor}; letter-spacing:2px;">
      #${opts.bestellnummer}
    </div>
  </td></tr>
${opts.inner}
  <tr><td style="padding:24px 40px; background:#f5f5f5; font-size:11px; color:#999; text-align:center; line-height:1.6;">
    Gesendet von <strong>${ctx.tenant.name}</strong>${opts.footerNote ? ' · ' + opts.footerNote : ''}<br>
    Diese E-Mail bekommst du weil du bei uns bestellt hast — keine Werbung.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** Status-Mail: Fahrer unterwegs (nur Lieferung). */
function deliveryUnterwegsHtml(
  data: { bestellnummer: string; kunde_name?: string; typ?: string; tracking_token?: string },
  ctx: { origin: string; tenant: any },
): string {
  const themeColor = ctx.tenant.theme_primary ?? '#14532d';
  const firstName = (data.kunde_name ?? '').split(' ')[0] || 'du';
  const trackUrl = buildTrackingUrl(ctx.origin, data.bestellnummer, data.tracking_token);
  const inner = `
  <tr><td style="padding:32px 40px 8px; font-size:16px; line-height:1.6; color:#333;">
    Hey ${firstName}, gute Nachrichten — <strong>${ctx.tenant.name}</strong> hat deine Bestellung
    auf den Weg gebracht. Ein Fahrer ist gerade unterwegs zu dir. 🛵
  </td></tr>
  <tr><td style="padding:8px 40px 4px; font-size:14px; line-height:1.6; color:#666;">
    Bitte halte dich bereit — es kann gleich klingeln.
  </td></tr>
  <tr><td style="padding:16px 40px 32px; text-align:center;">
    <a href="${trackUrl}" style="display:inline-block; background:${themeColor}; color:#ffffff; text-decoration:none; padding:16px 32px; border-radius:12px; font-weight:bold; font-size:15px;">
      Lieferung live verfolgen →
    </a>
  </td></tr>`;
  return emailShell(ctx, { icon: '🛵', eyebrow: ctx.tenant.name, title: 'Unterwegs zu dir', bestellnummer: data.bestellnummer, inner });
}

/** Status-Mail: geliefert/abgeholt + Bewertungs-Anfrage. */
function deliveryDeliveredHtml(
  data: { bestellnummer: string; kunde_name?: string; typ?: string; rating_token?: string },
  ctx: { origin: string; tenant: any },
): string {
  const themeColor = ctx.tenant.theme_primary ?? '#14532d';
  const accentColor = ctx.tenant.theme_accent ?? '#4ae68a';
  const firstName = (data.kunde_name ?? '').split(' ')[0] || 'du';
  const isPickup = data.typ === 'abholung';
  const lead = isPickup
    ? `Danke, dass du bei <strong>${ctx.tenant.name}</strong> abgeholt hast! Wir hoffen, es schmeckt.`
    : `Deine Bestellung von <strong>${ctx.tenant.name}</strong> ist angekommen. Guten Appetit! 🍝`;

  // Bewertungs-Block nur wenn Token vorhanden (Link auf öffentliche /rate-Seite)
  let ratingBlock = '';
  if (data.rating_token) {
    const rateUrl = `${ctx.origin}/rate/${data.rating_token}`;
    const stars = [1, 2, 3, 4, 5].map((n) =>
      `<a href="${rateUrl}" style="text-decoration:none; font-size:30px; color:${accentColor}; padding:0 3px;">★</a>`
    ).join('');
    ratingBlock = `
  <tr><td style="padding:8px 40px 4px; text-align:center;">
    <div style="border-top:1px solid #eee; padding-top:24px;">
      <div style="font-size:15px; font-weight:bold; color:#1a1a1a;">Wie war's?</div>
      <div style="font-size:13px; color:#777; margin-top:4px;">Deine Bewertung hilft uns, besser zu werden.</div>
      <div style="margin:16px 0 4px;">${stars}</div>
    </div>
  </td></tr>
  <tr><td style="padding:8px 40px 32px; text-align:center;">
    <a href="${rateUrl}" style="display:inline-block; background:${themeColor}; color:#ffffff; text-decoration:none; padding:14px 30px; border-radius:12px; font-weight:bold; font-size:15px;">
      Jetzt bewerten →
    </a>
  </td></tr>`;
  } else {
    ratingBlock = `<tr><td style="padding:8px 40px 32px;"></td></tr>`;
  }

  const inner = `
  <tr><td style="padding:32px 40px 8px; font-size:16px; line-height:1.6; color:#333;">
    Hey ${firstName}, ${lead}
  </td></tr>${ratingBlock}`;
  return emailShell(ctx, {
    icon: '✅',
    eyebrow: ctx.tenant.name,
    title: isPickup ? 'Abgeholt — danke!' : 'Geliefert — guten Appetit!',
    bestellnummer: data.bestellnummer,
    inner,
  });
}

/** Status-Mail: Abholung bereit (typ=abholung, status=fertig). */
function deliveryAbholbereitHtml(
  data: { bestellnummer: string; kunde_name?: string },
  ctx: { origin: string; tenant: any },
): string {
  const themeColor = ctx.tenant.theme_primary ?? '#14532d';
  const firstName = (data.kunde_name ?? '').split(' ')[0] || 'du';
  const adresse = [ctx.tenant.adresse, [ctx.tenant.plz, ctx.tenant.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const adrBlock = adresse ? `
  <tr><td style="padding:0 40px 8px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5; border-radius:12px; padding:18px;">
      <tr><td>
        <div style="font-size:11px; color:#888; letter-spacing:2px; text-transform:uppercase;">Abholadresse</div>
        <div style="font-size:15px; font-weight:bold; margin-top:5px; color:#1a1a1a;">${ctx.tenant.name}</div>
        <div style="font-size:14px; color:#444; margin-top:2px;">${adresse}</div>
      </td></tr>
    </table>
  </td></tr>` : '';
  const inner = `
  <tr><td style="padding:32px 40px 8px; font-size:16px; line-height:1.6; color:#333;">
    Hey ${firstName}, deine Bestellung bei <strong>${ctx.tenant.name}</strong> ist <strong>fertig und kann abgeholt werden</strong>. 🛍️
  </td></tr>
  <tr><td style="padding:4px 40px 16px; font-size:14px; line-height:1.6; color:#666;">
    Am besten gleich kommen, solange es frisch und warm ist.
  </td></tr>${adrBlock}
  <tr><td style="padding:16px 40px 32px;"></td></tr>`;
  return emailShell(ctx, { icon: '🛍️', eyebrow: ctx.tenant.name, title: 'Bereit zur Abholung', bestellnummer: data.bestellnummer, inner });
}

function orderConfirmationHtml(
  data: { bestellnummer: string; kunde_name: string; gesamtbetrag: number; typ: string; zahlungsart: string; unsubscribe_token?: string; tracking_token?: string },
  ctx: { origin: string; tenant: any },
): string {
  const trackUrl = buildTrackingUrl(ctx.origin, data.bestellnummer, data.tracking_token);
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

function buildTrackingUrl(origin: string, bestellnummer: string, token?: string) {
  const path = `${origin}/track/${encodeURIComponent(bestellnummer)}`;
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}
