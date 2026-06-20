import { Suspense } from 'react';
import { DriverLendingClient } from './client';

export const metadata = { title: 'Fahrer-Ausleihe — Mise Admin' };

export default function DriverLendingPage() {
  return (
    <Suspense>
      <DriverLendingClient />
    </Suspense>
  );
}
