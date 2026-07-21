'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Leaf } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  co2_kg: number;
  co2_kg_gestern: number;
  trend: string;
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_co2: number;
}

const ZIEL_CO2 = 15;
const MAX_BAR  = 40;

const MOCK_ENTRY: FahrerEntry = {
  fahrer_id: 'f1', fahrer_name: 'Max M.',
  co2_kg: 19.8, co2_kg_gestern: 21.2,
  trend: 'fallend', trend_delta: -1.4,
};
const MOCK: ApiData = { fahrer: [MOCK_ENTRY], team_avg_co2: 20.2 };

const TIPPS: Record<string, string> = {
  gruen: 'Super! Dein CO2-Ausstoss ist vorbildlich — weiter so umweltfreundlich fahren!',
  gelb:  'Guter Wert. Noch etwas sparsamer fahren und du erreichst das Ziel ≤15 kg.',
  rot:   'Hoher CO2-Ausstoss. Versuche, Leerkilometer zu reduzieren und gleichmäßiger zu fahren.',
};

function calcAmpel(co2: number): string {
  if (co2 <= ZIEL_CO2) return 'gruen';
  if (co2 <= 25) return 'gelb';
  return 'rot';
}

// Trend INVERTIERT: fallend = besser
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

export function FahrerPhase2997MeinCo2({
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
      fetch(`/api/delivery/admin/fahrer-co2-ausstoss?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f        = (driverId ? data.fahrer.find(x => x.fahrer_id === driverId) : null) ?? data.fahrer[0] ?? MOCK_ENTRY;
  const ampel    = calcAmpel(f.co2_kg);
  const valueCls = ampel === 'rot' ? 'text-red-600' : ampel === 'gelb' ? 'text-amber-600' : 'text-green-600';
  const barCls   = ampel === 'rot' ? 'bg-red-500'   : ampel === 'gelb' ? 'bg-amber-400'   : 'bg-green-500';
  const pct      = Math.min(100, (f.co2_kg / MAX_BAR) * 100);
  const zielPct  = (ZIEL_CO2 / MAX_BAR) * 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Leaf size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Mein CO2-Ausstoss</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${valueCls}`}>{f.co2_kg.toFixed(1)} <span className="text-2xl">kg CO2</span></div>
            <div className="text-xs text-gray-400 mt-0.5">CO2-Ausstoss heute</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>Ziel ≤{ZIEL_CO2} kg</span>
            <span>{MAX_BAR}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Trend',
                value: f.trend_delta > 0 ? `+${f.trend_delta.toFixed(1)} kg` : `${f.trend_delta.toFixed(1)} kg`,
                icon: <TrendIcon trend={f.trend} />,
              },
              { label: 'Team-Ø', value: `${data.team_avg_co2.toFixed(1)} kg`, icon: null },
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

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-300">
            {TIPPS[ampel] ?? TIPPS.gelb}
          </div>

          <div className="text-xs text-gray-400">CO2 = km × 0,21 kg/km | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
