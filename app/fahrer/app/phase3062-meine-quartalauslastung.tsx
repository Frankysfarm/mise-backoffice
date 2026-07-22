'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  auslastung_pct: number;
  auslastung_pct_vorquartal: number;
  monate_pct: number[];
  trend: string;
  trend_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  quartal: number;
  monate: string[];
}

const ZIEL_PCT = 65;

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   tip: 'bg-red-50 text-red-700 border-red-200'     };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400', tip: 'bg-amber-50 text-amber-700 border-amber-200' };
  return                   { text: 'text-green-600', bar: 'bg-green-500', tip: 'bg-green-50 text-green-700 border-green-200' };
}

const TIPPS: Record<string, string> = {
  gruen: '≥65 %: Ausgezeichnete Quartalauslastung! Starke Leistung über alle drei Monate.',
  gelb:  '45–64 %: Noch Luft nach oben. Im nächsten Quartal mehr Schichten einplanen.',
  rot:   '<45 %: Geringe Quartalauslastung! Bitte mit dem Disponenten sprechen.',
};

const MOCK_ENTRY: FahrerEntry = {
  fahrer_id: 'mock',
  auslastung_pct: 68.4,
  auslastung_pct_vorquartal: 64.8,
  monate_pct: [70, 68, 67],
  trend: 'steigend',
  trend_delta: 3.6,
  ampel: 'gruen',
};
const MOCK_DATA: ApiData = { fahrer: [MOCK_ENTRY], team_avg_pct: 61.7, quartal: 3, monate: ['Jul', 'Aug', 'Sep'] };

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

export function FahrerPhase3062MeineQuartalauslastung({
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
    if (!isOnline || !locationId) { setData(MOCK_DATA); return; }
    const load = () => {
      const url = `/api/delivery/admin/fahrer-quartalauslastung?location_id=${locationId}${driverId ? `&driver_id=${driverId}` : ''}`;
      fetch(url)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK_DATA));
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId, driverId]);

  if (!isOnline) return null;
  if (!data) return null;

  const entry = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0] ?? MOCK_ENTRY;
  const { text, bar, tip } = ampelCls(entry.ampel);
  const pct       = Math.min(100, entry.auslastung_pct);
  const teamAmpel = data.team_avg_pct >= ZIEL_PCT ? 'gruen' : data.team_avg_pct >= 45 ? 'gelb' : 'rot';
  const { text: teamText } = ampelCls(teamAmpel);
  const monatLabels = data.monate?.length === 3 ? data.monate : ['M1', 'M2', 'M3'];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-amber-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Meine Quartalauslastung {data?.quartal ? `Q${data.quartal}` : ''}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${text}`}>{pct.toFixed(1)} %</div>
            <div className="text-xs text-gray-500 mt-0.5">Quartalauslastung</div>
          </div>

          {/* Balken */}
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-gray-700 dark:bg-gray-200 opacity-60" style={{ left: `${ZIEL_PCT}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 %</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">Ziel {ZIEL_PCT} %</span>
            <span>100 %</span>
          </div>

          {/* Monatsübersicht (3 Monate des Quartals) */}
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Monatsübersicht</div>
            <div className="grid grid-cols-3 gap-2">
              {entry.monate_pct.slice(0, 3).map((m, i) => {
                const mAmpel = m >= ZIEL_PCT ? 'gruen' : m >= 45 ? 'gelb' : 'rot';
                const { text: mText, bar: mBar } = ampelCls(mAmpel);
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`text-xs font-bold ${mText}`}>{m.toFixed(0)} %</div>
                    <div className="w-full h-10 bg-gray-100 dark:bg-gray-800 rounded relative overflow-hidden flex items-end">
                      <div className={`w-full rounded transition-all ${mBar}`} style={{ height: `${m}%` }} />
                    </div>
                    <div className="text-xs text-gray-400">{monatLabels[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team + Vorquartal */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
              <div className="text-gray-500 font-medium mb-0.5">Team-Ø</div>
              <div className={`font-bold text-base ${teamText}`}>{data.team_avg_pct.toFixed(1)} %</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
              <div className="text-gray-500 font-medium mb-0.5">Vorquartal</div>
              <div className="flex items-center justify-center gap-1">
                <span className="font-bold text-base text-gray-700 dark:text-gray-200">{entry.auslastung_pct_vorquartal.toFixed(1)} %</span>
                <TrendIcon trend={entry.trend} />
              </div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg border text-xs px-3 py-2 ${tip}`}>
            {TIPPS[entry.ampel] ?? TIPPS.gruen}
          </div>
        </div>
      )}
    </div>
  );
}
