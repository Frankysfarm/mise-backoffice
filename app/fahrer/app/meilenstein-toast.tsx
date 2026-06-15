'use client';

import { useEffect, useRef, useState } from 'react';

interface MilestoneData {
  milestone: number;
  bonusEur: number;
  multiplier: number;
}

interface Props {
  driverId: string;
}

export function MeilensteinToast({ driverId }: Props) {
  const [toast, setToast] = useState<MilestoneData | null>(null);
  const [visible, setVisible] = useState(false);
  const seenRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let mounted = true;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/admin/driver-streaks?action=driver&driverId=${driverId}`);
        if (!res.ok || !mounted) return;
        const data = await res.json();
        const milestone: number | null = data.lastMilestoneHit ?? null;
        const bonusEur: number | null = data.lastMilestoneBonusEur ?? null;
        const multiplier: number = data.currentMultiplier ?? 1;
        if (milestone != null && !seenRef.current.has(milestone)) {
          seenRef.current.add(milestone);
          setToast({ milestone, bonusEur: bonusEur ?? 0, multiplier });
          setVisible(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setVisible(false), 5000);
        }
      } catch { /* silent */ }
    }

    poll();
    const iv = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(iv); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [driverId]);

  if (!toast || !visible) return null;

  const isLarge = toast.milestone >= 20;

  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
      <div
        className={`pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-2xl shadow-2xl border-2 flex items-center gap-4 px-5 py-4 max-w-sm w-full
          ${isLarge ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white border-matcha-300 text-gray-800'}`}
      >
        <div className="text-4xl select-none">
          {toast.milestone >= 50 ? '👑' : toast.milestone >= 20 ? '🏆' : toast.milestone >= 10 ? '🔥' : '🎯'}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-black text-base leading-tight ${isLarge ? 'text-white' : 'text-gray-900'}`}>
            🎉 {toast.milestone}-Stop-Meilenstein!
          </div>
          {toast.bonusEur > 0 && (
            <div className={`text-sm mt-0.5 font-semibold ${isLarge ? 'text-orange-100' : 'text-matcha-600'}`}>
              +€{toast.bonusEur.toFixed(2)} Bonus gutgeschrieben
            </div>
          )}
          <div className={`text-xs mt-0.5 ${isLarge ? 'text-orange-200' : 'text-gray-500'}`}>
            Aktueller Multiplikator: {toast.multiplier.toFixed(2)}×
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className={`shrink-0 text-lg leading-none opacity-60 hover:opacity-100 ${isLarge ? 'text-white' : 'text-gray-500'}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
