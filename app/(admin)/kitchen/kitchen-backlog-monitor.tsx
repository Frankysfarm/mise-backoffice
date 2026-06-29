'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type BacklogLevel = 'ok' | 'warning' | 'critical';

interface BacklogOrder {
  orderId: string;
  bestellnummer: string | null;
  status: string;
  waitMinutes: number;
  zone: string | null;
}

interface BacklogData {
  alertLevel: BacklogLevel;
  backlogCount: number;
  thresholdMin: number;
  alertCountThreshold: number;
  longestWaitMin: number;
  totalInPrep: number;
  orders: BacklogOrder[];
}

interface ApiResponse {
  ok: boolean;
  data: BacklogData;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const levelConfig: Record<BacklogLevel, { bg: string; border: string; icon: React.ReactNode; title: string; pulse?: boolean } | null> = {
  ok: null,
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: <Clock className="h-4 w-4 text-amber-600 shrink-0" />,
    title: 'Küchen-Rückstand',
  },
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    icon: <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 animate-pulse" />,
    title: 'Kritischer Rückstand!',
    pulse: true,
  },
};

export function KitchenBacklogMonitor({ locationId }: Props) {
  const [data, setData] = useState<BacklogData | null>(null);
  const [dismissed, setDismissed] = useState<BacklogLevel | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-backlog-monitor?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        if (d.ok) {
          setData(d.data);
          // Re-show bei Level-Eskalation
          if (dismissed && d.data.alertLevel === 'critical' && dismissed !== 'critical') {
            setDismissed(null);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId || !data) return null;
  if (data.alertLevel === 'ok') return null;
  if (dismissed === data.alertLevel) return null;

  const cfg = levelConfig[data.alertLevel];
  if (!cfg) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border px-5 py-4',
        cfg.bg,
        cfg.border,
        cfg.pulse && 'animate-pulse-border',
      )}
    >
      <div className="flex items-start gap-3">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{cfg.title}</span>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              data.alertLevel === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-400 text-white',
            )}>
              {data.backlogCount} Bestellungen
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5">
            {data.backlogCount} von {data.totalInPrep} Bestellungen warten &gt;{data.thresholdMin} Min
            {data.longestWaitMin > 0 && ` · Längste Wartezeit: ${data.longestWaitMin} Min`}
          </p>

          {/* Bestellliste bei critical */}
          {data.alertLevel === 'critical' && data.orders.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.orders.map((o) => (
                <span
                  key={o.orderId}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold border',
                    o.waitMinutes > 30 ? 'bg-red-100 border-red-300 text-red-700' : 'bg-amber-100 border-amber-300 text-amber-700',
                  )}
                  title={`Zone ${o.zone ?? '?'} · ${o.waitMinutes} Min`}
                >
                  #{o.bestellnummer ?? o.orderId.slice(-4)} · {o.waitMinutes} Min
                </span>
              ))}
            </div>
          )}

          {/* Fortschrittsbalken */}
          <div className="mt-2 bg-white/60 rounded-full h-1.5 w-full max-w-xs">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all',
                data.alertLevel === 'critical' ? 'bg-red-500' : 'bg-amber-400',
              )}
              style={{
                width: `${Math.min(100, Math.round((data.backlogCount / Math.max(data.alertCountThreshold * 2, 1)) * 100))}%`,
              }}
            />
          </div>
        </div>

        <button
          onClick={() => setDismissed(data.alertLevel)}
          className="text-stone-400 hover:text-stone-600 transition shrink-0"
          title="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
