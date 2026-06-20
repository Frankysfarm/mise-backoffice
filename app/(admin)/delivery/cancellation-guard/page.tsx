import { Suspense } from 'react';
import { CancellationGuardClient } from './client';

export const metadata = { title: 'Cancellation Guard — Mise Admin' };

export default function CancellationGuardPage() {
  return (
    <Suspense>
      <CancellationGuardClient />
    </Suspense>
  );
}
