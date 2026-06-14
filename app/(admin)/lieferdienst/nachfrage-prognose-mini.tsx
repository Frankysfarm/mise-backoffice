'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Zap, AlertTriangle } from 'lucide-react';

interface HourBucket {
  hour: number;
  label: string;
  expected: number;
  actual?: number;
  isCurrent: boolean;
}

interface Props {
  locationId: string | null;
}

function buildForecast(): HourBucket[] {
  const now = new Date();
  const currentHour = now.getHours();
  const buckets: HourBucket[] = [];

  // Typical delivery demand curve by hour (mock baseline)
  const baseline: Record<number, number> = {
    10: 3, 11: 6, 12: 14, 13: 18, 14: 12, 15: 7, 16: 5,
    17: 8, 18: 16, 19: 22, 20: 24, 21: 19, 22: 12, 23: 6,
  };

  for (let offset = 0; offset <= 3; offset++) {
    const h = (currentHour + offset) % 24;
    const expected = baseline[h] ?? 2;
    // Add slight randomness for visual variety
    const actual = offset === 0 ? Math.round(expected * (0.8 + Math.random() * 0.4)) : undefined;
    buckets.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      expected,
      actual,
      isCurrent: offset === 0,
    });
  }
  return buckets;
}

export function NachfragePrognoseMini({ locationId }: Props) {
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to fetch real data, fall back to mock
    const load = async () => {
      try {
        if (locationId) {
          const res = await fetch(`/api/delivery/admin/ai-forecast?location_id=${locationId}&hours=4`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.forecast) && json.forecast.length > 0) {
              setBuckets(json.forecast.map((f: { hour: number; expected_orders: number }, i: number) => ({
                hour: f.hour,
                label: `${String(f.hour).padStart(2, '0')}:00`,
                expected: f.expected_orders,
                isCurrent: i === 0,
              })));
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // fallthrough to mock
      }
      setBuckets(buildForecast());
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 animate-pulse">
        <div className="h-3 w-32 bg-muted rounded mb-3" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="flex-1 h-12 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  const maxExpected = Math.max(...buckets.map(b => b.expected), 1);
  const currentBucket = buckets[0];
  const isHighDemand = (currentBucket?.expected ?? 0) >= 18;
  const isMediumDemand = (currentBucket?.expected ?? 0) >= 10;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={13} className="text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Nachfrage-Prognose (nächste 4h)
        </span>
        {isHighDemand && (
          <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-black text-red-600 animate-pulse">
            <Zap size={8} />
            Hochbetrieb
          </span>
        )}
        {!isHighDemand && isMediumDemand && (
          <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600">
            <AlertTriangle size={8} />
            Mittel
          </span>
        )}
      </div>

      <div className="flex gap-2 items-end h-16">
        {buckets.map(b => {
          const barH = Math.max(6, Math.round((b.expected / maxExpected) * 52));
          const actualH = b.actual != null ? Math.max(4, Math.round((b.actual / maxExpected) * 52)) : null;
          return (
            <div key={b.hour} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex items-end justify-center" style={{ height: 56 }}>
                {/* Expected bar */}
                <div
                  className={cn(
                    'absolute bottom-0 w-full rounded-t-md transition-all duration-500',
                    b.isCurrent
                      ? isHighDemand ? 'bg-red-400/30' : isMediumDemand ? 'bg-amber-400/30' : 'bg-matcha-400/30'
                      : 'bg-muted',
                  )}
                  style={{ height: barH }}
                />
                {/* Actual bar (current hour only) */}
                {actualH != null && (
                  <div
                    className={cn(
                      'absolute bottom-0 w-3/4 rounded-t-md transition-all duration-700',
                      isHighDemand ? 'bg-red-500' : isMediumDemand ? 'bg-amber-500' : 'bg-matcha-500',
                    )}
                    style={{ height: actualH }}
                  />
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className={cn(
                  'text-[8px] font-bold tabular-nums',
                  b.isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {b.expected}
                </span>
                <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                  <Clock size={6} />
                  {b.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" />
          Ist (aktuell)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted inline-block" />
          Prognose
        </span>
      </div>
    </div>
  );
}
