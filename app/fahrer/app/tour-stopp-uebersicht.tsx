'use client';

import { useEffect, useState } from 'react';
import { MapPin, CheckCircle2, Clock, Navigation, Package, Phone, ChevronRight } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface TourStop {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  distanz_zum_vorgaenger_m: number | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_telefon?: string | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    kunde_notiz?: string | null;
  };
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDist(m: number | null): string {
  if (m === null) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function TourStoppUebersicht({
  stops,
  currentStopId,
}: {
  stops: TourStop[];
  currentStopId?: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(currentStopId ?? null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = sorted.filter((s) => s.geliefert_am).length;
  const totalCount = sorted.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (totalCount === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Package className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground">Tour-Stopps</div>
          <div className="text-[10px] text-muted-foreground">
            {doneCount} von {totalCount} geliefert
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-matcha-600">{progressPct}%</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Fertig</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stop list */}
      <div className="divide-y divide-border/40">
        {sorted.map((stop, idx) => {
          const isDone = !!stop.geliefert_am;
          const isCurrent = stop.id === currentStopId && !isDone;
          const isExpanded = expanded === stop.id;
          const eta = stop.order.eta_earliest;
          const etaMin = eta
            ? Math.round((new Date(eta).getTime() - now) / 60_000)
            : null;

          return (
            <div
              key={stop.id}
              className={cn(
                'transition-colors',
                isDone && 'bg-muted/20',
                isCurrent && 'bg-matcha-50 border-l-4 border-l-matcha-500',
              )}
            >
              {/* Stop row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : stop.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {/* Step indicator */}
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-black text-[11px]',
                  isDone
                    ? 'border-matcha-400 bg-matcha-500 text-white'
                    : isCurrent
                    ? 'border-matcha-500 bg-matcha-100 text-matcha-700 animate-pulse'
                    : 'border-border bg-background text-muted-foreground',
                )}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      'font-mono text-[12px] font-black',
                      isDone ? 'text-muted-foreground' : 'text-foreground',
                    )}>
                      #{stop.order.bestellnummer.slice(-4)}
                    </span>
                    <span className={cn(
                      'text-[12px] font-semibold truncate',
                      isDone ? 'text-muted-foreground' : 'text-foreground',
                    )}>
                      {stop.order.kunde_name}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-matcha-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                        Jetzt
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    'text-[11px] truncate',
                    isDone ? 'text-muted-foreground/60' : 'text-muted-foreground',
                  )}>
                    {stop.order.kunde_adresse}{stop.order.kunde_plz ? `, ${stop.order.kunde_plz}` : ''}
                  </div>
                </div>

                {/* Right side: ETA or done time */}
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  {isDone ? (
                    <span className="text-[11px] font-bold text-matcha-600">
                      {fmtTime(stop.geliefert_am)}
                    </span>
                  ) : etaMin !== null ? (
                    <span className={cn(
                      'text-[11px] font-bold tabular-nums',
                      etaMin < 0 ? 'text-red-600' : etaMin < 5 ? 'text-amber-600' : 'text-matcha-600',
                    )}>
                      {etaMin < 0 ? `+${Math.abs(etaMin)}m spät` : `~${etaMin}m`}
                    </span>
                  ) : null}
                  {stop.distanz_zum_vorgaenger_m && idx > 0 && (
                    <span className="text-[9px] text-muted-foreground">
                      {fmtDist(stop.distanz_zum_vorgaenger_m)}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    'h-3.5 w-3.5 text-muted-foreground/50 transition-transform',
                    isExpanded && 'rotate-90',
                  )} />
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 pt-1 ml-10 space-y-2">
                  {/* Payment info */}
                  <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-[11px] font-bold text-foreground">
                      {euro(stop.order.gesamtbetrag)}
                    </span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-bold',
                      stop.order.bezahlt
                        ? 'bg-matcha-100 text-matcha-700'
                        : 'bg-amber-100 text-amber-700',
                    )}>
                      {stop.order.bezahlt ? 'Bezahlt' : stop.order.zahlungsart === 'bar' ? 'Bar kassieren' : 'Ausstehend'}
                    </span>
                  </div>

                  {/* Customer note */}
                  {stop.order.kunde_notiz && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <div className="text-[9px] font-black uppercase tracking-wider text-amber-600 mb-0.5">
                        Kundenhinweis
                      </div>
                      <div className="text-[11px] text-amber-800">{stop.order.kunde_notiz}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {stop.order.kunde_telefon && (
                      <a
                        href={`tel:${stop.order.kunde_telefon}`}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-[11px] font-bold text-blue-700"
                      >
                        <Phone className="h-3 w-3" />
                        Anrufen
                      </a>
                    )}
                    {stop.order.kunde_adresse && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(
                          `${stop.order.kunde_adresse} ${stop.order.kunde_plz ?? ''}`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-1.5 text-[11px] font-bold text-matcha-700"
                      >
                        <Navigation className="h-3 w-3" />
                        Navigation
                      </a>
                    )}
                  </div>

                  {/* Timestamps */}
                  {(stop.angekommen_am || stop.geliefert_am) && (
                    <div className="flex gap-4 text-[9px] text-muted-foreground">
                      {stop.angekommen_am && (
                        <span>Angekommen: {fmtTime(stop.angekommen_am)}</span>
                      )}
                      {stop.geliefert_am && (
                        <span>Geliefert: {fmtTime(stop.geliefert_am)}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {doneCount === totalCount && totalCount > 0 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 bg-matcha-50 border-t border-matcha-200">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-black text-matcha-700">Alle Stopps abgeschlossen!</span>
        </div>
      )}
    </div>
  );
}
