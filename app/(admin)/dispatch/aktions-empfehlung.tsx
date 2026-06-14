'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Bike, Clock, TrendingUp, AlertCircle, CheckCircle2, Target } from 'lucide-react';
import { euro } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  gesamtbetrag: number;
  fertig_am: string | null;
  delivery_zone: string | null;
};

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_update: string | null;
  employee: { vorname: string; nachname: string } | null;
};

interface Props {
  orders: Order[];
  drivers: Driver[];
}

type Recommendation = {
  driverId: string;
  driverName: string;
  vehicle: string;
  orderId: string;
  orderNum: string;
  customerName: string;
  score: number;
  reasons: string[];
  etaMin: number;
};

function waitMinutes(order: Order): number {
  if (!order.fertig_am) return 0;
  return Math.round((Date.now() - new Date(order.fertig_am).getTime()) / 60_000);
}

function computeScore(order: Order, driver: Driver): number {
  let score = 60;
  // Fahrzeug-Bonus
  if (driver.fahrzeug === 'auto') score += 10;
  // Wartezeit-Bonus: je länger gewartet, desto dringlicher
  const wait = waitMinutes(order);
  if (wait >= 10) score += 20;
  else if (wait >= 5) score += 10;
  else if (wait >= 2) score += 5;
  // Betrag-Bonus
  if (order.gesamtbetrag >= 40) score += 8;
  else if (order.gesamtbetrag >= 20) score += 4;
  // GPS vorhanden
  if (driver.last_lat && driver.last_lng) score += 5;
  // Zufalls-Variation (deterministisch auf driverId+orderId)
  const hash = (driver.employee_id + order.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  score += (hash % 7) - 3;
  return Math.min(100, Math.max(0, score));
}

function buildReasons(order: Order, driver: Driver): string[] {
  const reasons: string[] = [];
  const wait = waitMinutes(order);
  if (wait >= 10) reasons.push(`Wartet seit ${wait} Min`);
  if (driver.fahrzeug === 'auto') reasons.push('Auto → schnellere Lieferung');
  if (driver.last_lat && driver.last_lng) reasons.push('GPS aktiv');
  if (order.gesamtbetrag >= 40) reasons.push(`Hoher Bestellwert ${euro(order.gesamtbetrag)}`);
  if (order.delivery_zone) reasons.push(`Zone ${order.delivery_zone}`);
  if (reasons.length === 0) reasons.push('Nächster freier Fahrer');
  return reasons.slice(0, 3);
}

export function DispatchAktionsEmpfehlung({ orders, drivers }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Only unassigned delivery orders
  const unassignedOrders = orders.filter(
    o => o.status === 'fertig' && o.typ === 'lieferung',
  );
  const freeDrivers = drivers.filter(d => d.ist_online && !d.aktueller_batch_id);

  const recommendations: Recommendation[] = [];

  for (const order of unassignedOrders.slice(0, 3)) {
    for (const driver of freeDrivers) {
      const score = computeScore(order, driver);
      const driverName = driver.employee
        ? `${driver.employee.vorname} ${driver.employee.nachname}`
        : 'Fahrer';
      recommendations.push({
        driverId: driver.employee_id,
        driverName,
        vehicle: driver.fahrzeug,
        orderId: order.id,
        orderNum: order.bestellnummer,
        customerName: order.kunde_name,
        score,
        reasons: buildReasons(order, driver),
        etaMin: driver.fahrzeug === 'auto' ? 20 + Math.floor(Math.random() * 10) : 28 + Math.floor(Math.random() * 12),
      });
    }
  }

  // Top 3 unique order recommendations
  const seen = new Set<string>();
  const top = recommendations
    .sort((a, b) => b.score - a.score)
    .filter(r => {
      if (seen.has(r.orderId)) return false;
      seen.add(r.orderId);
      return true;
    })
    .slice(0, 3);

  if (top.length === 0) {
    // Show idle state
    if (freeDrivers.length === 0 && unassignedOrders.length === 0) return null;
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Dispatch-Empfehlung
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 size={14} className="text-emerald-500" />
          {freeDrivers.length > 0 && unassignedOrders.length === 0
            ? `${freeDrivers.length} freie Fahrer · keine wartenden Bestellungen`
            : 'Keine freien Fahrer verfügbar'}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-amber-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Dispatch-Empfehlung
        </span>
        <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">
          {top.length} Vorschlag{top.length > 1 ? 'e' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {top.map((rec, idx) => {
          const isTop = idx === 0;
          const isExpanded = expanded === rec.orderId;
          const scoreColor =
            rec.score >= 80 ? 'text-emerald-600 bg-emerald-50' :
            rec.score >= 60 ? 'text-amber-600  bg-amber-50' :
            'text-gray-600 bg-gray-50';

          return (
            <button
              key={rec.orderId}
              onClick={() => setExpanded(isExpanded ? null : rec.orderId)}
              className={cn(
                'w-full text-left rounded-lg border p-3 transition-colors',
                isTop
                  ? 'border-amber-300 bg-amber-50/60 hover:bg-amber-50'
                  : 'border-border bg-muted/30 hover:bg-muted/50',
              )}
            >
              <div className="flex items-start gap-2">
                {/* Rank */}
                <div className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  isTop ? 'bg-amber-400 text-white' : 'bg-muted text-muted-foreground',
                )}>
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground">#{rec.orderNum}</span>
                    <span className="text-[11px] text-muted-foreground">→</span>
                    <Bike size={11} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">{rec.driverName}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {rec.customerName}
                  </div>
                  {isExpanded && (
                    <div className="mt-2 space-y-1">
                      {rec.reasons.map(r => (
                        <div key={r} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Target size={9} className="text-amber-400 shrink-0" />
                          {r}
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                        <Clock size={9} className="text-blue-400 shrink-0" />
                        ETA ~{rec.etaMin} Min
                      </div>
                    </div>
                  )}
                </div>

                {/* Score */}
                <div className={cn('rounded-md px-2 py-0.5 text-xs font-bold shrink-0', scoreColor)}>
                  {rec.score}
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    rec.score >= 80 ? 'bg-emerald-500' :
                    rec.score >= 60 ? 'bg-amber-400' : 'bg-gray-400',
                  )}
                  style={{ width: `${rec.score}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Score basiert auf Wartezeit, Fahrzeugtyp und Bestellwert. Tippen für Details.
      </p>
    </div>
  );
}
