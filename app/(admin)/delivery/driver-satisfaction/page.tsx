import { Suspense } from 'react';
import { DriverSatisfactionClient } from './client';

export const metadata = { title: 'Fahrer-Zufriedenheits-Score (Live)' };

export default function DriverSatisfactionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Zufriedenheitsdaten…</div>}>
      <DriverSatisfactionClient />
    </Suspense>
  );
}
