'use server';

import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { revalidatePath } from 'next/cache';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Resend-Versand-Konfiguration speichern (tenant-scoped via Session).
 * Sicher: Der API-Key wird nur überschrieben, wenn ein neuer eingegeben wird —
 * ein leeres Key-Feld behält den bestehenden Key (der Key wird nie an den Client gegeben).
 */
export async function saveResendConfig(data: { apiKey: string | null; fromEmail: string; fromName: string }) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht eingeloggt.' };

  const fromEmail = (data.fromEmail || '').trim();
  const fromName = (data.fromName || '').trim();
  if (!fromEmail || !EMAIL_RE.test(fromEmail)) {
    return { ok: false, error: 'Bitte eine gültige Absender-E-Mail eingeben (z. B. bestellung@deinrestaurant.de).' };
  }

  const update: Record<string, unknown> = {
    resend_from_email: fromEmail,
    resend_from_name: fromName || null,
  };

  // Key nur setzen, wenn neu eingegeben — leeres Feld = bestehenden Key behalten.
  const newKey = (data.apiKey || '').trim();
  if (newKey) {
    if (!newKey.startsWith('re_')) {
      return { ok: false, error: 'Resend-API-Keys beginnen mit „re_". Bitte prüfe den Key.' };
    }
    update.resend_api_key = newKey;
    update.resend_verified_at = null; // neuer Key → erneut testen
  }

  const svc = createServiceClient();
  const { error } = await svc.from('tenants').update(update).eq('id', emp.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/neo/app/shopsettings');
  return { ok: true };
}

/**
 * Test-Mail an eine Adresse senden. Bei Erfolg wird resend_verified_at gesetzt.
 */
export async function testResendConnection(to: string) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht eingeloggt.' };

  const toAddr = (to || '').trim();
  if (!EMAIL_RE.test(toAddr)) return { ok: false, error: 'Bitte eine gültige Test-Adresse eingeben.' };

  const svc = createServiceClient();
  const { data: tenant } = await svc
    .from('tenants')
    .select('resend_api_key, resend_from_email, resend_from_name, name, theme_primary, theme_accent')
    .eq('id', emp.tenant_id)
    .single();

  if (!tenant?.resend_api_key || !tenant.resend_from_email) {
    return { ok: false, error: 'Bitte zuerst API-Key und Absender-Adresse speichern.' };
  }

  const themeColor = (tenant as any).theme_primary ?? '#14532d';
  try {
    const resend = new Resend(tenant.resend_api_key);
    const r = await resend.emails.send({
      from: `${tenant.resend_from_name ?? tenant.name} <${tenant.resend_from_email}>`,
      to: toAddr,
      subject: '✓ E-Mail-Versand erfolgreich getestet',
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:24px;background:#f5f2ed;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
          <div style="font-size:32px;margin-bottom:12px;">✅</div>
          <h1 style="color:${themeColor};margin:0 0 8px;font-size:24px;">Versand funktioniert</h1>
          <p style="color:#525252;line-height:1.55;">Dein Resend-Account ist mit <strong>${tenant.name}</strong> verbunden. Ab sofort erhalten deine Kunden Bestellbestätigungen sowie Liefer-Status- und Bewertungs-E-Mails.</p>
          <div style="margin-top:24px;padding:14px;background:#f5f5f5;border-radius:8px;font-size:12px;color:#737373;">Test-E-Mail von Mise · ${new Date().toLocaleString('de-DE')}</div>
        </div>
      </div>`,
    });
    if (r.error) return { ok: false, error: r.error.message };

    await svc.from('tenants').update({ resend_verified_at: new Date().toISOString() }).eq('id', emp.tenant_id);
    revalidatePath('/neo/app/shopsettings');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler beim Versand.' };
  }
}
