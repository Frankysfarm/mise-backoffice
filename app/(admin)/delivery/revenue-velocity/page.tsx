import { Suspense } from 'react';
import { RevenueVelocityClient } from './client';

export default function RevenueVelocityPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Velocity</h1>
          <p className="text-gray-400 text-sm mt-1">
            Stündliche Umsatz-Analyse · Heute vs. Gestern · Schicht-Prognose
          </p>
        </div>
        <Suspense fallback={<div className="text-gray-500 text-sm">Lade…</div>}>
          <RevenueVelocityClient />
        </Suspense>
      </div>
    </div>
  );
}
