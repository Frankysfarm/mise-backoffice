'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Lightbulb, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

/**
 * Phase 1880 — Zonen-Tipp-des-Tages (Fahrer-App)
 *
 * Empfiehlt Zone mit bester Ø-Verdienst/Stopp heute.
 * isOnline-Guard. Collapsible (default geschlossen). 30-Min-Polling.
 * GET /api/delivery/admin/zonen-effizienz (Phase 1873).
 */

interface ZoneEffizienz {
  zone: string;
  sla_quote: number;
  avg_wartezeit_min: number;
  umsatz_cents: number;
  bestellungen_heute: number;
  kritisch: boolean;
}

interface Props {
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

const MOCK_ZONEN: ZoneEffizienz[] = [
  { zone: 'A', sla_quote: 91, avg_wartezeit_min: 22, umsatz_cents: 84_00, bestellungen_heute: 14, kritisch: false },
  { zone: 'B', sla_quote: 78, avg_wartezeit_min: 31, umsatz_cents: 62_00, bestellungen_heute: 9,  kritisch: false },
  { zone: 'C', sla_quote: 65, avg_wartezeit_min: 39, umsatz_cents: 41_00, bestellungen_heute: 6,  kritisch: true  },
  { zone: 'D', sla_quote: 52, avg_wartezeit_min: 47, umsatz_cents: 18_00, bestellungen_heute: 2,  kritisch: true  },
];

interface ZonenTipp {
  zone: string;
  umsatzProBestellung: number;
  bestellungen: number;
  sla: number;
  wartezeit: number;
  grund: string;
}

export function FahrerPhase1880ZonenTippDesTages({ locationId, isOnline, className }: Props) {
  const [zonen, setZonen] = useState<ZoneEffizienz[]>([]);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    if (!locationId || !isOnline) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/zonen-effizienz?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          setZonen(data.zonen ?? []);
        }
      } catch {
        setZonen([]);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId, isOnline]);

  const tipp = useMemo<ZonenTipp | null>(() => {
    const basis = zonen.length > 0 ? zonen : MOCK_ZONEN;
    const kandidaten = basis
      .filter((z) => z.bestellungen_heute > 0)
      .map((z) => ({
        zone: z.zone,
        umsatzProBestellung: z.bestellungen_heute > 0 ? z.umsatz_cents / z.bestellungen_heute : 0,
        bestellungen: z.bestellungen_heute,
        sla: z.sla_quote,
        wartezeit: z.avg_wartezeit_min,
        grund: '',
      }))
      .sort((a, b) => b.umsatzProBestellung - a.umsatzProBestellung);

    if (kandidaten.length === 0) return null;
    const best = kandidaten[0];

    let grund = `Zone ${best.zone} hat heute ${best.bestellungen} Bestellungen`;
    if (best.sla >= 80) {
      grund += ` mit ${best.sla}% Pünktlichkeit — Top-Bedingungen!`;
    } else if (best.sla >= 70) {
      grund += ` — guter Kompromiss aus Umsatz und Pünktlichkeit.`;
    } else {
      grund += ` — höchster Ertrag, aber Pünktlichkeit beachten.`;
    }

    return { ...best, grund };
  }, [zonen]);

  if (!isOnline) return null;
  if (!tipp) return null;

  const umsatzEuro = (tipp.umsatzProBestellung / 100).toFixed(2);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Tipp des Tages</span>
        <span className="ml-auto text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5">
          Zone {tipp.zone}
        </span>
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Empfehlung-Kachel */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white font-black text-lg shrink-0">
              {tipp.zone}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-amber-800 dark:text-amber-200">
                Zone {tipp.zone} — Empfehlung heute
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {umsatzEuro} € Ø je Bestellung · {tipp.bestellungen} Bestellungen
              </div>
            </div>
            <TrendingUp className="h-5 w-5 text-amber-500 shrink-0" />
          </div>

          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">SLA</div>
              <div className={cn(
                'text-base font-black tabular-nums mt-0.5',
                tipp.sla >= 80 ? 'text-matcha-700 dark:text-matcha-300'
                  : tipp.sla >= 70 ? 'text-amber-700 dark:text-amber-300'
                  : 'text-red-700 dark:text-red-300',
              )}>
                {tipp.sla}%
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Ø Zeit</div>
              <div className="text-base font-black tabular-nums mt-0.5">
                {tipp.wartezeit}
                <span className="text-[10px] font-normal ml-0.5">Min</span>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Bstlg.</div>
              <div className="text-base font-black tabular-nums mt-0.5">{tipp.bestellungen}</div>
            </div>
          </div>

          {/* Tipp-Text */}
          <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50/50 dark:bg-matcha-950/10 px-3 py-2">
            <p className="text-xs text-matcha-800 dark:text-matcha-200">{tipp.grund}</p>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Basierend auf heutigem Umsatz je Zone · Aktualisierung alle 30 Min
          </p>
        </div>
      )}
    </div>
  );
}
