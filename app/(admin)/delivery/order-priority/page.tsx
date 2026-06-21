import { Suspense } from 'react';
import { OrderPriorityClient } from './client';

export const metadata = { title: 'KI-Auftrags-Priorisierung' };

export default function OrderPriorityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Prioritäts-Dashboard…</div>}>
      <OrderPriorityClient />
    </Suspense>
  );
}
