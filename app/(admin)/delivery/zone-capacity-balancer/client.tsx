'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Shuffle, Users, Package, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneSnap {
  zone:           string;
  pending_orders: number;
  active_orders:  number;
  idle_drivers:   number;
  busy_drivers:   number;
  capacity_score: number;
  demand_score:   number;
  imbalance_flag: boolean;
}

interface Suggestion {
  id:          string;
  from_zone:   string | null;
  to_zone:     string;
  driver_name: string | null;
  reason:      string;
  urgency:     'normal' | 'high' | 'critical';
  status:      string;
  suggested_at: string;
}

interface Dashboard {
  zones:               ZoneSnap[];
  pendingSuggestions:  Suggestion[];
  recentResolved:      Suggestion[];
  summary: {
    totalZones:        number;
    imbalancedZones:   number;
    idleDrivers:       number;
    urgentSuggestions: number;
  };
}

const ZONE_COLOR: Record<string, string> = {
  A: 'bg-emerald-500',
  B: 'bg-blue-500',
  C: 'bg-amber-500',
  D: 'bg-red-500',
};

const URGENCY_CFG: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  normal:   { label: 'Normal',   color: 'bg-stone-100 text-stone-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  high:     { label: 'Hoch',     color: 'bg-amber-100 text-amber-800',    icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  critical: { label: 'Kritisch', color: 'bg-red-100 text-red-800',        icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

function CapacityBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 60 ? 'bg-emerald-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-stone-100">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-stone-500 w-8 text-right">{Math.round(pct)}</span>
    </div>
  );
}

export function ZoneCapacityBalancerClient({ locationId }: { locationId: string }) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [tab, setTab]         = useState<'zones' | 'suggestions' | 'resolved'>('zones');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/zone-capacity-balancer', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const snap = async () => {
    setSnapping(true);
    try {
      await fetch('/api/delivery/admin/zone-capacity-balancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snap' }),
      });
      await load();
    } finally {
      setSnapping(false);
    }
  };

  const resolve = async (id: string, action: 'accept' | 'dismiss') => {
    await fetch('/api/delivery/admin/zone-capacity-balancer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, suggestion_id: id }),
    });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Lade Zonen-Kapazität…
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Zonen gesamt',     value: summary?.totalZones      ?? '–', icon: <Shuffle className="h-5 w-5 text-blue-500" /> },
          { label: 'Überlastet',        value: summary?.imbalancedZones  ?? '–', icon: <AlertTriangle className="h-5 w-5 text-red-500" /> },
          { label: 'Freie Fahrer',      value: summary?.idleDrivers      ?? '–', icon: <Users className="h-5 w-5 text-emerald-500" /> },
          { label: 'Dringende Emp.',    value: summary?.urgentSuggestions ?? '–', icon: <Package className="h-5 w-5 text-amber-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl border bg-white p-4 flex items-center gap-3">
            {icon}
            <div>
              <div className="text-2xl font-black text-stone-800">{String(value)}</div>
              <div className="text-[11px] text-stone-500 font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['zones', 'suggestions', 'resolved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all',
                tab === t ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
              )}
            >
              {t === 'zones' ? 'Zonen-Übersicht' : t === 'suggestions' ? `Empfehlungen (${data?.pendingSuggestions.length ?? 0})` : 'Erledigt'}
            </button>
          ))}
        </div>
        <button
          onClick={snap}
          disabled={snapping}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', snapping && 'animate-spin')} />
          Snapshot
        </button>
      </div>

      {/* Zonen-Übersicht */}
      {tab === 'zones' && (
        <div className="grid md:grid-cols-2 gap-4">
          {(data?.zones ?? []).map((z) => (
            <div
              key={z.zone}
              className={cn(
                'rounded-xl border bg-white p-5 space-y-3',
                z.imbalance_flag && 'border-red-200 bg-red-50',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-white font-black text-sm', ZONE_COLOR[z.zone] ?? 'bg-stone-400')}>
                    {z.zone}
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">Zone {z.zone}</div>
                    {z.imbalance_flag && (
                      <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Überlastet</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <div className="text-[10px] text-stone-400 uppercase tracking-wide">Bestellungen</div>
                  <div className="font-bold text-stone-800">{z.pending_orders + z.active_orders}</div>
                  <div className="text-[10px] text-stone-400">{z.pending_orders} wartend · {z.active_orders} aktiv</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] text-stone-400 uppercase tracking-wide">Fahrer</div>
                  <div className="font-bold text-stone-800">{z.idle_drivers + z.busy_drivers}</div>
                  <div className="text-[10px] text-stone-400">{z.idle_drivers} frei · {z.busy_drivers} beschäftigt</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Kapazitäts-Score</div>
                <CapacityBar score={z.capacity_score} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empfehlungen */}
      {tab === 'suggestions' && (
        <div className="space-y-3">
          {(data?.pendingSuggestions ?? []).length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              Keine offenen Empfehlungen — alle Zonen gut ausbalanciert ✓
            </div>
          ) : (
            (data?.pendingSuggestions ?? []).map((s) => {
              const urg = URGENCY_CFG[s.urgency] ?? URGENCY_CFG.normal;
              return (
                <div key={s.id} className="rounded-xl border bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', urg.color)}>
                        {urg.icon} {urg.label}
                      </span>
                      <span className="text-sm font-semibold text-stone-700 truncate">
                        {s.from_zone ? `Zone ${s.from_zone} → Zone ${s.to_zone}` : `Fahrer → Zone ${s.to_zone}`}
                      </span>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => resolve(s.id, 'accept')}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> OK
                      </button>
                      <button
                        onClick={() => resolve(s.id, 'dismiss')}
                        className="flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-600 rounded text-xs font-semibold hover:bg-stone-200"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Ablehnen
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-stone-600">{s.reason}</div>
                  {s.driver_name && (
                    <div className="text-[11px] text-stone-400">Vorgeschlagener Fahrer: <strong className="text-stone-600">{s.driver_name}</strong></div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Erledigt */}
      {tab === 'resolved' && (
        <div className="space-y-2">
          {(data?.recentResolved ?? []).length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">Noch keine erledigten Empfehlungen</div>
          ) : (
            (data?.recentResolved ?? []).map((s) => (
              <div key={s.id} className="rounded-lg border bg-white p-3 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {s.status === 'accepted' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-stone-300 shrink-0" />
                  )}
                  <span className="text-stone-700 truncate">{s.from_zone ? `Zone ${s.from_zone} → ${s.to_zone}` : `→ Zone ${s.to_zone}`}</span>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0',
                  s.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500',
                )}>
                  {s.status === 'accepted' ? 'Angenommen' : 'Abgelehnt'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
