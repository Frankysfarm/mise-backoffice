'use client';

import { useEffect, useState, useCallback } from 'react';
import { Lightbulb, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  created_at: string;
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

const TYPE_LABEL: Record<RecoType, string> = {
  pending_orders_stale:    'Veraltete Bestellungen',
  driver_shortage:          'Fahrermangel',
  sla_breach_risk:          'SLA-Risiko',
  revenue_below_target:     'Umsatz unter Ziel',
  surge_pricing_activate:   'Surge empfohlen',
  driver_offline_on_tour:   'Fahrer offline auf Tour',
};

const PRIORITY_CFG: Record<RecoPriority, { label: string; badgeClass: string; rowClass: string }> = {
  critical: { label: 'Kritisch', badgeClass: 'bg-red-500 text-white',    rowClass: 'border-l-4 border-red-400 bg-red-50/60'    },
  high:     { label: 'Hoch',     badgeClass: 'bg-amber-400 text-white',  rowClass: 'border-l-4 border-amber-400 bg-amber-50/60' },
  normal:   { label: 'Normal',   badgeClass: 'bg-blue-400 text-white',   rowClass: 'border-l-4 border-blue-300 bg-blue-50/40'   },
  low:      { label: 'Niedrig',  badgeClass: 'bg-stone-400 text-white',  rowClass: 'border-l-4 border-stone-300 bg-stone-50/40' },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  return `vor ${Math.floor(diffMin / 60)} Std`;
}

export function DispatchOpsDecisionPanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
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

  const resolve = useCallback(async (id: string, status: 'accepted' | 'dismissed') => {
    setResolving(id);
    try {
      await fetch('/api/delivery/admin/ops-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id, status }),
      });
      await load();
    } catch { /* ignore */ } finally {
      setResolving(null);
    }
  }, [load]);

  const recos = data?.active ?? [];
  const stats = data?.stats;

  if (!data && !loading) return null;
  if (data && recos.length === 0 && (stats?.resolvedToday ?? 0) === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Ops-Entscheidungs-Support
        </span>
        {stats && stats.criticalCount > 0 && (
          <Badge className="ml-1 bg-red-500 text-white text-[9px] px-1.5">
            {stats.criticalCount} Kritisch
          </Badge>
        )}
        {stats && stats.highCount > 0 && (
          <Badge className="ml-1 bg-amber-400 text-white text-[9px] px-1.5">
            {stats.highCount} Hoch
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {stats && (
            <span className="text-[10px] text-muted-foreground">
              {stats.resolvedToday} heute erledigt
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); void load(); }}
            className="p-1 rounded hover:bg-muted transition"
          >
            <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
          </button>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="divide-y">
          {loading && recos.length === 0 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {recos.length === 0 && !loading && (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              Alle Systeme im grünen Bereich — keine Empfehlungen aktiv.
            </div>
          )}
          {recos.map(reco => {
            const cfg = PRIORITY_CFG[reco.priority];
            return (
              <div key={reco.id} className={cn('px-4 py-3 space-y-1.5', cfg.rowClass)}>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0', cfg.badgeClass)}>
                    {cfg.label}
                  </span>
                  <span className="text-xs font-bold text-foreground">{reco.title}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto shrink-0">{timeAgo(reco.created_at)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{reco.body}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-semibold text-stone-400 uppercase tracking-wide">
                    {TYPE_LABEL[reco.type]}
                  </span>
                  {reco.impact_estimate && (
                    <span className="text-[10px] font-bold text-matcha-700">{reco.impact_estimate}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => void resolve(reco.id, 'accepted')}
                      disabled={resolving === reco.id}
                      className="flex items-center gap-1 rounded-lg bg-matcha-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-matcha-700 disabled:opacity-50 transition"
                    >
                      {resolving === reco.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <CheckCircle2 className="h-3 w-3" />}
                      {reco.action_label ?? 'Annehmen'}
                    </button>
                    <button
                      onClick={() => void resolve(reco.id, 'dismissed')}
                      disabled={resolving === reco.id}
                      className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:bg-stone-50 disabled:opacity-50 transition"
                    >
                      <XCircle className="h-3 w-3" />
                      Ignorieren
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
