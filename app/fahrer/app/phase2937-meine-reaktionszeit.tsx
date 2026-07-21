'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  avg_min: number;
  trend: string;
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

interface DriverData {
  avg_min: number;
  trend: string;
  trend_delta: number;
  team_avg: number;
}

const ZIEL = 2;
const WARN = 5;
const MAX_BAR = 10;

function calcAmpel(min: number): string {
  if (min <= ZIEL) return 'gruen';
  if (min <= WARN) return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400' };
  return                   { text: 'text-green-600', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Reaktionszeit zu hoch! Sofort nach Auftragszuweisung starten, keine Pausen dazwischen.';
  if (ampel === 'gelb') return 'Reaktionszeit noch nicht optimal. Schnellere Vorbereitung und direkter Start helfen.';
  return 'Sehr gute Reaktionszeit — du bist schnell! Halte dieses Tempo und starte direkt nach Zuweisung.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'mock-f1', avg_min: 1.8, trend: 'fallend', trend_delta: -0.3 }],
  team_durchschnitt: 4.1,
};

export function FahrerPhase2937MeineReaktionszeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    const load = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}${driverId ? `&driver_id=${driverId}` : ''}`
        : null;
      if (!url) {
        const m = MOCK.fahrer[0];
        setData({ avg_min: m.avg_min, trend: m.trend, trend_delta: m.trend_delta, team_avg: MOCK.team_durchschnitt });
        return;
      }
      fetch(url)
        .then(r => r.json())
        .then((d: ApiData) => {
          const entry = driverId ? d.fahrer.find(f => f.fahrer_id === driverId) : d.fahrer[0];
          const m = MOCK.fahrer[0];
          if (entry) setData({ ...entry, team_avg: d.team_durchschnitt });
          else setData({ avg_min: m.avg_min, trend: m.trend, trend_delta: m.trend_delta, team_avg: d.team_durchschnitt });
        })
        .catch(() => {
          const m = MOCK.fahrer[0];
          setData({ avg_min: m.avg_min, trend: m.trend, trend_delta: m.trend_delta, team_avg: MOCK.team_durchschnitt });
        });
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const ampel       = calcAmpel(data.avg_min);
  const { text, bar } = ampelColors(ampel);
  const pct         = Math.min(100, (data.avg_min / MAX_BAR) * 100);
  const zielLeft    = `${(ZIEL / MAX_BAR) * 100}%`;
  const tipp        = coachingTipp(ampel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Reaktionszeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          <div className="text-center">
            <div className={`text-4xl font-bold tabular-nums ${text}`}>{data.avg_min.toFixed(1)} Min</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ø Zeit bis Abfahrt nach Zuweisung</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
            <div className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: zielLeft }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 Min</span>
            <span className="font-medium text-gray-600 dark:text-gray-300">Ziel ≤{ZIEL} Min</span>
            <span>{MAX_BAR}+ Min</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Trend heute',
                value: (
                  <span className="flex items-center justify-center gap-1">
                    <TrendIcon trend={data.trend} />
                    <span className="text-sm font-bold">{data.trend_delta > 0 ? '+' : ''}{data.trend_delta.toFixed(1)} Min</span>
                  </span>
                ),
              },
              {
                label: 'Team-Ø',
                value: <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{data.team_avg.toFixed(1)} Min</span>,
              },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{k.label}</div>
                <div className="flex items-center justify-center">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
            {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
