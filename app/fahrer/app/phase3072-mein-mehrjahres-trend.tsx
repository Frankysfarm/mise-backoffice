'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  jahre_pct: number[];
  aktuell_pct: number;
  vorjahr_pct: number;
  vorvorjahr_pct: number;
  trend: string;
  trend_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  jahre: number[];
}

const MOCK_ENTRY: FahrerEntry = {
  fahrer_id: 'mock',
  jahre_pct: [55.0, 60.2, 64.2],
  aktuell_pct: 64.2,
  vorjahr_pct: 60.2,
  vorvorjahr_pct: 55.0,
  trend: 'steigend',
  trend_delta: 9.2,
  ampel: 'gruen',
};
const MOCK_DATA: ApiData = { fahrer: [MOCK_ENTRY], team_avg_pct: 55.4, jahre: [2024, 2025, 2026] };

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   tip: 'bg-red-50 text-red-700 border-red-200'     };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400', tip: 'bg-amber-50 text-amber-700 border-amber-200' };
  return                   { text: 'text-green-600', bar: 'bg-green-500', tip: 'bg-green-50 text-green-700 border-green-200' };
}

const TIPPS: Record<string, string> = {
  gruen: 'Steigender Mehrjahrestrend: Super! Kontinuierliche Verbesserung über mehrere Jahre.',
  gelb:  'Stabiler Trend: Die Auslastung bleibt konstant. Nächstes Jahr mehr Schichten einplanen.',
  rot:   'Negativer Mehrjahrestrend! Bitte Ursachen mit dem Disponenten klären.',
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

function SparklineBars({ pcts, jahre }: { pcts: number[]; jahre: number[] }) {
  const max = Math.max(...pcts, 10);
  return (
    <div className="flex items-end justify-center gap-3 h-16 mt-2">
      {pcts.map((p, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{p.toFixed(0)} %</span>
          <div
            className={`w-10 rounded-t transition-all ${i === pcts.length - 1 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            style={{ height: `${Math.max(4, Math.round((p / max) * 40))}px` }}
          />
          <span className="text-xs text-gray-400">{jahre[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function FahrerPhase3072MeinMehrjahresTrend({
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
      const url = `/api/delivery/admin/fahrer-mehrjahres-trend?location_id=${locationId}${driverId ? `&driver_id=${driverId}` : ''}`;
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

  const entry    = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0] ?? MOCK_ENTRY;
  const { text, bar, tip } = ampelCls(entry.ampel);
  const jahre    = data.jahre ?? [2024, 2025, 2026];
  const teamAmpel = data.team_avg_pct >= 60 ? 'gruen' : data.team_avg_pct >= 40 ? 'gelb' : 'rot';
  const { text: teamText } = ampelCls(teamAmpel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Mein Mehrjahres-Trend {jahre[0]}–{jahre[jahre.length - 1]}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${text}`}>{entry.aktuell_pct.toFixed(1)} %</div>
            <div className="flex items-center justify-center gap-1 mt-1 text-sm text-gray-500">
              <TrendIcon trend={entry.trend} />
              <span>{entry.trend_delta > 0 ? '+' : ''}{entry.trend_delta.toFixed(1)} % vs. {jahre[0]}</span>
            </div>
          </div>

          {/* Sparkline 3 Jahre */}
          <SparklineBars pcts={entry.jahre_pct.slice(0, 3)} jahre={jahre} />

          {/* Vorjahr + Vorvorjahr */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
              <div className="text-gray-500 font-medium mb-0.5">{jahre[1]}</div>
              <div className="font-bold text-base text-gray-700 dark:text-gray-200">{entry.vorjahr_pct.toFixed(1)} %</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
              <div className="text-gray-500 font-medium mb-0.5">{jahre[0]}</div>
              <div className="font-bold text-base text-gray-700 dark:text-gray-200">{entry.vorvorjahr_pct.toFixed(1)} %</div>
            </div>
          </div>

          {/* Team-Ø */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2 text-center text-xs">
            <div className="text-gray-500 font-medium mb-0.5">Team-Ø {jahre[2]}</div>
            <div className={`font-bold text-base ${teamText}`}>{data.team_avg_pct.toFixed(1)} %</div>
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
