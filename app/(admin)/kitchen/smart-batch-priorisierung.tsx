'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchPriority = 'kritisch' | 'dringend' | 'normal';

interface PrioritizedBatch {
  id: string;
  bestellnummer: string | null;
  zone: string | null;
  status: string;
  driverName: string | null;
  driverAssigned: boolean;
  orderCount: number;
  waitMin: number;
  priorityScore: number;
  priority: BatchPriority;
}

interface Props {
  locationId: string | null;
}

const PRIO_CONFIG: Record<BatchPriority, { label: string; bg: string; text: string; border: string }> = {
  kritisch: { label: 'KRITISCH', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  dringend: { label: 'DRINGEND', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  normal:   { label: 'NORMAL',   bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
};

export function KitchenSmartBatchPriorisierung({ locationId }: Props) {
  const [batches, setBatches] = useState<PrioritizedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/smart-batch-priority?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => setBatches(d.batches ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const kritisch = batches.filter((b) => b.priority === 'kritisch').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('h-4 w-4', kritisch > 0 ? 'text-red-500' : 'text-amber-500')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Smart-Batch-Priorisierung</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              kritisch > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
            )}>
              {batches.length} offen{kritisch > 0 ? ` · ${kritisch} kritisch` : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Batch-Prioritäten…
            </div>
          )}

          {!loading && batches.length === 0 && (
            <div className="text-sm text-muted-foreground py-2 text-center">
              Keine offenen Batches — alles läuft ✓
            </div>
          )}

          {!loading && batches.length > 0 && (
            <div className="space-y-2">
              {batches.map((b) => {
                const pc = PRIO_CONFIG[b.priority];
                return (
                  <div
                    key={b.id}
                    className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', pc.border, b.priority === 'kritisch' ? 'bg-red-50' : b.priority === 'dringend' ? 'bg-amber-50' : 'bg-gray-50')}
                  >
                    {/* Priority badge */}
                    <span className={cn('shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider', pc.bg, pc.text)}>
                      {pc.label}
                    </span>

                    {/* Zone */}
                    {b.zone && (
                      <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-matcha-100 text-matcha-700 text-xs font-black">
                        {b.zone}
                      </span>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-foreground truncate">
                        {b.bestellnummer ?? b.id.slice(0, 8)}
                        {b.orderCount > 1 && (
                          <span className="ml-1 text-[9px] text-muted-foreground">·{b.orderCount} Bestell.</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{b.waitMin} Min Wartezeit</span>
                      </div>
                    </div>

                    {/* Driver */}
                    <div className="shrink-0 flex items-center gap-1">
                      <User className={cn('h-3 w-3', b.driverAssigned ? 'text-matcha-600' : 'text-red-500')} />
                      <span className={cn('text-[10px] font-bold', b.driverAssigned ? 'text-matcha-700' : 'text-red-600')}>
                        {b.driverAssigned ? (b.driverName ?? 'Zugewiesen') : 'Kein Fahrer'}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="shrink-0 text-right">
                      <div className={cn('text-sm font-black tabular-nums', pc.text)}>{b.priorityScore}</div>
                      <div className="text-[8px] text-muted-foreground">Prio-Score</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
