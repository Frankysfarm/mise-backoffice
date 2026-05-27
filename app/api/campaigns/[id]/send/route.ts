import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sb = await createClient();
  const svc = createServiceClient();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ error: 'Kein Tenant' }, { status: 403 });

  const { data: campaign } = await svc.from('email_campaigns').select('*').eq('id', id).eq('tenant_id', emp.tenant_id).single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden' }, { status: 404 });

  const { data: tenant } = await svc
    .from('tenants')
    .select('resend_api_key, resend_from_email, resend_from_name, name, slug')
    .eq('id', emp.tenant_id).single();

  if (!tenant?.resend_api_key || !tenant.resend_from_email) {
    return NextResponse.json({ error: 'Resend nicht konfiguriert' }, { status: 400 });
  }

  // Empfänger-Liste holen
  const { data: audience } = await svc.rpc('campaign_audience', {
    p_tenant_id: emp.tenant_id,
    p_audience: campaign.audience_typ,
    p_manual: campaign.audience_manual_emails ?? null,
  });
  const emails = ((audience as any[]) ?? []).map((a) => a.email).filter(Boolean) as string[];

  if (emails.length === 0) {
    return NextResponse.json({ error: 'Keine Empfänger' }, { status: 400 });
  }

  // Update Status
  await svc.from('email_campaigns').update({
    status: 'versand',
    empfaenger_count: emails.length,
  }).eq('id', id);

  const resend = new Resend(tenant.resend_api_key);
  const origin = new URL(req.url).origin;

  let sentCount = 0;
  let errorCount = 0;

  // Sequential send (Resend hat 10 req/s — ausreichend für MVP)
  for (const email of emails) {
    try {
      const html = renderEmail({
        bodyHtml: campaign.body_html ?? '',
        voucherCode: campaign.voucher_code,
        ctaLabel: campaign.cta_label ?? 'Jetzt bestellen',
        ctaUrl: campaign.cta_url ?? `${origin}/order/${tenant.slug}${campaign.voucher_code ? `?code=${encodeURIComponent(campaign.voucher_code)}` : ''}`,
        preheader: campaign.preheader,
        tenantName: tenant.name,
        unsubscribeUrl: `${origin}/unsubscribe?email=${encodeURIComponent(email)}`,
      });

      const r = await resend.emails.send({
        from: `${tenant.resend_from_name ?? tenant.name} <${tenant.resend_from_email}>`,
        to: email,
        subject: campaign.betreff,
        html,
      });

      if (r.error) throw new Error(r.error.message);

      await svc.from('email_campaign_deliveries').insert({
        campaign_id: id,
        kunde_email: email,
        resend_id: r.data?.id ?? null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      sentCount++;
    } catch (e) {
      await svc.from('email_campaign_deliveries').insert({
        campaign_id: id,
        kunde_email: email,
        status: 'failed',
        error_message: e instanceof Error ? e.message : 'Unknown error',
      });
      errorCount++;
    }
  }

  await svc.from('email_campaigns').update({
    status: errorCount === emails.length ? 'fehler' : 'gesendet',
    versendet_count: sentCount,
    fehler_count: errorCount,
    sent_at: new Date().toISOString(),
  }).eq('id', id);

  return NextResponse.json({ ok: true, sent: sentCount, failed: errorCount });
}

function renderEmail(opts: {
  bodyHtml: string;
  voucherCode: string | null;
  ctaLabel: string;
  ctaUrl: string;
  preheader: string | null;
  tenantName: string;
  unsubscribeUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.tenantName}</title>
</head>
<body style="margin:0; padding:0; background:#f5f2ed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1a1a1a;">
${opts.preheader ? `<div style="display:none; font-size:1px; color:#f5f2ed; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">${opts.preheader}</div>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f2ed; padding: 40px 20px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border-radius:16px; padding: 40px;">
        <tr>
          <td style="padding-bottom: 24px;">
            <div style="font-size:32px;">🍵</div>
            <div style="font-size:12px; color:#737373; letter-spacing:2px; text-transform:uppercase; margin-top:8px;">${opts.tenantName}</div>
          </td>
        </tr>
        <tr>
          <td style="font-size:16px; line-height:1.6; color:#262626;">
            ${opts.bodyHtml}
          </td>
        </tr>
        ${opts.voucherCode ? `
        <tr>
          <td style="padding: 24px 0; text-align: center;">
            <div style="display:inline-block; background:#4ae68a; color:#14532d; font-family: 'Courier New', monospace; font-weight:bold; font-size:24px; letter-spacing:3px; padding: 16px 32px; border-radius: 12px;">
              ${opts.voucherCode}
            </div>
            <div style="font-size:11px; color:#737373; margin-top:8px;">dein persönlicher Rabatt-Code</div>
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 24px 0; text-align:center;">
            <a href="${opts.ctaUrl}" style="display:inline-block; background:#14532d; color:#ffffff; text-decoration:none; padding:16px 32px; border-radius:12px; font-weight:bold; font-size:16px;">
              ${opts.ctaLabel}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding-top:32px; border-top:1px solid #e5e5e5; font-size:12px; color:#737373; text-align:center; line-height:1.5;">
            Du bekommst diese E-Mail, weil du bei ${opts.tenantName} bestellt und dem Newsletter zugestimmt hast.<br>
            <a href="${opts.unsubscribeUrl}" style="color:#737373;">Abmelden</a> · Gesendet via Mise
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
