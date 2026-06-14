import { Suspense } from 'react';
import TripCostIntelligenceClient from './client';

export const dynamic = 'force-dynamic';

export default function TripCostIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Lade Kostenanalyse…</div>}>
      <TripCostIntelligenceClient />
    </Suspense>
  );
}
