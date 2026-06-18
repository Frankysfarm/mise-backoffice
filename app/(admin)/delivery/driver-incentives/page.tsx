import { Suspense } from 'react';
import { DriverIncentivesClient } from './client';

export const metadata = { title: 'Echtzeit-Fahrer-Incentives' };

export default function DriverIncentivesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Incentive-Daten…</div>}>
      <DriverIncentivesClient />
    </Suspense>
  );
}
