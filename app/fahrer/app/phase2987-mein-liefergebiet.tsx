'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  radius_km: number;
  auslastung_pct: number;
  auslastung_vw: number;
  trend: string;
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_radius: number;
  team_avg_auslastung: number;
}

const ZIEL_AUSL = 80;

const MOCK_ENTRY: FahrerEntry = {
  fahrer_id: 'f1', fahrer_name: 'Max M.',
  radius_km: 3.2, auslastung_pct: 65, auslastung_vw: 70,
  trend: 'fallend', trend_delta: -5,
};
const MOCK: ApiData = { fahrer: [MOCK_ENTRY], team_avg_radius: 4.5, team_avg_auslastung: 76 };

const TIPPS: Record<string, string> = {
  gruen: 'Perfekt! Dein Gebiet ist gut erreichbar und nicht überlastet.',
  gelb:  'Gebiet leicht ausgelastet. Achte auf effiziente Routenwahl.',
  rot:   'Gebiet überlastet oder zu groß. Bitte beim Dispatcher melden!',
};

function calcAmpel(radius: number, ausl: number): string {
  if (radius > 6 || ausl > 90) return 'rot';
  if (radius > 4 || ausl > 80) return 'gelb';
  return 'gruen';
}

export function FahrerPhase2987MeinLiefergebiet({
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
    if (!locationId) { setData(MOCK); return; }
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefergebiet-auslastung?${params}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f      = (driverId ? data.fahrer.find(x => x.fahrer_id === driverId) : null) ?? data.fahrer[0] ?? MOCK_ENTRY;
  const ampel  = calcAmpel(f.radius_km, f.auslastung_pct);
  const valCls = ampel === 'rot' ? 'text-red-600' : ampel === 'gelb' ? 'text-amber-600' : 'text-green-600';
  const barCls = ampel === 'rot' ? 'bg-red-500'   : ampel === 'gelb' ? 'bg-amber-400'   : 'bg-green-500';
  const pct    = Math.min(100, f.auslastung_pct);
  const zielPct = ZIEL_AUSL;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Mein Liefergebiet</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${valCls}`}>
              {f.auslastung_pct}<span className="text-2xl">%</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Gebiets-Auslastung heute</div>
            <div className="text-xs text-gray-500 mt-0.5">Ø Radius: {f.radius_km.toFixed(1)} km</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span>Ziel &lt;{ZIEL_AUSL}%</span>
            <span>100%</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Trend',
                value: f.trend_delta > 0 ? `+${f.trend_delta.toFixed(0)}%` : `${f.trend_delta.toFixed(0)}%`,
                icon: f.trend === 'fallend'
                  ? <TrendingDown size={12} className="text-green-600" />
                  : f.trend === 'steigend'
                    ? <TrendingUp   size={12} className="text-red-500"   />
                    : <Minus        size={12} className="text-gray-400"  />,
              },
              { label: 'Team-Ø', value: `${data.team_avg_auslastung}%`, icon: null },
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
            {TIPPS[ampel] ?? TIPPS.gelb}
          </div>

          <div className="text-xs text-gray-400">Liefergebiet heute | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
