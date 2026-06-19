'use client';

/**
 * DispatchZuweisungsVorschau — Phase 249
 *
 * Zeigt bei selektierten Bestellungen die Top-3 freien Fahrer
 * mit geschätztem Score und Fahrzeugtyp — BEVOR die Zuweisung
 * ausgelöst wird. Beschleunigt Dispatch-Entscheidungen.
 */

import { useMemo } from 'react';
import { Star, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type DispatchDriver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  employee: { id: string; vorname: string; nachname: string } | null;
};

type ReadyOrder = {
  id: string;
  delivery_zone: string | null;
};

interface Props {
  selectedOrderIds: Set<string>;
  readyOrders: ReadyOrder[];
  drivers: DispatchDriver[];
}

type Candidate = {
  driver: DispatchDriver;
  score: number;
  vehicleEmoji: string;
  vehicleLabel: string;
};

function estimateScore(driver: DispatchDriver, orders: ReadyOrder[]): number {
  let score = 70;
  const v = driver.fahrzeug ?? '';
  if (v === 'auto')    score += 8;
  if (v === 'e-bike')  score += 5;
  if (v === 'fahrrad') score += 3;
  const zones = new Set(orders.map((o) => o.delivery_zone).filter(Boolean));
  if (zones.size === 1) score += 6;
  return Math.min(99, score);
}

function vehicleMeta(v: string): { emoji: string; label: string } {
  switch (v) {
    case 'auto':    return { emoji: '🚗', label: 'Auto' };
    case 'e-bike':  return { emoji: '⚡', label: 'E-Bike' };
    case 'fahrrad': return { emoji: '🚲', label: 'Fahrrad' };
    case 'roller':  return { emoji: '🛵', label: 'Roller' };
    default:        return { emoji: '🚶', label: driver.fahrzeug || 'Unbekannt' };
  }
}

export function DispatchZuweisungsVorschau({ selectedOrderIds, readyOrders, drivers }: Props) {
  const selectedOrders = useMemo(
    () => readyOrders.filter((o) => selectedOrderIds.has(o.id)),
    [readyOrders, selectedOrderIds],
  );

  const candidates = useMemo((): Candidate[] =>
    drivers
      .filter((d) => d.ist_online && !d.aktueller_batch_id && d.employee)
      .map((d) => {
        const { emoji, label } = vehicleMeta(d.fahrzeug ?? '');
        return { driver: d, score: estimateScore(d, selectedOrders), vehicleEmoji: emoji, vehicleLabel: label };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
    [drivers, selectedOrders],
  );

  if (selectedOrderIds.size === 0 || candidates.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Zap size={13} className="text-amber-600 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
          Vorschau — {selectedOrderIds.size} Bestellung{selectedOrderIds.size !== 1 ? 'en' : ''}
        </span>
      </div>

      <div className="space-y-1.5">
        {candidates.map(({ driver, score, vehicleEmoji, vehicleLabel }, idx) => {
          const isBest = idx === 0;
          const stars = Math.round((score / 100) * 5);
          const name = driver.employee
            ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
            : `Fahrer ${driver.employee_id.slice(0, 4)}`;

          return (
            <div
              key={driver.employee_id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2',
                isBest ? 'bg-white border-amber-300 shadow-sm' : 'bg-white/60 border-amber-100',
              )}
            >
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                isBest ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700',
              )}>
                {idx + 1}
              </div>

              <span className="text-sm shrink-0">{vehicleEmoji}</span>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground">{name}</div>
                <div className="text-[10px] text-muted-foreground">{vehicleLabel} · frei</div>
              </div>

              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className={cn(
                  'text-sm font-black tabular-nums',
                  score >= 85 ? 'text-matcha-700' : score >= 75 ? 'text-amber-700' : 'text-muted-foreground',
                )}>
                  {score}
                </span>
                <div className="flex gap-px">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={7}
                      className={cn(
                        s <= stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40',
                      )}
                    />
                  ))}
                </div>
              </div>

              {isBest && <ChevronRight size={14} className="text-amber-500 shrink-0" />}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-amber-600/70 text-center">
        Vorläufiger Score · Finale Berechnung beim Zuweisen
      </p>
    </div>
  );
}
