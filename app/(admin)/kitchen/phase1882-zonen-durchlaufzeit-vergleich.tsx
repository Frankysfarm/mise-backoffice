'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1882 — Zonen-Durchlaufzeit-Vergleich (Kitchen)
 *
 * Ø Kochzeit + Lieferzeit je Zone A/B/C/D aus props orders.
 * Ampel: grün (<25 Min Kochzeit + <35 Min gesamt), gelb, rot.
 * useMemo. Collapsible.
 */

interface Order {
  id: string;
  status?: string | null;
  delivery_zone?: string | null;
  created_at?: string | null;
  kitchen_started_at?: string | null;
  ready_at?: string | null;
  actual_delivery_time?: string | null;
}

interface Props {
  orders: Order[];
  className?: string;
}

const ZONEN = ['A', 'B', 'C', 'D'] as const;

const KOCHZEIT_ZIEL = 20;
const GESAMT_ZIEL_NACH_ZONE: Record<string, number> = { A: 30, B: 38, C: 50, D: 65 };

interface ZoneDurchlauf {
  zone: string;
  avg_kochzeit_min: number | null;
  avg_lieferzeit_min: number | null;
  avg_gesamt_min: number | null;
  anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const FARB = {
  gruen: {
    bar:    'bg-matcha-500',
    text:   'text-matcha-700 dark:text-matcha-300',
    badge:  'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300',
    border: 'border-matcha-200 dark:border-matcha-800',
    bg:     'bg-matcha-50/50 dark:bg-matcha-950/10',
    dot:    'bg-matcha-500',
  },
  gelb: {
    bar:    'bg-amber-400',
    text:   'text-amber-700 dark:text-amber-300',
    badge:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    bg:     'bg-amber-50/50 dark:bg-amber-950/10',
    dot:    'bg-amber-500',
  },
  rot: {
    bar:    'bg-red-500',
    text:   'text-red-700 dark:text-red-300',
    badge:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    bg:     'bg-red-50/50 dark:bg-red-950/10',
    dot:    'bg-red-500',
  },
} as const;

const ABGESCHLOSSEN_STATUS = ['delivered', 'delivering'];

export function KitchenPhase1882ZonenDurchlaufzeitVergleich({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);

  const zonenDurchlauf = useMemo<ZoneDurchlauf[]>(() => {
    type ZoneAcc = { kochzeiten: number[]; lieferzeiten: number[]; gesamt: number[] };
    const accMap = new Map<string, ZoneAcc>(ZONEN.map((z) => [z, { kochzeiten: [], lieferzeiten: [], gesamt: [] }]));

    for (const o of orders) {
      if (!ABGESCHLOSSEN_STATUS.includes(o.status ?? '')) continue;
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (!accMap.has(zone)) continue;
      const acc = accMap.get(zone)!;

      const erstellt = o.created_at ? new Date(o.created_at).getTime() : null;
      const kochStart = o.kitchen_started_at ? new Date(o.kitchen_started_at).getTime() : erstellt;
      const bereit = o.ready_at ? new Date(o.ready_at).getTime() : null;
      const geliefert = o.actual_delivery_time ? new Date(o.actual_delivery_time).getTime() : null;

      if (kochStart && bereit) {
        const kochMin = (bereit - kochStart) / 60_000;
        if (kochMin > 0 && kochMin < 120) acc.kochzeiten.push(kochMin);
      }

      if (bereit && geliefert) {
        const lieferMin = (geliefert - bereit) / 60_000;
        if (lieferMin > 0 && lieferMin < 120) acc.lieferzeiten.push(lieferMin);
      }

      if (erstellt && geliefert) {
        const gesamtMin = (geliefert - erstellt) / 60_000;
        if (gesamtMin > 0 && gesamtMin < 240) acc.gesamt.push(gesamtMin);
      }
    }

    return ZONEN.map((zone) => {
      const acc = accMap.get(zone)!;
      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

      const avgKoch = avg(acc.kochzeiten);
      const avgLiefer = avg(acc.lieferzeiten);
      const avgGesamt = avg(acc.gesamt);
      const anzahl = acc.gesamt.length;

      const ziel = GESAMT_ZIEL_NACH_ZONE[zone] ?? 60;
      const kochUeberschritten = avgKoch !== null && avgKoch > KOCHZEIT_ZIEL * 1.25;
      const gesamtUeberschritten = avgGesamt !== null && avgGesamt > ziel * 1.25;
      const kochGrenzwertig = avgKoch !== null && avgKoch > KOCHZEIT_ZIEL;
      const gesamtGrenzwertig = avgGesamt !== null && avgGesamt > ziel;

      let ampel: 'gruen' | 'gelb' | 'rot' = 'gruen';
      if (kochUeberschritten || gesamtUeberschritten) ampel = 'rot';
      else if (kochGrenzwertig || gesamtGrenzwertig) ampel = 'gelb';

      return { zone, avg_kochzeit_min: avgKoch, avg_lieferzeit_min: avgLiefer, avg_gesamt_min: avgGesamt, anzahl, ampel };
    });
  }, [orders]);

  const rotZonen = zonenDurchlauf.filter((z) => z.ampel === 'rot');
  const hatDaten = zonenDurchlauf.some((z) => z.anzahl > 0);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Durchlaufzeit</span>
        {rotZonen.length > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {rotZonen.length} überschritten
          </span>
        )}
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {!hatDaten && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Noch keine abgeschlossenen Bestellungen für Vergleich.
            </p>
          )}

          {rotZonen.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Zone{rotZonen.length > 1 ? 'n' : ''} {rotZonen.map((z) => z.zone).join(', ')} — Durchlaufzeit &gt;25% über Ziel.
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            {zonenDurchlauf.map((z) => {
              const cfg = FARB[z.ampel];
              const ziel = GESAMT_ZIEL_NACH_ZONE[z.zone] ?? 60;
              const barBreite = z.avg_gesamt_min !== null ? Math.min(100, Math.round((z.avg_gesamt_min / (ziel * 1.5)) * 100)) : 0;

              return (
                <div key={z.zone} className={cn('rounded-xl border px-3 py-2.5 space-y-2', cfg.border, cfg.bg)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shrink-0',
                        z.ampel === 'rot' ? 'bg-red-500' : z.ampel === 'gelb' ? 'bg-amber-500' : 'bg-matcha-500',
                      )}>
                        {z.zone}
                      </span>
                      <span className="text-xs font-bold">Zone {z.zone}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({z.anzahl} Bst.)
                      </span>
                    </div>
                    <span className={cn('text-xs font-black tabular-nums', cfg.text)}>
                      {z.avg_gesamt_min !== null ? `${z.avg_gesamt_min} Min gesamt` : '—'}
                    </span>
                  </div>

                  {/* Fortschrittsbalken Gesamt vs. Ziel */}
                  {z.avg_gesamt_min !== null && (
                    <div className="space-y-0.5">
                      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                          style={{ width: `${barBreite}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Ziel: {ziel} Min</span>
                        <span>{barBreite > 100 ? '⚠' : `${barBreite}%`} des Limits</span>
                      </div>
                    </div>
                  )}

                  {/* Kochzeit + Lieferzeit */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="text-muted-foreground">
                      Kochzeit:{' '}
                      <span className={cn(
                        'font-bold',
                        z.avg_kochzeit_min !== null && z.avg_kochzeit_min > KOCHZEIT_ZIEL * 1.25
                          ? 'text-red-600'
                          : z.avg_kochzeit_min !== null && z.avg_kochzeit_min > KOCHZEIT_ZIEL
                          ? 'text-amber-600'
                          : 'text-foreground',
                      )}>
                        {z.avg_kochzeit_min !== null ? `${z.avg_kochzeit_min} Min` : '—'}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-right">
                      Lieferzeit:{' '}
                      <span className="font-bold text-foreground">
                        {z.avg_lieferzeit_min !== null ? `${z.avg_lieferzeit_min} Min` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Kochzeit-Ziel: {KOCHZEIT_ZIEL} Min · Gesamt-Ziel: A {GESAMT_ZIEL_NACH_ZONE['A']} / B {GESAMT_ZIEL_NACH_ZONE['B']} / C {GESAMT_ZIEL_NACH_ZONE['C']} / D {GESAMT_ZIEL_NACH_ZONE['D']} Min
          </p>
        </div>
      )}
    </div>
  );
}
