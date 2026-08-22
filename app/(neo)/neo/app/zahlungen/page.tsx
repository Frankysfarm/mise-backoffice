import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { ZahlToggle, StripeControl, StripeStatusBanner } from './client';
export const dynamic = 'force-dynamic';
const PAYS = [
  { method: 'stripe', label: 'Online-Zahlung', desc: 'Kartenzahlung, Apple Pay & Google Pay im Shop', iconBg: '#EEF2FF' },
  { method: 'bar', label: 'Barzahlung', desc: 'Kunde zahlt bar bei Lieferung', iconBg: '#ECFDF5' },
  { method: 'karte', label: 'Kartenzahlung vor Ort', desc: 'EC-/Kreditkarte beim Fahrer', iconBg: '#FEF3C7' },
  { method: 'abholung', label: 'Zahlung bei Abholung', desc: 'Bezahlung bei Abholung im Restaurant', iconBg: '#F5F3FF' },
];
const COMING = ['SumUp Terminal', 'PayPal', 'Klarna', 'Rechnung (B2B)', 'Gutschein-Einlösung'];
export default async function Zahlungen({ searchParams }: { searchParams: Promise<{ stripe?: string; stripe_error?: string }> }) {
  const sp = await searchParams;
  const banner = sp?.stripe === 'done' ? 'done' : sp?.stripe_error ? 'error' : null;
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const [{ data }, { data: tenant }] = await Promise.all([
    sb.from('tenant_payment_methods').select('method, enabled_lieferung, enabled_abholung, enabled_vor_ort').eq('tenant_id', emp?.tenant_id ?? ''),
    sb.from('tenants').select('stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_details_submitted, stripe_secret_key').eq('id', emp?.tenant_id ?? '').maybeSingle(),
  ]);
  const rows = (data ?? []) as any[];
  // Online-Zahlung gilt als „verbunden", wenn Connect-Charges aktiv ODER Self-Service-Key gepflegt
  const chargesEnabled = !!(tenant?.stripe_connect_charges_enabled || tenant?.stripe_secret_key);
  const accountExists = !!(tenant?.stripe_connect_account_id || tenant?.stripe_connect_details_submitted);
  const list = PAYS.map((p) => { const r = rows.find((x) => x.method === p.method); return { ...p, on: r ? !!(r.enabled_lieferung || r.enabled_abholung || r.enabled_vor_ort) : false }; });
  return (
    <div style={{ maxWidth: 820 }}>
      <StripeStatusBanner status={banner as any} />
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Aktive Zahlungsarten</h3><p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Aktivierte Zahlungsarten erscheinen automatisch im Shop.</p></div>
        {list.map((p, i) => (
          <div key={p.method} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', borderBottom: i < list.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: p.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' }} /></div>
            <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{p.label}</span></div><div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{p.method === 'stripe' && !chargesEnabled ? 'Mit Stripe verbinden, um Kartenzahlung im Shop zu aktivieren — Stripe führt dich durch ein kurzes Onboarding.' : p.desc}</div></div>
            {p.method === 'stripe'
              ? <StripeControl on={p.on} chargesEnabled={chargesEnabled} accountExists={accountExists} />
              : <ZahlToggle method={p.method} on={p.on} />}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px', marginBottom: 10 }}>DEMNÄCHST VERFÜGBAR</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{COMING.map((c) => (<span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 10, padding: '9px 14px', fontSize: 13.5, fontWeight: 600, color: '#94A3B8' }}>{c}</span>))}</div>
    </div>
  );
}
