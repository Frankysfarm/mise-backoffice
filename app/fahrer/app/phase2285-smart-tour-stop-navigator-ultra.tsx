'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Navigation, Package, Phone, ChevronRight, Zap } from 'lucide-react';

/* ── Typen ─────────────────────────────────────────────────────────────── */
interface Stop {
  id: string;
  reihenfolge: number;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  kunde_telefon?: string | null;
  gesamtbetrag?: number | null;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  eta_min?: number | null;
  distanz_km?: number | null;
}

type StopStatus = 'erledigt' | 'aktuell' | 'naechster' | 'ausstehend';

/* ── Stop-Status ────────────────────────────────────────────────────────── */
function getStopStatus(stop: Stop, currentIdx: number, idx: number): StopStatus {
  if (stop.geliefert_am) return 'erledigt';
  if (idx === currentIdx) return 'aktuell';
  if (idx === currentIdx + 1) return 'naechster';
  return 'ausstehend';
}

/* ── Status-Konfiguration ───────────────────────────────────────────────── */
const STATUS_CONFIG: Record<StopStatus, { bg: string; border: string; dot: string; label: string }> = {
  erledigt:   { bg: 'bg-muted/20',                 border: 'border-border',          dot: 'bg-matcha-500',       label: 'Erledigt' },
  aktuell:    { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', label: 'Jetzt' },
  naechster:  { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-400', label: 'Als Nächstes' },
  ausstehend: { bg: 'bg-card',                     border: 'border-border',          dot: 'bg-muted-foreground', label: 'Ausstehend' },
};

/* ── Navi-Button ────────────────────────────────────────────────────────── */
function NaviButton({ adresse }: { adresse: string | null | undefined }) {
  if (!adresse) return null;
  const encoded = encodeURIComponent(adresse);
  return (
    <a
      href={`https://maps.google.com/?q=${encoded}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-blue-400 transition-colors"
    >
      <Navigation className="h-3 w-3" /> Navigieren
    </a>
  );
}

/* ── Stop-Karte ─────────────────────────────────────────────────────────── */
function StopCard({
  stop,
  status,
  idx,
  total,
}: {
  stop: Stop;
  status: StopStatus;
  idx: number;
  total: number;
}) {
  const cfg = STATUS_CONFIG[status];
  const [expanded, setExpanded] = useState(status === 'aktuell');

  return (
    <div className={cn('rounded-xl border transition-all', cfg.bg, cfg.border)}>
      <button
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Nummer-Badge */}
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white', cfg.dot)}>
          {stop.geliefert_am ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-bold">{stop.kunde_name ?? `Stopp ${idx + 1}`}</p>
            <span className={cn('rounded px-1 py-0.5 text-[8px] font-bold text-white', cfg.dot)}>{cfg.label}</span>
          </div>
          <p className="truncate text-[10px] text-muted-foreground">{stop.kunde_adresse ?? '—'}</p>
        </div>

        {/* Meta */}
        <div className="shrink-0 text-right">
          {stop.eta_min && !stop.geliefert_am && (
            <p className="text-[10px] font-bold tabular-nums text-blue-600">{stop.eta_min} Min</p>
          )}
          {stop.gesamtbetrag && (
            <p className="text-[9px] text-muted-foreground">{euro(stop.gesamtbetrag)}</p>
          )}
          <p className="text-[9px] text-muted-foreground">{idx + 1}/{total}</p>
        </div>
      </button>

      {/* Aufgeklappte Details */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            {stop.kunde_adresse && (
              <NaviButton adresse={stop.kunde_adresse} />
            )}
            {stop.kunde_telefon && (
              <a
                href={`tel:${stop.kunde_telefon}`}
                className="flex items-center gap-1 rounded-lg bg-matcha-500 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-matcha-400 transition-colors"
              >
                <Phone className="h-3 w-3" /> Anrufen
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {stop.distanz_km && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {stop.distanz_km.toFixed(1)} km
              </div>
            )}
            {stop.eta_min && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" /> ~{stop.eta_min} Min
              </div>
            )}
            {stop.gesamtbetrag && (
              <div className="flex items-center gap-1 font-bold">
                <Package className="h-3 w-3" /> {euro(stop.gesamtbetrag)}
              </div>
            )}
            {stop.geliefert_am && (
              <div className="flex items-center gap-1 text-matcha-600 font-bold">
                <CheckCircle2 className="h-3 w-3" />
                {new Date(stop.geliefert_am).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function FahrerPhase2285SmartTourStopNavigatorUltra({ stops, batchId }: { stops: Stop[]; batchId?: string | null }) {
  const sorted = useMemo(() =>
    [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const currentIdx = useMemo(() => {
    const firstNotDone = sorted.findIndex(s => !s.geliefert_am);
    return firstNotDone >= 0 ? firstNotDone : sorted.length - 1;
  }, [sorted]);

  const done = sorted.filter(s => s.geliefert_am).length;
  const total = sorted.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (sorted.length === 0) return null;

  const current = sorted[currentIdx];
  const nextEta = current?.eta_min ?? null;

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
            <Navigation className="h-4 w-4 text-blue-600" />
          </span>
          <div>
            <p className="text-sm font-bold">Tour Navigator</p>
            <p className="text-[10px] text-muted-foreground">{done}/{total} erledigt</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nextEta && done < total && (
            <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              <Zap className="h-3 w-3" /> {nextEta} Min
            </span>
          )}
          <span className="text-[10px] font-bold text-muted-foreground">{pct}%</span>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-matcha-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stops */}
      <div className="space-y-2">
        {sorted.map((stop, idx) => (
          <StopCard
            key={stop.id}
            stop={stop}
            status={getStopStatus(stop, currentIdx, idx)}
            idx={idx}
            total={total}
          />
        ))}
      </div>

      {done === total && total > 0 && (
        <div className="rounded-xl bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 p-3 text-center">
          <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-matcha-500" />
          <p className="text-xs font-bold text-matcha-700">Tour abgeschlossen!</p>
          <p className="text-[10px] text-muted-foreground">Alle {total} Stopps erledigt</p>
        </div>
      )}
    </section>
  );
}
