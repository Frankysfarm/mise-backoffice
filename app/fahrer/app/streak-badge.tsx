'use client';

import { useState, useEffect } from 'react';

interface StreakSummary {
  currentStreak:       number;
  multiplier:          number;
  nextMilestone:       number | null;
  stopsToNextMilestone: number | null;
  longestStreak:       number;
  isOnFire:            boolean;
}

interface Props {
  driverId: string;
  locationId: string;
}

export function StreakBadge({ driverId, locationId }: Props) {
  const [streak, setStreak] = useState<StreakSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/driver-streaks?action=driver&driverId=${driverId}`);
        if (!res.ok || !mounted) return;
        const data = await res.json();
        if (data && mounted) {
          setStreak({
            currentStreak:       data.currentStreak ?? 0,
            multiplier:          data.currentMultiplier ?? 1,
            nextMilestone:       data.nextMilestone ?? null,
            stopsToNextMilestone: data.stopsToNextMilestone ?? null,
            longestStreak:       data.longestStreak ?? 0,
            isOnFire:            (data.currentStreak ?? 0) >= 10,
          });
        }
      } catch { /* silent */ }
    }
    load();
    return () => { mounted = false; };
  }, [driverId, locationId]);

  if (!streak || streak.currentStreak === 0) return null;

  const isAbove1 = streak.multiplier > 1.0;

  return (
    <div className={`rounded-2xl p-3 flex items-center gap-3 ${streak.isOnFire ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-white/10 border border-white/10'}`}>
      <div className="text-2xl select-none">{streak.isOnFire ? '🔥' : '✅'}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{streak.currentStreak} Stop-Serie</span>
          {isAbove1 && (
            <span className="text-xs bg-orange-500 text-white font-bold px-2 py-0.5 rounded-full">
              {streak.multiplier.toFixed(2)}× Bonus
            </span>
          )}
        </div>
        {streak.stopsToNextMilestone != null ? (
          <div className="text-xs text-white/60 mt-0.5">
            Noch {streak.stopsToNextMilestone} pünktlich → 🎯 {streak.nextMilestone}-Stop-Meilenstein
          </div>
        ) : (
          <div className="text-xs text-white/60 mt-0.5">Allzeit-Rekord: {streak.longestStreak}</div>
        )}
      </div>
    </div>
  );
}
