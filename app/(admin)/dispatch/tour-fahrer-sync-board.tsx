'use client';

import { useMemo, useEffect, useState } from 'react';
import { Bike, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id: string | null;
  employee: { vorname: string; nachname: string } | null;
};

type Batch = {
  id: string;
  fahrer_id: string | null;
  status: string;
  startzeit?: string | null;
  total_eta_min: number | null;
  stops: {
    id: string;
    reihenfolge: number;
    geliefert_am: string | null;
  }[];
};

interface Props {
  drivers: Driver[];
  batches: Batch[];
}

const ACTIVE_BATCH = new Set(['assigned', 'on_route', 'en_route', 'unterwegs', 'active', 'picked_up']);

type SyncStatus = 'sync' | 'ahead' | 'late' | 'idle';

interface DriverRow {
  name: string;
  batchId: string | null;
  stopsTotal: number;
  stopsDone: number;
  elapsedMin: number | null;
  syncStatus: SyncStatus;
}

export function DispatchTourFahrerSyncBoard({ drivers, batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo((): DriverRow[] => {
    const now = Date.now();
    const batchMap = new Map(batches.map(b => [b.id, b]));

    return drivers
      .filter(d => d.ist_online)
      .map(d => {
        const name = `${d.employee?.vorname ?? '?'} ${(d.employee?.nachname ?? '').charAt(0)}.`;
        const batch = d.aktueller_batch_id ? batchMap.get(d.aktueller_batch_id) : null;
        if (!batch || !ACTIVE_BATCH.has(batch.status)) {
          return { name, batchId: null, stopsTotal: 0, stopsDone: 0, elapsedMin: null, syncStatus: 'idle' as SyncStatus };
        }
        const stopsTotal = batch.stops.length;
        const stopsDone = batch.stops.filter(s => s.geliefert_am).length;
        const elapsedMin = batch.startzeit ? (now - new Date(batch.startzeit).getTime()) / 60_000 : null;
        const etaMin = batch.total_eta_min;

        let syncStatus: SyncStatus = 'sync';
        if (etaMin != null && elapsedMin != null && stopsTotal > 0) {
          const expectedDone = (elapsedMin / etaMin) * stopsTotal;
          const diff = stopsDone - expectedDone;
          if (diff > 0.5) syncStatus = 'ahead';
          else if (diff < -0.5) syncStatus = 'late';
        }

        return { name, batchId: batch.id, stopsTotal, stopsDone, elapsedMin, syncStatus };
      });
  }, [drivers, batches]);

  const active = rows.filter(r => r.batchId);
  if (active.length === 0) return null;

  const statusCfg: Record<SyncStatus, { label: string; badge: string; Icon: typeof Clock }> = {
    ahead:  { label: 'Voraus',    badge: 'bg-matcha-100 text-matcha-700 border-matcha-300', Icon: CheckCircle2 },
    sync:   { label: 'Im Plan',   badge: 'bg-blue-100 text-blue-700 border-blue-300',       Icon: Clock },
    late:   { label: 'Rückstand', badge: 'bg-red-100 text-red-700 border-red-300',          Icon: AlertCircle },
    idle:   { label: 'Frei',      badge: 'bg-stone-100 text-stone-500 border-stone-200',    Icon: Bike },
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100">
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Fahrer-Tour-Sync</span>
        <span className="ml-auto text-[10px] text-stone-400 font-semibold">{active.length} aktiv</span>
      </div>

      <div className="divide-y divide-stone-100">
        {active.map(row => {
          const cfg = statusCfg[row.syncStatus];
          const { Icon } = cfg;
          const pct = row.stopsTotal > 0 ? Math.round((row.stopsDone / row.stopsTotal) * 100) : 0;
          return (
            <div key={row.name} className="flex items-center gap-3 px-4 py-2.5">
              <Icon className="h-3.5 w-3.5 shrink-0 text-stone-400" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold truncate">{row.name}</span>
                  <span className={cn('text-[9px] font-bold border rounded-full px-1.5 py-0.5', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        row.syncStatus === 'ahead' ? 'bg-matcha-500' :
                        row.syncStatus === 'late' ? 'bg-red-400' : 'bg-blue-400',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-stone-500 shrink-0">
                    {row.stopsDone}/{row.stopsTotal}
                  </span>
                </div>
              </div>
              {row.elapsedMin != null && (
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs font-black tabular-nums">{Math.round(row.elapsedMin)} Min</div>
                  <div className="text-[8px] text-stone-400">vergangen</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
