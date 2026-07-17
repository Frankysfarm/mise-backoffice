'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';

type RisikoStufe = 'niedrig' | 'mittel' | 'hoch';

interface FahrerRisiko {
  driver_id: string;
  fahrer_name: string;
  verspaetungen_3_tage: number;
  schicht_fehlzeiten: number;
  risiko_score: number;
  risiko_stufe: RisikoStufe;
}

interface ApiData {
  fahrer: FahrerRisiko[];
  gesamt_risiko: RisikoStufe;
}

const TIPPS: Record<RisikoStufe, string> = {
  niedrig: 'Du bist zuverlässig! Dein Ausfallrisiko ist gering. Weiter so!',
  mittel: 'Achte auf pünktliche Touren. Verzögerungen frühzeitig melden hilft dem Team.',
  hoch: 'Dein Risiko-Score ist erhöht. Sprich mit dem Dispatcher über mögliche Unterstützung.',
};

function ScoreIcon({ stufe }: { stufe: RisikoStufe }) {
  if (stufe === 'hoch') return <ShieldAlert className="w-8 h-8 text-red-500" />;
  if (stufe === 'mittel') return <ShieldQuestion className="w-8 h-8 text-yellow-500" />;
  return <ShieldCheck className="w-8 h-8 text-green-500" />;
}

function stufeLabel(stufe: RisikoStufe) {
  if (stufe === 'hoch') return { label: 'Hohes Risiko', color: 'text-red-600 dark:text-red-400' };
  if (stufe === 'mittel') return { label: 'Mittleres Risiko', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Niedriges Risiko', color: 'text-green-600 dark:text-green-400' };
}

export function FahrerPhase2218MeinZuverlaessigkeitsScore({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-ausfallrisiko';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const me = driverId
    ? data.fahrer.find((f) => f.driver_id === driverId)
    : data.fahrer[0];
  if (!me) return null;

  const { label, color } = stufeLabel(me.risiko_stufe);
  const maxScore = 20;
  const barPct = Math.min(100, Math.round((me.risiko_score / maxScore) * 100));
  const barColor =
    me.risiko_stufe === 'hoch' ? 'bg-red-500' : me.risiko_stufe === 'mittel' ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Mein Zuverlässigkeits-Score</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold', color)}>{label}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <ScoreIcon stufe={me.risiko_stufe} />
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className={cn('text-3xl font-bold', color)}>{me.risiko_score}</span>
                <span className="text-xs text-gray-400">/ {maxScore} Risiko-Punkte</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                <div className={cn('h-2 rounded-full transition-all', barColor)} style={{ width: `${barPct}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
              <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{me.verspaetungen_3_tage}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Verspätungen (3 Tage)</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
              <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{me.schicht_fehlzeiten}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Fehlzeiten</div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{TIPPS[me.risiko_stufe]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
