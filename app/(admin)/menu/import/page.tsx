import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { MenuImportClient } from './client';

export const dynamic = 'force-dynamic';

export default async function MenuImportPage() {
  const emp = await requireManagerPlus();
  if (!emp.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Menü importieren"
        description="CSV-Tabelle hochladen, Speisekarte abfotografieren, Sprachnotiz aufnehmen oder Liste einfügen — alle Positionen landen in Sekunden in deinem Menü."
        backHref="/menu"
      />
      <MenuImportClient />
    </>
  );
}
