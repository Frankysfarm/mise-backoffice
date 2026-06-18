'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';

type RecentEvent = {
  id: string;
  incentiveType: string;
  triggerLabel: string;
  bonusEur: number;
  status: string;
  earnedAt: string;
};

type Summary = {
  totalEurToday: number;
  eventsToday: number;
  recentEvents: RecentEvent[];
};

export function FahrerComebackBonusHinweis({ isOnline }: { isOnline: boolean }) {
  const [earned, setEarned] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/driver/incentives');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) {
          const summary: Summary = data.summary;
          // Suche nach comeback_bonus in den letzten Events
          const comeback = summary.recentEvents.find(
            (e) => e.incentiveType === 'comeback_bonus' &&
              e.status !== 'cancelled' &&
              Date.now() - new Date(e.earnedAt).getTime() < 5 * 60 * 1000,
          );
          if (comeback) setEarned(comeback.bonusEur);
        }
      } catch { /* ignore */ }
    };

    load();
  }, [isOnline]);

  if (!isOnline || earned === null || dismissed) return null;

  return (
    <div className={cn(
      'relative flex items-start gap-3 rounded-2xl px-4 py-3',
      'bg-gradient-to-r from-blue-900/80 to-blue-800/80 border border-blue-700/50',
    )}>
      <Zap className="h-5 w-5 text-blue-300 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">Comeback-Bonus aktiviert! 🎯</div>
        <div className="text-xs text-blue-300 mt-0.5">
          Du erhältst <span className="font-bold text-white">+{earned.toFixed(2)} €</span> für deine erste Lieferung
          nach der Pause.
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-blue-400 hover:text-blue-200 text-xs shrink-0 mt-0.5"
        aria-label="Schließen"
      >
        ✕
      </button>
    </div>
  );
}
