import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
export default async function Kunden() {
  const emp = await getCurrentEmployee();
  const supabase = await createClient();
  const { data } = await supabase.from('customer_orders').select('kunde_name, kunde_telefon, gesamtbetrag, created_at').eq('tenant_id', emp?.tenant_id ?? '').neq('status', 'storniert').order('created_at', { ascending: false }).limit(1000);
  const map = new Map<string, { name: string; tel: string; orders: number; total: number; last: string }>();
  for (const o of (data ?? []) as any[]) {
    const key = o.kunde_telefon || o.kunde_name || ''; if (!key) continue;
    const e = map.get(key) || { name: o.kunde_name || '—', tel: o.kunde_telefon || '', orders: 0, total: 0, last: o.created_at };
    e.orders++; e.total += Number(o.gesamtbetrag ?? 0); if (o.created_at > e.last) e.last = o.created_at;
    map.set(key, e);
  }
  const customers = [...map.values()].sort((a, b) => b.total - a.total);
  const campaigns = [['E-Mail-Kampagne', '#4F46E5', '#EEF2FF'], ['WhatsApp', '#10B981', '#ECFDF5'], ['SMS', '#F59E0B', '#FEF3C7']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {campaigns.map(([t, c, bg]) => (<div key={t} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}><div style={{ width: 36, height: 36, borderRadius: 10, background: bg, marginBottom: 10 }} /><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 15 }}>{t}</div><button style={{ marginTop: 10, height: 34, padding: '0 14px', borderRadius: 9, border: 'none', background: c as string, color: '#fff', fontSize: 12.5, fontWeight: 600 }}>Kampagne starten</button></div>))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between' }}><h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 16, fontWeight: 700 }}>Kunden</h3><span style={{ fontSize: 12.5, color: '#94A3B8' }}>{customers.length} gesamt</span></div>
        {customers.slice(0, 50).map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{c.name}</span>
            <span style={{ fontSize: 12.5, color: '#64748B', width: 140 }}>{c.tel}</span>
            <span style={{ fontSize: 12.5, color: '#64748B', width: 90 }}>{c.orders} Best.</span>
            <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 13.5, width: 90, textAlign: 'right' }}>{eur(c.total)}</span>
          </div>
        ))}
        {customers.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>Noch keine Kunden.</div>}
      </div>
    </div>
  );
}
