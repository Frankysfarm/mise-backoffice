'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, TrendingUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

type DriverStreakRow = {
  driverId: string;
  name: string;
  todayDeliveries: number;
  currentStreak: number;
  nextMilestone: number | null;
  stopsToMilestone: number | null;
  bonusEur: number | null;
  multiplier: number;
};

type ApiResponse = {
  ok: boolean;
  drivers: DriverStreakRow[];
};

function ProgressRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#60a5fa';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

export function DriverBonusProximityPanel({ locationId }: { locationId: string | null }) {
  const [drivers, setDrivers] = useState<DriverStreakRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/driver-streaks?action=summary&locationId=${locationId}`);
      if (!res.ok) return;
      const data = await res.json() as ApiResponse;
      if (data.ok && Array.isArray(data.drivers)) {
        setDrivers(
          data.drivers
            .filter((d) => d.stopsToMilestone !== null && d.stopsToMilestone <= 5)
            .sort((a, b) => (a.stopsToMilestone ?? 99) - (b.stopsToMilestone ?? 99))
            .slice(0, 5),
        );
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading || drivers.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
        <Gift className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
          Bonus-Nähe · Fahrer kurz vor Meilenstein
        </span>
        <span className="ml-auto text-[10px] font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">
          {drivers.length}
        </span>
      </div>
      <div className="divide-y">
        {drivers.map((d) => {
          const progressPct = d.nextMilestone
            ? Math.min(100, ((d.nextMilestone - (d.stopsToMilestone ?? 0)) / d.nextMilestone) * 100)
            : 0;
          return (
            <div key={d.driverId} className="flex items-center gap-3 px-4 py-3">
              {/* Ring */}
              <div className="relative shrink-0">
                <ProgressRing pct={progressPct} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-black tabular-nums text-foreground">
                    {Math.round(progressPct)}%
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold truncate">{d.name}</span>
                  {d.multiplier > 1 && (
                    <span className="text-[9px] font-bold bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                      <Zap className="h-2.5 w-2.5" /> ×{d.multiplier.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {d.todayDeliveries} Lieferungen heute
                  {d.currentStreak > 0 && ` · 🔥 ${d.currentStreak} Streak`}
                </div>
                <div className={cn(
                  'h-1 rounded-full mt-1.5 bg-black/10 overflow-hidden w-full',
                )}>
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Milestone badge */}
              <div className="shrink-0 text-right">
                {d.stopsToMilestone !== null && (
                  <>
                    <div className={cn(
                      'text-xs font-black tabular-nums',
                      d.stopsToMilestone === 0 ? 'text-emerald-600' :
                      d.stopsToMilestone <= 2 ? 'text-amber-600' : 'text-blue-600',
                    )}>
                      {d.stopsToMilestone === 0 ? '✓ Erreicht!' : `noch ${d.stopsToMilestone}`}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {d.stopsToMilestone === 0 ? '' : 'Stops'}{d.bonusEur ? ` +${d.bonusEur.toFixed(0)}€` : ''}
                    </div>
                  </>
                )}
                {d.stopsToMilestone === null && (
                  <div className="flex items-center gap-0.5 text-emerald-600">
                    <TrendingUp className="h-3 w-3" />
                    <span className="text-[9px] font-bold">Top!</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
