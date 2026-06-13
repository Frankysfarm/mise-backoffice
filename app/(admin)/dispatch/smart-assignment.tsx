'use client';

/**
 * SmartAssignmentPanel — KI-gestützte Fahrerzuweisung für wartende Bestellungen.
 * Berechnet client-side welcher freie Fahrer am besten zu jeder Order passt:
 *   - Fahrzeugtyp (Bike vs. Auto) passend zur Zone
 *   - Freie Kapazität (aktueller_batch_id = null = frei)
 *   - Fahrzeug-Zonen-Match (Zone A/B → Bike ok, Zone C/D → Auto bevorzugt)
 * Zeigt Top-3 Empfehlungen als klickbare Zuweisung-Chips.
 */

import { useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Bike, Car, CheckCircle2, Clock, MapPin, Sparkles, Target, User, Zap } from 'lucide-react';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  kunde_adresse: string | null;
  gesamtbetrag: number;
  fertig_am: string | null;
  dispatch_score: number | null;
  delivery_zone: string | null;
  eta_earliest: string | null;
};

/** Berechnet einen einfachen Client-Side Match-Score (0-100) */
function computeMatch(driver: Driver, order: Order): number {
  let score = 50;

  // +20 wenn Fahrer frei (kein aktiver Batch)
  if (!driver.aktueller_batch_id) score += 20;
  else score -= 20; // Busy driver: penalty

  // Fahrzeug-Zone-Match
  const zone = (order.delivery_zone ?? 'A').toUpperCase();
  const isBike = driver.fahrzeug === 'bike' || driver.fahrzeug === 'fahrrad';
  if (zone === 'A' || zone === 'B') {
    if (isBike) score += 15; // Bike gut für kurze Distanzen
  } else if (zone === 'C' || zone === 'D') {
    if (!isBike) score += 15; // Auto besser für lange Distanzen
    else score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function WaitMin({ fertigAm }: { fertigAm: string | null }) {
  if (!fertigAm) return null;
  const min = Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
  return (
    <span className={cn(
      'text-[9px] font-bold tabular-nums',
      min >= 10 ? 'text-red-500' : min >= 5 ? 'text-amber-500' : 'text-matcha-500',
    )}>
      {min} Min warten
    </span>
  );
}

export function SmartAssignmentPanel({
  orders,
  drivers,
  onAssign,
}: {
  orders: Order[];
  drivers: Driver[];
  onAssign: (driverId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const readyOrders = orders.filter(o => o.status === 'fertig');
  const freeDrivers = drivers.filter(d => d.ist_online && !d.aktueller_batch_id);
  const busyDrivers = drivers.filter(d => d.ist_online && !!d.aktueller_batch_id);

  if (readyOrders.length === 0 || drivers.filter(d => d.ist_online).length === 0) return null;

  // Beste Bestellung: höchster dispatch_score, oder längste Wartezeit
  const topOrder = [...readyOrders].sort((a, b) => {
    const aWait = a.fertig_am ? Date.now() - new Date(a.fertig_am).getTime() : 0;
    const bWait = b.fertig_am ? Date.now() - new Date(b.fertig_am).getTime() : 0;
    return bWait - aWait; // Älteste zuerst
  })[0];

  // Fahrer nach Match-Score ranken
  const rankedDrivers = drivers
    .filter(d => d.ist_online)
    .map(d => ({ driver: d, match: computeMatch(d, topOrder) }))
    .sort((a, b) => b.match - a.match)
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-matcha-200 bg-gradient-to-br from-matcha-50 to-matcha-50/30">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-matcha-100/50 transition rounded-xl"
        onClick={() => setExpanded(v => !v)}
      >
        <Sparkles className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-matcha-700 flex-1 text-left">
          Zuweisung-Empfehlung
        </span>
        <div className="flex items-center gap-2 text-[10px] text-matcha-500">
          <span className="font-bold">{freeDrivers.length} frei</span>
          {busyDrivers.length > 0 && <span className="text-matcha-400">· {busyDrivers.length} unterwegs</span>}
        </div>
        <Zap className={cn('h-3.5 w-3.5 text-matcha-400 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-3 border-t border-matcha-200/50">
          {/* Top Order Info */}
          <div className="rounded-lg border border-matcha-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <Target className="h-3.5 w-3.5 text-matcha-600" />
              <span className="text-[10px] font-black text-matcha-700 uppercase tracking-wide">Prioritäts-Bestellung</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">#{topOrder.bestellnummer} · {topOrder.kunde_name}</span>
              <WaitMin fertigAm={topOrder.fertig_am} />
              {topOrder.delivery_zone && (
                <span className="text-[9px] font-bold bg-matcha-100 text-matcha-700 rounded px-1 py-0.5">
                  Zone {topOrder.delivery_zone.toUpperCase()}
                </span>
              )}
            </div>
            {topOrder.kunde_adresse && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                <MapPin className="h-2.5 w-2.5" />
                {topOrder.kunde_adresse}
                <span className="ml-auto font-bold text-foreground">{euro(topOrder.gesamtbetrag)}</span>
              </div>
            )}
          </div>

          {/* Driver Recommendations */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground px-0.5">
              Beste Fahrer-Matches
            </div>
            {rankedDrivers.map(({ driver, match }, i) => {
              const name = driver.employee
                ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
                : `Fahrer ${driver.employee_id.slice(0, 6)}`;
              const isBike = driver.fahrzeug === 'bike' || driver.fahrzeug === 'fahrrad';
              const isFree = !driver.aktueller_batch_id;
              const matchColor = match >= 70 ? 'text-matcha-700 bg-matcha-50 border-matcha-200'
                : match >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-muted-foreground bg-muted/30 border-border';

              return (
                <div
                  key={driver.employee_id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2',
                    i === 0 ? 'border-matcha-300 bg-matcha-50' : 'border-border bg-card',
                  )}
                >
                  {i === 0 && (
                    <span className="text-[8px] font-black text-matcha-600 bg-matcha-200 rounded px-1 py-0.5 shrink-0">BEST</span>
                  )}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {isBike
                      ? <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    }
                    <span className="text-sm font-bold text-foreground truncate">{name}</span>
                    {isFree
                      ? <span className="text-[9px] font-bold text-matcha-600 bg-matcha-100 rounded-full px-1.5 py-0.5 shrink-0">Frei</span>
                      : <span className="text-[9px] text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5 shrink-0">Unterwegs</span>
                    }
                  </div>
                  <div className={cn('flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold shrink-0', matchColor)}>
                    <span>{match}%</span>
                    <span className="font-normal opacity-70">Match</span>
                  </div>
                  {isFree && (
                    <button
                      onClick={() => onAssign(driver.employee_id)}
                      className="shrink-0 h-7 px-2.5 rounded-lg bg-matcha-600 text-white text-[11px] font-bold hover:bg-matcha-700 active:scale-[0.97] transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Zuweisen
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {rankedDrivers.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Kein Fahrer online — bitte Fahrer aktivieren
            </div>
          )}
        </div>
      )}
    </div>
  );
}
