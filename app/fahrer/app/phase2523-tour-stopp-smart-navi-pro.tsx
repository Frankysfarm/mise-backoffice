'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronDown, ChevronUp, MapPin, Navigation, Phone } from 'lucide-react';

/**
 * Phase 2523 — Tour-Stopp Smart-Navi Pro (Fahrer-App)
 *
 * Kompakte Stopp-Liste mit Hero-Fokus auf den nächsten Stopp,
 * 1-Tap Navigation (Google/Apple/Waze), Anruf-Button,
 * Fortschrittsleiste und Stopp-Bestätigung.
 */

interface Stop {
  id: string;
  reihenfolge?: number | null;
  adresse?: string | null;
  plz?: string | null;
  kunde_name?: string | null;
  kunde_telefon?: string | null;
  gesamtbetrag?: number | null;
  geliefert_am?: string | null;
  notiz?: string | null;
  eta_min?: number | null;
}

interface Props {
  stops: Stop[];
  batchId?: string | null;
  onConfirmDelivered?: (stopId: string) => Promise<void>;
}

function buildNavUrl(app: 'google' | 'apple' | 'waze', adresse: string, plz: string | null): string {
  const q = encodeURIComponent(`${adresse}${plz ? ` ${plz}` : ''}`);
  if (app === 'google') return `https://maps.google.com/maps?q=${q}`;
  if (app === 'apple') return `maps://maps.apple.com/?q=${q}`;
  return `https://waze.com/ul?q=${q}`;
}

function fmtEur(ct: number): string {
  return (ct / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function FahrerPhase2523TourStoppSmartNaviPro({ stops, onConfirmDelivered }: Props) {
  const [open, setOpen] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [expandStops, setExpandStops] = useState(false);

  const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
  const doneCount = sorted.filter(s => s.geliefert_am || confirmed.has(s.id)).length;
  const nextStop = sorted.find(s => !s.geliefert_am && !confirmed.has(s.id)) ?? null;
  const donePct = sorted.length > 0 ? Math.round((doneCount / sorted.length) * 100) : 0;

  useEffect(() => {
    setConfirmed(new Set());
  }, [stops.length]);

  async function handleConfirm(stopId: string) {
    setConfirming(stopId);
    try {
      await onConfirmDelivered?.(stopId);
      setConfirmed(prev => new Set([...prev, stopId]));
    } catch {}
    finally { setConfirming(null); }
  }

  if (sorted.length === 0) return null;

  const allDone = doneCount >= sorted.length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold">Tour-Stopps</span>
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 text-[10px] font-bold">
            {doneCount}/{sorted.length}
          </span>
          {allDone && (
            <span className="rounded-full bg-matcha-600 text-white px-2 py-0.5 text-[10px] font-bold">Alle fertig!</span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t space-y-0">
          {/* Fortschrittsleiste */}
          <div className="px-4 py-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${donePct}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-muted-foreground">{donePct}% abgeschlossen</span>
              {nextStop && nextStop.eta_min !== null && nextStop.eta_min !== undefined && (
                <span className="text-[9px] text-matcha-600 font-bold">~{nextStop.eta_min} min zum nächsten Stopp</span>
              )}
            </div>
          </div>

          {/* Hero: Nächster Stopp */}
          {nextStop && !allDone && (
            <div className="mx-4 mb-3 rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/30 p-3">
              <div className="flex items-start gap-2 mb-2">
                <div className="h-5 w-5 rounded-full bg-matcha-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">
                  {nextStop.reihenfolge ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-matcha-800 dark:text-matcha-200 truncate">
                    {nextStop.kunde_name ?? 'Kunde'}
                  </div>
                  <div className="text-[11px] text-matcha-600 dark:text-matcha-400 truncate">
                    {nextStop.adresse ?? 'Adresse fehlt'}{nextStop.plz ? `, ${nextStop.plz}` : ''}
                  </div>
                  {nextStop.notiz && (
                    <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 rounded px-1.5 py-0.5 inline-block">
                      💬 {nextStop.notiz}
                    </div>
                  )}
                </div>
                {nextStop.gesamtbetrag !== null && nextStop.gesamtbetrag !== undefined && (
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-black text-matcha-800 dark:text-matcha-200 tabular-nums">
                      {fmtEur(nextStop.gesamtbetrag)}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigations-Buttons */}
              {nextStop.adresse && (
                <div className="flex gap-1.5 mb-2">
                  {(['google', 'apple', 'waze'] as const).map(app => (
                    <a
                      key={app}
                      href={buildNavUrl(app, nextStop.adresse!, nextStop.plz ?? null)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-matcha-600 text-white text-[10px] font-bold hover:bg-matcha-700 transition"
                    >
                      <Navigation className="h-3 w-3" />
                      {app === 'google' ? 'Maps' : app === 'apple' ? 'Apple' : 'Waze'}
                    </a>
                  ))}
                  {nextStop.kunde_telefon && (
                    <a
                      href={`tel:${nextStop.kunde_telefon}`}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-foreground text-[10px] font-bold hover:bg-muted/80 transition"
                    >
                      <Phone className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Zugestellt-Button */}
              {onConfirmDelivered && (
                <button
                  onClick={() => handleConfirm(nextStop.id)}
                  disabled={confirming === nextStop.id}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition',
                    confirming === nextStop.id
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-matcha-900 dark:bg-matcha-100 text-white dark:text-matcha-900 hover:bg-matcha-800 dark:hover:bg-matcha-200 active:scale-[0.98]'
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirming === nextStop.id ? 'Bestätige…' : 'Zugestellt ✓'}
                </button>
              )}
            </div>
          )}

          {/* Alle Stopps (aufklappbar) */}
          <div className="px-4 pb-3">
            <button
              onClick={() => setExpandStops(v => !v)}
              className="w-full text-left text-[10px] font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition py-1"
            >
              {expandStops ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Alle {sorted.length} Stopps {expandStops ? 'ausblenden' : 'anzeigen'}
            </button>

            {expandStops && (
              <div className="mt-1 space-y-1">
                {sorted.map(s => {
                  const done = s.geliefert_am || confirmed.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]',
                        done ? 'bg-matcha-50 dark:bg-matcha-950/20' : 'bg-muted/30',
                        s.id === nextStop?.id && 'ring-1 ring-matcha-400'
                      )}
                    >
                      <div className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                        done
                          ? 'bg-matcha-500 text-white'
                          : s.id === nextStop?.id
                            ? 'bg-matcha-600 text-white'
                            : 'bg-muted text-muted-foreground'
                      )}>
                        {done ? '✓' : (s.reihenfolge ?? '?')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('font-semibold truncate', done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                          {s.kunde_name ?? 'Kunde'}
                        </div>
                        <div className="text-muted-foreground truncate">{s.adresse}</div>
                      </div>
                      {s.gesamtbetrag !== null && s.gesamtbetrag !== undefined && (
                        <div className={cn('shrink-0 tabular-nums font-bold', done ? 'text-muted-foreground' : 'text-foreground')}>
                          {fmtEur(s.gesamtbetrag)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
