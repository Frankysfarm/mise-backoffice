import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Meine Schichten · Mise',
  description: 'Persönlicher Dienstplan für Mise-Mitarbeiter.',
  manifest: '/mitarbeiter.webmanifest',
  appleWebApp: { capable: true, title: 'Mise Team', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function MitarbeiterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
