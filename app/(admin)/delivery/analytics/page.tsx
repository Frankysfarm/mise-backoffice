import { Suspense } from 'react';
import { DeliveryAnalyticsClient } from './client';

export default function DeliveryAnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Delivery Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            Lieferrate · ø Lieferzeit · SLA-Einhaltung · Top-Fahrer · 30-Tage-Trend
          </p>
        </div>
        <Suspense fallback={<div className="text-gray-500 text-sm">Lade Analyse…</div>}>
          <DeliveryAnalyticsClient />
        </Suspense>
      </div>
    </div>
  );
}
