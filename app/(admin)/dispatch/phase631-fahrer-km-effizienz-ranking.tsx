'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Bike, Car, TrendingDown } from 'lucide-react';

interface FahrerEfzizienz {
  driverId: string;
  driverName: string;
  vehicle: string | null;
  touren: number;
  totalKm: number;
  kmProLieferung: number;
  lieferlohn_eur: number;
  marge_pct: number;
}

interface Props {
  locationId: string | null;
}

const MOCK: FahrerEfzizienz[] = [
  {
    driverId: 'd1', driverName: 'Alex B.', vehicle: 'bike',
    touren: 8, totalKm: 28.4, kmProLieferung: 3.55,
    lieferlohn_eur: 9.94, marge_pct: 42.1,
  },
  {
    driverId: 'd2', driverName: 'Kim S.', vehicle: 'car',
    touren: 5, totalKm: 34.1, kmProLieferung: 6.82,
    lieferlohn_eur: 11.94, marge_pct: 28.7,
  },
  {
    driverId: 'd3', driverName: 'Sam R.', vehicle: 'bike',
    touren: 6, totalKm: 27.0, kmProLieferung: 4.50,
    lieferlohn_eur: 9.45, marge_pct: 38.4,
  },
];

function VehicleIcon({ vehicle }: { vehicle: string | null }) {
  if (vehicle === 'bike' || vehicle === 'bicycle') {
    return <Bike className="h-3 w-3 text-emerald-500" />;
  }
  return <Car className="h-3 w-3 text-blue-500" />;
}

function RangBadge({ rang }: { rang: number }) {
  const colors = [
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  ];
  const emoji = ['🥇', '🥈', '🥉'];
  return (
    <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${colors[rang] ?? 'bg-gray-100 text-gray-500'}`}>
      {emoji[rang] ?? `#${rang + 1}`}
    </span>
  );
}

function EffizienzBar({ km, max }: { km: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (km / max) * 100) : 0;
  // Lower km/Lieferung = more efficient = greener
  const color = km <= 4 ? '#10b981' : km <= 6 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function DispatchPhase631FahrerKmEffizienzRanking({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerEfzizienz[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) {
      setFahrer(MOCK);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-profitabilitaet?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      if (json.ok && Array.isArray(json.shifts) && json.shifts.length > 0) {
        const ranked: FahrerEfzizienz[] = json.shifts
          .map((s: Record<string, unknown>) => ({
            driverId: s.driverId as string,
            driverName: s.driverName as string,
            vehicle: s.vehicle as string | null,
            touren: s.touren as number,
            totalKm: s.totalKm as number,
            kmProLieferung: (s.touren as number) > 0
              ? Math.round(((s.totalKm as number) / (s.touren as number)) * 100) / 100
              : 0,
            lieferlohn_eur: s.lieferlohn_eur as number,
            marge_pct: s.marge_pct as number,
          }))
          .sort((a: FahrerEfzizienz, b: FahrerEfzizienz) => a.kmProLieferung - b.kmProLieferung);
        setFahrer(ranked);
      } else {
        setFahrer(MOCK);
      }
    } catch {
      setFahrer(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (fahrer.length === 0) return null;

  const maxKm = Math.max(...fahrer.map((f) => f.kmProLieferung));

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 shadow-sm">
      <button
        className="mb-3 flex w-full items-center gap-2 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Trophy className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wide">
          km-Effizienz Ranking
        </span>
        <TrendingDown className="h-3 w-3 text-indigo-500 dark:text-indigo-400 ml-1" />
        <span className="ml-auto text-xs text-indigo-500 dark:text-indigo-400">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-2">
          {fahrer.map((f, i) => (
            <div
              key={f.driverId}
              className="flex items-center gap-2 rounded-lg bg-white dark:bg-gray-900/40 border border-indigo-100 dark:border-indigo-900 px-3 py-2"
            >
              <RangBadge rang={i} />
              <VehicleIcon vehicle={f.vehicle} />
              <span className="flex-1 truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                {f.driverName}
              </span>
              <EffizienzBar km={f.kmProLieferung} max={maxKm} />
              <div className="text-right shrink-0 ml-2">
                <div className="font-mono text-xs font-black tabular-nums text-gray-800 dark:text-gray-200">
                  {f.kmProLieferung.toFixed(1)} km
                </div>
                <div className="text-[9px] text-gray-400">pro Lieferung</div>
              </div>
              <div className="text-right shrink-0 ml-1">
                <div className="text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {f.marge_pct.toFixed(0)}%
                </div>
                <div className="text-[9px] text-gray-400">Marge</div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-indigo-400 dark:text-indigo-500 text-center mt-1">
            Niedrigster km/Lieferung = effizientester Fahrer
          </p>
        </div>
      )}
    </div>
  );
}
