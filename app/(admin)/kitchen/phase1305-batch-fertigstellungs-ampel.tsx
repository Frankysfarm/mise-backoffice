'use client';

// Phase 1305 — Batch-Fertigstellungs-Ampel (Kitchen)
// Countdown bis Batch-Abholzeit + Farbkodierung je Batch-Zustand
// Props-basiert · nach Phase1300

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Package, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchOrder {
  id: string;
  status?: string;
  eta_pickup?: string | null;
  driver_name?: string | null;
  batch_id?: string | null;
}

interface Props {
  orders: BatchOrder[];
}

interface BatchGruppe {
  batchId: string;
  fahrerName: string;
  orders: BatchOrder[];
  verbleibendMin: number | null;
  fertig: number;
  gesamt: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const FERTIG_STATUSES = ['ready', 'fertig', 'prepared', 'done'];
const PREPARING_STATUSES = ['preparing', 'cooking', 'in_preparation', 'kocht'];

function minutenBis(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = (new Date(iso).getTime() - Date.now()) / 60000;
  return +diff.toFixed(1);
}

function ampelFarbe(fertig: number, gesamt: number, minLeft: number | null): 'gruen' | 'gelb' | 'rot' {
  if (fertig === gesamt) return 'gruen';
  if (minLeft !== null && minLeft < 3) return 'rot';
  if (minLeft !== null && minLeft < 8) return 'gelb';
  return 'gruen';
}

export function KitchenPhase1305BatchFertigstellungsAmpel({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const batches = useMemo(() => {
    const map = new Map<string, BatchOrder[]>();
    for (const o of orders) {
      const bid = o.batch_id ?? `solo-${o.id}`;
      if (!map.has(bid)) map.set(bid, []);
      map.get(bid)!.push(o);
    }

    const result: BatchGruppe[] = [];
    for (const [batchId, bOrders] of map) {
      const fertig = bOrders.filter(o => FERTIG_STATUSES.includes((o.status ?? '').toLowerCase())).length;
      const eta = bOrders.find(o => o.eta_pickup)?.eta_pickup ?? null;
      const min = minutenBis(eta);
      const ampel = ampelFarbe(fertig, bOrders.length, min);
      result.push({
        batchId,
        fahrerName: bOrders[0]?.driver_name ?? 'Fahrer unbekannt',
        orders: bOrders,
        verbleibendMin: min,
        fertig,
        gesamt: bOrders.length,
        ampel,
      });
    }
    return result.sort((a, b) => {
      const p = { rot: 0, gelb: 1, gruen: 2 };
      return p[a.ampel] - p[b.ampel];
    });
  }, [orders]);

  const kritischCount = batches.filter(b => b.ampel === 'rot').length;
  const warnCount = batches.filter(b => b.ampel === 'gelb').length;

  const headerBg = kritischCount > 0
    ? 'bg-red-600 dark:bg-red-700'
    : warnCount > 0
    ? 'bg-amber-500 dark:bg-amber-600'
    : 'bg-emerald-600 dark:bg-emerald-700';

  if (batches.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 text-white', headerBg)}
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          <span className="text-sm font-semibold">Batch-Fertigstellungs-Ampel</span>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
            {batches.length} Batches
          </span>
          {kritischCount > 0 && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 animate-pulse">
              {kritischCount} KRITISCH
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {batches.map(batch => {
            const pct = batch.gesamt > 0 ? Math.round((batch.fertig / batch.gesamt) * 100) : 0;
            const barColor = batch.ampel === 'rot' ? 'bg-red-500' : batch.ampel === 'gelb' ? 'bg-amber-400' : 'bg-emerald-500';
            const borderColor = batch.ampel === 'rot' ? 'border-red-200 dark:border-red-700' : batch.ampel === 'gelb' ? 'border-amber-200 dark:border-amber-700' : 'border-emerald-200 dark:border-emerald-700';
            const bgColor = batch.ampel === 'rot' ? 'bg-red-50 dark:bg-red-900/20' : batch.ampel === 'gelb' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20';
            const statusIcon = batch.fertig === batch.gesamt
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : batch.ampel === 'rot'
              ? <AlertTriangle className="h-4 w-4 text-red-500" />
              : <Package className="h-4 w-4 text-amber-500" />;

            return (
              <div key={batch.batchId} className={cn('rounded-xl border p-3', bgColor, borderColor)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {statusIcon}
                    <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                      {batch.fahrerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                    <Clock className="h-3 w-3" />
                    {batch.verbleibendMin !== null
                      ? batch.verbleibendMin <= 0
                        ? <span className="text-red-600 font-bold">Überfällig!</span>
                        : <span>{batch.verbleibendMin.toFixed(0)} Min</span>
                      : <span>—</span>}
                  </div>
                </div>

                {/* Fortschrittsbalken */}
                <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2 mb-1">
                  <div
                    className={cn('h-2 rounded-full transition-all duration-500', barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-stone-500 dark:text-stone-400">
                  <span>{batch.fertig}/{batch.gesamt} fertig</span>
                  <span>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
