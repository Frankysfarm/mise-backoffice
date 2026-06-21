import { Suspense } from 'react';
import { TourEfficiencyClient } from './client';

export const metadata = { title: 'Tour-Effizienz Report' };

export default function TourEfficiencyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Tour-Effizienz-Report…</div>}>
      <TourEfficiencyClient />
    </Suspense>
  );
}
