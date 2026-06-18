'use client';
import { zoneAdjust, zoneToggle, zoneAdd } from './actions';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const Step = ({ on, children }: any) => <div onClick={on} style={{ width: 30, height: 30, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>{children}</div>;
const Box = ({ children }: any) => <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 3, width: 'fit-content' }}>{children}</div>;
const Val = ({ children, color = '#0F172A' }: any) => <span style={{ minWidth: 64, textAlign: 'center', fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color }}>{children}</span>;

export function ZoneTable({ zones }: { zones: any[] }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '128px 1fr 1fr 1fr 64px', gap: 14, padding: '10px 22px 8px', fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '.4px' }}><span>ZONE</span><span>MINDESTBESTELLWERT</span><span>LIEFERGEBÜHR</span><span>GRATIS AB</span><span style={{ textAlign: 'right' }}>AKTIV</span></div>
      {zones.length === 0 && <div style={{ padding: '14px 22px', color: '#94A3B8', fontSize: 13 }}>Noch keine Zonen. Klick „Zone hinzufügen".</div>}
      {zones.map((z, i) => (
        <div key={z.id} style={{ display: 'grid', gridTemplateColumns: '128px 1fr 1fr 1fr 64px', gap: 14, alignItems: 'center', padding: '14px 22px', borderTop: '1px solid #F1F5F9', opacity: z.aktiv ? 1 : .5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <div><div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>Zone {i + 1}</div><div style={{ marginTop: 3 }}><span style={{ background: '#EEF2FF', color: '#4338CA', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 7 }}>bis {z.radius_km_bis} km</span></div></div>
          </div>
          <Box><Step on={() => zoneAdjust(z.id, 'mindestbestellwert', -1, 0, 200)}>−</Step><Val>{eur(z.mindestbestellwert)}</Val><Step on={() => zoneAdjust(z.id, 'mindestbestellwert', 1, 0, 200)}>+</Step></Box>
          <Box><Step on={() => zoneAdjust(z.id, 'liefergebuehr', -0.5, 0, 50)}>−</Step><Val color={Number(z.liefergebuehr) === 0 ? '#047857' : '#0F172A'}>{Number(z.liefergebuehr) === 0 ? 'Gratis' : eur(z.liefergebuehr)}</Val><Step on={() => zoneAdjust(z.id, 'liefergebuehr', 0.5, 0, 50)}>+</Step></Box>
          <Box><Step on={() => zoneAdjust(z.id, 'free_ab', -5, 0, 500)}>−</Step><Val color={Number(z.free_ab) === 0 ? '#94A3B8' : '#0F172A'}>{Number(z.free_ab) === 0 ? 'Aus' : eur(z.free_ab)}</Val><Step on={() => zoneAdjust(z.id, 'free_ab', 5, 0, 500)}>+</Step></Box>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div onClick={() => zoneToggle(z.id, z.aktiv)} style={{ width: 44, height: 26, borderRadius: 999, background: z.aktiv ? '#4F46E5' : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}><div style={{ position: 'absolute', top: 3, left: z.aktiv ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s' }} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}
export function AddZoneBtn({ tenantId, locId }: { tenantId: string; locId: string }) {
  return <button onClick={() => zoneAdd(tenantId, locId)} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', border: '1.5px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#4338CA', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' }} />Zone hinzufügen</button>;
}
