'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
}

interface StatsData {
  orders?: number;
  pending_orders?: number;
  cancelled_orders?: number;
}

const MOCK_TOTAL = 50;
const MOCK_FERTIG = 42;

function getBarColor(pct: number): string {
  if (pct >= 75) return '#5c7a4e';
  if (pct >= 50) return '#d97706';
  return '#ef4444';
}

function ProgressBar({ pct }: { pct: number }) {
  const color = getBarColor(pct);
  return (
    <svg width="100%" height="20" viewBox="0 0 200 20" preserveAspectRatio="none">
      <rect x="0" y="4" width="200" height="12" rx="6" fill="#e5e7eb" />
      <rect
        x="0"
        y="4"
        width={Math.min(200, (pct / 100) * 200)}
        height="12"
        rx="6"
        fill={color}
        style={{ transition: 'width 0.6s ease' }}
      />
    </svg>
  );
}

export function KitchenSchichtFertigQuote({ locationId }: Props) {
  const [fertig, setFertig] = useState(MOCK_FERTIG);
  const [total, setTotal] = useState(MOCK_TOTAL);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/stats?location_id=${locationId}&period=today`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const data: StatsData = await res.json();

      const ordersTotal = data.orders ?? 0;
      const pending = data.pending_orders ?? 0;
      const cancelled = data.cancelled_orders ?? 0;

      if (ordersTotal === 0) {
        setFertig(MOCK_FERTIG);
        setTotal(MOCK_TOTAL);
        setUseMock(true);
      } else {
        const doneCount = ordersTotal - pending - cancelled;
        setFertig(Math.max(0, doneCount));
        setTotal(ordersTotal);
        setUseMock(false);
      }
    } catch {
      setFertig(MOCK_FERTIG);
      setTotal(MOCK_TOTAL);
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const pct = total > 0 ? Math.round((fertig / total) * 100) : 0;
  const barColor = getBarColor(pct);

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-100 bg-matcha-50">
        <span className="text-base">✅</span>
        <h2 className="text-sm font-semibold text-matcha-700">Schicht Fertig-Quote</h2>
        {useMock && (
          <span className="ml-auto text-xs text-amber-500">(Demo)</span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="h-12 bg-stone-100 rounded-lg animate-pulse" />
        ) : (
          <>
            {/* Main stat */}
            <div className="flex items-end justify-between">
              <div>
                <span
                  className="text-3xl font-black tabular-nums"
                  style={{ color: barColor }}
                >
                  {pct}%
                </span>
                <p className="text-xs text-stone-500 mt-0.5">
                  {fertig} von {total} Bestellungen fertig
                </p>
              </div>
              <div
                className={cn(
                  'text-xs font-bold px-2 py-1 rounded-full',
                  pct >= 75
                    ? 'bg-matcha-100 text-matcha-700'
                    : pct >= 50
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700',
                )}
              >
                {pct >= 75 ? 'Gut' : pct >= 50 ? 'Mittel' : 'Niedrig'}
              </div>
            </div>

            {/* Progress bar */}
            <ProgressBar pct={pct} />

            {/* Legend */}
            <div className="flex items-center justify-between text-[10px] text-stone-400">
              <span>Letzte 8h Schicht</span>
              <span>{total - fertig} ausstehend</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
