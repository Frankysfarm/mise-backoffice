'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, AlertCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type RecoPriority = 'critical' | 'high' | 'normal' | 'low';
type RecoType =
  | 'pending_orders_stale'
  | 'driver_shortage'
  | 'sla_breach_risk'
  | 'revenue_below_target'
  | 'surge_pricing_activate'
  | 'driver_offline_on_tour';

interface OpsReco {
  id: string;
  type: RecoType;
  priority: RecoPriority;
  title: string;
  body: string;
  action_label: string | null;
  impact_estimate: string | null;
}

interface Dashboard {
  active: OpsReco[];
  stats: {
    totalActive: number;
    criticalCount: number;
    highCount: number;
    resolvedToday: number;
  };
}

const KITCHEN_TYPES: RecoType[] = ['pending_orders_stale', 'sla_breach_risk'];

const PRIORITY_STYLE: Record<RecoPriority, { strip: string; badge: string; icon: string }> = {
  critical: { strip: 'bg-red-50 border-red-200',   badge: 'bg-red-500 text-white',   icon: 'text-red-500' },
  high:     { strip: 'bg-amber-50 border-amber-200', badge: 'bg-amber-400 text-white', icon: 'text-amber-500' },
  normal:   { strip: 'bg-blue-50 border-blue-200',  badge: 'bg-blue-400 text-white',  icon: 'text-blue-500' },
  low:      { strip: 'bg-stone-50 border-stone-200', badge: 'bg-stone-400 text-white', icon: 'text-stone-400' },
};

export function KitchenOpsRecoStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/ops-recommendations');
      if (res.ok) setData(await res.json() as Dashboard);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const dismiss = useCallback(async (id: string) => {
    setResolving(id);
    try {
      await fetch('/api/delivery/admin/ops-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id, status: 'dismissed' }),
      });
      setDismissed(prev => new Set([...prev, id]));
    } catch { /* ignore */ } finally {
      setResolving(null);
    }
  }, []);

  if (loading && !data) return null;

  const recos = (data?.active ?? [])
    .filter(r => KITCHEN_TYPES.includes(r.type) && !dismissed.has(r.id))
    .slice(0, 3);

  if (recos.length === 0) return null;

  return (
    <div className="space-y-2">
      {recos.map(reco => {
        const s = PRIORITY_STYLE[reco.priority];
        const Icon = reco.priority === 'critical' ? AlertTriangle : AlertCircle;
        return (
          <div key={reco.id} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', s.strip)}>
            <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', s.icon)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full', s.badge)}>
                  {reco.priority === 'critical' ? 'Kritisch' :
                   reco.priority === 'high'     ? 'Hoch'     :
                   reco.priority === 'normal'   ? 'Normal'   : 'Niedrig'}
                </span>
                <span className="text-xs font-bold text-foreground">{reco.title}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{reco.body}</p>
              {reco.impact_estimate && (
                <p className="mt-0.5 text-[10px] font-semibold text-matcha-700">{reco.impact_estimate}</p>
              )}
            </div>
            <button
              onClick={() => void dismiss(reco.id)}
              disabled={resolving === reco.id}
              className="shrink-0 p-1 rounded-lg hover:bg-black/10 transition disabled:opacity-50"
            >
              {resolving === reco.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                : <X className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
