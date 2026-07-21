'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  stopps_pro_stunde: number;
  stopps_pro_stunde_gestern: number;
  stopps_heute: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_stopps_pro_stunde: number;
}

const ZIEL_SPH = 5;
const MAX_BAR = 10;

function calcAmpel(sph: number): string {
  if (sph >= ZIEL_SPH) return 'gruen';
  if (sph >= 3) return 'gelb';
  return 'rot';
}

const MOCK: ApiData = {
  fahrer_single: { fahrer_id: 'd1', fahrer_name: 'Max M.', stopps_pro_stunde: 6.2, stopps_pro_stunde_gestern: 5.8, stopps_heute: 37, trend: 'steigend', trend_delta: 0.4, ampel: 'gruen', alert: false },
  team_avg_stopps_pro_stunde: 4.6,
};

const TIPPS: Record<string, string> = {
  gruen: 'Top-Tempo! Du lieferst effizient — halte diesen Rhythmus.',
  gelb:  'Noch im Zielbereich. Optimiere deine Stopp-Reihenfolge für mehr Speed.',
  rot:   'Zu wenige Stopps pro Stunde. Prüfe Wartezeiten und plane deine Route besser.',
};

export function FahrerPhase2967MeineStoppsProStunde({
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
      fetch(`/api/delivery/admin/fahrer-stopps-pro-stunde?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const ampel = calcAmpel(f.stopps_pro_stunde);
  const valueCls = ampel === 'rot' ? 'text-red-600' : ampel === 'gelb' ? 'text-amber-600' : 'text-green-600';
  const barCls   = ampel === 'rot' ? 'bg-red-500'   : ampel === 'gelb' ? 'bg-amber-400'   : 'bg-green-500';
  const pct = Math.min(100, (f.stopps_pro_stunde / MAX_BAR) * 100);
  const zielPct = (ZIEL_SPH / MAX_BAR) * 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Stopps/h</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${valueCls}`}>{f.stopps_pro_stunde.toFixed(1)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Stopps/h heute</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0/h</span>
            <span>Ziel ≥{ZIEL_SPH}/h</span>
            <span>{MAX_BAR}/h</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Trend',
                value: f.trend_delta > 0 ? `+${f.trend_delta.toFixed(1)}` : `${f.trend_delta.toFixed(1)}`,
                icon: f.trend === 'steigend'
                  ? <TrendingUp size={12} className="text-green-600" />
                  : f.trend === 'fallend'
                    ? <TrendingDown size={12} className="text-red-500" />
                    : <Minus size={12} className="text-gray-400" />,
              },
              { label: 'Team-Ø', value: `${data.team_avg_stopps_pro_stunde.toFixed(1)}/h`, icon: null },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">{k.label}</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {k.icon}
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{k.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            {TIPPS[ampel]}
          </div>

          <div className="text-xs text-gray-400">{f.stopps_heute} Stopps heute | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
