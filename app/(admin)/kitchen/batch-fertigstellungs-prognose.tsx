'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReadinessStatus = 'ok' | 'tight' | 'alert' | 'unknown';

interface BatchReadiness {
  batchId: string;
  driverName: string | null;
  etaAt: string | null;
  minutesUntilEta: number | null;
  prepTimeMin: number;
  remainingPrepMin: number | null;
  status: ReadinessStatus;
  gapMin: number | null;
}

interface ApiResponse {
  ok: boolean;
  batches: BatchReadiness[];
  alertCount: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const statusConfig: Record<ReadinessStatus, { bg: string; text: string; badge: string; icon: React.ReactNode; label: string }> = {
  alert: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    badge: 'bg-red-500 text-white',
    icon: <AlertTriangle className="h-3 w-3" />,
    label: 'Zu spät',
  },
  tight: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    badge: 'bg-amber-400 text-white',
    icon: <Clock className="h-3 w-3" />,
    label: 'Knapp',
  },
  ok: {
    bg: 'bg-matcha-50',
    text: 'text-matcha-700',
    badge: 'bg-matcha-500 text-white',
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Rechtzeitig',
  },
  unknown: {
    bg: 'bg-stone-50',
    text: 'text-stone-500',
    badge: 'bg-stone-200 text-stone-600',
    icon: <Clock className="h-3 w-3" />,
    label: 'Unbekannt',
  },
};

export function KitchenBatchFertigstellungsPrognose({ locationId }: Props) {
  const [batches, setBatches] = useState<BatchReadiness[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-batch-readiness?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setBatches(d.batches ?? []);
        setAlertCount(d.alertCount ?? 0);
      })
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
  if (!loading && batches.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100">
        {alertCount > 0 ? (
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
        ) : (
          <CheckCircle className="h-4 w-4 text-matcha-600 shrink-0" />
        )}
        <span className="font-display text-sm font-bold uppercase tracking-wider">Batch-Fertigstellungs-Prognose</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {!loading && alertCount > 0 && (
          <span className="ml-auto rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-[10px] font-bold animate-pulse">
            {alertCount} Alert{alertCount !== 1 ? 's' : ''}
          </span>
        )}
        {!loading && alertCount === 0 && batches.length > 0 && (
          <span className="ml-auto rounded-full bg-matcha-100 text-matcha-700 px-2.5 py-0.5 text-[10px] font-bold">
            {batches.length} Batches ✓
          </span>
        )}
      </div>

      {loading && batches.length === 0 ? (
        <div className="px-5 py-6 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 bg-stone-100 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-stone-50">
          {batches.map((b) => {
            const cfg = statusConfig[b.status];
            return (
              <div key={b.batchId} className={cn('flex items-center gap-3 px-5 py-3', cfg.bg)}>
                <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0', cfg.badge)}>
                  {cfg.icon}
                  {cfg.label}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate block">
                    {b.driverName ?? <span className="italic text-muted-foreground">Kein Fahrer</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ETA: {formatTime(b.etaAt)} · Noch {b.remainingPrepMin ?? b.prepTimeMin} Min kochen
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  {b.gapMin !== null ? (
                    <span className={cn('text-sm font-bold tabular-nums', cfg.text)}>
                      {b.gapMin >= 0 ? `+${b.gapMin}` : b.gapMin} Min
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">–</span>
                  )}
                  <div className="text-[9px] text-muted-foreground">Puffer</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
