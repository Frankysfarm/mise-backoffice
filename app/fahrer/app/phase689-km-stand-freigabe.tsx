'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Gauge, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

const HEUTE_KEY = (driverId: string) =>
  `km-stand-freigabe-${driverId}-${new Date().toISOString().slice(0, 10)}`;

export function FahrerPhase689KmStandFreigabe({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [kmStart, setKmStart] = useState('');
  const [kmEnde, setKmEnde] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [freigegeben, setFreigegeben] = useState<{
    start: number;
    ende: number;
    delta: number;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HEUTE_KEY(driverId));
      if (stored) {
        const parsed = JSON.parse(stored);
        setFreigegeben(parsed);
        setSubmitted(true);
      }
    } catch {
      // ignore
    }
  }, [driverId]);

  // Only show at end of shift (when going offline) or when isOnline
  if (!isOnline && !submitted) return null;

  function handleSubmit() {
    const start = parseInt(kmStart, 10);
    const ende = parseInt(kmEnde, 10);
    if (isNaN(start) || isNaN(ende) || ende < start) return;
    const data = { start, ende, delta: ende - start };
    try {
      localStorage.setItem(HEUTE_KEY(driverId), JSON.stringify(data));
    } catch {
      // ignore
    }
    setFreigegeben(data);
    setSubmitted(true);
    setOpen(false);
  }

  if (submitted && freigegeben) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Kilometerstand heute freigegeben
          </p>
          <p className="text-[10px] text-muted-foreground">
            {freigegeben.start.toLocaleString('de-DE')} → {freigegeben.ende.toLocaleString('de-DE')} km
            · {freigegeben.delta.toLocaleString('de-DE')} km gefahren
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Kilometerstand freigeben</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
            Schichtende
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Kilometerstand Anfang und Ende der Schicht eintragen.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Start-km
              </label>
              <input
                type="number"
                value={kmStart}
                onChange={(e) => setKmStart(e.target.value)}
                placeholder="z.B. 45200"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Ende-km
              </label>
              <input
                type="number"
                value={kmEnde}
                onChange={(e) => setKmEnde(e.target.value)}
                placeholder="z.B. 45347"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {kmStart && kmEnde && parseInt(kmEnde, 10) > parseInt(kmStart, 10) && (
            <p className="text-xs text-muted-foreground">
              Gefahrene Strecke: <strong>{(parseInt(kmEnde, 10) - parseInt(kmStart, 10)).toLocaleString('de-DE')} km</strong>
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!kmStart || !kmEnde || parseInt(kmEnde, 10) <= parseInt(kmStart, 10)}
            className="w-full rounded-lg bg-slate-900 dark:bg-slate-100 py-2 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-40 transition"
          >
            Kilometerstand freigeben
          </button>
        </div>
      )}
    </div>
  );
}
