import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { ZoneTable, AddZoneBtn } from './client';
export const dynamic = 'force-dynamic';
const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const VEH: Record<string, { l: string; bg: string; c: string }> = { fahrrad: { l: 'Fahrrad', bg: '#ECFDF5', c: '#047857' }, roller: { l: 'Roller', bg: '#FEF3C7', c: '#B45309' }, auto: { l: 'Auto', bg: '#EFF6FF', c: '#1D4ED8' } };
export default async function Fahrer() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const [{ data: zones }, { data: dt }] = await Promise.all([
    supabase.from('delivery_zones').select('id, radius_km_bis, mindestbestellwert, liefergebuehr, free_ab, aktiv').eq('tenant_id', emp?.tenant_id ?? '').order('radius_km_bis', { ascending: true }),
    supabase.from('mise_driver_tenants').select('mise_drivers(id, name, email, phone, vehicle, max_radius_km, total_deliveries, rating, state)').eq('tenant_id', emp?.tenant_id ?? ''),
  ]);
  const zl = (zones ?? []) as any[];
  const drivers = ((dt ?? []) as any[]).map((x) => Array.isArray(x.mise_drivers) ? x.mise_drivers[0] : x.mise_drivers).filter(Boolean);
  const maxKm = Math.max(1, ...zl.map((z) => Number(z.radius_km_bis) || 0));
  const activeZones = zl.filter((z) => z.aktiv).length;
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <div><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Lieferradien &amp; Gebühren</h3><p style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>Pro Zone Mindestbestellwert und Liefergebühr festlegen — gilt automatisch im Shop &amp; an der Kasse.</p></div>
          <AddZoneBtn tenantId={emp?.tenant_id ?? ''} locId={emp?.location_id ?? ''} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0 }}>
          <div style={{ borderRight: '1px solid #F1F5F9', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FAFBFC' }}>
            <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {zl.slice().reverse().map((z, i) => { const d = (Number(z.radius_km_bis) / maxKm) * 200; const ci = zl.length - 1 - i; return (<div key={z.id} style={{ position: 'absolute', width: d, height: d, borderRadius: '50%', border: `2px solid ${COLORS[ci % COLORS.length]}`, opacity: 0.5, background: `${COLORS[ci % COLORS.length]}12` }} />); })}
              <div style={{ position: 'absolute', width: 30, height: 30, borderRadius: '50%', background: '#15170F', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}><span dangerouslySetInnerHTML={{ __html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.7-7-11a7 7 0 0114 0c0 5.3-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>' }} /></div>
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 16, textAlign: 'center' }}>Restaurant im Zentrum · {activeZones} aktive Zonen</div>
          </div>
          <ZoneTable zones={zl} />
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Alle Fahrer <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {drivers.length}</span></h3>
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(79,70,229,.28)' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' }} />Fahrer einladen</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 0.9fr 1fr 0.8fr', padding: '11px 22px', background: '#F8FAFC', fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px' }}><span>FAHRER</span><span>KONTAKT</span><span>FAHRZEUG</span><span>RADIUS</span><span>LIEFERUNGEN</span><span>STATUS</span></div>
        {drivers.length === 0 && <div style={{ padding: '24px 22px', color: '#94A3B8', fontSize: 13 }}>Noch keine Fahrer verknüpft. Lade welche ein.</div>}
        {drivers.map((d: any) => { const v = VEH[d.vehicle] || VEH.auto; const on = d.state && d.state !== 'offline'; return (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 0.9fr 1fr 0.8fr', alignItems: 'center', padding: '14px 22px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#818CF8,#4F46E5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{(d.name || '?').slice(0, 2).toUpperCase()}</div><div><div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{d.name}</div><div style={{ fontSize: 12, color: '#94A3B8' }}>★ {d.rating ?? '—'}</div></div></div>
            <div style={{ fontSize: 13, color: '#475569', minWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email || '—'}</div><div style={{ color: '#94A3B8', fontSize: 12 }}>{d.phone || ''}</div></div>
            <div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: v.bg, color: v.c, fontSize: 12.5, fontWeight: 600, padding: '4px 9px', borderRadius: 8 }}>{v.l}</span></div>
            <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#334155' }}>{d.max_radius_km ? d.max_radius_km + ' km' : '—'}</div>
            <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#334155' }}>{d.total_deliveries ?? 0}</div>
            <div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: on ? '#ECFDF5' : '#F1F5F9', color: on ? '#047857' : '#94A3B8', fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#10B981' : '#CBD5E1' }} />{on ? 'Online' : 'Offline'}</span></div>
          </div>
        ); })}
      </div>
    </div>
  );
}
