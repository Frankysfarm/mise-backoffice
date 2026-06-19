import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PerformanceScoreClient } from './client';

export const metadata = { title: 'Performance Score | Mise' };

export default async function PerformanceScorePage() {
  await requireManagerPlus();
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Delivery Performance Score"
        description="Aggregierter Standort-Score (0–100) aus Pünktlichkeit · Zufriedenheit · Auslastung · Marge"
      />
      <PerformanceScoreClient />
    </div>
  );
}
