export const dynamic = 'force-dynamic';
const KPIS = [
  { label: 'Bestellungen heute', value: '—', accent: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Umsatz heute', value: '—', accent: '#059669', bg: '#ECFDF5' },
  { label: 'Ø Bestellwert', value: '—', accent: '#D97706', bg: '#FEF3C7' },
  { label: 'Aktive Fahrer', value: '—', accent: '#7C3AED', bg: '#F5F3FF' },
];
export default function Uebersicht() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      {KPIS.map((k) => (
        <div key={k.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, marginBottom: 12 }} />
          <div style={{ fontFamily: "'Space Grotesk'", fontSize: 26, fontWeight: 700, letterSpacing: '-.5px' }}>{k.value}</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}
