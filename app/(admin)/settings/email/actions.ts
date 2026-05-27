'use server';

import { Resend } from 'resend';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function tenantId() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  return emp?.tenant_id ?? null;
}

export async function saveResendConfig(data: { apiKey: string; fromEmail: string; fromName: string }) {
  const t = await tenantId();
  if (!t) return { ok: false, error: 'Nicht eingeloggt' };
  const svc = createServiceClient();
  const { error } = await svc
    .from('tenants')
    .update({
      resend_api_key: data.apiKey,
      resend_from_email: data.fromEmail,
      resend_from_name: data.fromName,
      resend_verified_at: null,
    })
    .eq('id', t);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/email');
  return { ok: true };
}

export async function testResendConnection(to: string) {
  const t = await tenantId();
  if (!t) return { ok: false, error: 'Nicht eingeloggt' };
  const svc = createServiceClient();
  const { data: tenant } = await svc
    .from('tenants')
    .select('resend_api_key, resend_from_email, resend_from_name, name')
    .eq('id', t).single();

  if (!tenant?.resend_api_key || !tenant.resend_from_email) {
    return { ok: false, error: 'Resend-API-Key oder From-Adresse fehlt' };
  }

  try {
    const resend = new Resend(tenant.resend_api_key);
    const r = await resend.emails.send({
      from: `${tenant.resend_from_name ?? tenant.name} <${tenant.resend_from_email}>`,
      to,
      subject: '✓ Resend-Verbindung getestet',
      html: `<div style="font-family: system-ui; padding: 20px; background: #f5f2ed;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px;">
          <div style="font-size: 32px; margin-bottom: 16px;">🍵</div>
          <h1 style="color: #14532d; margin: 0 0 8px;">Verbindung erfolgreich</h1>
          <p style="color: #525252; line-height: 1.5;">Dein Resend-Account ist jetzt mit <strong>${tenant.name}</strong> verbunden. Du kannst ab sofort Email-Kampagnen versenden.</p>
          <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px; font-size: 12px; color: #737373;">
            Gesendet via Mise · Powered by Resend · ${new Date().toLocaleString('de-DE')}
          </div>
        </div>
      </div>`,
    });
    if (r.error) return { ok: false, error: r.error.message };
    await svc.from('tenants').update({ resend_verified_at: new Date().toISOString() }).eq('id', t);
    revalidatePath('/settings/email');
    return { ok: true, id: r.data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' };
  }
}
