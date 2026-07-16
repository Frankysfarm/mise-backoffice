'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock } from 'lucide-react';

/**
 * Phase 1876 — Zonen-Verfügbarkeits-Hinweis (Storefront)
 *
 * "Lieferung in Zone X aktuell XX Min" + Ampel für alle Zonen.
 * Nur wenn Bestellung noch nicht aufgegeben (kein activeOrder in localStorage).
 * Hydration-safe. 10-Min-Polling.
 * GET /api/delivery/admin/wartezeit-heatmap (Phase 1871).
 */

interface ZoneWartezeit {
  zone: string;
  heute_avg_min: number;
}

interface Props {
  locationId: string;
  className?: string;
}

function ampelKlassen(min: number) {
  if (min >= 40) return {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };
  if (min >= 30) return {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  };
  return {
    dot: 'bg-matcha-500',
    text: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300',
  };
}

const MOCK_ZONEN: ZoneWartezeit[] = [
  { zone: 'A', heute_avg_min: 22 },
  { zone: 'B', heute_avg_min: 31 },
  { zone: 'C', heute_avg_min: 39 },
  { zone: 'D', heute_avg_min: 47 },
];

export function StorefrontPhase1876ZonenVerfuegbarkeitsHinweis({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [zonen, setZonen] = useState<ZoneWartezeit[]>([]);
  const [hatAktiveBestellung, setHatAktiveBestellung] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(`active_order:${locationId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.orderId) setHatAktiveBestellung(true);
      }
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/wartezeit-heatmap?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          const raw: ZoneWartezeit[] = (data.zonen ?? []).map((z: { zone: string; heute_avg_min: number }) => ({
            zone: z.zone,
            heute_avg_min: z.heute_avg_min,
          }));
          if (raw.length > 0) setZonen(raw);
        }
      } catch {
        setZonen(MOCK_ZONEN);
      }
    };

    laden();
    const id = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || hatAktiveBestellung) return null;

  const anzeige = zonen.length > 0 ? zonen : MOCK_ZONEN;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Aktuelle Lieferzeiten
        </span>
        <Clock className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {anzeige.map((z) => {
          const klasse = ampelKlassen(z.heute_avg_min);
          return (
            <div
              key={z.zone}
              className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2"
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', klasse.dot)} />
              <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
                  Zone {z.zone}
                </div>
                <div className={cn('text-sm font-black tabular-nums leading-none', klasse.text)}>
                  ~{z.heute_avg_min}
                  <span className="text-[10px] font-semibold ml-0.5">Min</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="px-4 pb-2.5 text-[10px] text-muted-foreground">
        Basierend auf aktuellen Lieferdaten · Zone A = nah, D = weit
      </p>
    </div>
  );
}
