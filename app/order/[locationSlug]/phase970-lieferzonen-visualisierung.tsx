'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Phase 970 — Lieferzonen-Visualisierung (Storefront)
 *
 * Interaktive Übersicht der verfügbaren Lieferzonen A/B/C/D
 * mit geschätzter ETA + Liefergebühr + Auslastung je Zone.
 * 5-Min-Polling.
 */

interface ZoneInfo {
  zone: 'A' | 'B' | 'C' | 'D';
  label: string;
  beschreibung: string;
  eta_min_min: number;
  eta_min_max: number;
  liefergebuehr_eur: number;
  auslastung: 'niedrig' | 'normal' | 'hoch' | 'voll';
  aktive_bestellungen: number;
  verfuegbar: boolean;
}

interface ApiResponse {
  zonen: ZoneInfo[];
}

interface Props {
  locationId: string;
}

const ZONE_COLORS: Record<string, { ring: string; bg: string; text: string; dot: string }> = {
  A: { ring: 'border-matcha-400', bg: 'bg-matcha-50 dark:bg-matcha-950/30', text: 'text-matcha-700 dark:text-matcha-300', dot: 'bg-matcha-500' },
  B: { ring: 'border-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  C: { ring: 'border-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  D: { ring: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
};

const AUSLASTUNG_CONFIG: Record<ZoneInfo['auslastung'], { label: string; color: string }> = {
  niedrig: { label: 'Schnell verfügbar', color: 'text-matcha-600' },
  normal: { label: 'Normal', color: 'text-blue-600' },
  hoch: { label: 'Hohe Nachfrage', color: 'text-amber-600' },
  voll: { label: 'Ausgelastet', color: 'text-red-600' },
};

function ZoneKarte({ zone }: { zone: ZoneInfo }) {
  const colors = ZONE_COLORS[zone.zone] ?? ZONE_COLORS['A'];
  const auslastung = AUSLASTUNG_CONFIG[zone.auslastung];

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-3 transition-all',
        colors.ring,
        colors.bg,
        !zone.verfuegbar && 'opacity-60',
      )}
    >
      {/* Zone badge */}
      <div className="flex items-start justify-between mb-2">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black',
          colors.bg,
          colors.text,
          'border border-current',
        )}>
          {zone.zone}
        </div>
        {zone.verfuegbar ? (
          <CheckCircle className="h-4 w-4 text-matcha-500 shrink-0" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}
      </div>

      {/* Beschreibung */}
      <div className="mb-2">
        <div className="text-[11px] font-bold text-foreground/80">{zone.beschreibung}</div>
        <div className={cn('text-[10px] font-medium', auslastung.color)}>
          {auslastung.label}
        </div>
      </div>

      {/* ETA */}
      <div className="flex items-center gap-1 mb-1.5">
        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          {zone.eta_min_min}–{zone.eta_min_max} Min
        </span>
      </div>

      {/* Liefergebühr */}
      <div className={cn(
        'rounded-md px-2 py-1 text-center text-[11px] font-bold',
        zone.liefergebuehr_eur === 0
          ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
          : 'bg-muted text-muted-foreground',
      )}>
        {zone.liefergebuehr_eur === 0 ? 'Kostenlos' : `€${zone.liefergebuehr_eur.toFixed(2)} Liefergebühr`}
      </div>

      {!zone.verfuegbar && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-stone-100/80 dark:bg-stone-900/80">
          <span className="rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-1 text-[10px] font-bold text-red-700 dark:text-red-300">
            Nicht verfügbar
          </span>
        </div>
      )}
    </div>
  );
}

export function Phase970LieferzonenVisualisierung({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [zonen, setZonen] = useState<ZoneInfo[]>([]);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/storefront/lieferzonen?location_id=${locationId}`);
        if (!res.ok) return;
        const json: ApiResponse = await res.json();
        setZonen(json.zonen ?? []);
      } catch {
        // silent
      }
    };

    laden();
    const interval = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationId]);

  if (zonen.length === 0) return null;

  const verfuegbareZonen = zonen.filter((z) => z.verfuegbar).length;
  const schnellsteEta = zonen.filter((z) => z.verfuegbar).reduce(
    (min, z) => Math.min(min, z.eta_min_min),
    Infinity,
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-950/20 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-stone-600" />
          <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
            Lieferzonen-Übersicht
          </span>
          {schnellsteEta < Infinity && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/50 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
              ab {schnellsteEta} Min
            </span>
          )}
          <span className="rounded-full bg-stone-200 dark:bg-stone-700 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-300">
            {verfuegbareZonen}/{zonen.length} Zonen aktiv
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-stone-500" />
          : <ChevronDown className="h-4 w-4 text-stone-500" />}
      </button>

      {open && (
        <div className="border-t border-stone-200 dark:border-stone-700 px-4 py-4">
          {/* Konzentrische-Ringe-Visualisierung */}
          <div className="relative flex items-center justify-center mb-4 h-32">
            {/* Outer rings */}
            {['D', 'C', 'B', 'A'].map((z, i) => {
              const size = 120 - i * 26;
              const zoneData = zonen.find((zone) => zone.zone === z);
              const colors = ZONE_COLORS[z];
              return (
                <div
                  key={z}
                  className={cn(
                    'absolute rounded-full border-2 flex items-center justify-center',
                    colors.ring,
                    colors.bg,
                    !zoneData?.verfuegbar && 'opacity-40',
                  )}
                  style={{ width: size, height: size }}
                >
                  {i === 3 && (
                    <div className="flex flex-col items-center">
                      <MapPin className="h-4 w-4 text-matcha-600" />
                      <span className="text-[8px] font-bold text-matcha-700 mt-0.5">Restaurant</span>
                    </div>
                  )}
                  {i < 3 && (
                    <span className={cn(
                      'absolute font-black text-[9px]',
                      colors.text,
                    )}
                      style={{
                        top: '2px',
                        right: '6px',
                      }}
                    >
                      {z}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Zone cards grid */}
          <div className="grid grid-cols-2 gap-2">
            {zonen.map((zone) => (
              <ZoneKarte key={zone.zone} zone={zone} />
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Zone A = nächster Bereich · Zone D = weitester Bereich · ETAs sind Schätzungen
          </p>
        </div>
      )}
    </div>
  );
}
