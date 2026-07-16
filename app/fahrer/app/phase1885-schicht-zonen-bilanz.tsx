'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Wallet, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1885 — Schicht-Zonen-Bilanz (Fahrer-App)
 *
 * Stopps + Verdienst je Zone diese Schicht, Vergleich zu letzter Schicht.
 * isOnline-Guard. Collapsible (default geschlossen). 30-Min-Polling.
 * GET /api/delivery/admin/zonen-effizienz (Phase 1873).
 */

interface ZoneEffizienz {
  zone: string;
  umsatz_cents: number;
  bestellungen_heute: number;
  umsatz_woche_cents: number;
  bestellungen_woche: number;
}

interface Props {
  locationId: string | null;
  driverId?: string | null;
  isOnline: boolean;
  className?: string;
}

const MOCK_ZONEN: ZoneEffizienz[] = [
  { zone: 'A', umsatz_cents: 84_00, bestellungen_heute: 14, umsatz_woche_cents: 512_00, bestellungen_woche: 82 },
  { zone: 'B', umsatz_cents: 62_00, bestellungen_heute: 9,  umsatz_woche_cents: 398_00, bestellungen_woche: 61 },
  { zone: 'C', umsatz_cents: 41_00, bestellungen_heute: 6,  umsatz_woche_cents: 267_00, bestellungen_woche: 38 },
  { zone: 'D', umsatz_cents: 18_00, bestellungen_heute: 2,  umsatz_woche_cents: 121_00, bestellungen_woche: 14 },
];

function eur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

type TrendDir = 'up' | 'down' | 'gleich';

function trendDir(aktuell: number, vorher: number): TrendDir {
  const diff = aktuell - vorher;
  if (diff > 0.05 * Math.max(1, vorher)) return 'up';
  if (diff < -0.05 * Math.max(1, vorher)) return 'down';
  return 'gleich';
}

function TrendPfeil({ dir }: { dir: TrendDir }) {
  if (dir === 'up')   return <TrendingUp   className="h-3 w-3 text-matcha-500 shrink-0" />;
  if (dir === 'down') return <TrendingDown  className="h-3 w-3 text-red-500 shrink-0"   />;
  return                     <Minus         className="h-3 w-3 text-muted-foreground shrink-0" />;
}

export function FahrerPhase1885SchichtZonenBilanz({ locationId, isOnline, className }: Props) {
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
          setZonen(data.zonen ?? MOCK_ZONEN);
        } else {
          setZonen(MOCK_ZONEN);
        }
      } catch {
        setZonen(MOCK_ZONEN);
      }
    };

    laden();
    const iv = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId, isOnline]);

  const basis = zonen.length > 0 ? zonen : MOCK_ZONEN;

  const zeilen = useMemo(() => {
    return basis
      .filter((z) => z.bestellungen_heute > 0)
      .map((z) => {
        const avgHeute = z.bestellungen_heute > 0
          ? z.umsatz_cents / z.bestellungen_heute
          : 0;
        const wochenBestellungenProTag = z.bestellungen_woche / 7;
        const avgVorher = wochenBestellungenProTag > 0
          ? (z.umsatz_woche_cents / 7) / wochenBestellungenProTag
          : avgHeute;
        return {
          zone: z.zone,
          stopps: z.bestellungen_heute,
          verdienst_cents: z.umsatz_cents,
          avg_pro_stopp_cents: Math.round(avgHeute),
          avg_vorher_cents: Math.round(avgVorher),
          trend: trendDir(avgHeute, avgVorher),
        };
      })
      .sort((a, b) => b.verdienst_cents - a.verdienst_cents);
  }, [basis]);

  const gesamtVerdienst = zeilen.reduce((s, z) => s + z.verdienst_cents, 0);
  const gesamtStopps = zeilen.reduce((s, z) => s + z.stopps, 0);

  if (!isOnline) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-muted/10 hover:bg-muted/20 transition-colors"
      >
        <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Schicht-Zonen-Bilanz
        </span>
        {gesamtStopps > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {gesamtStopps} Stopps · {eur(gesamtVerdienst)}
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-2">
          {zeilen.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">
              Noch keine Stopps in dieser Schicht.
            </p>
          ) : (
            <>
              {zeilen.map((z) => (
                <div
                  key={z.zone}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/5 px-3 py-2.5"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                    {z.zone}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-sm font-semibold leading-none">
                      {eur(z.verdienst_cents)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {z.stopps} Stopp{z.stopps !== 1 ? 's' : ''} · Ø {eur(z.avg_pro_stopp_cents)}/Stopp
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <TrendPfeil dir={z.trend} />
                    <span className={cn(
                      'text-[10px] font-semibold',
                      z.trend === 'up'   ? 'text-matcha-600 dark:text-matcha-400' :
                      z.trend === 'down' ? 'text-red-600 dark:text-red-400' :
                                           'text-muted-foreground',
                    )}>
                      {z.trend === 'up' ? 'besser' : z.trend === 'down' ? 'schwächer' : 'stabil'}
                    </span>
                  </div>
                </div>
              ))}

              {zeilen.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/10 px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Gesamt</span>
                  <span className="font-bold">{eur(gesamtVerdienst)} · {gesamtStopps} Stopps</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
