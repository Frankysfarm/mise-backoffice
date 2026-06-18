import { Suspense } from 'react';
import { ShiftPredictionClient } from './client';

export const metadata = { title: 'Schicht-Performance-Prognose' };

export default function ShiftPerformancePredictionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Prognose-Daten…</div>}>
      <ShiftPredictionClient />
    </Suspense>
  );
}
