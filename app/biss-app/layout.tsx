import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mise · Bestellen',
  description: 'Jetzt online bestellen — schnelle Lieferung, sichere Zahlung.',
  manifest: '/manifest.json',
  themeColor: '#0f5132',
};

export default function BissAppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
