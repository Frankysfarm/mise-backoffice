import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { ZahlToggle } from './client';
export const dynamic = 'force-dynamic';
const PAYS = [
  { method: 'stripe', label: 'Online-Zahlung', desc: 'Kartenzahlung, Apple Pay & Google Pay im Shop', tag: 'Schnittstelle aktiv', iconBg: '#EEF2FF' },
  { method: 'bar', label: 'Barzahlung', desc: 'Kunde zahlt bar bei Lieferung', tag: '', iconBg: '#ECFDF5' },
  { method: 'karte', label: 'Kartenzahlung vor Ort', desc: 'EC-/Kreditkarte beim Fahrer', tag: '', iconBg: '#FEF3C7' },
  { method: 'abholung', label: 'Zahlung bei Abholung', desc: 'Bezahlung bei Abholung im Restaurant', tag: '', iconBg: '#F5F3FF' },
];
const COMING = ['SumUp Terminal', 'PayPal', 'Klarna', 'Rechnung (B2B)', 'Gutschein-Einlösung'];
export default async function Zahlungen() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const { data } = await sb.from('tenant_payment_methods').select('method, enabled_lieferung, enabled_abholung, enabled_vor_ort').eq('tenant_id', emp?.tenant_id ?? '');
  const rows = (data ?? []) as any[];
  const list = PAYS.map((p) => { const r = rows.find((x) => x.method === p.method); return { ...p, on: r ? !!(r.enabled_lieferung || r.enabled_abholung || r.enabled_vor_ort) : false }; });
  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Aktive Zahlungsarten</h3><p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Aktivierte Zahlungsarten erscheinen automatisch im Shop.</p></div>
        {list.map((p, i) => (
          <div key={p.method} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', borderBottom: i < list.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: p.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' }} /></div>
            <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{p.label}</span>{p.tag && <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '3px 8px', borderRadius: 999 }}>{p.tag}</span>}</div><div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{p.desc}</div></div>
            <ZahlToggle method={p.method} on={p.on} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px', marginBottom: 10 }}>DEMNÄCHST VERFÜGBAR</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{COMING.map((c) => (<span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 10, padding: '9px 14px', fontSize: 13.5, fontWeight: 600, color: '#94A3B8' }}>{c}</span>))}</div>
    </div>
  );
}
