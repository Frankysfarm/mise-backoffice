import { Suspense } from 'react';
import { ScoreBonusTriggerClient } from './client';

export const metadata = { title: 'Score-Bonus-Trigger' };

export default function ScoreBonusTriggerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Score-Bonus-Daten…</div>}>
      <ScoreBonusTriggerClient />
    </Suspense>
  );
}
