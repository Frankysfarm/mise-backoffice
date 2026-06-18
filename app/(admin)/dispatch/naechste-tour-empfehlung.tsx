'use client';

import { useMemo } from 'react';
import { cn, euro } from '@/lib/utils';
import { Sparkles, Bike, Clock, MapPin, ChevronRight, AlertCircle, Zap, Target } from 'lucide-react';

export type ReadyOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  delivery_zone: string | null;
  fertig_am: string | null;
  dispatch_score: number | null;
};

export type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  employee: { id: string; vorname: string; nachname: string; telefon: string | null } | null;
};

interface Props {
  readyOrders: ReadyOrder[];
  drivers: Driver[];
  onAssign?: (driverId: string, orderIds: string[]) => void;
}

type Suggestion = {
  driver: Driver;
  driverName: string;
  orders: ReadyOrder[];
  zone: string | null;
  score: number;
  etaMin: number;
};

function waitMinutes(order: ReadyOrder): number {
  if (!order.fertig_am) return 0;
  return Math.round((Date.now() - new Date(order.fertig_am).getTime()) / 60_000);
}

function scoreDriverForOrders(driver: Driver, orders: ReadyOrder[]): number {
  let score = 0;
  // Free driver priority
  if (!driver.aktueller_batch_id) score += 50;
  // Bike bonus for small zones / nearby
  const zone = orders[0]?.delivery_zone;
  if (driver.fahrzeug === 'fahrrad' && (!zone || zone.length <= 2)) score += 10;
  // GPS available
  if (driver.last_lat && driver.last_lng) score += 5;
  // Slight deterministic variation
  const hash = driver.employee_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  score += hash % 5;
  return score;
}

function groupOrdersByZone(orders: ReadyOrder[]): ReadyOrder[][] {
  const zoneMap = new Map<string, ReadyOrder[]>();
  for (const o of orders) {
    const key = o.delivery_zone ?? '__none__';
    if (!zoneMap.has(key)) zoneMap.set(key, []);
    zoneMap.get(key)!.push(o);
  }
  return Array.from(zoneMap.values()).sort((a, b) => b.length - a.length);
}

export function DispatchNaechsteTourEmpfehlung({ readyOrders, drivers, onAssign }: Props) {
  const freeDrivers = useMemo(
    () => drivers.filter(d => d.ist_online && !d.aktueller_batch_id),
    [drivers],
  );

  const suggestions = useMemo<Suggestion[]>(() => {
    if (readyOrders.length === 0 || freeDrivers.length === 0) return [];

    const batches = groupOrdersByZone(readyOrders).slice(0, 3);
    const result: Suggestion[] = [];
    const usedDrivers = new Set<string>();

    for (const batch of batches) {
      const zone = batch[0].delivery_zone ?? null;
      const capped = batch.slice(0, 3); // max 3 stops per suggestion

      let bestDriver: Driver | null = null;
      let bestScore = -1;
      for (const d of freeDrivers) {
        if (usedDrivers.has(d.employee_id)) continue;
        const s = scoreDriverForOrders(d, capped);
        if (s > bestScore) { bestScore = s; bestDriver = d; }
      }
      if (!bestDriver) continue;

      usedDrivers.add(bestDriver.employee_id);
      const stops = capped.length;
      result.push({
        driver: bestDriver,
        driverName: bestDriver.employee
          ? `${bestDriver.employee.vorname} ${bestDriver.employee.nachname}`
          : 'Fahrer',
        orders: capped,
        zone,
        score: bestScore,
        etaMin: 10 + stops * 13, // ~12-15 min per stop
      });
    }
    return result;
  }, [readyOrders, freeDrivers]);

  // Longest-waiting order
  const maxWait = useMemo(
    () => Math.max(0, ...readyOrders.map(waitMinutes)),
    [readyOrders],
  );

  if (readyOrders.length === 0 || freeDrivers.length === 0) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles size={14} className="text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-700">
          Nächste Tour Empfehlung
        </span>
        <span className="rounded-full bg-matcha-100 text-matcha-700 border border-matcha-200 px-2 py-0.5 text-[10px] font-bold">
          KI-Empfehlung
        </span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertCircle size={10} className={cn(maxWait >= 10 ? 'text-red-500' : 'text-amber-400')} />
          Längste Wartezeit: <strong className={cn(maxWait >= 10 ? 'text-red-600' : 'text-amber-600')}>{maxWait} Min</strong>
        </span>
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        {suggestions.map((s, idx) => {
          const isTop = idx === 0;
          const totalValue = s.orders.reduce((sum, o) => sum + o.gesamtbetrag, 0);
          return (
            <div
              key={s.driver.employee_id}
              className={cn(
                'rounded-lg border p-3',
                isTop
                  ? 'border-matcha-300 bg-white shadow-sm'
                  : 'border-border bg-white/60',
              )}
            >
              <div className="flex items-start gap-2">
                {/* Rank badge */}
                <div className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  isTop ? 'bg-matcha-500 text-white' : 'bg-muted text-muted-foreground',
                )}>
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Driver + vehicle */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {s.driver.fahrzeug === 'fahrrad'
                      ? <Bike size={12} className="text-matcha-600 shrink-0" />
                      : <Zap size={12} className="text-amber-500 shrink-0" />}
                    <span className="text-xs font-bold text-foreground">{s.driverName}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">· {s.driver.fahrzeug}</span>
                  </div>

                  {/* Zone + order count */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    {s.zone && (
                      <span className="flex items-center gap-1">
                        <MapPin size={9} className="text-matcha-400" />
                        Zone {s.zone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Target size={9} className="text-matcha-400" />
                      {s.orders.length} Stopp{s.orders.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={9} className="text-blue-400" />
                      ~{s.etaMin} Min
                    </span>
                    <span className="font-semibold text-foreground">{euro(totalValue)}</span>
                  </div>

                  {/* Order numbers */}
                  <div className="flex flex-wrap gap-1">
                    {s.orders.map(o => (
                      <span
                        key={o.id}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                      >
                        #{o.bestellnummer}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Assign button */}
                <button
                  disabled
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground cursor-not-allowed"
                  title="Zuweisung läuft über die Dispatch-Queue"
                >
                  Wird berechnet
                  <ChevronRight size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Bestellungen werden nach Zone gebündelt · Schätzung: 12–15 Min pro Stopp
      </p>
    </div>
  );
}
