import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { ZoneTable, AddZoneBtn, InviteDriverBtn } from './client';
import { LieferMap } from './liefermap';
import { getSatisfactionSummary } from '@/lib/delivery/satisfaction';
export const dynamic = 'force-dynamic';
const VEH: Record<string, { l: string; bg: string; c: string }> = { fahrrad: { l: 'Fahrrad', bg: '#ECFDF5', c: '#047857' }, roller: { l: 'Roller', bg: '#FEF3C7', c: '#B45309' }, auto: { l: 'Auto', bg: '#EFF6FF', c: '#1D4ED8' } };
export default async function Fahrer() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const [{ data: zones }, { data: dt }, { data: loc }, { data: ten }] = await Promise.all([
    supabase.from('delivery_zones').select('id, radius_km_bis, mindestbestellwert, liefergebuehr, free_ab, aktiv').eq('tenant_id', emp?.tenant_id ?? '').eq('location_id', emp?.location_id ?? '').order('radius_km_bis', { ascending: true }),
    supabase.from('mise_driver_tenants').select('mise_drivers(id, name, email, phone, vehicle, max_radius_km, total_deliveries, rating, state)').eq('tenant_id', emp?.tenant_id ?? ''),
    supabase.from('locations').select('lat, lng').eq('id', emp?.location_id ?? '').maybeSingle(),
    supabase.from('tenants').select('adresse, stadt, plz').eq('id', emp?.tenant_id ?? '').maybeSingle(),
  ]);
  const zl = (zones ?? []) as any[];
  const drivers = ((dt ?? []) as any[]).map((x) => Array.isArray(x.mise_drivers) ? x.mise_drivers[0] : x.mise_drivers).filter(Boolean);
  const addr = [ten?.adresse, ten?.plz, ten?.stadt].filter(Boolean).join(' ');
  const sat = emp?.location_id ? await getSatisfactionSummary(emp.location_id, 30) : null;
  const fmtDay = (iso: string) => { try { const d = new Date(iso); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); } catch { return ''; } };
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <div><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Lieferradien &amp; Gebühren</h3><p style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>Pro Zone Mindestbestellwert und Liefergebühr festlegen — gilt automatisch im Shop &amp; an der Kasse.</p></div>
          <AddZoneBtn />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 0 }}>
          <LieferMap center={{ lat: loc?.lat ?? null, lng: loc?.lng ?? null }} address={addr} zones={zl} />
          <ZoneTable zones={zl} />
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Alle Fahrer <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {drivers.length}</span></h3>
          <InviteDriverBtn />
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

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Kundenbewertungen <span style={{ color: '#94A3B8', fontWeight: 500 }}>· letzte 30 Tage</span></h3>
            <p style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>Kunden bewerten nach jeder Lieferung per E-Mail-Link — hier siehst du das Feedback.</p>
          </div>
          {sat && sat.totalRatings > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 26, fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>★ {sat.avgRating.toFixed(1)}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>{sat.totalRatings} {sat.totalRatings === 1 ? 'Bewertung' : 'Bewertungen'} · {sat.positiveRate}% positiv</div>
            </div>
          )}
        </div>
        {(!sat || sat.totalRatings === 0) ? (
          <div style={{ padding: '28px 22px', color: '#94A3B8', fontSize: 13 }}>Noch keine Bewertungen. Sobald Lieferungen abgeschlossen sind, bekommen Kunden automatisch eine Bewertungs-E-Mail.</div>
        ) : (
          <div>
            {sat.recentComments.length === 0 && (
              <div style={{ padding: '20px 22px', color: '#94A3B8', fontSize: 13 }}>Bewertungen vorhanden, aber noch keine Kommentare.</div>
            )}
            {sat.recentComments.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 22px', borderTop: i === 0 ? 'none' : '1px solid #F1F5F9' }}>
                <span style={{ color: c.rating >= 4 ? '#F59E0B' : c.rating <= 2 ? '#EF4444' : '#94A3B8', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 56 }}>{'★'.repeat(c.rating)}<span style={{ color: '#E2E8F0' }}>{'★'.repeat(5 - c.rating)}</span></span>
                <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5, flex: 1 }}>{c.comment}</span>
                <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDay(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
