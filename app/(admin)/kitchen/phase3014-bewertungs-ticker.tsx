'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  bewertungen_heute: number;
  trend: string;
  trend_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  alert_count: number;
}

const ZIEL_AVG  = 4.5;
const ALERT_AVG = 4.0;

function ampelDot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  bewertung_avg: 4.8, bewertungen_heute: 12, trend: 'steigend', trend_delta: 0.3,  ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Lisa F.', bewertung_avg: 4.6, bewertungen_heute: 11, trend: 'steigend', trend_delta: 0.2,  ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.', bewertung_avg: 4.2, bewertungen_heute:  9, trend: 'stabil',  trend_delta: 0.0,  ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',  bewertung_avg: 3.8, bewertungen_heute:  7, trend: 'fallend', trend_delta: -0.4, ampel: 'rot'   },
  ],
  team_durchschnitt: 4.35,
  alert_count: 1,
};

export function KitchenPhase3014BewertungsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted    = [...data.fahrer].sort((a, b) => b.bewertung_avg - a.bewertung_avg);
  const alerts    = data.fahrer.filter(f => f.bewertung_avg < ALERT_AVG);
  const hasAlert  = alerts.length > 0;

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-400" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Kundenbewertungen</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Team-Ø {data.team_durchschnitt.toFixed(1)} ★
          </span>
          {hasAlert && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Schlechte Bewertungen! ({f.bewertung_avg.toFixed(1)} ★)
              </span>
            </div>
          ))}

          <div className="space-y-1.5">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                    {f.bewertung_avg.toFixed(1)} ★
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
            Ziel ≥{ZIEL_AVG} ★ · steigend=grün · 30-Min-Polling
          </div>
        </div>
      )}
    </div>
  );
}
