'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const ICONS: Record<string, string> = {
  overview: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  lieferzentrale: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
  tischbestellung: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14h1M20 18h1M14 21h3M19 21h2"/></svg>',
  fahrer: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="14" height="11" rx="1.5"/><path d="M15 9h4l4 4v4h-8V9z"/><circle cx="5" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/></svg>',
  shopdesign: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 22a10 10 0 110-20c5.5 0 10 4.5 10 10 0 2.8-2.2 4-4 4h-2c-1.5 0-2 1-2 2s-.5 4-2 4z"/></svg>',
  shopsettings: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-6 10 6M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9M9 20v-6h6v6"/></svg>',
  menu: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18M3 12h18M3 17h12"/></svg>',
  aktionen: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4L13.4 20.6a2 2 0 01-2.8 0l-7.2-7.2a2 2 0 01-.6-1.4V5a2 2 0 012-2h6.6a2 2 0 011.4.6l7.8 7.8a2 2 0 010 3z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  zahlungen: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  kunden: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  statistik: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
  buchhaltung: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  bewerbungen: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 015-5h4a5 5 0 015 5v2M17 11l2 2 4-4"/></svg>',
  mitarbeiter: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>',
  dienstplan: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>',
  lager: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/><path d="M7 21v-8h10v8M7 16h10"/></svg>',
  ablaeufe: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  schulungen: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5M22 10v6"/></svg>',
  compliance: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
  rezeptbuch: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5z"/><path d="M8 7h8M8 11h5"/></svg>',
  klarheit: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
};
const NAV: { label: string; managerOnly?: boolean; items: [string, string][] }[] = [
  { label: 'BETRIEB', items: [['overview', 'Übersicht'], ['lieferzentrale', 'Lieferzentrale'], ['tischbestellung', 'Tischbestellung'], ['fahrer', 'Fahrer']] },
  { label: 'TEAM & ABLÄUFE', managerOnly: true, items: [['klarheit', 'Tagesklarheit'], ['bewerbungen', 'Bewerbungen'], ['tests', 'Bewerbungstests'], ['mitarbeiter', 'Mitarbeiter & Bereiche'], ['dienstplan', 'Dienstplan'], ['lager', 'Lager'], ['ablaeufe', 'Listen & Abläufe'], ['schulungen', 'Schulungen'], ['compliance', 'Team & Compliance'], ['rezeptbuch', 'Rezeptbuch']] },
  { label: 'SHOP', items: [['shopdesign', 'Shop-Design'], ['shopsettings', 'Shop-Einstellungen'], ['menu', 'Menü'], ['aktionen', 'Aktionen & Rabatte'], ['loyalty', 'Bonusprogramme'], ['zahlungen', 'Zahlungen']] },
  { label: 'GESCHÄFT', items: [['kunden', 'Kundenstamm'], ['statistik', 'Statistik'], ['buchhaltung', 'Buchhaltung']] },
];
const META: Record<string, [string, string]> = {
  overview: ['Übersicht', 'Dein Liefergeschäft auf einen Blick'], lieferzentrale: ['Lieferzentrale', 'Küchendisplay · alle eingehenden Bestellungen'],
  tischbestellung: ['Tischbestellung', 'Tische, QR-Codes und Bestellfluss verwalten'],
  fahrer: ['Fahrer', 'Fahrer einladen und Liefergebiete verwalten'], shopdesign: ['Shop-Design', 'Aussehen deines Online-Shops anpassen'],
  shopsettings: ['Shop-Einstellungen', 'Domain, QR-Code und Verfügbarkeit'], menu: ['Menü', 'Kategorien, Artikel, Preise & Steuersätze'],
  aktionen: ['Aktionen & Rabatte', 'Marketingaktionen und Treueprogramm'], zahlungen: ['Zahlungsmodalitäten', 'Zahlungsarten im Shop aktivieren'],
  kunden: ['Kundenstamm', 'Kunden verwalten und Kampagnen erstellen'], statistik: ['Statistik', 'Kennzahlen deines Liefergeschäfts'],
  buchhaltung: ['Buchhaltung', 'Steuerlich saubere Auswertung & Export'],
  bewerbungen: ['Bewerbungen', 'Prüfen, Probearbeit planen und Einstellung entscheiden'],
  mitarbeiter: ['Verantwortung & Team', 'Hierarchie, Pflichtbereiche, Aufgaben und Vertretungen verwalten'],
  dienstplan: ['Dienstplan', 'Schichten planen und Besetzung im Blick behalten'],
  lager: ['Lager', 'Bestände, Inventuren und Bestellungen steuern'],
  ablaeufe: ['Listen & Abläufe', 'Wiederkehrende Betriebsaufgaben verbindlich steuern'],
  schulungen: ['Schulungen', 'Onboarding, Wissen und Praxisnachweise verwalten'],
  compliance: ['Team & Compliance', 'Qualifikationen, Zertifikate und Pflichten im Blick behalten'],
  rezeptbuch: ['Rezeptbuch', 'Rezepte und Küchenwissen gemeinsam pflegen'],
  klarheit: ['Tagesklarheit', 'Heute im Dienst, offene Aufgaben und Abdeckung auf einen Blick'],
};
const ROUTE: Record<string, string> = {
  overview: 'uebersicht',
  // Loyalty rewards are configured in the combined promotions module.
  loyalty: 'aktionen',
};
const href = (k: string) => `/neo/app/${ROUTE[k] || k}`;
const Svg = ({ html }: { html: string }) => <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: html }} />;

export default function Shell({ children, newCount = 0, tenantName = 'Mein Shop', shopUrl = '#', canManageOperations = false }: { children: React.ReactNode; newCount?: number; tenantName?: string; shopUrl?: string; canManageOperations?: boolean }) {
  const path = usePathname() || '';
  const seg = path.split('/neo/app/')[1]?.split('/')[0] || 'uebersicht';
  const active = seg === 'uebersicht' ? 'overview' : seg;
  const [title, sub] = META[active] || META.overview;
  const isOperations = ['klarheit', 'bewerbungen', 'mitarbeiter', 'dienstplan', 'lager', 'ablaeufe', 'schulungen', 'compliance', 'rezeptbuch'].includes(active);
  const initials = tenantName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="neo-shell" style={{ display: 'flex', height: '100vh', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: '#F1F5F9', color: '#0F172A' }}>
      {menuOpen && <button type="button" className="neo-overlay" aria-label="Navigation schließen" onClick={() => setMenuOpen(false)} />}
      <aside className={`neo-sidebar${menuOpen ? ' neo-sidebar-open' : ''}`} style={{ width: 256, flexShrink: 0, background: '#fff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#312E81)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 12, height: 12, borderRadius: 4, background: '#fff' }} /></div>
          <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 19, color: '#0F172A', letterSpacing: '-.5px' }}>mise</span>
          <button type="button" className="neo-sidebar-close" aria-label="Navigation schließen" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <div style={{ padding: '14px 14px 6px' }}>
          <Link href="/neo" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 11, padding: '9px 11px', textDecoration: 'none' }}>
            <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#818CF8', letterSpacing: '.5px' }}>ARBEITSBEREICH</div><div style={{ fontSize: 14, fontWeight: 700, color: '#3730A3', marginTop: 1 }}>{isOperations ? 'Team & Abläufe' : 'Lieferservice'}</div></div>
            <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818CF8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M8 15l4 4 4-4"/></svg>' }} />
          </Link>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 20px' }}>
          {NAV.filter((grp) => !grp.managerOnly || canManageOperations).map((grp) => (
            <div key={grp.label} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '.7px', padding: '0 11px', marginBottom: 6 }}>{grp.label}</div>
              {grp.items.map(([key, label]) => {
                const on = key === active;
                return (
                  <Link key={key} href={href(key)} onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10, fontSize: 14, fontWeight: 600, marginBottom: 2, textDecoration: 'none', transition: 'background .12s', background: on ? '#EEF2FF' : 'transparent', color: on ? '#4338CA' : '#64748B' }}>
                    <Svg html={ICONS[key]} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {key === 'lieferzentrale' && newCount > 0 && <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, minWidth: 19, height: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{newCount}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ flexShrink: 0, padding: '12px 14px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#818CF8,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenantName}</div><div style={{ fontSize: 11.5, color: '#94A3B8' }}>{isOperations ? 'Team & Abläufe' : 'Lieferservice'}</div></div>
          </div>
        </div>
      </aside>
      <div className="neo-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header className="neo-header" style={{ height: 64, flexShrink: 0, background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button type="button" className="neo-menu-button" aria-label="Navigation öffnen" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <span /><span /><span />
            </button>
            <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 19, fontWeight: 700, color: '#0F172A', letterSpacing: '-.4px' }}>{title}</div>
              <div className="neo-subtitle" style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 1 }}>{sub}</div>
            </div>
          </div>
          <div className="neo-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="neo-search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 12px', width: 230 }}>
              <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>' }} />
              <span style={{ fontSize: 13, color: '#94A3B8' }}>Suchen…</span>
            </div>
            <a className="neo-shop-link" href={shopUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, background: '#0F172A', borderRadius: 10, padding: '0 14px', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>' }} />
              Shop ansehen
            </a>
            <div style={{ position: 'relative', width: 38, height: 38, border: '1px solid #E2E8F0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>' }} />
              {newCount > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 3px', background: '#EF4444', border: '2px solid #fff', borderRadius: 999, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{newCount}</span>}
            </div>
          </div>
        </header>
        <main className="neo-main" style={{ flex: 1, overflowY: 'auto', padding: '30px 32px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
      <style jsx>{`
        .neo-menu-button, .neo-sidebar-close, .neo-overlay { display: none; }
        .neo-menu-button {
          width: 38px; height: 38px; flex: 0 0 38px; border: 1px solid #E2E8F0;
          border-radius: 10px; background: #fff; align-items: center; justify-content: center;
          flex-direction: column; gap: 4px;
        }
        .neo-menu-button span { width: 16px; height: 2px; border-radius: 2px; background: #475569; }
        .neo-menu-button:focus-visible, .neo-sidebar-close:focus-visible { outline: 3px solid rgba(79,70,229,.28); outline-offset: 2px; }
        @media (max-width: 900px) {
          .neo-sidebar {
            position: fixed; inset: 0 auto 0 0; z-index: 60;
            transform: translateX(-105%); transition: transform .2s ease;
            box-shadow: 16px 0 40px rgba(15,23,42,.18);
          }
          .neo-sidebar-open { transform: translateX(0); }
          .neo-overlay { display: block; position: fixed; inset: 0; z-index: 50; border: 0; background: rgba(15,23,42,.38); }
          .neo-menu-button { display: flex; }
          .neo-sidebar-close { display: block; margin-left: auto; border: 0; background: transparent; color: #64748B; font-size: 28px; line-height: 1; }
          .neo-header { padding: 0 16px !important; }
          .neo-search { display: none !important; }
          .neo-main { padding: 22px 16px !important; }
        }
        @media (max-width: 620px) {
          .neo-subtitle { display: none; }
          .neo-shop-link { width: 38px; padding: 0 !important; justify-content: center; font-size: 0 !important; }
          .neo-header-actions { gap: 8px !important; }
        }
        @media (prefers-reduced-motion: reduce) { .neo-sidebar { transition: none; } }
      `}</style>
    </div>
  );
}
