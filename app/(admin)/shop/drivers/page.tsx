/**
 * /shop/drivers — Fahrer-Verwaltung für den Restaurant-Owner.
 * Liegt unter app/(admin)/shop/drivers/page.tsx auf dem Server.
 *
 * Page liefert den Frame (PageHeader + backHref zum Shop-Hub).
 * DriversClient lädt die echte Liste via /api/admin/drivers.
 */
import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { DriversClient } from './client';

export const metadata: Metadata = {
  title: 'Fahrer · Mise',
  description: 'Eigene Lieferfahrer verwalten — einladen, sperren, neuen Login-Code geben.',
};

export default function DriversPage() {
  return (
    <>
      <PageHeader
        title="Fahrer · Mise Driver App"
        description="Lade Lieferanten ein — sie bekommen eine E-Mail, setzen ihr Passwort und loggen sich danach mit derselben Adresse in der Mise Driver App ein."
        backHref="/shop"
      />
      <DriversClient />
    </>
  );
}
