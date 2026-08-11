import Link from 'next/link';
import { ArrowRight, Boxes, BriefcaseBusiness, CalendarDays, MonitorDot, QrCode, ReceiptText, UsersRound } from 'lucide-react';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';

export const dynamic = 'force-dynamic';
const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

const MODULES = [
  {
    title: 'Lieferzentrale',
    description: 'Bestellungen, Küche, Fahrer und laufende Auslieferungen in einer Zentrale.',
    href: '/neo/app/lieferzentrale',
    action: 'Zentrale öffnen',
    badge: 'LIVE',
    color: '#4F46E5',
    tint: '#EEF2FF',
    icon: MonitorDot,
  },
  {
    title: 'Tischbestellung',
    description: 'Tische und QR-Codes verwalten; Bestellungen direkt an die Zentrale senden.',
    href: '/neo/app/tischbestellung',
    action: 'Tische verwalten',
    badge: 'AKTIV',
    color: '#7C3AED',
    tint: '#F5F3FF',
    icon: QrCode,
  },
  {
    title: 'POS / Kasse',
    description: 'Kassieren, Tische bedienen, Bons ausgeben und Tagesabschlüsse erstellen.',
    href: '/pos',
    action: 'Kasse öffnen',
    badge: 'AKTIV',
    color: '#2563EB',
    tint: '#EFF6FF',
    icon: ReceiptText,
  },
  {
    title: 'Geschäftsverwaltung',
    description: 'Kennzahlen, Kunden, Buchhaltung und operative Einstellungen verwalten.',
    href: '/neo/app/uebersicht',
    action: 'Backoffice öffnen',
    badge: 'AKTIV',
    color: '#D97706',
    tint: '#FEF3C7',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Mitarbeiter',
    description: 'Team, Rollen, Verfügbarkeiten und Mitarbeiterdaten sicher verwalten.',
    href: '/neo/app/mitarbeiter',
    action: 'Team verwalten',
    badge: 'AKTIV',
    color: '#0891B2',
    tint: '#ECFEFF',
    icon: UsersRound,
    managerOnly: true,
  },
  {
    title: 'Dienstplan',
    description: 'Schichten anlegen, verschieben und offene Tauschanfragen bearbeiten.',
    href: '/neo/app/dienstplan',
    action: 'Plan öffnen',
    badge: 'AKTIV',
    color: '#D97706',
    tint: '#FFFBEB',
    icon: CalendarDays,
    managerOnly: true,
  },
  {
    title: 'Lager',
    description: 'Bestände, Inventuren, Lieferanten, Bestellungen und Schwund steuern.',
    href: '/neo/app/lager',
    action: 'Lager öffnen',
    badge: 'AKTIV',
    color: '#059669',
    tint: '#ECFDF5',
    icon: Boxes,
    managerOnly: true,
  },
] as const;

export default async function NeoModuleDashboard() {
  const employee = await getCurrentEmployee();
  const canManageOperations = !!employee && ['manager', 'backoffice', 'admin'].includes(employee.rolle);
  const modules = MODULES.filter((module) => !('managerOnly' in module) || !module.managerOnly || canManageOperations);
  return (
    <>
      <link href={FONTS} rel="stylesheet" />
      <div style={{ minHeight: '100vh', background: '#F1F5F9', color: '#0F172A', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <header style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 26px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#312E81)', display: 'grid', placeItems: 'center' }}><div style={{ width: 12, height: 12, borderRadius: 4, background: '#fff' }} /></div>
            <span style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '-.5px' }}>mise</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, color: '#64748B', fontSize: 12.5, fontWeight: 650 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366F1' }} />{modules.length} Module verbunden</div>
        </header>

        <main style={{ width: 'min(1040px,calc(100% - 40px))', margin: '0 auto', padding: '54px 0 70px' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ color: '#4F46E5', fontSize: 11, fontWeight: 800, letterSpacing: '.8px', marginBottom: 9 }}>DEINE ARBEITSBEREICHE</div>
            <h1 style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 35, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-1px' }}>Was möchtest du öffnen?</h1>
            <p style={{ marginTop: 9, color: '#64748B', fontSize: 14.5 }}>Ein Betrieb, ein Zugang. Wähle den Bereich, in dem du jetzt arbeiten möchtest.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 16 }}>
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <Link key={module.title} href={module.href} style={{ minHeight: 210, display: 'flex', flexDirection: 'column', padding: 22, borderRadius: 17, border: index === 0 ? '1px solid #A5B4FC' : '1px solid #E2E8F0', background: '#fff', color: '#0F172A', textDecoration: 'none', boxShadow: index === 0 ? '0 12px 30px rgba(79,70,229,.10)' : '0 1px 2px rgba(15,23,42,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <span style={{ width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', background: module.tint, color: module.color }}><Icon size={22} /></span>
                    <span style={{ padding: '4px 8px', borderRadius: 999, background: module.tint, color: module.color, fontSize: 10, lineHeight: 1, fontWeight: 800, letterSpacing: '.55px' }}>{module.badge}</span>
                  </div>
                  <div style={{ flex: 1, marginTop: 18 }}>
                    <h2 style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '-.35px' }}>{module.title}</h2>
                    <p style={{ maxWidth: 390, marginTop: 7, color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>{module.description}</p>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: module.color, fontSize: 12.5, fontWeight: 750 }}>{module.action}<ArrowRight size={14} /></span>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}
