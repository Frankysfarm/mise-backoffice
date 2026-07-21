'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_tour: number;
  km_pro_tour_gestern: number;
  touren_heute: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_km_pro_tour: number;
}

const ZIEL_KM = 8;
const ALERT_KM = 12;
const MAX_BAR = 20;

function calcAmpel(km: number): string {
  if (km <= ZIEL_KM) return 'gruen';
  if (km <= ALERT_KM) return 'gelb';
  return 'rot';
}

const MOCK: ApiData = {
  fahrer_single: { fahrer_id: 'd1', fahrer_name: 'Max M.', km_pro_tour: 7.4, km_pro_tour_gestern: 8.1, touren_heute: 9, trend: 'fallend', trend_delta: -0.7, ampel: 'gruen', alert: false },
  team_avg_km_pro_tour: 9.1,
};

const TIPPS: Record<string, string> = {
  gruen: 'Super! Deine Touren sind effizient — halte diesen Wert.',
  gelb:  'Noch im Rahmen. Prüfe deine Routen für kürzere Wege.',
  rot:   'Zu hohe km pro Tour. Bündel Stopps und optimiere deine Route.',
};

export function FahrerPhase2962MeineKmProTour({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId || !driverId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-km-pro-tour?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const ampel = calcAmpel(f.km_pro_tour);
  const valueCls = ampel === 'rot' ? 'text-red-600' : ampel === 'gelb' ? 'text-amber-600' : 'text-green-600';
  const barCls   = ampel === 'rot' ? 'bg-red-500'   : ampel === 'gelb' ? 'bg-amber-400'   : 'bg-green-500';
  const pct = Math.min(100, (f.km_pro_tour / MAX_BAR) * 100);
  const zielPct = (ZIEL_KM / MAX_BAR) * 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine km/Tour</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${valueCls}`}>{f.km_pro_tour.toFixed(1)}</div>
            <div className="text-xs text-gray-400 mt-0.5">km pro Tour heute</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 km</span>
            <span>Ziel ≤{ZIEL_KM} km</span>
            <span>{MAX_BAR} km</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend', value: f.trend_delta > 0 ? `+${f.trend_delta.toFixed(1)}` : `${f.trend_delta.toFixed(1)}`, icon: f.trend === 'fallend' ? <TrendingDown size={12} className="text-green-600" /> : f.trend === 'steigend' ? <TrendingUp size={12} className="text-red-500" /> : <Minus size={12} className="text-gray-400" /> },
              { label: 'Team-Ø', value: `${data.team_avg_km_pro_tour.toFixed(1)} km`, icon: null },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">{k.label}</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {k.icon}
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{k.value} km</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            {TIPPS[ampel]}
          </div>

          <div className="text-xs text-gray-400">{f.touren_heute} Touren heute | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
