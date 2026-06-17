export const dynamic = 'force-dynamic';
const Card = ({ title, sub, children }: any) => (<div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}><h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 16, fontWeight: 700 }}>{title}</h3>{sub && <p style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2, marginBottom: 14 }}>{sub}</p>}{children}</div>);
export default function Aktionen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Card title="Treueprogramm" sub="Jede 5. Bestellung = 1 Gratis-Produkt">
          <div style={{ display: 'flex', gap: 8 }}>{[1, 2, 3, 4, 5].map((n) => (<div key={n} style={{ flex: 1, aspectRatio: '1', borderRadius: 10, border: '2px dashed #C7D2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', fontWeight: 700 }}>{n === 5 ? '🎁' : n}</div>))}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13.5, fontWeight: 600, color: '#334155' }}><input type="checkbox" defaultChecked /> Treueprogramm aktiv</label>
        </Card>
        <Card title="Gratis-Produkt beim Start" sub="Neukunden wählen 1 Gratis-Artikel">
          <button style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#334155' }}>Gratis-Produkt festlegen</button>
        </Card>
      </div>
      <Card title="Rabattcodes" sub="Zeitlich begrenzte Aktionen">
        <button style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 20px rgba(79,70,229,.3)' }}>+ Rabattcode erstellen</button>
        <div style={{ marginTop: 14, fontSize: 13, color: '#94A3B8' }}>Noch keine Rabattcodes angelegt.</div>
      </Card>
    </div>
  );
}
