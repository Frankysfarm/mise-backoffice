'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Loader2, Zap, Clock } from 'lucide-react';

interface BacklogData {
  openOrders: number;
  inPrepOrders: number;
  avgPrepMin: number;
  clearingTimeMin: number;
  clearingLabel: string;
  urgency: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  overdueCount: number;
  capacityFactor: number;
  recommendation: string;
}

interface Props {
  locationId?: string | null;
}

const URGENCY: Record<string, {
  bg: string; border: string; text: string; badge: string; dot: string; icon: typeof AlertTriangle;
}> = {
  niedrig:  { bg: 'bg-matcha-50',  border: 'border-matcha-300',  text: 'text-matcha-800',  badge: 'bg-matcha-600 text-white',  dot: 'bg-matcha-500',  icon: CheckCircle2   },
  mittel:   { bg: 'bg-blue-50',    border: 'border-blue-300',    text: 'text-blue-800',    badge: 'bg-blue-600 text-white',    dot: 'bg-blue-500',    icon: Clock          },
  hoch:     { bg: 'bg-amber-50',   border: 'border-amber-400',   text: 'text-amber-800',   badge: 'bg-amber-500 text-white',   dot: 'bg-amber-500',   icon: AlertTriangle  },
  kritisch: { bg: 'bg-red-50',     border: 'border-red-400',     text: 'text-red-800',     badge: 'bg-red-600 text-white',     dot: 'bg-red-500',     icon: Zap            },
};

const URGENCY_LABEL: Record<string, string> = {
  niedrig: 'Kapazität OK', mittel: 'Leicht ausgelastet', hoch: 'Hohe Auslastung', kritisch: 'Überlastet',
};

export function KitchenEchtzeitKapazitaetsAmpel({ locationId }: Props) {
  const [data, setData] = useState<BacklogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/admin/kuechen-backlog-klarierung?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!cancelled) { setData(d?.data ?? null); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId || loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Kapazitäts-Ampel lädt…
      </div>
    );
  }

  if (!data) return null;

  const cfg = URGENCY[data.urgency] ?? URGENCY.niedrig;
  const Icon = cfg.icon;
  const isPulsing = data.urgency === 'hoch' || data.urgency === 'kritisch';

  return (
    <div className={cn('rounded-xl border-2 px-4 py-3 flex items-center gap-3', cfg.bg, cfg.border)}>
      {/* Puls-Dot */}
      <div className="relative shrink-0 flex h-8 w-8 items-center justify-center">
        {isPulsing && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-30', cfg.dot)} />
        )}
        <span className={cn('relative inline-flex h-5 w-5 rounded-full items-center justify-center', cfg.dot)}>
          <Icon size={12} className="text-white" />
        </span>
      </div>

      {/* Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-black uppercase tracking-wide', cfg.text)}>
            {URGENCY_LABEL[data.urgency]}
          </span>
          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', cfg.badge)}>
            {data.clearingLabel}
          </span>
          {data.overdueCount > 0 && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[9px] font-bold">
              {data.overdueCount} überfällig
            </span>
          )}
        </div>
        <div className={cn('mt-0.5 text-[11px] truncate', cfg.text, 'opacity-80')}>
          {data.recommendation}
        </div>
      </div>

      {/* Zähler */}
      <div className="shrink-0 text-right">
        <div className={cn('font-mono text-xl font-black tabular-nums', cfg.text)}>
          {data.openOrders}
        </div>
        <div className="text-[8px] text-muted-foreground">offen</div>
      </div>
    </div>
  );
}
