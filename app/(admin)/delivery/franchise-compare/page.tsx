import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { FranchiseCompareClient } from './client';

export const dynamic = 'force-dynamic';

export default async function FranchiseComparePage() {
  await requireManagerPlus().catch(() => redirect('/start'));

  return (
    <>
      <PageHeader
        title="Franchise-Vergleich"
        description="KPI-Vergleich aller Standorte — On-Time, Bewertungen, Durchsatz · Aktualisierung alle 30 Sek."
      />
      <FranchiseCompareClient />
    </>
  );
}
