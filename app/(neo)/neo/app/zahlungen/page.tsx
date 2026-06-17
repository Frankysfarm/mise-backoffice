import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const DEFAULTS = [
  { method: 'stripe', label: 'Stripe', desc: 'Online-Kartenzahlung, Apple Pay & Google Pay' },
  { method: 'bar', label: 'Barzahlung', desc: 'Kunde zahlt bar bei Lieferung' },
  { method: 'karte', label: 'Kartenzahlung vor Ort', desc: 'EC-/Kreditkarte beim Fahrer' },
  { method: 'abholung', label: 'Zahlung bei Abholung', desc: 'Bezahlung bei Abholung im Restaurant' },
];
export default async function Zahlungen() {
  const emp = await getCurrentEmployee();
  const supabase = await createClient();
  const { data } = await supabase.from('tenant_payment_methods').select('method, label, enabled_lieferung, enabled_abholung, enabled_vor_ort').eq('tenant_id', emp?.tenant_id ?? '');
  const rows = (data ?? []) as any[];
  const list = DEFAULTS.map((d) => { const r = rows.find((x) => x.method === d.method); return { ...d, label: r?.label || d.label, on: r ? !!(r.enabled_lieferung || r.enabled_abholung || r.enabled_vor_ort) : false }; });
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 8, boxShadow: '0 1px 2px rgba(15,23,42,.05)', maxWidth: 720 }}>
      {list.map((p, i) => (
        <div key={p.method} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderBottom: i < list.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.label}</div><div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>{p.desc}</div></div>
          <div style={{ width: 46, height: 26, borderRadius: 999, background: p.on ? '#4F46E5' : '#CBD5E1', position: 'relative', flexShrink: 0 }}><div style={{ position: 'absolute', top: 3, left: p.on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} /></div>
        </div>
      ))}
    </div>
  );
}
