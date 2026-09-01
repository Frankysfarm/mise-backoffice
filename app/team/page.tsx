import type { Metadata, Viewport } from 'next';
import { TeamLogin } from './team-login';

export const metadata: Metadata = {
  title: 'Mise Team · Anmeldung',
  description: 'Mitarbeiter-Anmeldung: Schichten, Aufgaben und Übergaben.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Mise Team', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1f5a3a' };

/** Neutraler Team-Eingang ohne Betrieb – z. B. wenn der Link ohne Betriebskürzel geteilt wurde. */
export default function TeamLoginNeutralPage() {
  return <TeamLogin brand={{ name: 'Mise', slug: null, logoUrl: null, primary: '#1f5a3a', accent: '#7ee2a8', onBrand: '#ffffff' }} />;
}
