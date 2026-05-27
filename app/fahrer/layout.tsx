import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Mise Fahrer',
  description: 'Deine Fahrer-App für Mise',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mise Fahrer',
  },
  icons: {
    apple: [{ url: '/fahrer-icon-192.png' }],
    shortcut: '/fahrer-icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#14532d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function FahrerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1f16] text-white">
      {children}
    </div>
  );
}
