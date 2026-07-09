'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Layers, Loader2, Settings2, Zap } from 'lucide-react';

/**
 * phase880 — Smart-Batch-Konfigurator
 *
 * Editor für Batch-Größen mit automatischer Empfehlung je Tageszeit.
 * Empfiehlt optimale Batch-Größen basierend auf Vorhersage der Fahrer-Auslastung.
 */

interface AuslastungStunde {
  hour: number;
  prognose_besetzt: number;
  prognose_frei: number;
  live_besetzt: number | null;
  live_frei: number | null;
  ist_vergangenheit: boolean;
}

interface Props {
  locationId: string | null;
}

const BATCH_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

function recommendBatchSize(hour: number, prognose_besetzt: number): number {
  if (prognose_besetzt >= 4) return 4;
  if (prognose_besetzt >= 2) return 3;
  if (hour >= 11 && hour <= 14) return 3; // Mittagspeak
  if (hour >= 18 && hour <= 21) return 3; // Abendpeak
  return 2;
}

export function KitchenPhase880SmartBatchKonfigurator({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stunden, setStunden] = useState<AuslastungStunde[]>([]);
  const [userBatch, setUserBatch] = useState<number>(3);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-auslastungs-vorhersage?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        if (d?.stunden) setStunden(d.stunden as AuslastungStunde[]);
      })
      .finally(() => setLoading(false));
  }, [open, locationId]);

  const nowHour = new Date().getUTCHours();
  const current = stunden.find(s => s.hour === nowHour);
  const recommended = current
    ? recommendBatchSize(nowHour, current.prognose_besetzt)
    : recommendBatchSize(nowHour, 2);

  // Relevant window: ±3h around now
  const window = stunden.filter(s => Math.abs(s.hour - nowHour) <= 3).sort((a, b) => a.hour - b.hour);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold uppercase tracking-wider">Smart-Batch-Konfigurator</span>
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            Empfehlung: {recommended} Bestellungen
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Auslastungsprognose…
            </div>
          )}

          {!loading && (
            <>
              {/* Recommendation highlight */}
              <div className={cn(
                'flex items-center gap-3 rounded-xl border p-3',
                userBatch === recommended
                  ? 'bg-matcha-50 border-matcha-300'
                  : 'bg-amber-50 border-amber-300',
              )}>
                <Zap className={cn('h-5 w-5 shrink-0', userBatch === recommended ? 'text-matcha-600' : 'text-amber-600')} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground">
                    KI-Empfehlung für {nowHour}:00 Uhr:
                    <span className={cn('ml-1', userBatch === recommended ? 'text-matcha-700' : 'text-amber-700')}>
                      {recommended} Bestellungen / Batch
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {current
                      ? `${current.live_besetzt ?? current.prognose_besetzt} Fahrer aktiv · Prognose: ${current.prognose_besetzt} besetzt`
                      : 'Keine Echtzeit-Daten'}
                  </div>
                </div>
                {userBatch !== recommended && (
                  <button
                    onClick={() => setUserBatch(recommended)}
                    className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-600 transition"
                  >
                    Übernehmen
                  </button>
                )}
              </div>

              {/* Batch size picker */}
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Aktuelle Batch-Größe
                </div>
                <div className="flex gap-2 flex-wrap">
                  {BATCH_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setUserBatch(n)}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold transition',
                        userBatch === n
                          ? 'border-matcha-500 bg-matcha-500 text-white'
                          : 'border-border bg-muted text-foreground hover:border-matcha-400',
                        n === recommended && userBatch !== n
                          ? 'border-amber-400 ring-1 ring-amber-300'
                          : '',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  Maximal {userBatch} Bestellungen werden zu einer Tour gebündelt.
                  {recommended !== userBatch && (
                    <span className="ml-1 text-amber-600 font-semibold">
                      KI empfiehlt {recommended}.
                    </span>
                  )}
                </div>
              </div>

              {/* Hourly forecast strip */}
              {window.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Fahrer-Prognose ±3h
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {window.map(s => {
                      const besetzt = s.live_besetzt ?? s.prognose_besetzt;
                      const isNow = s.hour === nowHour;
                      return (
                        <div
                          key={s.hour}
                          className={cn(
                            'flex flex-col items-center rounded-lg border p-2 min-w-[48px]',
                            isNow ? 'border-matcha-400 bg-matcha-50' : 'border-border bg-muted/30',
                          )}
                        >
                          <span className={cn('text-[9px] font-bold', isNow ? 'text-matcha-700' : 'text-muted-foreground')}>
                            {s.hour}:00
                          </span>
                          <div className="flex items-end gap-0.5 mt-1 h-6">
                            <div
                              className="w-2 rounded-sm bg-amber-400"
                              style={{ height: `${Math.min(24, besetzt * 6)}px` }}
                              title={`${besetzt} besetzt`}
                            />
                            <div
                              className="w-2 rounded-sm bg-matcha-400"
                              style={{ height: `${Math.min(24, (s.live_frei ?? s.prognose_frei) * 6)}px` }}
                              title={`${s.live_frei ?? s.prognose_frei} frei`}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                            {besetzt}F
                          </span>
                          <div className={cn(
                            'mt-1 rounded px-1 py-0.5 text-[8px] font-bold',
                            recommendBatchSize(s.hour, s.prognose_besetzt) >= 3
                              ? 'bg-matcha-100 text-matcha-700'
                              : 'bg-muted text-muted-foreground',
                          )}>
                            B:{recommendBatchSize(s.hour, s.prognose_besetzt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Save */}
              <button
                onClick={save}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                  saved
                    ? 'bg-matcha-100 text-matcha-700 border border-matcha-300'
                    : 'bg-matcha-600 text-white hover:bg-matcha-700',
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                {saved ? 'Gespeichert ✓' : `Batch-Größe ${userBatch} übernehmen`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
