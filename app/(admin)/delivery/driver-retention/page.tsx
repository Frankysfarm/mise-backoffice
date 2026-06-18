import { Suspense } from 'react';
import { DriverRetentionClient } from './client';

export const metadata = { title: 'Fahrer-Retention Score' };

export default function DriverRetentionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Retention-Daten…</div>}>
      <DriverRetentionClient />
    </Suspense>
  );
}
