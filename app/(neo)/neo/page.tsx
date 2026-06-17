import Link from 'next/link';
export const dynamic = 'force-dynamic';
const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
export default function ModulDashboard() {
  return (
    <>
      <link href={FONTS} rel="stylesheet" />
      <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#0F172A' }}>
        <div className="flex items-center gap-2.5" style={{ height: 64, padding: '0 26px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#312E81)' }}><div style={{ width: 11, height: 11, borderRadius: 4, background: '#fff' }} /></div>
          <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 20, letterSpacing: '-.5px' }}>mise</span>
        </div>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '56px 24px' }}>
          <h1 style={{ fontFamily: "'Space Grotesk'", fontSize: 34, fontWeight: 700, letterSpacing: '-1px' }}>Willkommen 👋</h1>
          <p style={{ color: '#64748B', marginTop: 8, marginBottom: 36 }}>Wähle ein Modul.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            <Link href="/neo/app/uebersicht" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 18, padding: 24, textDecoration: 'none', boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
              <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 7 }}>Lieferservice</h3>
              <p style={{ fontSize: 13.5, color: '#64748B' }}>Shop, Bestellungen, Fahrer, Lieferzentrale.</p>
              <span style={{ display: 'inline-block', marginTop: 14, fontSize: 11, fontWeight: 700, color: '#047857', background: '#ECFDF5', borderRadius: 999, padding: '4px 10px' }}>AKTIV</span>
            </Link>
            {[['POS / Kasse', 'Kassensystem, TSE, Bons.'], ['Geschäftsverwaltung', 'Buchhaltung, Personal, Lager.']].map(([t, d]) => (
              <div key={t} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 18, padding: 24, opacity: .6 }}>
                <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, color: '#475569', marginBottom: 7 }}>{t}</h3>
                <p style={{ fontSize: 13.5, color: '#94A3B8' }}>{d}</p>
                <span style={{ display: 'inline-block', marginTop: 14, fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', borderRadius: 999, padding: '4px 10px' }}>IN BEARBEITUNG</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
