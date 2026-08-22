'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zoneAdjust, zoneToggle, zoneAdd } from './actions';
const run = (fn: () => Promise<void>) => fn().catch((e: any) => alert('Fehler: ' + (e?.message || e)));

export function InviteDriverBtn() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [vehicle, setVehicle] = useState<'bike' | 'car'>('bike');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function send() {
    if (!valid || saving) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/admin/drivers/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), name: name.trim(), vehicle }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.error || 'Einladung fehlgeschlagen'); setSaving(false); return; }
      setDone(true); setSaving(false);
      setTimeout(() => { setOpen(false); setDone(false); setName(''); setEmail(''); router.refresh(); }, 1600);
    } catch (e: any) { setErr(e?.message || 'Fehler'); setSaving(false); }
  }

  const L: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' };
  const I: React.CSSProperties = { width: '100%', height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14, color: '#0F172A', marginBottom: 14 };
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(79,70,229,.28)' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' }} />Fahrer einladen</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '100%', background: '#fff', borderRadius: 18, padding: 24 }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
                <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Einladung gesendet</h3>
                <p style={{ fontSize: 13.5, color: '#64748B', marginTop: 6 }}>{name} bekommt eine E-Mail mit Link zum Passwort-Setzen + Fahrer-App-Installation.</p>
              </div>
            ) : (<>
              <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Fahrer einladen</h3>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Der Fahrer bekommt eine E-Mail → Passwort setzen → Fahrer-App installieren.</p>
              <label style={L}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marco Rossi" style={I} />
              <label style={L}>E-Mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marco@example.com" style={I} />
              <label style={L}>Fahrzeug</label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {([['bike', '🚲 Fahrrad/Roller'], ['car', '🚗 Auto']] as const).map(([v, lbl]) => (
                  <button key={v} onClick={() => setVehicle(v)} style={{ flex: 1, height: 42, borderRadius: 10, border: `1.5px solid ${vehicle === v ? '#4F46E5' : '#E2E8F0'}`, background: vehicle === v ? '#EEF2FF' : '#fff', color: vehicle === v ? '#4338CA' : '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
              {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setOpen(false)} style={{ flex: 1, height: 44, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Abbrechen</button>
                <button onClick={send} disabled={!valid || saving} style={{ flex: 2, height: 44, borderRadius: 10, border: 'none', background: valid && !saving ? '#4F46E5' : '#CBD5E1', color: '#fff', fontWeight: 700, cursor: valid && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Sendet…' : 'Einladung senden'}</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
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
            <div><div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>Zone {i + 1}</div><div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}><div onClick={() => run(() => zoneAdjust(z.id, 'radius_km_bis', -1, 1, 50))} style={{ width: 24, height: 24, borderRadius: 7, background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>−</div><span style={{ minWidth: 52, textAlign: 'center', background: '#EEF2FF', color: '#4338CA', fontSize: 11.5, fontWeight: 700, padding: '4px 7px', borderRadius: 7 }}>bis {z.radius_km_bis} km</span><div onClick={() => run(() => zoneAdjust(z.id, 'radius_km_bis', 1, 1, 50))} style={{ width: 24, height: 24, borderRadius: 7, background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>+</div></div></div>
          </div>
          <Box><Step on={() => run(() => zoneAdjust(z.id, 'mindestbestellwert', -1, 0, 200))}>−</Step><Val>{eur(z.mindestbestellwert)}</Val><Step on={() => run(() => zoneAdjust(z.id, 'mindestbestellwert', 1, 0, 200))}>+</Step></Box>
          <Box><Step on={() => run(() => zoneAdjust(z.id, 'liefergebuehr', -0.5, 0, 50))}>−</Step><Val color={Number(z.liefergebuehr) === 0 ? '#047857' : '#0F172A'}>{Number(z.liefergebuehr) === 0 ? 'Gratis' : eur(z.liefergebuehr)}</Val><Step on={() => run(() => zoneAdjust(z.id, 'liefergebuehr', 0.5, 0, 50))}>+</Step></Box>
          <Box><Step on={() => run(() => zoneAdjust(z.id, 'free_ab', -5, 0, 500))}>−</Step><Val color={Number(z.free_ab) === 0 ? '#94A3B8' : '#0F172A'}>{Number(z.free_ab) === 0 ? 'Aus' : eur(z.free_ab)}</Val><Step on={() => run(() => zoneAdjust(z.id, 'free_ab', 5, 0, 500))}>+</Step></Box>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div onClick={() => run(() => zoneToggle(z.id, z.aktiv))} style={{ width: 44, height: 26, borderRadius: 999, background: z.aktiv ? '#4F46E5' : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}><div style={{ position: 'absolute', top: 3, left: z.aktiv ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s' }} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}
export function AddZoneBtn() {
  return <button onClick={() => run(() => zoneAdd())} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', border: '1.5px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#4338CA', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}><span dangerouslySetInnerHTML={{ __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' }} />Zone hinzufügen</button>;
}
