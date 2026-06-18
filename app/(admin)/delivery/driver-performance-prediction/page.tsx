import { Suspense } from 'react';
import { DriverPredictionClient } from './client';

export const metadata = { title: 'Fahrer-Performance-Prognose | Mise' };

export default function DriverPredictionPage() {
  return (
    <Suspense>
      <DriverPredictionClient />
    </Suspense>
  );
}
