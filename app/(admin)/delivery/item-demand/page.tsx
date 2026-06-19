import { Suspense } from 'react';
import { Metadata } from 'next';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { ItemDemandClient } from './client';

export const metadata: Metadata = {
  title: 'Artikel-Nachfrage-Prognose | Mise Delivery',
};

export default async function ItemDemandPage() {
  await requireManagerPlus();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Lade Prognose…</div>}>
      <ItemDemandClient />
    </Suspense>
  );
}
