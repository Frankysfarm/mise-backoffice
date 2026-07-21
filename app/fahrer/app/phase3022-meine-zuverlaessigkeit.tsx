'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, ShieldCheck } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  abschluss_pct: number;
  lieferungen_heute: number;
  trend: string;
  trend_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL_PCT = 95;
const MAX_BAR  = 100;

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   tip: 'bg-red-50 text-red-700 border-red-200'     };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400', tip: 'bg-amber-50 text-amber-700 border-amber-200' };
  return                   { text: 'text-green-600', bar: 'bg-green-500', tip: 'bg-green-50 text-green-700 border-green-200' };
}

const TIPPS: Record<string, string> = {
  gruen: '≥95%: Ausgezeichnet! Du schließt fast alle Aufträge erfolgreich ab. Weiter so!',
  gelb:  '85–94%: Gut, aber nicht perfekt. Prüfe, warum manche Aufträge nicht abgeschlossen werden.',
  rot:   '<85%: Bitte keine Aufträge abbrechen! Jede nicht abgeschlossene Lieferung schadet dem Team.',
};

const MOCK_ENTRY: FahrerEntry = {
  fahrer_id: 'mock', abschluss_pct: 95, lieferungen_heute: 18, trend: 'steigend', trend_delta: 1, ampel: 'gruen',
};
const MOCK_DATA: ApiData = { fahrer: [MOCK_ENTRY], team_durchschnitt: 90.3 };

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

export function FahrerPhase3022MeineZuverlaessigkeit({
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
      const url = `/api/delivery/admin/fahrer-lieferzuverlaessigkeit?location_id=${locationId}${driverId ? `&driver_id=${driverId}` : ''}`;
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
  const pct     = Math.min(100, entry.abschluss_pct);
  const zielPct = (ZIEL_PCT / MAX_BAR) * 100;
  const teamAmpel = data.team_durchschnitt >= ZIEL_PCT ? 'gruen' : data.team_durchschnitt >= 85 ? 'gelb' : 'rot';
  const { text: teamText } = ampelCls(teamAmpel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Zuverlässigkeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          <div className="text-center">
            <div className={`text-4xl font-black ${text}`}>{entry.abschluss_pct.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Abschlussrate heute ({entry.lieferungen_heute} Lieferungen)</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={entry.trend} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {entry.trend_delta > 0 ? '+' : ''}{entry.trend_delta} PP vs. gestern
              </span>
            </div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-2">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-[18px] w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-2">
            <span>0%</span>
            <span>Ziel ≥{ZIEL_PCT}%</span>
            <span>100%</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className={`text-sm font-bold ${teamText}`}>{data.team_durchschnitt.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend</div>
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={entry.trend} />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {entry.trend_delta > 0 ? '+' : ''}{entry.trend_delta} PP
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
