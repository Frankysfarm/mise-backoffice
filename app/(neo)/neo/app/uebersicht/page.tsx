import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { FilterBar } from './filter-bar';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const eur0 = (n: number) => Math.round(Number(n ?? 0)).toLocaleString('de-DE') + ' €';
const Svg = ({ html }: { html: string }) => <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: html }} />;
const I_ORDERS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/></svg>';
const I_EUR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>';
const I_BAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>';
const I_TRUCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="14" height="11" rx="1.5"/><path d="M15 9h4l4 4v4h-8z"/><circle cx="5" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
const PBG = ['#FEF3C7', '#ECFDF5', '#EEF2FF', '#DCFCE7', '#FCE7F3'];

export default async function Uebersicht({ searchParams }: { searchParams: Promise<{ period?: string; typ?: string }> }) {
  const sp = await searchParams;
  const period = ['today', '7d', '30d', '90d'].includes(sp?.period ?? '') ? (sp!.period as string) : '7d';
  const typ = ['lieferung', 'abholung'].includes(sp?.typ ?? '') ? (sp!.typ as string) : 'alle';
  const DAYS_BACK: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };
  const daysBack = DAYS_BACK[period];
  const periodLabel: Record<string, string> = { today: 'heute', '7d': 'letzte 7 Tage', '30d': 'letzte 30 Tage', '90d': 'letzte 90 Tage' };

  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const tenantId = emp?.tenant_id ?? '';
  const now = new Date();
  const dayMs = 86400000;
  // Fenster (auf Tagesgrenze) + Vorperiode für Delta
  const startOfToday = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const winStart = new Date(startOfToday.getTime() - (daysBack - 1) * dayMs);
  const prevStart = new Date(winStart.getTime() - daysBack * dayMs);
  const fetchSince = prevStart.toISOString();

  let oq = supabase.from('customer_orders').select('gesamtbetrag, created_at, status, typ').eq('tenant_id', tenantId).gte('created_at', fetchSince).neq('status', 'storniert');
  if (typ !== 'alle') oq = oq.eq('typ', typ);
  let iq = supabase.from('order_items').select('name, menge, gesamtpreis, order:customer_orders!inner(tenant_id, created_at, status, typ)').eq('order.tenant_id', tenantId).gte('order.created_at', winStart.toISOString()).neq('order.status', 'storniert').limit(4000);
  if (typ !== 'alle') iq = iq.eq('order.typ', typ);
  const [{ data: ordersRaw }, { data: dt }, { data: items }] = await Promise.all([oq, supabase.from('mise_driver_tenants').select('mise_drivers(state)').eq('tenant_id', tenantId), iq]);

  const allRaw = (ordersRaw ?? []) as any[];
  const ts = (o: any) => new Date(o.created_at).getTime();
  const cur = allRaw.filter((o) => ts(o) >= winStart.getTime());
  const prev = allRaw.filter((o) => ts(o) >= prevStart.getTime() && ts(o) < winStart.getTime());
  const sum = (a: any[]) => a.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);
  const count = cur.length, revenue = sum(cur), avg = count ? revenue / count : 0;
  const pCount = prev.length, pRev = sum(prev), pAvg = pCount ? pRev / pCount : 0;
  const activeDrivers = ((dt ?? []) as any[]).map((d) => Array.isArray(d.mise_drivers) ? d.mise_drivers[0] : d.mise_drivers).filter((m) => m && m.state && m.state !== 'offline').length;
  const delta = (t: number, y: number) => { if (!y) return { txt: t > 0 ? 'neu' : '—', up: true }; const p = Math.round((t - y) / y * 100); return { txt: (p >= 0 ? '+' : '') + p + '%', up: p >= 0 }; };
  const dO = delta(count, pCount), dR = delta(revenue, pRev), dA = delta(avg, pAvg);
  const G = { c: '#047857', b: '#ECFDF5' }, R = { c: '#DC2626', b: '#FEF2F2' };
  const suffix = period === 'today' ? 'heute' : `· ${periodLabel[period]}`;
  const KPIS = [
    { label: `Bestellungen ${suffix}`, value: String(count), icon: I_ORDERS, iconBg: '#EEF2FF', delta: dO.txt, dc: dO.up ? G : R },
    { label: `Umsatz ${suffix}`, value: eur(revenue), icon: I_EUR, iconBg: '#ECFDF5', delta: dR.txt, dc: dR.up ? G : R },
    { label: 'Ø Bestellwert', value: count ? eur(avg) : '—', icon: I_BAR, iconBg: '#FEF3C7', delta: dA.txt, dc: dA.up ? G : R },
    { label: 'Aktive Fahrer', value: String(activeDrivers), icon: I_TRUCK, iconBg: '#F5F3FF', delta: 'live', dc: { c: '#1D4ED8', b: '#EFF6FF' } },
  ];
  // Chart-Buckets: bis 14 Tage täglich, sonst gleichmäßig gruppiert (max 14 Balken)
  // Bucket-Breite zuerst, dann Anzahl daraus ableiten → Buckets decken exakt den Zeitraum (keine leeren Balken vor winStart)
  const bucketDays = Math.ceil(daysBack / Math.min(daysBack, 14));
  const nBuckets = Math.ceil(daysBack / bucketDays);
  const days: { day: string; value: number }[] = [];
  for (let b = nBuckets - 1; b >= 0; b--) {
    const bEnd = new Date(startOfToday.getTime() + dayMs - b * bucketDays * dayMs);
    const bStart = new Date(bEnd.getTime() - bucketDays * dayMs);
    const val = sum(cur.filter((o) => ts(o) >= bStart.getTime() && ts(o) < bEnd.getTime()));
    const lbl = bucketDays === 1 ? new Date(bEnd.getTime() - dayMs).toLocaleDateString('de-DE', { weekday: period === 'today' ? undefined : 'short', day: daysBack > 7 ? '2-digit' : undefined, month: daysBack > 7 ? '2-digit' : undefined }) : new Date(bStart).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    days.push({ day: lbl, value: val });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.value));
  const total7 = revenue;
  const prodMap = new Map<string, { rev: number; cnt: number }>();
  for (const it of (items ?? []) as any[]) { const e = prodMap.get(it.name) || { rev: 0, cnt: 0 }; e.rev += Number(it.gesamtpreis ?? 0); e.cnt += Number(it.menge ?? 0); prodMap.set(it.name, e); }
  const top = [...prodMap.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);

  return (
    <div style={{ maxWidth: 1180 }}>
      <FilterBar period={period} typ={typ} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 24 }}>
        {KPIS.map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: k.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg html={k.icon} /></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: k.dc.c, background: k.dc.b, padding: '3px 8px', borderRadius: 999 }}>{k.delta}</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 26, fontWeight: 700, color: '#0F172A', letterSpacing: '-.5px' }}>{k.value}</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Umsatz · {periodLabel[period]}</h3><span style={{ fontSize: 13, color: '#94A3B8' }}>Gesamt: <span style={{ fontWeight: 700, color: '#334155' }}>{eur0(total7)}</span></span></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 170, paddingTop: 10 }}>
            {days.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{b.value > 0 ? eur0(b.value) : ''}</div>
                <div style={{ width: '100%', borderRadius: '7px 7px 0 0', background: i >= days.length - Math.max(1, Math.ceil(days.length / 3)) ? 'linear-gradient(180deg,#6366F1,#4338CA)' : '#C7D2FE', height: `${Math.max(2, Math.round(b.value / maxDay * 100))}%` }} />
                <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>{b.day}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Beliebteste Produkte</h3>
          {top.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>Noch keine Daten.</div>}
          {top.map(([name, d], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: '#94A3B8', width: 16 }}>{i + 1}</span>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: PBG[i % PBG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{name.slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div><div style={{ fontSize: 12, color: '#94A3B8' }}>{d.cnt} verkauft</div></div>
              <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{eur0(d.rev)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
