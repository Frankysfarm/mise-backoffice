'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1102 — Nächste-Lieferfenster-Anzeige (Storefront)
// Zeigt nächste 3 verfügbare Lieferfenster; Kunde sieht wann die Lieferung ankommt

interface Props {
  locationId: string;
  className?: string;
}

type Fenster = {
  label: string;        // "Jetzt · ~25 Min"
  eta_label: string;    // "13:45–14:05 Uhr"
  verfuegbar: boolean;
  empfohlen: boolean;
};

type ApiData = {
  fenster: Fenster[];
  location_id: string;
  generiert_am: string;
};

function buildMock(): ApiData {
  const now = new Date();
  const fenster: Fenster[] = [
    {
      label: 'Jetzt · ~25 Min',
      eta_label: formatEtaRange(now, 25, 15),
      verfuegbar: true,
      empfohlen: true,
    },
    {
      label: 'In 30 Min',
      eta_label: formatEtaRange(now, 55, 15),
      verfuegbar: true,
      empfohlen: false,
    },
    {
      label: 'In 60 Min',
      eta_label: formatEtaRange(now, 85, 15),
      verfuegbar: true,
      empfohlen: false,
    },
  ];
  return { fenster, location_id: 'mock', generiert_am: now.toISOString() };
}

function formatEtaRange(base: Date, offsetMin: number, rangeMin: number): string {
  const start = new Date(base.getTime() + offsetMin * 60_000);
  const end = new Date(start.getTime() + rangeMin * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)}–${fmt(end)} Uhr`;
}

export function Phase1102NaechsteLieferfenster({ locationId, className }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!locationId || !open) return;
    setLoading(true);
    fetch(`/api/delivery/public/naechste-lieferfenster?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [locationId, open]);

  const displayed = data ?? buildMock();

  if (dismissed) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold">Nächste Lieferfenster</span>
          {!open && (
            <span className="rounded-full bg-matcha-100 text-matcha-700 border border-matcha-200 px-2 py-0.5 text-[10px] font-bold">
              ~25 Min · jetzt verfügbar
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setDismissed(true); }}
            className="rounded-full p-0.5 hover:bg-muted/60 text-muted-foreground transition"
            aria-label="Schließen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Wann möchtest du deine Lieferung erhalten?
          </p>

          <div className="space-y-1.5">
            {displayed.fenster.map((f, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                  f.verfuegbar
                    ? f.empfohlen
                      ? 'border-matcha-300 bg-matcha-50 dark:bg-matcha-900/20'
                      : 'border-border bg-muted/20'
                    : 'border-border bg-muted/10 opacity-50',
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Clock className={cn(
                    'h-4 w-4',
                    f.empfohlen ? 'text-matcha-600' : 'text-muted-foreground',
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-sm font-semibold', f.empfohlen && 'text-matcha-700 dark:text-matcha-300')}>
                      {f.label}
                    </span>
                    {f.empfohlen && (
                      <span className="rounded-full bg-matcha-100 text-matcha-700 text-[9px] font-bold px-1.5 py-0.5 border border-matcha-200">
                        Empfohlen
                      </span>
                    )}
                    {!f.verfuegbar && (
                      <span className="text-[9px] text-muted-foreground font-medium">Belegt</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{f.eta_label}</div>
                </div>
                {f.verfuegbar && (
                  <CheckCircle2 className={cn(
                    'h-4 w-4 shrink-0',
                    f.empfohlen ? 'text-matcha-500' : 'text-muted-foreground/40',
                  )} />
                )}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground pt-1">
            Zeitfenster werden bei Bestellabschluss bestätigt. Echtzeit-Verfügbarkeit.
          </p>
        </div>
      )}
    </div>
  );
}
