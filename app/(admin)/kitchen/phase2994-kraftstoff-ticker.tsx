'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Fuel } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_liter: number;
  trend: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_kml: number;
  alert_count: number;
}

const ZIEL_KML  = 15;
const ALERT_KML = 10;

function dotCls(kml: number): string {
  if (kml >= ZIEL_KML)  return 'bg-green-500';
  if (kml >= ALERT_KML) return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   km_pro_liter: 16.8, trend: 'steigend' },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', km_pro_liter: 14.9, trend: 'steigend' },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  km_pro_liter: 13.5, trend: 'fallend'  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   km_pro_liter:  9.4, trend: 'fallend'  },
  ],
  team_avg_kml: 13.7,
  alert_count: 1,
};

export function KitchenPhase2994KraftstoffTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kraftstoff-effizienz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => b.km_pro_liter - a.km_pro_liter);
  const alerts   = data.fahrer.filter(f => f.km_pro_liter < ALERT_KML);
  const hasAlert = alerts.length > 0;
  const teamAmpel = data.team_avg_kml >= ZIEL_KML ? 'gruen' : data.team_avg_kml >= ALERT_KML ? 'gelb' : 'rot';
  const teamText  = teamAmpel === 'rot' ? 'text-red-600' : teamAmpel === 'gelb' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Fuel size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Kraftstoff-Ticker
            <span className={`ml-2 font-black ${teamText}`}>{data.team_avg_kml.toFixed(1)} km/l</span>
            <span className="text-xs font-normal text-gray-400 ml-1">Team-Ø</span>
          </span>
          {hasAlert && <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs">
              <AlertTriangle size={12} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Hoher Verbrauch! ({f.km_pro_liter.toFixed(1)} km/l)
              </span>
            </div>
          ))}

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map(f => {
              const kml = f.km_pro_liter;
              const cls = kml >= ZIEL_KML ? 'text-green-600' : kml >= ALERT_KML ? 'text-amber-600' : 'text-red-600';
              return (
                <div key={f.fahrer_id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dotCls(kml)} shrink-0`} />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendIcon trend={f.trend} />
                    <span className={`text-xs font-bold ${cls}`}>{kml.toFixed(1)} km/l</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-400 pt-1">Ziel ≥{ZIEL_KML} km/l | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
