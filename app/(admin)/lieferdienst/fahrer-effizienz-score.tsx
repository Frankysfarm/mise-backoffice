'use client';

/**
 * LieferdienstFahrerEffizienzScore — Phase 337
 *
 * Fahrer-Effizienz-Übersicht für Lieferdienst.
 * Pollt /api/delivery/admin/analytics?action=dashboard alle 120s.
 * Zeigt Top-Fahrer nach Effizienz: Name/Initialen, Stopps/Stunde, Pünktlichkeit%, Ø Bewertung.
 * Effizienz-Score 0–100 mit Farbbalken. Sortierbar nach Score (client-side).
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Loader2, Star, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverEfficiency {
  id: string;
  name: string;
  stopsPerHour: number;
  onTimePct: number;
  avgRating: number;
  efficiencyScore: number;
}

interface AnalyticsDashboard {
  drivers?: DriverEfficiency[];
}

const MOCK_DRIVERS: DriverEfficiency[] = [
  { id: 'd1', name: 'Ali Kaya',      stopsPerHour: 5.2, onTimePct: 94, avgRating: 4.8, efficiencyScore: 88 },
  { id: 'd2', name: 'Bernd Müller',  stopsPerHour: 4.7, onTimePct: 87, avgRating: 4.5, efficiencyScore: 76 },
  { id: 'd3', name: 'Canan Yilmaz', stopsPerHour: 4.1, onTimePct: 82, avgRating: 4.2, efficiencyScore: 64 },
];

type SortKey = 'efficiencyScore' | 'stopsPerHour' | 'onTimePct' | 'avgRating';

function getScoreColor(score: number) {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700' };
  if (score >= 60) return { bar: 'bg-amber-500',   text: 'text-amber-700'   };
  return           { bar: 'bg-red-500',    text: 'text-red-700'    };
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('');
}

export default function LieferdienstFahrerEffizienzScore() {
  const [drivers, setDrivers] = useState<DriverEfficiency[]>([]);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('efficiencyScore');
  const [sortAsc, setSortAsc] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchData() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/delivery/admin/analytics?action=dashboard', {
        signal: abortRef.current.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('not ok');
      const json = (await res.json()) as AnalyticsDashboard;
      const fetched = json.drivers ?? [];
      if (fetched.length === 0) {
        setDrivers(MOCK_DRIVERS);
        setUseMock(true);
      } else {
        setDrivers(fetched);
        setUseMock(false);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setUseMock(true);
        if (drivers.length === 0) setDrivers(MOCK_DRIVERS);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 120_000);
    return () => {
      clearInterval(iv);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(a => !a);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...drivers].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortAsc ? <ChevronUp className="h-3 w-3 inline-block ml-0.5" /> : <ChevronDown className="h-3 w-3 inline-block ml-0.5" />
    ) : null;

  const colBtn = (col: SortKey, label: string) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition"
    >
      {label}
      <SortIcon col={col} />
    </button>
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Effizienz</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        {useMock && !loading && (
          <span className="ml-auto text-[9px] text-amber-600 font-bold">Mockdaten</span>
        )}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-3 px-4 py-2 bg-muted/10 border-b">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">#</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Fahrer</span>
        {colBtn('stopsPerHour', 'Stopps/h')}
        {colBtn('onTimePct', 'Pünktl.')}
        {colBtn('avgRating', 'Ø Rating')}
        {colBtn('efficiencyScore', 'Score')}
      </div>

      {/* Rows */}
      {sorted.length === 0 && !loading && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          Keine Fahrerdaten verfügbar.
        </div>
      )}
      <div className="divide-y">
        {sorted.map((driver, idx) => {
          const sc = getScoreColor(driver.efficiencyScore);
          return (
            <div
              key={driver.id}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-3 items-center px-4 py-2.5"
            >
              {/* Rank */}
              <span className="text-[11px] font-black text-muted-foreground w-4 text-center">
                {idx + 1}
              </span>

              {/* Avatar + Name */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                  {initials(driver.name)}
                </span>
                <span className="text-[11px] font-bold truncate">{driver.name}</span>
              </div>

              {/* Stopps/Stunde */}
              <div className="flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-mono text-[11px] font-bold tabular-nums">
                  {driver.stopsPerHour.toFixed(1)}
                </span>
              </div>

              {/* Pünktlichkeit */}
              <span className={cn(
                'font-mono text-[11px] font-bold tabular-nums text-right',
                driver.onTimePct >= 90 ? 'text-emerald-600' : driver.onTimePct >= 75 ? 'text-amber-600' : 'text-red-600',
              )}>
                {driver.onTimePct}%
              </span>

              {/* Rating */}
              <div className="flex items-center gap-0.5 justify-end">
                <Star className="h-3 w-3 text-amber-400 shrink-0" />
                <span className="font-mono text-[11px] font-bold tabular-nums">
                  {driver.avgRating.toFixed(1)}
                </span>
              </div>

              {/* Score mit Balken */}
              <div className="flex flex-col items-end gap-0.5 min-w-[52px]">
                <span className={cn('font-mono text-[11px] font-black tabular-nums', sc.text)}>
                  {driver.efficiencyScore}
                </span>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', sc.bar)}
                    style={{ width: `${driver.efficiencyScore}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
