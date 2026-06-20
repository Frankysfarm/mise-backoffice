'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Zap, Star, TrendingUp, Euro, Users, RefreshCw, Settings,
  ChevronDown, ChevronRight, Clock, Trophy, Flame, Shield,
  CheckCircle, Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IncentiveV2Dashboard, IncentiveV2Config } from '@/lib/delivery/driver-incentive-v2';

interface Props {
  locationId: string;
  initial: IncentiveV2Dashboard;
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'peak_hour':      return 'Peak-Hour';
    case 'loyalty_streak': return 'Treue-Streak';
    case 'on_time_bonus':  return 'Pünktlichkeit';
    default:               return 'Basis-Lieferung';
  }
}

function reasonColor(reason: string): string {
  switch (reason) {
    case 'peak_hour':      return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'loyalty_streak': return 'bg-purple-100 text-purple-700 border-purple-300';
    case 'on_time_bonus':  return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    default:               return 'bg-slate-100 text-slate-600 border-slate-300';
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'leaderboard' | 'events' | 'config';

export function IncentiveV2Client({ locationId, initial }: Props) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(initial.config);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/incentive-v2?location_id=${locationId}`);
      const json = await res.json();
      if (json.ok) {
        setData(json as IncentiveV2Dashboard);
        setConfig(json.config);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/incentive-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          location_id: locationId,
          enabled: config.enabled,
          base_points_per_delivery: config.basePointsPerDelivery,
          peak_hours: config.peakHours,
          peak_multiplier: config.peakMultiplier,
          loyalty_min_shifts: config.loyaltyMinShifts,
          loyalty_multiplier: config.loyaltyMultiplier,
          points_to_eur_rate: config.pointsToEurRate,
          min_payout_points: config.minPayoutPoints,
          auto_approve: config.autoApprove,
        }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }, [config, locationId, reload]);

  const evaluateNow = useCallback(async () => {
    setActionLoading('evaluate');
    try {
      await fetch('/api/delivery/admin/incentive-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate_now', location_id: locationId }),
      });
      await reload();
    } finally {
      setActionLoading(null);
    }
  }, [locationId, reload]);

  const approveDriver = useCallback(async (driverId: string) => {
    setActionLoading(driverId);
    try {
      await fetch('/api/delivery/admin/incentive-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_driver', location_id: locationId, driver_id: driverId }),
      });
      await reload();
    } finally {
      setActionLoading(null);
    }
  }, [locationId, reload]);

  const markPaid = useCallback(async (driverId: string) => {
    setActionLoading(`paid-${driverId}`);
    try {
      await fetch('/api/delivery/admin/incentive-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', location_id: locationId, driver_id: driverId }),
      });
      await reload();
    } finally {
      setActionLoading(null);
    }
  }, [locationId, reload]);

  const eurPerPoint = data.config.pointsToEurRate;

  return (
    <div className="space-y-6">
      {/* Header-Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['overview', 'leaderboard', 'events', 'config'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground',
            )}
          >
            {t === 'overview' ? 'Übersicht' : t === 'leaderboard' ? 'Leaderboard' : t === 'events' ? 'Ereignisse' : 'Konfiguration'}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={evaluateNow} disabled={actionLoading === 'evaluate'}>
            <Zap size={14} className="mr-1" />
            {actionLoading === 'evaluate' ? 'Scannt…' : 'Jetzt scannen'}
          </Button>
          <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw size={14} className={cn('mr-1', loading && 'animate-spin')} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* ── Overview Tab ──────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { icon: <Star size={16} />, label: 'Punkte heute', value: data.totalPointsToday.toLocaleString('de-DE'), color: 'text-amber-600' },
              { icon: <Euro size={16} />, label: 'Ausstehend', value: fmtEur(data.totalEurPending), color: 'text-emerald-600' },
              { icon: <Banknote size={16} />, label: 'Ausgezahlt', value: fmtEur(data.totalEurPaid), color: 'text-blue-600' },
              { icon: <Users size={16} />, label: 'Fahrer heute', value: data.driversWithPoints, color: 'text-purple-600' },
              { icon: <Flame size={16} />, label: 'Peak-Events', value: data.peakHourEventsToday, color: 'text-orange-600' },
              { icon: <Shield size={16} />, label: 'Treue-Events', value: data.loyaltyEventsToday, color: 'text-indigo-600' },
            ].map((kpi, i) => (
              <Card key={i} className="p-3">
                <div className={cn('mb-1', kpi.color)}>{kpi.icon}</div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold mt-0.5">{kpi.value}</p>
              </Card>
            ))}
          </div>

          {/* Peak-Hour-Info */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={16} className="text-amber-600" />
              <span className="font-semibold text-amber-800">Peak-Hour-Konfiguration</span>
              {data.config.peakHours.includes(new Date().getHours()) && (
                <span className="ml-auto text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  JETZT AKTIV
                </span>
              )}
            </div>
            <p className="text-sm text-amber-700">
              Stunden: {data.config.peakHours.map((h) => `${h}:00`).join(', ')} ·{' '}
              Multiplikator: <strong>×{data.config.peakMultiplier}</strong>
            </p>
          </Card>

          {/* Loyalty-Streak-Info */}
          <Card className="p-4 bg-purple-50 border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-purple-600" />
              <span className="font-semibold text-purple-800">Treue-Streak</span>
            </div>
            <p className="text-sm text-purple-700">
              Ab <strong>{data.config.loyaltyMinShifts} konsekutiven Schichten</strong> ·{' '}
              Multiplikator: <strong>×{data.config.loyaltyMultiplier}</strong>
            </p>
          </Card>
        </>
      )}

      {/* ── Leaderboard Tab ───────────────────────────────────── */}
      {tab === 'leaderboard' && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" /> Fahrer-Leaderboard (heute)
          </h3>
          {data.leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine Punkte heute</p>
          ) : (
            <div className="space-y-2">
              {data.leaderboard.map((entry, i) => (
                <div
                  key={entry.driverId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40"
                >
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    i === 0 ? 'bg-amber-400 text-white' :
                    i === 1 ? 'bg-slate-300 text-slate-700' :
                    i === 2 ? 'bg-orange-300 text-white' :
                    'bg-muted text-muted-foreground',
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{entry.driverName ?? 'Unbekannt'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.currentStreak > 0 && (
                        <span className="text-xs text-purple-600">
                          🔥 {entry.currentStreak}er Streak
                        </span>
                      )}
                      {entry.isPeakActive && (
                        <span className="text-xs text-amber-600">⚡ Peak aktiv</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{entry.pointsToday.toLocaleString('de-DE')} Pkt</p>
                    <p className="text-xs text-muted-foreground">{fmtEur(entry.eurEquivalent)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2"
                      onClick={() => approveDriver(entry.driverId)}
                      disabled={actionLoading === entry.driverId}
                    >
                      <CheckCircle size={12} className="mr-1" />
                      Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2"
                      onClick={() => markPaid(entry.driverId)}
                      disabled={actionLoading === `paid-${entry.driverId}`}
                    >
                      <Banknote size={12} className="mr-1" />
                      Bezahlt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Events Tab ────────────────────────────────────────── */}
      {tab === 'events' && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} /> Letzte Ereignisse (heute)
          </h3>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Ereignisse heute</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left pb-2 pr-3">Fahrer</th>
                    <th className="text-left pb-2 pr-3">Typ</th>
                    <th className="text-right pb-2 pr-3">Punkte</th>
                    <th className="text-right pb-2 pr-3">Mult.</th>
                    <th className="text-right pb-2 pr-3">EUR</th>
                    <th className="text-left pb-2">Zeitpunkt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEvents.map((ev) => (
                    <tr key={ev.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{ev.driverName ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded border', reasonColor(ev.reason))}>
                          {reasonLabel(ev.reason)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-bold">{ev.totalPoints}</td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">×{ev.multiplier.toFixed(1)}</td>
                      <td className="py-2 pr-3 text-right text-emerald-600">{fmtEur(ev.eurEquivalent)}</td>
                      <td className="py-2 text-muted-foreground text-xs">{fmtDate(ev.earnedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Config Tab ────────────────────────────────────────── */}
      {tab === 'config' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <Settings size={16} /> Engine-Konfiguration
          </h3>
          <div className="space-y-5 max-w-md">
            {/* Aktiviert */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Engine aktiviert</label>
              <button
                onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative',
                  config.enabled ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  config.enabled ? 'translate-x-5' : 'translate-x-1',
                )} />
              </button>
            </div>

            <hr />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basispunkte</p>

            {/* Basis-Punkte */}
            <div>
              <label className="text-sm font-medium block mb-1">Punkte je Lieferung</label>
              <input
                type="number"
                min={1}
                max={100}
                value={config.basePointsPerDelivery}
                onChange={(e) => setConfig((c) => ({ ...c, basePointsPerDelivery: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>

            {/* EUR-Rate */}
            <div>
              <label className="text-sm font-medium block mb-1">Punkte → EUR Rate (Punkte pro EUR)</label>
              <input
                type="number"
                min={0.001}
                max={1}
                step={0.001}
                value={config.pointsToEurRate}
                onChange={(e) => setConfig((c) => ({ ...c, pointsToEurRate: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Bei {config.basePointsPerDelivery} Punkten = {(config.basePointsPerDelivery * config.pointsToEurRate).toFixed(3)} EUR je Lieferung
              </p>
            </div>

            <hr />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peak-Hour</p>

            {/* Peak-Multiplikator */}
            <div>
              <label className="text-sm font-medium block mb-1">Peak-Multiplikator</label>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={config.peakMultiplier}
                onChange={(e) => setConfig((c) => ({ ...c, peakMultiplier: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>

            <hr />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Treue-Streak</p>

            {/* Mindest-Schichten */}
            <div>
              <label className="text-sm font-medium block mb-1">Mindest-Schichten für Streak</label>
              <input
                type="number"
                min={2}
                max={30}
                value={config.loyaltyMinShifts}
                onChange={(e) => setConfig((c) => ({ ...c, loyaltyMinShifts: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>

            {/* Loyalty-Multiplikator */}
            <div>
              <label className="text-sm font-medium block mb-1">Treue-Multiplikator</label>
              <input
                type="number"
                min={1}
                max={5}
                step={0.25}
                value={config.loyaltyMultiplier}
                onChange={(e) => setConfig((c) => ({ ...c, loyaltyMultiplier: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>

            <hr />

            {/* Min-Auszahlung */}
            <div>
              <label className="text-sm font-medium block mb-1">Mindest-Punkte für Auszahlung</label>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={config.minPayoutPoints}
                onChange={(e) => setConfig((c) => ({ ...c, minPayoutPoints: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                = {(config.minPayoutPoints * config.pointsToEurRate).toFixed(2)} EUR Mindestauszahlung
              </p>
            </div>

            {/* Auto-Approve */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Auto-Genehmigung</label>
                <p className="text-xs text-muted-foreground">Punkte automatisch nach 24h genehmigen</p>
              </div>
              <button
                onClick={() => setConfig((c) => ({ ...c, autoApprove: !c.autoApprove }))}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative flex-shrink-0',
                  config.autoApprove ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  config.autoApprove ? 'translate-x-5' : 'translate-x-1',
                )} />
              </button>
            </div>

            <Button onClick={saveConfig} disabled={saving} className="w-full">
              {saving ? 'Speichert…' : 'Konfiguration speichern'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
