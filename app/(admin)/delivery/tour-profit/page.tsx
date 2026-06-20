import { Suspense } from 'react';
import { TourProfitClient } from './client';

export const metadata = { title: 'Tour-Gewinn-Analyse — Mise Admin' };

export default function TourProfitPage() {
  return (
    <Suspense>
      <TourProfitClient />
    </Suspense>
  );
}
