import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

const eur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export default async function Uebersicht() {
  const emp = await getCurrentEmployee();
  const tenantId = emp?.tenant_id ?? '';
  const supabase = await createClient();
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const todayStr = now.toISOString().slice(0, 10);

  const [{ data: orders7 }, { data: drv }, { data: items }] = await Promise.all([
    supabase.from('customer_orders').select('gesamtbetrag, created_at, status').eq('tenant_id', tenantId).gte('created_at', since7).neq('status', 'storniert'),
    supabase.from('mise_driver_tenants').select('driver_id, mise_drivers(state)').eq('tenant_id', tenantId),
    supabase.from('order_items').select('name, gesamtpreis, order:customer_orders!inner(tenant_id, created_at, status)').eq('order.tenant_id', tenantId).gte('order.created_at', since7).neq('order.status', 'storniert').limit(800),
  ]);

  const all = orders7 ?? [];
  const todays = all.filter((o: any) => (o.created_at ?? '').slice(0, 10) === todayStr);
  const count = todays.length;
  const revenue = todays.reduce((s: number, o: any) => s + Number(o.gesamtbetrag ?? 0), 0);
  const avg = count ? revenue / count : 0;
  const activeDrivers = (drv ?? []).filter((d: any) => d.mise_drivers && d.mise_drivers.state && d.mise_drivers.state !== 'offline').length;

  // 7-Tage-Umsatz pro Tag
  const days: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const ds = d.toISOString().slice(0, 10);
    const sum = all.filter((o: any) => (o.created_at ?? '').slice(0, 10) === ds).reduce((s: number, o: any) => s + Number(o.gesamtbetrag ?? 0), 0);
    days.push({ label: d.toLocaleDateString('de-DE', { weekday: 'short' }), value: sum });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.value));
  const total7 = days.reduce((s, d) => s + d.value, 0);

  // Top-Produkte
  const prodMap = new Map<string, number>();
  for (const it of (items ?? []) as any[]) prodMap.set(it.name, (prodMap.get(it.name) ?? 0) + Number(it.gesamtpreis ?? 0));
  const top = [...prodMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const KPIS = [
    { label: 'Bestellungen heute', value: String(count), bg: '#EEF2FF', dot: '#4F46E5' },
    { label: 'Umsatz heute', value: eur(revenue), bg: '#ECFDF5', dot: '#059669' },
    { label: 'Ø Bestellwert', value: count ? eur(avg) : '—', bg: '#FEF3C7', dot: '#D97706' },
    { label: 'Aktive Fahrer', value: String(activeDrivers), bg: '#F5F3FF', dot: '#7C3AED' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {KPIS.map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 14, height: 14, borderRadius: 5, background: k.dot }} /></div>
            <div style={{ fontFamily: "'Space Grotesk'", fontSize: 26, fontWeight: 700, letterSpacing: '-.5px' }}>{k.value}</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 16, fontWeight: 700 }}>Umsatz · letzte 7 Tage</h3>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>Gesamt: <span style={{ fontWeight: 700, color: '#334155' }}>{eur(total7)}</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {days.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', fontFamily: "'Space Grotesk'" }}>{b.value > 0 ? Math.round(b.value) : ''}</div>
                <div style={{ width: '100%', height: Math.max(4, (b.value / maxDay) * 120), background: 'linear-gradient(180deg,#6366F1,#4F46E5)', borderRadius: 8 }} />
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
          <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Beliebteste Produkte</h3>
          {top.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>Noch keine Daten.</div>}
          {top.map(([name, rev], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < top.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 13, color: '#94A3B8', width: 16 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 14 }}>{eur(rev)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
