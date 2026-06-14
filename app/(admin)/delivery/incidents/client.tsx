'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';

type IncidentType = 'low_rating' | 'late_delivery' | 'wrong_item' | 'missing_item' | 'damaged' | 'driver_behavior' | 'failed_delivery' | 'manual';
type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed';

interface DeliveryIncident {
  id: string;
  order_id: string | null;
  driver_id: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string | null;
  customer_name: string | null;
  customer_rating: number | null;
  created_at: string;
  resolved_at: string | null;
}

interface IncidentStats {
  open: number;
  investigating: number;
  escalated: number;
  resolved_today: number;
  critical_open: number;
  avg_resolution_hours: number | null;
}

const TYPE_LABELS: Record<IncidentType, string> = {
  low_rating: 'Schlechte Bewertung',
  late_delivery: 'Verspätung',
  wrong_item: 'Falscher Artikel',
  missing_item: 'Fehlender Artikel',
  damaged: 'Beschädigt',
  driver_behavior: 'Fahrerverhalten',
  failed_delivery: 'Zustellfehler',
  manual: 'Manuell',
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Offen',
  investigating: 'In Prüfung',
  escalated: 'Eskaliert',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
};

function severityBadge(s: IncidentSeverity) {
  if (s === 'critical') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-300 text-red-700">Kritisch</span>;
  if (s === 'high') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-orange-50 border-orange-200 text-orange-700">Hoch</span>;
  if (s === 'medium') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-amber-50 border-amber-200 text-amber-700">Mittel</span>;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-muted border-border text-muted-foreground">Niedrig</span>;
}

function statusBadge(s: IncidentStatus) {
  if (s === 'escalated') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-200 text-red-700">Eskaliert</span>;
  if (s === 'investigating') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-blue-50 border-blue-200 text-blue-700">In Prüfung</span>;
  if (s === 'open') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-amber-50 border-amber-200 text-amber-700">Offen</span>;
  if (s === 'resolved') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-matcha-50 border-matcha-200 text-matcha-700">Gelöst</span>;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-muted border-border text-muted-foreground">Geschlossen</span>;
}

export function IncidentsClient({ locationId }: { locationId: string }) {
  void locationId;
  const [statusFilter, setStatusFilter] = useState<'open_all' | IncidentStatus>('open_all');
  const [incidents, setIncidents] = useState<DeliveryIncident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/delivery/admin/incidents?status=${statusFilter}&limit=50`).then(r => r.ok ? r.json() : null),
      fetch('/api/delivery/admin/incidents?stats=true').then(r => r.ok ? r.json() : null),
    ]).then(([listData, statsData]) => {
      if (listData?.incidents) { setIncidents(listData.incidents); setTotal(listData.total ?? 0); }
      if (statsData?.stats) setStats(statsData.stats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const STATUS_FILTER_OPTIONS: { value: 'open_all' | IncidentStatus; label: string }[] = [
    { value: 'open_all', label: 'Alle offen' },
    { value: 'open', label: 'Offen' },
    { value: 'investigating', label: 'In Prüfung' },
    { value: 'escalated', label: 'Eskaliert' },
    { value: 'resolved', label: 'Gelöst' },
    { value: 'closed', label: 'Geschlossen' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cn('rounded-xl border px-4 py-3', (stats.open + stats.investigating + stats.escalated) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Offen gesamt</div>
            <div className={cn('font-display text-2xl font-black', (stats.open + stats.investigating + stats.escalated) > 0 ? 'text-amber-700' : '')}>{stats.open + stats.investigating + stats.escalated}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', stats.critical_open > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Kritisch</div>
            <div className={cn('font-display text-2xl font-black', stats.critical_open > 0 ? 'text-red-700' : '')}>{stats.critical_open}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Heute gelöst</div>
            <div className="font-display text-2xl font-black">{stats.resolved_today}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ø Lösungszeit</div>
            <div className="font-display text-2xl font-black">
              {stats.avg_resolution_hours !== null ? `${stats.avg_resolution_hours.toFixed(1)}h` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              statusFilter === opt.value
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.label}
          </button>
        ))}
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Vorfälle…</div>}

      {!loading && incidents.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          Keine Vorfälle.
        </div>
      )}

      {!loading && incidents.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">{total} Vorfälle</span>
          </div>
          <div className="divide-y divide-border">
            {incidents.map(inc => (
              <div key={inc.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold">{inc.title}</span>
                    {severityBadge(inc.severity)}
                    {statusBadge(inc.status)}
                    <span className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{TYPE_LABELS[inc.type]}</span>
                  </div>
                  {inc.description && <p className="text-sm text-muted-foreground">{inc.description}</p>}
                  {inc.customer_name && <div className="text-[11px] text-muted-foreground mt-0.5">Kunde: {inc.customer_name}{inc.customer_rating ? ` · ★${inc.customer_rating}` : ''}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 text-right">
                  <div>{new Date(inc.created_at).toLocaleDateString('de-DE')}</div>
                  <div>{new Date(inc.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
