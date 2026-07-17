'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

type FahrerSpitzenzeit = {
  fahrer_id: string;
  name: string;
  auftraege_spitze: number;
  auftraege_normal: number;
  peak_score: number;
  trend_7tage: number;
};

function minutesUntilNextRushHour(): number | null {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m;

  // Rush hours: 12:00-14:00 and 18:00-21:00
  const rushStarts = [12 * 60, 18 * 60];
  for (const start of rushStarts) {
    if (totalMin < start) return start - totalMin;
  }
  return null;
}

function isCurrentlyRushHour(): boolean {
  const h = new Date().getHours();
  return (h >= 12 && h < 14) || (h >= 18 && h < 21);
}

export function KitchenPhase2167SpitzenzeitAlert({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FahrerSpitzenzeit[]>([]);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-spitzenzeit?location_id=${locationId}`)
        .then((r) => r.json())
        .then((d) => setData(d.drivers ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const minsUntil = minutesUntilNextRushHour();
  const isRush = isCurrentlyRushHour();

  const lowPeakFahrer = useMemo(
    () => data.filter((d) => d.peak_score < 60),
    [data],
  );

  // Show alert if: upcoming rush in <30 min OR currently in rush with low-performing drivers
  const shouldShow =
    data.length > 0 &&
    ((minsUntil !== null && minsUntil <= 30) || (isRush && lowPeakFahrer.length > 0));

  if (!shouldShow) return null;

  const teamAvg = data.length
    ? Math.round(data.reduce((s, d) => s + d.peak_score, 0) / data.length)
    : 0;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
          <Zap className="h-4 w-4" />
          {isRush ? 'Stoßzeit aktiv' : `Stoßzeit in ${minsUntil} Min.`}
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">
            {isRush ? `${lowPeakFahrer.length} schwach` : 'Vorbereitung'}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-amber-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600" />
        )}
      </button>

      {open && (
        <div className="border-t border-amber-500/20 px-4 pb-4 pt-3 space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {isRush
                ? `Stoßzeit läuft — Team-Peak-Score: ${teamAvg}%. ${lowPeakFahrer.length > 0 ? `${lowPeakFahrer.length} Fahrer unter 60% — Batch-Optimierung empfohlen.` : 'Team gut aufgestellt.'}`
                : `In ${minsUntil} Min. beginnt die nächste Stoßzeit. Batch-Zuteilung jetzt vorbereiten.`}
            </span>
          </div>

          {isRush && lowPeakFahrer.length > 0 && (
            <div className="space-y-1">
              {lowPeakFahrer.map((d) => (
                <div
                  key={d.fahrer_id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs"
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-amber-600 font-semibold">
                    Peak-Score: {d.peak_score}% · {d.auftraege_spitze} Stoßzeit-Aufträge
                  </span>
                </div>
              ))}
            </div>
          )}

          {!isRush && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="font-bold text-amber-600">Nächste Rush-Hour</div>
                <div className="text-muted-foreground">
                  {minsUntil !== null && minsUntil <= 30
                    ? 'Jetzt Batches optimieren'
                    : 'In Kürze'}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="font-bold text-foreground">{teamAvg}%</div>
                <div className="text-muted-foreground">Team Peak-Score</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
