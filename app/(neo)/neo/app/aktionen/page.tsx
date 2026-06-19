import { Soon } from '../_soon';
export const dynamic = 'force-dynamic';
const IDEAS = ['Happy Hour', '2-für-1 Pizza', 'Gratis Lieferung ab 30€', 'Studenten-Rabatt', 'Mittagsangebot', 'Wochenend-Special'];
export default function Aktionen() {
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>🎁</div><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Kostenloses Produkt</h3></div><span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 9px', borderRadius: 999 }}>Bald</span></div>
          <p style={{ fontSize: 13.5, color: '#64748B', marginBottom: 14 }}>Jeder Kunde erhält bei seiner Bestellung ein Gratis-Produkt.</p>
          <Soon href="/loyalty" style={{ width: '100%', height: 44, border: '1.5px solid #E2E8F0', borderRadius: 10, background: '#fff', fontSize: 14, color: '#475569', fontWeight: 600, cursor: 'pointer', textAlign: 'left', paddingLeft: 12 }}>Gratis-Produkt festlegen…</Soon>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>⭐</div><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Treueprogramm</h3></div><span style={{ fontSize: 12, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '4px 10px', borderRadius: 999 }}>AKTIV</span></div>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Jede 5. Bestellung = 1 Gratis-Produkt</div></div>
          <p style={{ fontSize: 12.5, color: '#94A3B8' }}>Läuft automatisch im Shop. Konfiguration folgt.</p>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Rabattcodes</h3><Soon href="/vouchers" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', border: 'none', borderRadius: 10, background: '#0F172A', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>+ Code erstellen</Soon></div>
        <div style={{ padding: '24px 22px', textAlign: 'center', color: '#94A3B8', fontSize: 13.5 }}>Noch keine Rabattcodes angelegt.</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px', marginBottom: 10 }}>WEITERE AKTIONS-IDEEN</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{IDEAS.map((p) => (<Soon key={p} href="/loyalty" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}><span style={{ color: '#4F46E5' }}>+</span>{p}</Soon>))}</div>
    </div>
  );
}
