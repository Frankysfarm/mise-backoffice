'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, MapPin, Navigation, Package, Phone, Zap } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

/* ── Typen ─────────────────────────────────────────────────────────────── */
export interface TourStop {
  id: string;
  reihenfolge: number;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  kunde_telefon?: string | null;
  gesamtbetrag?: number | null;
  geliefert_am?: string | null;
  eta_min?: number | null;
  distanz_km?: number | null;
  notizen?: string | null;
}

type Status = 'erledigt' | 'aktuell' | 'naechster' | 'offen';

const STATUS: Record<Status, { label: string; dot: string; bg: string; border: string; textColor: string }> = {
  erledigt:  { label: '✓ Erledigt',     dot: 'bg-matcha-500',  bg: 'bg-muted/10',                              border: 'border-border',                         textColor: 'text-matcha-600 dark:text-matcha-400' },
  aktuell:   { label: '▶ Jetzt',         dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30',           border: 'border-blue-300 dark:border-blue-700',  textColor: 'text-blue-700 dark:text-blue-300' },
  naechster: { label: '→ Als Nächstes',  dot: 'bg-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30',         border: 'border-amber-300 dark:border-amber-700',textColor: 'text-amber-700 dark:text-amber-300' },
  offen:     { label: '○ Ausstehend',    dot: 'bg-muted-foreground', bg: 'bg-card',                             border: 'border-border',                         textColor: 'text-muted-foreground' },
};

function getStatus(stop: TourStop, idx: number, currentIdx: number): Status {
  if (stop.geliefert_am) return 'erledigt';
  if (idx === currentIdx) return 'aktuell';
  if (idx === currentIdx + 1) return 'naechster';
  return 'offen';
}

/* ── Navigation-Buttons ─────────────────────────────────────────────────── */
function NavButtons({ adresse, telefon }: { adresse?: string | null; telefon?: string | null }) {
  if (!adresse && !telefon) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {adresse && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(adresse)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-blue-400 active:scale-95 transition-all"
        >
          <Navigation className="h-3 w-3" /> Google Maps
        </a>
      )}
      {adresse && (
        <a
          href={`waze://?q=${encodeURIComponent(adresse ?? '')}&navigate=yes`}
          className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-cyan-400 active:scale-95 transition-all"
        >
          <Zap className="h-3 w-3" /> Waze
        </a>
      )}
      {telefon && (
        <a
          href={`tel:${telefon}`}
          className="flex items-center gap-1.5 rounded-lg bg-matcha-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-matcha-400 active:scale-95 transition-all"
        >
          <Phone className="h-3 w-3" /> Anrufen
        </a>
      )}
    </div>
  );
}

/* ── Stop-Karte ─────────────────────────────────────────────────────────── */
function StopKarte({ stop, idx, total, status }: { stop: TourStop; idx: number; total: number; status: Status }) {
  const cfg = STATUS[status];
  const [expanded, setExpanded] = useState(status === 'aktuell' || status === 'naechster');

  return (
    <div className={cn('rounded-xl border transition-all overflow-hidden', cfg.bg, cfg.border)}>
      <button
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Nummer */}
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white', cfg.dot)}>
          {stop.geliefert_am ? <CheckCircle2 className="h-4 w-4" /> : <span>{idx + 1}</span>}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate text-xs font-bold">{stop.kunde_name ?? `Stopp ${idx + 1}`}</p>
            <span className={cn('rounded px-1 py-0.5 text-[8px] font-bold', cfg.textColor)}>
              {cfg.label}
            </span>
          </div>
          <p className="truncate text-[10px] text-muted-foreground">{stop.kunde_adresse ?? '—'}</p>
        </div>

        {/* Meta */}
        <div className="shrink-0 text-right space-y-0.5">
          {stop.eta_min != null && !stop.geliefert_am && (
            <p className={cn('text-[10px] font-bold tabular-nums', cfg.textColor)}>{stop.eta_min} Min</p>
          )}
          {stop.gesamtbetrag != null && (
            <p className="text-[9px] text-muted-foreground">{euro(stop.gesamtbetrag)}</p>
          )}
          <p className="text-[9px] text-muted-foreground">{idx + 1}/{total}</p>
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {/* Detail-Bereich */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {stop.distanz_km != null && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {stop.distanz_km.toFixed(1)} km
              </div>
            )}
            {stop.eta_min != null && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" /> ~{stop.eta_min} Min
              </div>
            )}
            {stop.gesamtbetrag != null && (
              <div className="flex items-center gap-1 font-bold">
                <Package className="h-3 w-3" /> {euro(stop.gesamtbetrag)}
              </div>
            )}
            {stop.geliefert_am && (
              <div className={cn('flex items-center gap-1 font-bold', cfg.textColor)}>
                <CheckCircle2 className="h-3 w-3" />
                {new Date(stop.geliefert_am).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            )}
          </div>
          {stop.notizen && (
            <p className="text-[10px] bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1 text-amber-700 dark:text-amber-300">
              Hinweis: {stop.notizen}
            </p>
          )}
          <NavButtons adresse={stop.kunde_adresse} telefon={stop.kunde_telefon} />
        </div>
      )}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function FahrerPhase2290TourStoppNaviKommando({
  stops = [],
  batchId,
}: {
  stops?: TourStop[];
  batchId?: string | null;
}) {
  const [open, setOpen] = useState(true);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const currentIdx = useMemo(() => {
    const first = sorted.findIndex(s => !s.geliefert_am);
    return first >= 0 ? first : sorted.length - 1;
  }, [sorted]);

  const done = sorted.filter(s => s.geliefert_am).length;
  const total = sorted.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const current = sorted[currentIdx];
  const naechsteEta = current?.eta_min ?? null;

  if (total === 0) return null;

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
            <Navigation className="h-4 w-4 text-blue-600" />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold">Stopp-Kommando</p>
            <p className="text-[10px] text-muted-foreground">{done}/{total} erledigt · {pct}%</p>
          </div>
          {naechsteEta != null && done < total && (
            <span className="flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300">
              <Zap className="h-3 w-3" /> {naechsteEta} Min
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Fortschrittsbalken */}
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {open && (
        <>
          {/* Stop-Kacheln */}
          <div className="space-y-2">
            {sorted.map((stop, idx) => (
              <StopKarte
                key={stop.id}
                stop={stop}
                idx={idx}
                total={total}
                status={getStatus(stop, idx, currentIdx)}
              />
            ))}
          </div>

          {/* Abschluss */}
          {done === total && total > 0 && (
            <div className="rounded-xl bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 dark:border-matcha-800 py-3 text-center">
              <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-matcha-500" />
              <p className="text-sm font-bold text-matcha-700 dark:text-matcha-300">Tour abgeschlossen!</p>
              <p className="text-[10px] text-muted-foreground">Alle {total} Stopps erfolgreich beliefert</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
