'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  bewertung_avg: number;
  bewertungen_heute: number;
  trend: string;
  trend_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL_AVG = 4.5;
const MAX_BAR  = 5;

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   tip: 'bg-red-50 text-red-700 border-red-200'     };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400', tip: 'bg-amber-50 text-amber-700 border-amber-200' };
  return                   { text: 'text-green-600', bar: 'bg-green-500', tip: 'bg-green-50 text-green-700 border-green-200' };
}

const TIPPS: Record<string, string> = {
  gruen: 'Ausgezeichnet! Deine Kundenbewertungen sind top. Mach weiter so — deine freundliche Art zahlt sich aus!',
  gelb:  'Gute Bewertungen, aber es geht noch besser! Lächle beim Übergeben und sage "Guten Appetit!" für den Extra-Stern.',
  rot:   'Deine Bewertungen brauchen Aufmerksamkeit. Prüfe: Waren die Bestellungen vollständig? Warst du pünktlich und freundlich?',
};

const MOCK_ENTRY: FahrerEntry = {
  fahrer_id: 'mock', bewertung_avg: 4.8, bewertungen_heute: 12, trend: 'steigend', trend_delta: 0.3, ampel: 'gruen',
};
const MOCK_DATA: ApiData = { fahrer: [MOCK_ENTRY], team_durchschnitt: 4.35 };

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

export function FahrerPhase3012MeineBewertung({
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
      fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK_DATA));
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId]);

  if (!isOnline) return null;
  if (!data) return null;

  const entry = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0] ?? MOCK_ENTRY;
  const { text, bar, tip } = ampelCls(entry.ampel);
  const pct     = Math.min(100, (entry.bewertung_avg / MAX_BAR) * 100);
  const zielPct = (ZIEL_AVG / MAX_BAR) * 100;
  const teamAmpel = data.team_durchschnitt >= ZIEL_AVG ? 'gruen' : data.team_durchschnitt >= 4.0 ? 'gelb' : 'rot';
  const { text: teamText } = ampelCls(teamAmpel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-400" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Bewertungen</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          <div className="text-center">
            <div className={`text-4xl font-black ${text}`}>{entry.bewertung_avg.toFixed(1)} ★</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ø heute ({entry.bewertungen_heute} Bewertungen)</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={entry.trend} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {entry.trend_delta > 0 ? '+' : ''}{entry.trend_delta.toFixed(1)} vs. Vorwoche
              </span>
            </div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-2">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-[18px] w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-2">
            <span>0 ★</span>
            <span>Ziel ≥{ZIEL_AVG} ★</span>
            <span>{MAX_BAR} ★</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className={`text-sm font-bold ${teamText}`}>{data.team_durchschnitt.toFixed(1)} ★</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend</div>
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={entry.trend} />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {entry.trend_delta > 0 ? '+' : ''}{entry.trend_delta.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className={`border rounded-lg px-3 py-2 text-xs ${tip}`}>
            {TIPPS[entry.ampel] ?? TIPPS.gelb}
          </div>
        </div>
      )}
    </div>
  );
}
