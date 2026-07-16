'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Coffee, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface FahrerPausenzeit {
  driver_id: string;
  name: string;
  avg_pause_min: number;
  max_pause_min: number;
  pause_count: number;
  ist_ausreisser: boolean;
}

interface PausenzeitData {
  fahrer: FahrerPausenzeit[];
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const TIPPS = [
  'Kurze Pausen (5–10 Min) steigern die Produktivität — plane sie regelmäßig ein.',
  'Deine Pausen sind im guten Bereich. Weiter so!',
  'Achte darauf, Pausen unter 20 Minuten zu halten, um die Toureffizienz zu sichern.',
];

const MOCK_EIGENE: FahrerPausenzeit = {
  driver_id: 'self',
  name: 'Ich',
  avg_pause_min: 9,
  max_pause_min: 15,
  pause_count: 12,
  ist_ausreisser: false,
};
const MOCK_TEAM_AVG = 11;

const POLL_MS = 15 * 60 * 1000;

export function FahrerPhase2027MeinePausenzeitAnalyse({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [eigene, setEigene] = useState<FahrerPausenzeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-pausenzeit?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: PausenzeitData = await res.json();
        const self = (json.fahrer ?? []).find(f => f.driver_id === driverId) ?? null;
        const avg =
          json.fahrer.length > 0
            ? Math.round(json.fahrer.reduce((s, f) => s + f.avg_pause_min, 0) / json.fahrer.length)
            : null;
        if (!cancelled) {
          setEigene(self ?? MOCK_EIGENE);
          setTeamAvg(avg ?? MOCK_TEAM_AVG);
        }
      } catch {
        if (!cancelled) {
          setEigene(MOCK_EIGENE);
          setTeamAvg(MOCK_TEAM_AVG);
        }
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, locationId]);

  if (!driverId || !isOnline) return null;

  const d = eigene;
  const diff = d && teamAvg != null ? d.avg_pause_min - teamAvg : null;
  const tippIdx = d ? (d.ist_ausreisser ? 2 : d.avg_pause_min <= 10 ? 1 : 0) : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Coffee className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Meine Pausenzeit-Analyse</span>
        {d && (
          <span className={cn(
            'text-[10px] font-bold rounded-full px-2 py-0.5',
            d.ist_ausreisser
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              : 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300',
          )}>
            Ø {d.avg_pause_min} Min
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!d ? (
            <p className="text-xs text-muted-foreground text-center py-4">Lade Pausendaten…</p>
          ) : (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'Ø Pause',
                    value: `${d.avg_pause_min} Min`,
                    color: d.ist_ausreisser ? 'text-amber-600' : 'text-matcha-600',
                  },
                  {
                    label: 'Max Pause',
                    value: `${d.max_pause_min} Min`,
                    color: d.max_pause_min > 30 ? 'text-red-600' : 'text-foreground',
                  },
                  {
                    label: 'Team-Ø',
                    value: teamAvg != null ? `${teamAvg} Min` : '—',
                    color: 'text-sky-600',
                  },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-lg border bg-muted/20 p-2 text-center">
                    <div className={cn('text-sm font-black', kpi.color)}>{kpi.value}</div>
                    <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* vs team */}
              {diff !== null && (
                <div className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
                  diff > 5
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    : diff < -5
                      ? 'border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-900/20 text-matcha-700 dark:text-matcha-300'
                      : 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300',
                )}>
                  {diff > 5
                    ? `Du pausierst ${diff} Min länger als das Team-Ø.`
                    : diff < -5
                      ? `Du pausierst ${Math.abs(diff)} Min kürzer als das Team-Ø — sehr effizient!`
                      : 'Du liegst im Team-Durchschnitt.'}
                </div>
              )}

              {/* Tipp */}
              <div className="flex items-start gap-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-3 py-2">
                <Lightbulb className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span className="text-xs text-sky-700 dark:text-sky-300">{TIPPS[tippIdx]}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
