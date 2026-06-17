'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: { label: string; items: [string, string][] }[] = [
  { label: 'BETRIEB', items: [['uebersicht', 'Übersicht'], ['lieferzentrale', 'Lieferzentrale'], ['fahrer', 'Fahrer']] },
  { label: 'SHOP', items: [['shopdesign', 'Shop-Design'], ['shopsettings', 'Shop-Einstellungen'], ['menu', 'Menü'], ['aktionen', 'Aktionen & Rabatte'], ['zahlungen', 'Zahlungen']] },
  { label: 'GESCHÄFT', items: [['kunden', 'Kundenstamm'], ['statistik', 'Statistik'], ['buchhaltung', 'Buchhaltung']] },
];
const SUBS: Record<string, string> = {
  uebersicht: 'KPIs & Tagesüberblick', lieferzentrale: 'Küchendisplay & Bestellungen', fahrer: 'Fahrer & Lieferradien',
  shopdesign: 'Template & Inhalte', shopsettings: 'Domain & QR-Code', menu: 'Speisekarte verwalten',
  aktionen: 'Marketing & Rabatte', zahlungen: 'Zahlungsarten', kunden: 'CRM & Kampagnen',
  statistik: 'Auswertungen', buchhaltung: 'Finanzen & Export',
};

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || '';
  const active = path.split('/neo/app/')[1]?.split('/')[0] || 'uebersicht';
  const title = NAV.flatMap((g) => g.items).find(([k]) => k === active)?.[1] || 'Übersicht';
  return (
    <div className="flex h-screen" style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", background: '#F1F5F9', color: '#0F172A' }}>
      {/* SIDEBAR */}
      <aside className="flex-shrink-0 flex flex-col h-screen" style={{ width: 256, background: '#fff', borderRight: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-2.5 px-5" style={{ height: 64, borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#312E81)' }}><div style={{ width: 12, height: 12, borderRadius: 4, background: '#fff' }} /></div>
          <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '-.5px' }}>mise</span>
        </div>
        <div className="px-3.5 pt-3.5 pb-1.5">
          <Link href="/neo" className="flex items-center gap-2.5 cursor-pointer" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 11, padding: '9px 11px', textDecoration: 'none' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#818CF8', letterSpacing: '.5px' }}>MODUL</div><div style={{ fontSize: 14, fontWeight: 700, color: '#3730A3', marginTop: 1 }}>Lieferservice</div></div>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto" style={{ padding: '10px 14px 20px' }}>
          {NAV.map((grp) => (
            <div key={grp.label} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '.7px', padding: '0 11px', marginBottom: 6 }}>{grp.label}</div>
              {grp.items.map(([key, label]) => {
                const on = key === active;
                return (
                  <Link key={key} href={`/neo/app/${key}`} className="flex items-center gap-2.5" style={{ padding: '9px 11px', borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: on ? 700 : 500, textDecoration: 'none', background: on ? '#EEF2FF' : 'transparent', color: on ? '#4338CA' : '#475569' }}>
                    <span style={{ flex: 1 }}>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ flexShrink: 0, padding: '12px 14px', borderTop: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-2.5" style={{ padding: '7px 8px', borderRadius: 10 }}>
            <div className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#818CF8,#4F46E5)', color: '#fff', fontWeight: 700, fontSize: 12 }}>FR</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Franky&apos;s Pasta</div><div style={{ fontSize: 11.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Lieferservice</div></div>
          </div>
        </div>
      </aside>
      {/* MAIN */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex items-center justify-between" style={{ height: 64, flexShrink: 0, background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 26px' }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 19, fontWeight: 700, letterSpacing: '-.4px' }}>{title}</div>
            <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 1 }}>{SUBS[active] || ''}</div>
          </div>
          <a href="https://mise-gastro.de/biss-app/frankys-pasta" target="_blank" rel="noreferrer" className="flex items-center gap-1.5" style={{ height: 38, background: '#0F172A', borderRadius: 10, padding: '0 14px', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Shop ansehen</a>
        </header>
        <main className="flex-1 overflow-y-auto" style={{ padding: '30px 32px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
