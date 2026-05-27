import { NextRequest, NextResponse } from 'next/server';
import { promises as dns } from 'dns';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPECTED_CNAMES = ['cname.mise-gastro.de', 'mise-gastro.de'];

/**
 * POST /api/settings/domain/verify
 * Body: { domain: string }
 * Prüft DNS-CNAME-Eintrag + setzt Status auf 'verified' / 'error'.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();
  const { data: emp } = await svc.from('employees').select('tenant_id, rolle').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ ok: false, error: 'Kein Tenant' }, { status: 403 });
  if (!['admin', 'manager', 'backoffice'].includes(emp.rolle ?? '')) {
    return NextResponse.json({ ok: false, error: 'Keine Berechtigung' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = String(body.domain ?? '').trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ ok: false, error: 'Ungültige Domain' }, { status: 400 });
  }

  // DNS-Resolution: CNAME muss auf EXPECTED_CNAME zeigen
  let cnameTargets: string[] = [];
  let aRecords: string[] = [];
  try { cnameTargets = await dns.resolveCname(domain); } catch { /* keine CNAME */ }
  try { aRecords = await dns.resolve4(domain); } catch { /* keine A-Records */ }

  const cnameOk = cnameTargets.some((t) => EXPECTED_CNAMES.includes(t.toLowerCase().replace(/\.$/, '')));

  // Fallback: A-Record direkt auf unseren Server (für Apex-Domains die kein CNAME erlauben)
  // Aktueller Server: Hetzner-IP holen wir aus CNAME-Resolution
  let aOk = false;
  if (!cnameOk && aRecords.length > 0) {
    try {
      const ourA = await dns.resolve4(EXPECTED_CNAMES[1]);
      aOk = aRecords.some((ip) => ourA.includes(ip));
    } catch { aOk = false; }
  }

  if (!cnameOk && !aOk) {
    const msg = `DNS-Eintrag noch nicht aktiv. Erwartet: CNAME ${domain} → mise-gastro.de (oder cname.mise-gastro.de). Gefunden: ${cnameTargets.length > 0 ? 'CNAME ' + cnameTargets.join(',') : aRecords.length > 0 ? 'A ' + aRecords.join(',') : 'kein Eintrag'}. DNS-Änderungen brauchen oft 5-30 Min bis aktiv.`;
    await svc.from('tenants').update({
      custom_domain: domain,
      custom_domain_status: 'error',
      custom_domain_error: msg,
    }).eq('id', emp.tenant_id);
    return NextResponse.json({ ok: false, status: 'error', error: msg });
  }

  // ✅ DNS verifiziert — jetzt SSL-Setup via Host-Daemon triggern
  const daemonUrl = process.env.MISE_DOMAIN_DAEMON_URL;
  const daemonSecret = process.env.MISE_DOMAIN_DAEMON_SECRET;
  let sslResult: { ok: boolean; output?: string; error?: string } | null = null;

  if (daemonUrl && daemonSecret) {
    try {
      const r = await fetch(`${daemonUrl}/setup-ssl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mise-Secret': daemonSecret },
        body: JSON.stringify({ domain }),
        signal: AbortSignal.timeout(120_000),
      });
      sslResult = await r.json();
    } catch (e) {
      sslResult = { ok: false, error: 'SSL-Daemon nicht erreichbar: ' + (e instanceof Error ? e.message : 'unknown') };
    }
  }

  const sslOk = sslResult?.ok === true;

  await svc.from('tenants').update({
    custom_domain: domain,
    custom_domain_status: sslOk ? 'verified' : 'error',
    custom_domain_verified_at: sslOk ? new Date().toISOString() : null,
    custom_domain_error: sslOk ? null : (sslResult?.error ?? 'SSL-Setup fehlgeschlagen — bitte erneut versuchen'),
  }).eq('id', emp.tenant_id);

  if (!sslOk) {
    return NextResponse.json({
      ok: false,
      status: 'error',
      error: sslResult?.error ?? 'SSL-Setup fehlgeschlagen',
      sslOutput: sslResult?.output,
    });
  }

  return NextResponse.json({
    ok: true,
    status: 'verified',
    domain,
    verifiedAt: new Date().toISOString(),
    note: `✅ DNS aktiv + SSL-Zertifikat installiert. Deine Bestellseite ist jetzt unter https://${domain} erreichbar.`,
  });
}
