'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  trend: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_uph: number;
  alert_count: number;
}

const ZIEL_UPH  = 25;
const ALERT_UPH = 15;

function dotCls(uph: number): string {
  if (uph >= ZIEL_UPH) return 'bg-green-500';
  if (uph >= ALERT_UPH) return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   umsatz_pro_stunde: 32.5, trend: 'steigend' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  umsatz_pro_stunde: 27.0, trend: 'stabil'   },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   umsatz_pro_stunde: 18.0, trend: 'fallend'  },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', umsatz_pro_stunde: 11.5, trend: 'fallend'  },
  ],
  team_avg_uph: 22.3,
  alert_count: 1,
};

export function KitchenPhase2984UmsatzProStundeTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);
  const alerts   = data.fahrer.filter(f => f.umsatz_pro_stunde < ALERT_UPH);
  const hasAlert = alerts.length > 0;
  const teamAmpel = data.team_avg_uph >= ZIEL_UPH ? 'gruen' : data.team_avg_uph >= ALERT_UPH ? 'gelb' : 'rot';
  const teamText  = teamAmpel === 'rot' ? 'text-red-600' : teamAmpel === 'gelb' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Umsatz/h-Ticker
            <span className={`ml-2 font-black ${teamText}`}>{data.team_avg_uph.toFixed(1)} €/h</span>
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
                {f.fahrer_name}: Umsatz zu niedrig! ({f.umsatz_pro_stunde.toFixed(1)} €/h)
              </span>
            </div>
          ))}

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map(f => {
              const uph = f.umsatz_pro_stunde;
              const cls = uph >= ZIEL_UPH ? 'text-green-600' : uph >= ALERT_UPH ? 'text-amber-600' : 'text-red-600';
              return (
                <div key={f.fahrer_id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dotCls(uph)} shrink-0`} />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendIcon trend={f.trend} />
                    <span className={`text-xs font-bold ${cls}`}>{uph.toFixed(1)} €/h</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-400 pt-1">Ziel ≥{ZIEL_UPH} €/h | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
