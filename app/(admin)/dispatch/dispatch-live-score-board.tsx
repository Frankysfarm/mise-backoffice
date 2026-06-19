'use client';

/**
 * DispatchLiveScoreBoard — Echtzeit-Dispatch-Score-Rangliste aller aktiven Fahrer.
 *
 * Zeigt:
 *  - Ø Score-Header mit Trend-Pfeil vs. letzte Stunde
 *  - Top-5-Fahrer sortiert nach Dispatch-Score (0–100)
 *  - Pro Zeile: Avatar-Initial, Name, Fahrzeug-Icon, Score-Balken, Score-Zahl
 *  - Farbcodierung: ≥85 grün, 70–85 amber, <70 rot
 *  - Aktualisierung alle 30 Sekunden
 *
 * Daten: /api/delivery/dispatch/scores, Fallback auf Mock.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Bike, Car, Star, RefreshCw, BarChart2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriverScore {
  name: string;
  vehicle: 'bike' | 'car';
  score: number;
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

const MOCK_DRIVERS: DriverScore[] = [
  { name: 'Kemal A.', vehicle: 'bike', score: 91 },
  { name: 'Jana M.',  vehicle: 'car',  score: 87 },
  { name: 'Marco B.', vehicle: 'bike', score: 79 },
  { name: 'Ayse K.',  vehicle: 'car',  score: 73 },
  { name: 'Luis P.',  vehicle: 'bike', score: 65 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(drivers: DriverScore[]): number {
  if (!drivers.length) return 0;
  return Math.round(drivers.reduce((s, d) => s + d.score, 0) / drivers.length);
}

function scoreStyle(score: number): { bar: string; text: string; bg: string; label: string } {
  if (score >= 85)
    return { bar: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-100', label: 'Top' };
  if (score >= 70)
    return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-100', label: 'OK' };
  return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-100', label: 'Krit.' };
}

function initial(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VehicleIcon({ vehicle }: { vehicle: 'bike' | 'car' }) {
  if (vehicle === 'bike')
    return <Bike className="w-3 h-3 text-gray-400 shrink-0" />;
  return <Car className="w-3 h-3 text-gray-400 shrink-0" />;
}

function DriverRow({ driver, rank }: { driver: DriverScore; rank: number }) {
  const style = scoreStyle(driver.score);

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Rank */}
      <span className="w-4 text-[10px] font-bold text-gray-400 text-right tabular-nums shrink-0">
        {rank}.
      </span>

      {/* Avatar */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${style.bg} ${style.text}`}
      >
        {initial(driver.name)}
      </div>

      {/* Name + vehicle */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <span className="text-[11px] font-semibold text-gray-700 truncate">
          {driver.name}
        </span>
        <VehicleIcon vehicle={driver.vehicle} />
      </div>

      {/* Score bar */}
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
          style={{ width: `${driver.score}%` }}
        />
      </div>

      {/* Score number */}
      <span className={`w-6 text-right text-[11px] font-black tabular-nums shrink-0 ${style.text}`}>
        {driver.score}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DispatchLiveScoreBoard() {
  const [drivers, setDrivers] = useState<DriverScore[]>(MOCK_DRIVERS);
  const [prevAvg, setPrevAvg] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/dispatch/scores', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const parsed: DriverScore[] = (json as Array<Record<string, unknown>>)
          .filter(
            (d) =>
              typeof d.name === 'string' &&
              typeof d.score === 'number' &&
              (d.vehicle === 'bike' || d.vehicle === 'car')
          )
          .map((d) => ({
            name: d.name as string,
            vehicle: d.vehicle as 'bike' | 'car',
            score: d.score as number,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (parsed.length > 0) {
          setPrevAvg(avg(drivers));
          setDrivers(parsed);
        }
      }
    } catch {
      // API unavailable — keep current (initially mock)
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [drivers]);

  // Initial fetch + 30-second polling
  useEffect(() => {
    fetchScores();
    intervalRef.current = setInterval(fetchScores, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentAvg = avg(drivers);
  const trend = prevAvg !== null ? currentAvg - prevAvg : 0;

  return (
    <div className="w-full bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-matcha-500" />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
            Dispatch Score Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Average + trend */}
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400" />
            <span className="text-[11px] font-bold text-gray-700 tabular-nums">
              Ø {currentAvg}
            </span>
            {trend > 0 && (
              <TrendingUp className="w-3 h-3 text-matcha-500" />
            )}
            {trend < 0 && (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            {trend !== 0 && (
              <span
                className={`text-[9px] font-semibold tabular-nums ${
                  trend > 0 ? 'text-matcha-600' : 'text-red-600'
                }`}
              >
                {trend > 0 ? '+' : ''}{trend}
              </span>
            )}
          </div>

          {/* Time + refresh */}
          <span className="text-[10px] text-gray-400">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={fetchScores}
            disabled={loading}
            className="p-0.5 rounded text-gray-400 hover:text-matcha-600 transition-colors disabled:opacity-40"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Score legend chips */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-matcha-500" />
          <span className="text-[9px] text-gray-500">≥85 Top</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[9px] text-gray-500">70–84 OK</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[9px] text-gray-500">&lt;70 Krit.</span>
        </div>
      </div>

      {/* Driver rows */}
      <div className="divide-y divide-gray-50">
        {drivers.map((driver, i) => (
          <DriverRow key={`${driver.name}-${i}`} driver={driver} rank={i + 1} />
        ))}
        {drivers.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-4">
            Keine aktiven Fahrer
          </p>
        )}
      </div>
    </div>
  );
}

export default DispatchLiveScoreBoard;
