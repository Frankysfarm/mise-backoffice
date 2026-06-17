import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 0 }) + ' €';
export default async function Statistik() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase.from('customer_orders').select('gesamtbetrag, status, typ, zahlungsart').eq('tenant_id', emp?.tenant_id ?? '').gte('created_at', since);
  const all = (data ?? []) as any[];
  const valid = all.filter((o) => o.status !== 'storniert');
  const revenue = valid.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);
  const cancel = all.length ? (all.filter((o) => o.status === 'storniert').length / all.length) * 100 : 0;
  const KPIS = [
    { l: 'Umsatz (30 T.)', v: eur(revenue) }, { l: 'Bestellungen', v: String(valid.length) },
    { l: 'Ø Bestellwert', v: valid.length ? eur(revenue / valid.length) : '—' },
    { l: 'Stornoquote', v: cancel.toFixed(1) + ' %' },
    { l: 'Lieferung', v: valid.filter((o) => o.typ === 'lieferung').length + '×' },
    { l: 'Abholung', v: valid.filter((o) => o.typ === 'abholung').length + '×' },
  ];
  const payMap = new Map<string, number>(); for (const o of valid) { const k = o.zahlungsart || 'offen'; payMap.set(k, (payMap.get(k) ?? 0) + 1); } const pays = [...payMap.entries()].sort((a,b)=>b[1]-a[1]).map(([p, n]) => ({ p, n }));
  const totalPay = Math.max(1, pays.reduce((s, x) => s + x.n, 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {KPIS.map((k) => (<div key={k.l} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 24, fontWeight: 700 }}>{k.v}</div><div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{k.l}</div></div>))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)', maxWidth: 480 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Zahlungsarten (30 Tage)</h3>
        {pays.map(({ p, n }) => (<div key={p} style={{ marginBottom: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span style={{ textTransform: 'capitalize', color: '#475569', fontWeight: 600 }}>{p}</span><span style={{ color: '#64748B' }}>{n}×</span></div><div style={{ height: 8, borderRadius: 999, background: '#F1F5F9' }}><div style={{ height: 8, borderRadius: 999, width: `${(n / totalPay) * 100}%`, background: '#4F46E5' }} /></div></div>))}
      </div>
    </div>
  );
}
