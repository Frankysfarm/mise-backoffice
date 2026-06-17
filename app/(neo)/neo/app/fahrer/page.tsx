import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
export default async function Fahrer() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const [{ data: zones }, { data: dt }] = await Promise.all([
    supabase.from('delivery_zones').select('id, radius_km_bis, liefergebuehr, mindestbestellwert, aktiv').eq('tenant_id', emp?.tenant_id ?? '').order('radius_km_bis', { ascending: true }),
    supabase.from('mise_driver_tenants').select('mise_drivers(id, name, state)').eq('tenant_id', emp?.tenant_id ?? ''),
  ]);
  const zl = (zones ?? []) as any[];
  const drivers = ((dt ?? []) as any[]).map((x) => Array.isArray(x.mise_drivers) ? x.mise_drivers[0] : x.mise_drivers).filter(Boolean);
  const maxKm = Math.max(1, ...zl.map((z) => Number(z.radius_km_bis) || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700 }}>Liefergebiete &amp; Gebühren</h3>
        <p style={{ fontSize: 12.5, color: '#64748B', marginTop: 2, marginBottom: 20 }}>Pro Zone Mindestbestellwert und Liefergebühr — gilt automatisch im Shop &amp; an der Kasse.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
            {zl.slice().reverse().map((z, i) => { const r = (Number(z.radius_km_bis) / maxKm) * 100; return (<div key={z.id} style={{ position: 'absolute', top: '50%', left: '50%', width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, borderRadius: '50%', background: `rgba(79,70,229,${0.06 + i * 0.05})`, border: '2px solid rgba(79,70,229,0.35)' }} />); })}
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: '50%', background: '#4F46E5' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {zl.length === 0 && <div style={{ color: '#64748B', fontSize: 13 }}>Noch keine Liefergebiete angelegt.</div>}
            {zl.map((z) => (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 12, opacity: z.aktiv ? 1 : .5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', background: '#EEF2FF', borderRadius: 6, padding: '3px 9px' }}>Radius</span>
                <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, minWidth: 56 }}>{z.radius_km_bis} km</span>
                <span style={{ flex: 1, fontSize: 13, color: '#475569' }}>Min. <b>{eur(z.mindestbestellwert)}</b> · Gebühr <b style={{ color: Number(z.liefergebuehr) === 0 ? '#047857' : '#0F172A' }}>{Number(z.liefergebuehr) === 0 ? 'Gratis' : eur(z.liefergebuehr)}</b></span>
                <span style={{ fontSize: 11, fontWeight: 700, color: z.aktiv ? '#047857' : '#94A3B8' }}>{z.aktiv ? '● aktiv' : '○ inaktiv'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700 }}>Fahrer</h3><span style={{ fontSize: 12.5, color: '#64748B' }}>{drivers.length} gesamt</span></div>
        {drivers.length === 0 && <div style={{ color: '#64748B', fontSize: 13 }}>Noch keine Fahrer verknüpft.</div>}
        {drivers.map((d: any, i: number) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < drivers.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#818CF8,#4F46E5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{(d.name || '?').slice(0, 2).toUpperCase()}</div>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{d.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: d.state && d.state !== 'offline' ? '#047857' : '#94A3B8' }}>{d.state && d.state !== 'offline' ? '● online' : '○ offline'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
