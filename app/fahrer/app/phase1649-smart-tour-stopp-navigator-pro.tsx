'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Clock, CheckCircle2, ChevronDown, ChevronUp, Zap, Package } from 'lucide-react';

/**
 * Phase 1649 — Smart-Tour-Stopp-Navigator-Pro (Fahrer-App)
 *
 * Übersicht aller Tour-Stops mit Priorität, ETA, Reihenfolge.
 * Farbkodierung: Grün (erledigt), Blau (aktuell), Grau (ausstehend).
 * Mobile-first, kompakt.
 */

interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  order?: {
    id: string;
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string;
    gesamtbetrag?: number;
  } | null;
  eta_min?: number | null;
}

interface Props {
  stops: Stop[];
  currentStopId?: string | null;
  onNavigate?: (address: string) => void;
}

function stopStatus(stop: Stop): 'done' | 'current' | 'next' | 'pending' {
  if (stop.geliefert_am) return 'done';
  if (stop.angekommen_am) return 'current';
  return 'pending';
}

const STATUS_STYLE = {
  done:    { border: 'border-matcha-300 dark:border-matcha-700', bg: 'bg-matcha-50 dark:bg-matcha-900/20', dot: 'bg-matcha-500', text: 'text-matcha-700 dark:text-matcha-300', label: 'Geliefert' },
  current: { border: 'border-blue-300 dark:border-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700 dark:text-blue-300', label: 'Aktuell' },
  next:    { border: 'border-amber-300 dark:border-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300', label: 'Nächster' },
  pending: { border: 'border-border', bg: 'bg-muted/20', dot: 'bg-zinc-400', text: 'text-muted-foreground', label: 'Ausstehend' },
};

export function FahrerPhase1649SmartTourStoppNavigatorPro({ stops, currentStopId, onNavigate }: Props) {
  const [open, setOpen] = useState(true);

  const enriched = useMemo(() => {
    const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
    let nextAssigned = false;
    return sorted.map(s => {
      let status = stopStatus(s);
      if (status === 'pending' && !nextAssigned) {
        status = 'next';
        nextAssigned = true;
      }
      if (s.id === currentStopId && status !== 'done') status = 'current';
      return { ...s, status };
    });
  }, [stops, currentStopId]);

  const done = enriched.filter(s => s.status === 'done').length;
  const total = enriched.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-sm font-semibold">Tour-Stops</span>
          <span className="text-[10px] text-muted-foreground">{done}/{total} erledigt</span>
          {done === total && total > 0 && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/30 border border-matcha-300 px-1.5 py-0.5 text-[9px] font-bold text-matcha-700 dark:text-matcha-300">
              ✓ Komplett
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2">
          {enriched.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Keine Stops in dieser Tour.</p>
          )}
          {enriched.map(s => {
            const style = STATUS_STYLE[s.status as keyof typeof STATUS_STYLE];
            const address = s.order?.kunde_adresse ?? '';
            const name = s.order?.kunde_name ?? 'Kunde';
            const nr = s.order?.bestellnummer ?? s.order?.id?.slice(0, 6) ?? '?';
            const betrag = s.order?.gesamtbetrag;

            return (
              <div key={s.id} className={cn('rounded-lg border p-3', style.bg, style.border)}>
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <div className={cn('w-2.5 h-2.5 rounded-full', style.dot)} />
                    {s.status === 'done' && <CheckCircle2 className="h-3 w-3 text-matcha-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-muted-foreground">#{s.reihenfolge}</span>
                        <span className="text-xs font-bold truncate">{name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.status === 'next' && (
                          <span className="flex items-center gap-0.5 rounded bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-bold">
                            <Zap className="h-2.5 w-2.5" />
                            Nächster
                          </span>
                        )}
                        {s.status === 'current' && (
                          <span className="flex items-center gap-0.5 rounded bg-blue-600 text-white px-1.5 py-0.5 text-[9px] font-bold animate-pulse">
                            Aktuell
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Package className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground">#{nr}</span>
                      {betrag != null && (
                        <span className="text-[10px] font-bold text-foreground ml-1">
                          {betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      )}
                    </div>
                    {address && (
                      <div className="flex items-start gap-1 mt-1">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-[10px] text-muted-foreground leading-tight">{address}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      {s.eta_min != null && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">ETA ~{s.eta_min} Min</span>
                        </div>
                      )}
                      {(s.status === 'next' || s.status === 'current') && address && onNavigate && (
                        <button
                          onClick={() => onNavigate(address)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 text-white px-2 py-1 text-[10px] font-bold hover:bg-blue-700 transition"
                        >
                          <Navigation className="h-3 w-3" />
                          Navi starten
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
