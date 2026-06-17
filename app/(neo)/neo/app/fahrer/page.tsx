import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const VEH: Record<string, { l: string; bg: string; c: string }> = { fahrrad: { l: 'Fahrrad', bg: '#ECFDF5', c: '#047857' }, roller: { l: 'Roller', bg: '#FEF3C7', c: '#B45309' }, auto: { l: 'Auto', bg: '#EFF6FF', c: '#1D4ED8' } };
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
export default async function Fahrer() {
  const emp = await getCurrentEmployee();
  const supabase = await createClient();
  const locId = emp?.location_id ?? '';
  const [{ data: zones }, { data: dt }] = await Promise.all([
    supabase.from('delivery_zones').select('*').eq('location_id', locId).order('km'),
    supabase.from('mise_driver_tenants').select('mise_drivers(id, name, state)').eq('tenant_id', emp?.tenant_id ?? ''),
  ]);
  const zl = (zones ?? []) as any[];
  const drivers = ((dt ?? []) as any[]).map((x) => x.mise_drivers).filter(Boolean);
  const maxKm = Math.max(1, ...zl.map((z) => Number(z.km)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
        <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 16, fontWeight: 700 }}>Lieferradien &amp; Gebühren</h3>
        <p style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2, marginBottom: 18 }}>Pro Zone Mindestbestellwert und Liefergebühr — gilt automatisch im Shop &amp; an der Kasse.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
            {zl.slice().reverse().map((z) => { const r = (Number(z.km) / maxKm) * 100; const v = VEH[z.veh] || VEH.auto; return (<div key={z.id} style={{ position: 'absolute', top: '50%', left: '50%', width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, borderRadius: '50%', background: v.c + '14', border: `2px solid ${v.c}55` }} />); })}
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: '50%', background: '#4F46E5' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {zl.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Noch keine Zonen.</div>}
            {zl.map((z) => { const v = VEH[z.veh] || VEH.auto; return (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 12, opacity: z.active ? 1 : .5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: v.c, background: v.bg, borderRadius: 6, padding: '3px 9px' }}>{v.l}</span>
                <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 14, minWidth: 50 }}>{z.km} km</span>
                <span style={{ flex: 1, fontSize: 13, color: '#475569' }}>Min. <b>{eur(z.min_order)}</b> · Gebühr <b style={{ color: Number(z.fee) === 0 ? '#047857' : '#0F172A' }}>{Number(z.fee) === 0 ? 'Gratis' : eur(z.fee)}</b>{Number(z.free_from) > 0 ? ` · gratis ab ${eur(z.free_from)}` : ''}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: z.active ? '#047857' : '#94A3B8' }}>{z.active ? '● aktiv' : '○ inaktiv'}</span>
              </div>
            ); })}
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 16, fontWeight: 700 }}>Fahrer</h3><span style={{ fontSize: 12.5, color: '#94A3B8' }}>{drivers.length} gesamt</span></div>
        {drivers.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Noch keine Fahrer.</div>}
        {drivers.map((d: any, i: number) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < drivers.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#818CF8,#4F46E5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{(d.name || '?').slice(0, 2).toUpperCase()}</div>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{d.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: d.state !== 'offline' ? '#047857' : '#94A3B8' }}>{d.state !== 'offline' ? '● online' : '○ offline'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
