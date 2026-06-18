'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shuffle, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Users, TrendingUp, Clock, ChevronDown, ChevronRight, Info,
  ArrowRight, Layers,
} from 'lucide-react';
import type {
  ZoneRebalancingDashboard,
  ZoneCapacityState,
  RebalancingEvent,
} from '@/lib/delivery/zone-rebalancing';

interface Props {
  locationId: string;
  initial: ZoneRebalancingDashboard | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function loadColor(level: string): string {
  switch (level) {
    case 'low':        return 'text-sky-600';
    case 'normal':     return 'text-green-600';
    case 'high':       return 'text-amber-500';
    case 'overloaded': return 'text-red-600';
    default:           return 'text-muted-foreground';
  }
}

function loadBg(level: string): string {
  switch (level) {
    case 'low':        return 'bg-sky-50 border-sky-200';
    case 'normal':     return 'bg-green-50 border-green-200';
    case 'high':       return 'bg-amber-50 border-amber-200';
    case 'overloaded': return 'bg-red-50 border-red-200 animate-pulse';
    default:           return 'bg-slate-50 border-slate-200';
  }
}

function loadLabel(level: string): string {
  switch (level) {
    case 'low':        return 'Niedrig';
    case 'normal':     return 'Normal';
    case 'high':       return 'Hoch';
    case 'overloaded': return 'Überlastet';
    default:           return level;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    suggested: 'bg-amber-100 text-amber-700',
    applied:   'bg-green-100 text-green-700',
    dismissed: 'bg-slate-100 text-slate-500',
  };
  const label: Record<string, string> = {
    suggested: 'Vorschlag',
    applied:   'Angewendet',
    dismissed: 'Verworfen',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {label[status] ?? status}
    </span>
  );
}

// ── ZoneLoadCard ──────────────────────────────────────────────────────────────

function ZoneLoadCard({ zone }: { zone: ZoneCapacityState }) {
  const barPct = Math.min(100, zone.utilizationPct);
  const barColor = zone.loadLevel === 'overloaded'
    ? 'bg-red-500'
    : zone.loadLevel === 'high'
    ? 'bg-amber-400'
    : zone.loadLevel === 'low'
    ? 'bg-sky-400'
    : 'bg-green-500';

  return (
    <div className={`border rounded-lg p-4 ${loadBg(zone.loadLevel)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-lg">Zone {zone.zoneName}</span>
        <span className={`text-sm font-semibold ${loadColor(zone.loadLevel)}`}>
          {loadLabel(zone.loadLevel)}
        </span>
      </div>
      <div className="w-full bg-white/60 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="font-bold text-base">{zone.activeDrivers}</div>
          <div className="text-muted-foreground">Fahrer</div>
        </div>
        <div>
          <div className="font-bold text-base">{zone.pendingOrders}</div>
          <div className="text-muted-foreground">Ausstehend</div>
        </div>
        <div>
          <div className="font-bold text-base">{zone.activeTours}</div>
          <div className="text-muted-foreground">Touren</div>
        </div>
      </div>
      {zone.avgWaitMin != null && (
        <div className="mt-2 text-xs text-center text-muted-foreground">
          Ø Wartezeit: <strong>{zone.avgWaitMin.toFixed(0)} Min</strong>
        </div>
      )}
    </div>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onApply,
  onDismiss,
  loading,
}: {
  event: RebalancingEvent;
  onApply?: (id: string) => void;
  onDismiss?: (id: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            Zone {event.fromZone} → Zone {event.toZone}
          </span>
          <span className="text-xs text-muted-foreground">
            {event.driversMoved} Fahrer
          </span>
          {statusBadge(event.status)}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{fmtTime(event.triggeredAt)}</span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t bg-muted/10">
          <p className="text-sm text-muted-foreground mt-3 mb-3">{event.triggerReason}</p>

          {event.snapshotBefore && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Zustand vor Umverteilung</div>
              <div className="grid grid-cols-4 gap-2">
                {event.snapshotBefore.map((z) => (
                  <div key={z.zoneName} className="text-center text-xs bg-white border rounded p-1.5">
                    <div className="font-bold">Zone {z.zoneName}</div>
                    <div className={loadColor(z.loadLevel)}>{loadLabel(z.loadLevel)}</div>
                    <div className="text-muted-foreground">{z.pendingOrders} Auftr.</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.snapshotAfter && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Zustand nach Umverteilung</div>
              <div className="grid grid-cols-4 gap-2">
                {event.snapshotAfter.map((z) => (
                  <div key={z.zoneName} className="text-center text-xs bg-white border rounded p-1.5">
                    <div className="font-bold">Zone {z.zoneName}</div>
                    <div className={loadColor(z.loadLevel)}>{loadLabel(z.loadLevel)}</div>
                    <div className="text-muted-foreground">{z.pendingOrders} Auftr.</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.notes && (
            <p className="text-xs text-muted-foreground italic mb-3">Notiz: {event.notes}</p>
          )}

          {event.status === 'suggested' && onApply && onDismiss && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onApply(event.id)}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Anwenden
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDismiss(event.id)}
                disabled={loading}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Verwerfen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ZoneRebalancingClient ────────────────────────────────────────────────────

export function ZoneRebalancingClient({ locationId, initial }: Props) {
  const [data, setData] = useState<ZoneRebalancingDashboard | null>(initial);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<'live' | 'pending' | 'history'>('live');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zone-rebalancing?location_id=${locationId}`);
      const json = await res.json() as { ok: boolean; dashboard: ZoneRebalancingDashboard };
      if (json.ok) setData(json.dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleSuggest = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zone-rebalancing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest' }),
      });
      const json = await res.json() as { ok: boolean; message?: string };
      if (json.ok) {
        showToast(json.message ?? 'Umverteilungsvorschlag erstellt');
        await refresh();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleApply = async (eventId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zone-rebalancing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', eventId }),
      });
      const json = await res.json() as { ok: boolean };
      if (json.ok) {
        showToast('Umverteilung angewendet ✓');
        await refresh();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (eventId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zone-rebalancing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', eventId }),
      });
      const json = await res.json() as { ok: boolean };
      if (json.ok) {
        showToast('Vorschlag verworfen');
        await refresh();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const s = data?.summary;

  return (
    <div className="space-y-6 pb-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <PageHeader
        title="Zonen-Umverteilung"
        description="Automatische Kapazitäts-Analyse und Fahrer-Rebalancing zwischen Lieferzonen"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
            <Button size="sm" onClick={handleSuggest} disabled={actionLoading}>
              <Shuffle className="h-4 w-4 mr-1" />
              Vorschlag erstellen
            </Button>
          </div>
        }
      />

      {/* KPI Band */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Überlastet',    value: s?.overloadedZones ?? 0,  icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Niedrig-Last',  value: s?.lowLoadZones ?? 0,     icon: TrendingUp,    color: 'text-sky-600' },
          { label: 'Vorschläge',    value: s?.totalSuggested ?? 0,   icon: Shuffle,       color: 'text-amber-600' },
          { label: 'Angewendet',    value: s?.totalApplied ?? 0,     icon: CheckCircle2,  color: 'text-green-600' },
          { label: 'Verworfen',     value: s?.totalDismissed ?? 0,   icon: XCircle,       color: 'text-slate-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4 text-center">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { id: 'live' as const,    label: 'Live-Auslastung', icon: Layers },
          { id: 'pending' as const, label: `Vorschläge (${data?.pendingEvents.length ?? 0})`, icon: Shuffle },
          { id: 'history' as const, label: 'Verlauf',         icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Live-Auslastung */}
      {tab === 'live' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(data?.currentLoad ?? []).map((zone) => (
              <ZoneLoadCard key={zone.zoneName} zone={zone} />
            ))}
          </div>
          {data?.currentLoad.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Keine Zonen-Daten verfügbar</p>
            </div>
          )}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-2 text-sm text-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong>Auslastungsberechnung:</strong> Ausstehende Bestellungen ÷ (Fahrer × 3 Stops-Kapazität) × 100.
                Über 100% = überlastet. Unter 30% = niedrige Last. Der Cron prüft alle 10 Minuten auf Ungleichgewichte.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Vorschläge */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {(data?.pendingEvents ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30 text-green-500" />
              <p className="font-medium">Keine offenen Vorschläge</p>
              <p className="text-sm">Alle Zonen sind gut ausbalanciert</p>
            </div>
          ) : (
            (data?.pendingEvents ?? []).map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                onApply={handleApply}
                onDismiss={handleDismiss}
                loading={actionLoading}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Verlauf */}
      {tab === 'history' && (
        <div className="space-y-2">
          {(data?.recentHistory ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Noch keine Umverteilungen durchgeführt</p>
            </div>
          ) : (
            (data?.recentHistory ?? []).map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
