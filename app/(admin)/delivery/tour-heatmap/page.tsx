import { Suspense } from 'react';
import { TourHeatmapClient } from './client';

export const metadata = { title: 'Tour Heatmap — Mise Admin' };

export default function TourHeatmapPage() {
  return (
    <Suspense>
      <TourHeatmapClient />
    </Suspense>
  );
}
