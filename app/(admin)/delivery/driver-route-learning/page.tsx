import { Suspense } from 'react';
import { DriverRouteLearningClient } from './client';

export const metadata = { title: 'Smart Driver Route Learning' };

export default function DriverRouteLearningPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Routen-Lernkurve…</div>}>
      <DriverRouteLearningClient />
    </Suspense>
  );
}
