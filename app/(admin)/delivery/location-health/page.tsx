import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { LocationHealthClient } from './client';

export const metadata = { title: 'Standort-Gesundheits-Score | Mise' };

export default async function LocationHealthPage() {
  await requireManagerPlus();
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Standort-Gesundheits-Score"
        description="Aggregierter Score (0–100) aus Pünktlichkeit · Fahrerverfügbarkeit · Stornoquote · Kundenzufriedenheit"
      />
      <LocationHealthClient />
    </div>
  );
}
