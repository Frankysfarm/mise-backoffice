'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  uph_vw: number;
  trend: string;
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_uph: number;
}

const ZIEL_UPH = 25;
const MAX_BAR  = 40;

const MOCK_ENTRY: FahrerEntry = {
  fahrer_id: 'f1', fahrer_name: 'Max M.', umsatz_pro_stunde: 27.0,
  uph_vw: 24.5, trend: 'steigend', trend_delta: 2.5,
};

const MOCK: ApiData = { fahrer: [MOCK_ENTRY], team_avg_uph: 22.3 };

const TIPPS: Record<string, string> = {
  gruen: 'Stark! Du übertriffst dein Umsatzziel. Weiter so!',
  gelb:  'Du bist auf Kurs. Noch ein paar effiziente Lieferungen bis zum Ziel.',
  rot:   'Umsatz zu niedrig. Versuche, die Lieferzeit je Tour zu verkürzen.',
};

function calcAmpel(uph: number): string {
  if (uph >= ZIEL_UPH) return 'gruen';
  if (uph >= 15) return 'gelb';
  return 'rot';
}

export function FahrerPhase2982MeinUmsatzProStunde({
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
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f       = (driverId ? data.fahrer.find(x => x.fahrer_id === driverId) : null) ?? data.fahrer[0] ?? MOCK_ENTRY;
  const ampel   = calcAmpel(f.umsatz_pro_stunde);
  const valueCls = ampel === 'rot' ? 'text-red-600' : ampel === 'gelb' ? 'text-amber-600' : 'text-green-600';
  const barCls   = ampel === 'rot' ? 'bg-red-500'   : ampel === 'gelb' ? 'bg-amber-400'   : 'bg-green-500';
  const pct      = Math.min(100, (f.umsatz_pro_stunde / MAX_BAR) * 100);
  const zielPct  = (ZIEL_UPH / MAX_BAR) * 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Mein Umsatz/h</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${valueCls}`}>{f.umsatz_pro_stunde.toFixed(1)} <span className="text-2xl">€/h</span></div>
            <div className="text-xs text-gray-400 mt-0.5">Umsatz pro Stunde heute</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>Ziel ≥{ZIEL_UPH} €/h</span>
            <span>{MAX_BAR}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Trend',
                value: f.trend_delta > 0 ? `+${f.trend_delta.toFixed(1)} €/h` : `${f.trend_delta.toFixed(1)} €/h`,
                icon: f.trend === 'steigend'
                  ? <TrendingUp   size={12} className="text-green-600" />
                  : f.trend === 'fallend'
                    ? <TrendingDown size={12} className="text-red-500"   />
                    : <Minus        size={12} className="text-gray-400"  />,
              },
              { label: 'Team-Ø', value: `${data.team_avg_uph.toFixed(1)} €/h`, icon: null },
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

          <div className="text-xs text-gray-400">Umsatz/h heute | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
