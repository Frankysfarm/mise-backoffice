'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, LogOut } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
  onSchichtEnde?: () => void;
}

interface SchichtZusammenfassung {
  touren_count: number;
  km_gesamt: number;
  einnahmen_eur: number;
  schicht_stunden: number;
}

export function FahrerPhase724SchichtEndeBestaetigung({ driverId, isOnline, onSchichtEnde }: Props) {
  const [open, setOpen] = useState(false);
  const [kmEnde, setKmEnde] = useState('');
  const [bestätigt, setBestätigt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zusammenfassung, setZusammenfassung] = useState<SchichtZusammenfassung | null>(null);

  const ladeZusammenfassung = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await fetch(`/api/delivery/driver/tages-bilanz?driver_id=${driverId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (typeof json.touren_count === 'number') {
          setZusammenfassung({
            touren_count: json.touren_count,
            km_gesamt: json.km_gesamt,
            einnahmen_eur: json.einnahmen_eur + json.trinkgeld_eur,
            schicht_stunden: json.schicht_stunden,
          });
        }
      }
    } catch {
      // ignore
    }
  }, [driverId]);

  useEffect(() => {
    if (open && !zusammenfassung) ladeZusammenfassung();
  }, [open, zusammenfassung, ladeZusammenfassung]);

  async function bestätigenSchichtEnde() {
    if (!kmEnde || isNaN(parseFloat(kmEnde))) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/schicht-ende', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          km_ende: parseFloat(kmEnde),
        }),
      });
      setBestätigt(true);
      onSchichtEnde?.();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOnline && !bestätigt) return null;

  if (bestätigt) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Schicht beendet!</p>
            <p className="text-[10px] text-muted-foreground">Gute Erholung — bis zur nächsten Schicht!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2"
      >
        <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
        <span className="text-sm font-semibold text-red-700 dark:text-red-400">Schicht beenden</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {zusammenfassung && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-base font-bold">{zusammenfassung.touren_count}</p>
                <p className="text-[9px] text-muted-foreground">Touren</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-base font-bold">{zusammenfassung.km_gesamt.toFixed(0)} km</p>
                <p className="text-[9px] text-muted-foreground">gefahren</p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/10 p-2">
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {zusammenfassung.einnahmen_eur.toFixed(2)} €
                </p>
                <p className="text-[9px] text-muted-foreground">Einnahmen</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-base font-bold">{zusammenfassung.schicht_stunden.toFixed(1)}h</p>
                <p className="text-[9px] text-muted-foreground">Schicht</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">Km-Stand Ende</label>
            <input
              type="number"
              inputMode="decimal"
              value={kmEnde}
              onChange={(e) => setKmEnde(e.target.value)}
              placeholder="z.B. 48250"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={bestätigenSchichtEnde}
            disabled={submitting || !kmEnde}
            className="w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Wird gespeichert...' : 'Schicht jetzt beenden'}
          </button>
        </div>
      )}
    </div>
  );
}
