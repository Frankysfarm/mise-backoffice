import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const eur0 = (n: number) => Math.round(Number(n ?? 0)).toLocaleString('de-DE') + ' €';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
export default async function Statistik() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const { data } = await sb.from('customer_orders').select('gesamtbetrag, status, typ, zahlungsart, created_at, kunde_telefon').eq('tenant_id', emp?.tenant_id ?? '').gte('created_at', since).limit(8000);
  const all = (data ?? []) as any[];
  const valid = all.filter((o) => o.status !== 'storniert');
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const v30 = valid.filter((o) => o.created_at >= since30);
  const rev30 = v30.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);
  const cancel = all.length ? (all.filter((o) => o.status === 'storniert').length / all.length) * 100 : 0;
  const custCount = new Map<string, number>(); for (const o of valid) { const k = o.kunde_telefon; if (k) custCount.set(k, (custCount.get(k) ?? 0) + 1); }
  const repeat = custCount.size ? ([...custCount.values()].filter((n) => n >= 2).length / custCount.size) * 100 : 0;
  const KPIS = [
    { label: 'Umsatz (30 T.)', value: eur0(rev30), sub: 'Brutto', color: '#047857' },
    { label: 'Bestellungen (30 T.)', value: String(v30.length), sub: 'ohne Storno', color: '#047857' },
    { label: 'Ø Bestellwert', value: v30.length ? eur(rev30 / v30.length) : '—', sub: '', color: '#047857' },
    { label: 'Lieferungen', value: String(v30.filter((o) => o.typ === 'lieferung').length), sub: '30 Tage', color: '#1D4ED8' },
    { label: 'Stornoquote', value: cancel.toFixed(1) + ' %', sub: '6 Monate', color: cancel > 5 ? '#DC2626' : '#94A3B8' },
    { label: 'Wiederkaufsrate', value: repeat.toFixed(0) + ' %', sub: 'Stammkunden', color: '#047857' },
  ];
  const months: { day: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const y = d.getFullYear(), m = d.getMonth(); const sum = valid.filter((o) => { const od = new Date(o.created_at); return od.getFullYear() === y && od.getMonth() === m; }).reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0); months.push({ day: d.toLocaleDateString('de-DE', { month: 'short' }), value: sum }); }
  const maxM = Math.max(1, ...months.map((m) => m.value));
  const payMap = new Map<string, number>(); for (const o of v30) { const k = o.zahlungsart || 'offen'; payMap.set(k, (payMap.get(k) ?? 0) + Number(o.gesamtbetrag ?? 0)); }
  const paySum = Math.max(1, [...payMap.values()].reduce((s, n) => s + n, 0));
  const PCOL = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899'];
  const pays = [...payMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, amt], i) => ({ label, amount: eur0(amt), w: (amt / paySum * 100) + '%', color: PCOL[i % PCOL.length] }));
  const lief = v30.filter((o) => o.typ === 'lieferung').length, abh = v30.filter((o) => o.typ === 'abholung').length, ch = Math.max(1, lief + abh);
  const channels = [{ label: 'Lieferung', pct: Math.round(lief / ch * 100), color: '#4F46E5' }, { label: 'Abholung', pct: Math.round(abh / ch * 100), color: '#10B981' }];
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14, marginBottom: 20 }}>
        {KPIS.map((k) => (<div key={k.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}><div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 8 }}>{k.label}</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 21, fontWeight: 700, color: '#0F172A', letterSpacing: '-.5px' }}>{k.value}</div><div style={{ fontSize: 11.5, fontWeight: 600, color: k.color, marginTop: 4 }}>{k.sub}</div></div>))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 20 }}>Umsatzentwicklung · 6 Monate</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 200 }}>{months.map((b, i) => (<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 12, fontWeight: 700, color: '#475569' }}>{b.value > 0 ? eur0(b.value) : ''}</div><div style={{ width: '100%', borderRadius: '8px 8px 0 0', background: i === 5 ? 'linear-gradient(180deg,#6366F1,#4338CA)' : '#C7D2FE', height: `${Math.max(2, Math.round(b.value / maxM * 100))}%` }} /><div style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 600 }}>{b.day}</div></div>))}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Zahlungsarten</h3>{pays.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>Keine Daten.</div>}{pays.map((p) => (<div key={p.label} style={{ marginBottom: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, color: '#475569', fontWeight: 600, textTransform: 'capitalize' }}>{p.label}</span><span style={{ fontSize: 13, color: '#0F172A', fontWeight: 700, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{p.amount}</span></div><div style={{ height: 8, borderRadius: 999, background: '#F1F5F9' }}><div style={{ height: 8, borderRadius: 999, width: p.w, background: p.color }} /></div></div>))}</div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Lieferung vs. Abholung</h3>{channels.map((c) => (<div key={c.label} style={{ marginBottom: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{c.label}</span><span style={{ fontSize: 13, color: '#0F172A', fontWeight: 700, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{c.pct} %</span></div><div style={{ height: 8, borderRadius: 999, background: '#F1F5F9' }}><div style={{ height: 8, borderRadius: 999, width: c.pct + '%', background: c.color }} /></div></div>))}</div>
        </div>
      </div>
    </div>
  );
}
