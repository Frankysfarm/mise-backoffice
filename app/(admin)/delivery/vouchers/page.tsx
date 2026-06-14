import { Suspense } from 'react';
import VouchersClient from './client';

export const dynamic = 'force-dynamic';

export default function VouchersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Lade Gutscheine…</div>}>
      <VouchersClient />
    </Suspense>
  );
}
