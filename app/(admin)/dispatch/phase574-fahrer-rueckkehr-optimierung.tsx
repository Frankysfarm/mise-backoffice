'use client';

/**
 * Phase 574 — Dispatch: Fahrer-Rückkehr-Optimierungs-Panel
 *
 * Zeigt für alle unterwegs-Fahrer die voraussichtliche Rückkehrzeit
 * und empfiehlt optimale Reihenfolge für neue Touren-Zuweisungen.
 *
 * Sortierung: Fahrer mit kürzester Rückkehr-ETA zuerst.
 * Alert wenn alle Fahrer noch >20 Min unterwegs.
 *
 * Ticker: 20s
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Navigation, RefreshCw, Truck, User } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order?: { kunde_adresse?: string | null; eta_latest?: string | null } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id?: string | null;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  fahrer?: { vorname?: string; nachname?: string } | null;
  stops: Stop[];
}

interface Driver {
  employee_id?: string;
  id?: string;
  ist_online?: boolean;
  status?: { ist_online: boolean; aktueller_batch_id: string | null } | null;
  employee?: { id?: string; vorname?: string; nachname?: string } | null;
}

interface Props {
  batches: Batch[];
  drivers?: Driver[];
}

interface DriverReturn {
  driverId: string;
  name: string;
  returnEtaMin: number | null;
  remainingStops: number;
  zone: string | null;
  batchId: string;
  priority: number;
}

function getDriverName(b: Batch): string {
  if (b.fahrer?.vorname) return `${b.fahrer.vorname} ${b.fahrer.nachname ?? ''}`.trim();
  return b.fahrer_id ? `Fahrer ${b.fahrer_id.slice(0, 6)}` : 'Unbekannt';
}

export function DispatchPhase574FahrerRueckkehrOptimierung({ batches, drivers = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  const returns = useMemo<DriverReturn[]>(() => {
    const now = Date.now();
    const active = batches.filter(b => b.status === 'unterwegs' || b.status === 'gestartet');

    return active.map((b, i) => {
      const remaining = b.stops.filter(s => !s.geliefert_am).length;
      // Estimate: remaining stops × avg 8 min per stop + return 5 min
      const avgMinPerStop = 8;
      const returnEtaMin = remaining * avgMinPerStop + 5;

      // Priority: lower returnEtaMin = higher priority (1 = ready soonest)
      return {
        driverId: b.fahrer_id ?? `batch_${b.id}`,
        name: getDriverName(b),
        returnEtaMin,
        remainingStops: remaining,
        zone: b.zone ?? null,
        batchId: b.id,
        priority: i, // will sort after
      };
    }).sort((a, b) => (a.returnEtaMin ?? 999) - (b.returnEtaMin ?? 999))
      .map((d, i) => ({ ...d, priority: i + 1 }));
  }, [batches, tick]);

  const idleDrivers = drivers.filter(d => {
    const isOnline = d.ist_online ?? d.status?.ist_online ?? false;
    const hasBatch = d.status?.aktueller_batch_id != null;
    return isOnline && !hasBatch;
  });

  const allBusy = returns.length > 0 && returns.every(r => (r.returnEtaMin ?? 0) > 20);
  const earliest = returns[0] ?? null;

  if (returns.length === 0 && idleDrivers.length === 0) return null;

  return (
    <Card className="overflow-hidden border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Rückkehr-Optimierung</span>
          {returns.length > 0 && (
            <Badge className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5">
              {returns.length} Fahrer unterwegs
            </Badge>
          )}
          {idleDrivers.length > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5">
              {idleDrivers.length} verfügbar
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Alert when all drivers are busy for a long time */}
          {allBusy && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-700">
                Alle Fahrer noch ≥20 Min unterwegs — Kapazitätsengpass möglich!
              </span>
            </div>
          )}

          {/* Earliest return highlight */}
          {earliest && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Nächste Verfügbarkeit</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black">
                    {earliest.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-blue-900">{earliest.name}</div>
                    <div className="text-[10px] text-blue-600">{earliest.remainingStops} Stopp{earliest.remainingStops !== 1 ? 's' : ''} noch{earliest.zone ? ` · ${earliest.zone}` : ''}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black tabular-nums text-blue-700">~{earliest.returnEtaMin} Min</div>
                  <div className="text-[10px] text-blue-500">bis Rückkehr</div>
                </div>
              </div>
            </div>
          )}

          {/* All driver returns list */}
          {returns.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Priorisierung</div>
              {returns.map(r => {
                const urgency = (r.returnEtaMin ?? 99) <= 10 ? 'soon' : (r.returnEtaMin ?? 99) <= 20 ? 'medium' : 'later';
                return (
                  <div
                    key={r.batchId}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2',
                      urgency === 'soon' ? 'bg-emerald-50 border-emerald-200' :
                      urgency === 'medium' ? 'bg-amber-50 border-amber-200' :
                      'bg-slate-50 border-slate-200',
                    )}
                  >
                    <span className={cn(
                      'h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black text-white',
                      urgency === 'soon' ? 'bg-emerald-500' : urgency === 'medium' ? 'bg-amber-500' : 'bg-slate-400',
                    )}>
                      {r.priority}
                    </span>
                    <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">{r.name}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="tabular-nums font-bold">~{r.returnEtaMin} Min</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{r.remainingStops}S</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Idle drivers */}
          {idleDrivers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Sofort verfügbar</div>
              <div className="flex flex-wrap gap-1.5">
                {idleDrivers.slice(0, 6).map((d, i) => {
                  const name = d.employee?.vorname ?? `Fahrer ${i + 1}`;
                  return (
                    <span key={d.employee_id ?? d.id ?? i} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      <User className="h-3 w-3" />
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
