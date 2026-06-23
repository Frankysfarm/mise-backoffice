'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { revalidatePath } from 'next/cache';
import { getRegistrar, SERVER_IP } from '@/lib/domains/registrar';

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{2,63})+$/i;
function normalize(raw: string): string {
  return (raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

/** Eigene Domain verbinden → status 'pending', Host-Cron richtet danach DNS-Check + SSL ein. */
export async function connectDomain(raw: string) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert' };
  const domain = normalize(raw);
  if (!DOMAIN_RE.test(domain)) return { ok: false, error: 'Bitte eine gültige Domain eingeben (z. B. mein-restaurant.de).' };
  const svc = createServiceClient();
  // schon von einem ANDEREN Tenant belegt?
  const { data: taken } = await svc.from('tenants').select('id').eq('custom_domain', domain).neq('id', emp.tenant_id).maybeSingle();
  if (taken) return { ok: false, error: 'Diese Domain ist bereits mit einem anderen Shop verbunden.' };
  const { error } = await svc.from('tenants').update({
    custom_domain: domain, custom_domain_status: 'pending', custom_domain_error: null, custom_domain_verified_at: null,
  }).eq('id', emp.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/neo/app/shopsettings');
  return { ok: true, domain, ip: SERVER_IP };
}

/** Domain wieder trennen. */
export async function disconnectDomain() {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert' };
  const svc = createServiceClient();
  const { error } = await svc.from('tenants').update({
    custom_domain: null, custom_domain_status: 'none', custom_domain_error: null, custom_domain_verified_at: null,
  }).eq('id', emp.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/neo/app/shopsettings');
  return { ok: true };
}

/** Verfügbarkeit + Preis über Registrar prüfen (mehrere TLDs). */
export async function checkDomain(query: string) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert', configured: false, results: [] };
  const reg = getRegistrar();
  if (!reg.isConfigured()) return { ok: true, configured: false, results: [] };
  const base = normalize(query).replace(/\.[a-z.]+$/, '');
  if (base.length < 2) return { ok: false, error: 'Bitte mindestens 2 Zeichen.', configured: true, results: [] };
  const candidates = query.includes('.') ? [normalize(query)] : ['de', 'com', 'shop', 'eu', 'net'].map((t) => `${base}.${t}`);
  try {
    const results = await reg.check(candidates);
    return { ok: true, configured: true, results };
  } catch (e) {
    return { ok: false, configured: true, error: e instanceof Error ? e.message : 'Prüfung fehlgeschlagen', results: [] };
  }
}

/** Domain kaufen → registrieren → mit Shop verbinden (status pending → Host-Cron macht SSL). */
export async function buyDomain(raw: string, priceCents: number | null) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert' };
  const domain = normalize(raw);
  if (!DOMAIN_RE.test(domain)) return { ok: false, error: 'Ungültige Domain.' };
  const reg = getRegistrar();
  if (!reg.isConfigured()) return { ok: false, error: 'Domain-Kauf ist noch nicht aktiviert (Registrar nicht verbunden).' };
  const svc = createServiceClient();
  const { data: taken } = await svc.from('tenants').select('id').eq('custom_domain', domain).neq('id', emp.tenant_id).maybeSingle();
  if (taken) return { ok: false, error: 'Diese Domain ist bereits vergeben.' };

  const { data: purchase } = await svc.from('domain_purchases').insert({
    tenant_id: emp.tenant_id, domain, registrar: reg.name, status: 'bestellt', preis_cents: priceCents, jahre: 1,
  }).select('id').single();

  const r = await reg.register(domain, 1);
  if (!r.ok) {
    if (purchase) await svc.from('domain_purchases').update({ status: 'fehler', fehler: r.error }).eq('id', purchase.id);
    return { ok: false, error: r.error ?? 'Registrierung fehlgeschlagen' };
  }
  if (purchase) await svc.from('domain_purchases').update({ status: 'registriert', registriert_am: new Date().toISOString() }).eq('id', purchase.id);
  await svc.from('tenants').update({ custom_domain: domain, custom_domain_status: 'pending', custom_domain_error: null }).eq('id', emp.tenant_id);
  revalidatePath('/neo/app/shopsettings');
  return { ok: true, domain };
}
