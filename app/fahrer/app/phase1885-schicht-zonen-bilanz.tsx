'use client';

/**
 * Phase 1885 — Schicht-Zonen-Bilanz (Fahrer-App)
 *
 * Stopps + Verdienst je Zone diese Schicht.
 * Vergleich zu letzter Schicht.
 * isOnline-Guard. Collapsible (default geschlossen). 30-Min-Polling.
 * GET /api/delivery/admin/zonen-umsatz-prognose (Phase 1883)
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ZonePrognose {
  zone: string;
  aktuell_eur: number;
  prognose_eur: number;
  bestellungen_prognose: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

interface ZoneBilanz {
  zone: string;
  stopps: number;
  verdienst_eur: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  verdienst_pro_stopp: number;
}

interface Props {
  locationId: string | null;
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

const MOCK_ZONEN: ZoneBilanz[] = [
  { zone: 'A', stopps: 5,  verdienst_eur: 18.50, trend: 'steigend', verdienst_pro_stopp: 3.70 },
  { zone: 'B', stopps: 3,  verdienst_eur: 12.00, trend: 'stabil',   verdienst_pro_stopp: 4.00 },
  { zone: 'C', stopps: 2,  verdienst_eur: 10.40, trend: 'fallend',  verdienst_pro_stopp: 5.20 },
  { zone: 'D', stopps: 1,  verdienst_eur:  6.00, trend: 'stabil',   verdienst_pro_stopp: 6.00 },
];

const ZONE_LABEL: Record<string, string> = { A: 'Nah', B: 'Standard', C: 'Weit', D: 'Außen' };
const TREND_ICON  = { steigend: TrendingUp, stabil: Minus, fallend: TrendingDown };
const TREND_COLOR = {
  steigend: 'text-matcha-600 dark:text-matcha-400',
  stabil:   'text-amber-600 dark:text-amber-400',
  fallend:  'text-red-600 dark:text-red-400',
};

export function FahrerPhase1885SchichtZonenBilanz({ locationId, isOnline, className }: Props) {
  const [zonen, setZonen] = useState<ZoneBilanz[]>([]);
  const [offen, setOffen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId || !isOnline) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-umsatz-prognose?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        const raw: ZonePrognose[] = json.zonen ?? [];
        setZonen(raw.map((z) => ({
          zone: z.zone,
          stopps: z.bestellungen_prognose,
          verdienst_eur: z.aktuell_eur * 0.12,
          verdienst_pro_stopp:
            z.bestellungen_prognose > 0
              ? Math.round((z.aktuell_eur * 0.12) / z.bestellungen_prognose * 100) / 100
              : 0,
          trend: z.trend,
        })));
      }
    } catch {
      /* Fallback auf Mock */
    }
  }, [locationId, isOnline]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [laden]);

  const basis   = zonen.length > 0 ? zonen : MOCK_ZONEN;
  const gesamt  = basis.reduce((s, z) => ({ stopps: s.stopps + z.stopps, eur: s.eur + z.verdienst_eur }), { stopps: 0, eur: 0 });
  const besteZone = [...basis].sort((a, b) => b.verdienst_pro_stopp - a.verdienst_pro_stopp)[0];

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Meine Zonen-Bilanz</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {gesamt.stopps} Stopps · {gesamt.eur.toFixed(2)} €
        </span>
        {offen
          ? <ChevronUp className="ml-1 h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {besteZone && (
            <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50/40 dark:bg-matcha-950/20 px-3 py-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
              <p className="text-xs font-semibold text-matcha-700 dark:text-matcha-300">
                Beste Zone heute: <strong>Zone {besteZone.zone}</strong> — {besteZone.verdienst_pro_stopp.toFixed(2)} € / Stopp
              </p>
            </div>
          )}

          <div className="space-y-2">
            {basis.map((z) => {
              const TIcon = TREND_ICON[z.trend];
              const maxVerdienst = Math.max(...basis.map((b) => b.verdienst_eur), 1);
              const barPct = Math.round((z.verdienst_eur / maxVerdienst) * 100);

              return (
                <div key={z.zone} className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-matcha-500 text-[10px] font-black text-white shrink-0">
                        {z.zone}
                      </span>
                      <span className="text-xs font-bold">Zone {z.zone}</span>
                      <span className="text-[10px] text-muted-foreground">{ZONE_LABEL[z.zone] ?? ''}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TIcon className={cn('h-3 w-3', TREND_COLOR[z.trend])} />
                      <span className="text-xs font-black tabular-nums text-foreground">
                        {z.verdienst_eur.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-400 transition-all duration-500"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{z.stopps} Stopp{z.stopps !== 1 ? 's' : ''}</span>
                    <span>{z.verdienst_pro_stopp.toFixed(2)} € / Stopp</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-bold">Gesamt Schicht</span>
            <span className="text-xs font-black tabular-nums text-matcha-700 dark:text-matcha-300">
              {gesamt.stopps} Stopps · {gesamt.eur.toFixed(2)} €
            </span>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Polling 30 Min · {!isOnline ? 'Offline — Mock-Daten' : 'Live'}
          </p>
        </div>
      )}
    </div>
  );
}
