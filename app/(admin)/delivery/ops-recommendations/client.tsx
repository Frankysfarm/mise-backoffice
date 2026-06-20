'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Zap, TrendingDown, Clock, WifiOff, DollarSign, Users,
  ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RecoPriority = 'critical' | 'high' | 'normal' | 'low';
type RecoStatus = 'pending' | 'accepted' | 'dismissed' | 'expired' | 'auto_resolved';

interface OpsReco {
  id: string;
  type: string;
  priority: RecoPriority;
  title: string;
  body: string;
  action_label: string | null;
  action_type: string | null;
  action_params: Record<string, unknown>;
  status: RecoStatus;
  impact_estimate: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Dashboard {
  active: OpsReco[];
  recentResolved: OpsReco[];
  stats: {
    totalActive: number;
    criticalCount: number;
    highCount: number;
    resolvedToday: number;
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<RecoPriority, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  critical: {
    label: 'Kritisch',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-300',
    icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
  },
  high: {
    label: 'Hoch',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  },
  normal: {
    label: 'Normal',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: <Zap className="h-4 w-4 text-blue-600" />,
  },
  low: {
    label: 'Info',
    bg: 'bg-stone-50',
    text: 'text-stone-700',
    border: 'border-stone-200',
    icon: <Zap className="h-4 w-4 text-stone-500" />,
  },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  pending_orders_stale: <Clock className="h-4 w-4" />,
  driver_shortage: <Users className="h-4 w-4" />,
  sla_breach_risk: <TrendingDown className="h-4 w-4" />,
  revenue_below_target: <DollarSign className="h-4 w-4" />,
  surge_pricing_activate: <Zap className="h-4 w-4" />,
  driver_offline_on_tour: <WifiOff className="h-4 w-4" />,
};

const STATUS_CFG: Record<RecoStatus, { label: string; color: string }> = {
  pending: { label: 'Aktiv', color: 'text-stone-600' },
  accepted: { label: 'Angenommen', color: 'text-emerald-700' },
  dismissed: { label: 'Abgelehnt', color: 'text-stone-400' },
  expired: { label: 'Abgelaufen', color: 'text-stone-400' },
  auto_resolved: { label: 'Automatisch gelöst', color: 'text-blue-600' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'Gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const h = Math.floor(diffMin / 60);
  return `vor ${h} Std`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className={cn('text-2xl font-bold font-display', color)}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function RecoCard({
  reco,
  onResolve,
  resolving,
}: {
  reco: OpsReco;
  onResolve: (id: string, status: 'accepted' | 'dismissed') => void;
  resolving: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PRIORITY_CFG[reco.priority];

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', cfg.bg, cfg.border)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', cfg.text)}>{TYPE_ICON[reco.type] ?? cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', cfg.text, 'bg-white/60')}>
              {cfg.label}
            </span>
            <span className="text-[11px] text-stone-400">{timeAgo(reco.created_at)}</span>
          </div>
          <div className={cn('font-semibold mt-1 leading-snug', cfg.text)}>{reco.title}</div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-stone-400 hover:text-stone-600 mt-0.5"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Body (collapsed by default) */}
      {expanded && (
        <div className="text-sm text-stone-700 leading-relaxed pl-7">{reco.body}</div>
      )}

      {/* Impact */}
      {reco.impact_estimate && (
        <div className="pl-7 text-xs text-stone-500 italic">{reco.impact_estimate}</div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pl-7">
        {reco.action_label && reco.action_params.path && (
          <a
            href={reco.action_params.path as string}
            className="inline-flex items-center gap-1 text-xs font-semibold text-matcha-800 hover:underline"
          >
            {reco.action_label} <ArrowRight className="h-3 w-3" />
          </a>
        )}
        <div className="flex-1" />
        <button
          onClick={() => onResolve(reco.id, 'accepted')}
          disabled={resolving === reco.id}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Erledigt
        </button>
        <button
          onClick={() => onResolve(reco.id, 'dismissed')}
          disabled={resolving === reco.id}
          className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" /> Ignorieren
        </button>
      </div>
    </div>
  );
}

function ResolvedRow({ reco }: { reco: OpsReco }) {
  const statusCfg = STATUS_CFG[reco.status];
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <div className="text-stone-400 mt-0.5">{TYPE_ICON[reco.type] ?? <Zap className="h-4 w-4" />}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{reco.title}</div>
        <div className="text-xs text-muted-foreground">{timeAgo(reco.created_at)}</div>
      </div>
      <span className={cn('text-xs font-semibold shrink-0', statusCfg.color)}>{statusCfg.label}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OpsRecommendationsClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'resolved'>('active');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/ops-recommendations', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/delivery/admin/ops-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_now' }),
      });
      if (res.ok) setData(await res.json());
    } finally {
      setRunning(false);
    }
  };

  const resolve = async (id: string, status: 'accepted' | 'dismissed') => {
    setResolving(id);
    try {
      const res = await fetch('/api/delivery/admin/ops-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id, status }),
      });
      if (res.ok) setData(await res.json());
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Lade Empfehlungen…
      </div>
    );
  }

  const stats = data?.stats ?? { totalActive: 0, criticalCount: 0, highCount: 0, resolvedToday: 0 };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Aktive Empfehlungen" value={stats.totalActive} color="text-stone-800" />
        <KpiCard label="Kritisch" value={stats.criticalCount} color="text-red-700" />
        <KpiCard label="Hoch" value={stats.highCount} color="text-amber-700" />
        <KpiCard label="Heute erledigt" value={stats.resolvedToday} color="text-emerald-700" />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['active', 'resolved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition',
                tab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'active' ? `Aktiv (${stats.totalActive})` : 'Erledigt (24h)'}
            </button>
          ))}
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-matcha-800 text-white text-sm font-semibold hover:bg-matcha-900 disabled:opacity-50 transition"
        >
          <RefreshCw className={cn('h-4 w-4', running && 'animate-spin')} />
          Jetzt scannen
        </button>
      </div>

      {/* Active Tab */}
      {tab === 'active' && (
        <div className="space-y-3">
          {(data?.active ?? []).length === 0 ? (
            <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-semibold text-emerald-800">Alles grün — keine offenen Empfehlungen</div>
              <div className="text-sm text-emerald-600 mt-1">Der Scan läuft alle 5 Minuten automatisch.</div>
            </div>
          ) : (
            (data?.active ?? []).map((reco) => (
              <RecoCard
                key={reco.id}
                reco={reco}
                onResolve={resolve}
                resolving={resolving}
              />
            ))
          )}
        </div>
      )}

      {/* Resolved Tab */}
      {tab === 'resolved' && (
        <div className="rounded-xl border bg-card divide-y">
          {(data?.recentResolved ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Noch keine erledigten Empfehlungen in den letzten 24h.
            </div>
          ) : (
            <div className="p-4 space-y-0">
              {(data?.recentResolved ?? []).map((reco) => (
                <ResolvedRow key={reco.id} reco={reco} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Automatischer Scan alle 5 Min · 60s Auto-Refresh · Empfehlungen laufen nach 2h ab
      </p>
    </div>
  );
}
