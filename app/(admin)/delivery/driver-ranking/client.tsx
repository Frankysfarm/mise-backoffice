'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Trophy, Star, Clock, RefreshCw, Zap, CheckCircle, XCircle,
  Euro, Users, TrendingUp, Award, ChevronDown, ChevronRight,
  Banknote, Target, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RankingDashboard, WeeklyRankingEntry, RankingReward, RewardConfig } from '@/lib/delivery/driver-ranking';

interface Props {
  locationId: string;
  employeeId: string;
  initial: RankingDashboard;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function rankColor(rank: number): string {
  if (rank === 1) return 'bg-amber-100 text-amber-700 border-amber-300';
  if (rank === 2) return 'bg-slate-100 text-slate-600 border-slate-300';
  if (rank === 3) return 'bg-orange-50 text-orange-600 border-orange-200';
  return 'bg-muted text-muted-foreground border-border';
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A+': return 'bg-matcha-100 text-matcha-800 border-matcha-300';
    case 'A':  return 'bg-green-50 text-green-700 border-green-200';
    case 'B':  return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'C':  return 'bg-amber-50 text-amber-700 border-amber-200';
    default:   return 'bg-red-50 text-red-700 border-red-200';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'pending':  return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'approved': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'paid':     return 'bg-matcha-50 text-matcha-700 border-matcha-200';
    case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
    default:         return 'bg-muted text-muted-foreground border-border';
  }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, accent, iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  iconClass?: string;
}) {
  return (
    <Card className={cn('p-4', accent && 'border-amber-300 bg-amber-50/30')}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', iconClass ?? 'text-matcha-700')} />
        {label}
      </div>
      <div className="text-2xl font-black text-stone-800 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

// ── Ranking Row ───────────────────────────────────────────────────────────────

function RankingRow({ entry }: { entry: WeeklyRankingEntry }) {
  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black border',
            rankColor(entry.rank),
          )}>
            {entry.rank}
          </span>
          {entry.rank === 1 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-xs font-bold shrink-0">
            {entry.initials}
          </div>
          <div>
            <div className="text-sm font-semibold">{entry.driverName ?? entry.driverId.slice(0, 8)}</div>
            <div className="text-[11px] text-muted-foreground">{entry.toursCompleted} Touren</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="text-sm font-black tabular-nums">{fmt(entry.compositeScore)}</div>
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black border', gradeColor(entry.grade))}>
            {entry.grade}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">{entry.stopsCompleted}</td>
      <td className="px-4 py-3">
        {entry.onTimeRate != null ? (
          <span className={cn('text-sm font-bold tabular-nums',
            entry.onTimeRate >= 0.9 ? 'text-matcha-700' :
            entry.onTimeRate >= 0.75 ? 'text-amber-600' : 'text-red-600')}>
            {Math.round(entry.onTimeRate * 100)}%
          </span>
        ) : <span className="text-sm text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3">
        {entry.avgRating != null ? (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium tabular-nums">{fmt(entry.avgRating, 1)}</span>
          </div>
        ) : <span className="text-sm text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
        {fmtEur(entry.totalEarningsEur)}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
        {fmt(entry.kmTotal, 1)} km
      </td>
    </tr>
  );
}

// ── Reward Row ────────────────────────────────────────────────────────────────

function RewardRow({
  reward,
  onApprove,
  onReject,
  onPaid,
}: {
  reward: RankingReward;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
  onPaid: (id: string) => void;
}) {
  const [note, setNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black border',
          rankColor(reward.rank),
        )}>
          {reward.rank}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-xs font-bold shrink-0">
            {reward.initials}
          </div>
          <span className="text-sm font-medium">{reward.driverName ?? reward.driverId.slice(0, 8)}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-black tabular-nums text-matcha-700">{fmtEur(reward.bonusEur)}</span>
      </td>
      <td className="px-4 py-3 text-[11px] text-muted-foreground">{fmtDate(reward.weekStart)}</td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border', statusColor(reward.status))}>
          {reward.status === 'pending' ? 'Ausstehend' :
           reward.status === 'approved' ? 'Genehmigt' :
           reward.status === 'paid' ? 'Ausgezahlt' : 'Abgelehnt'}
        </span>
      </td>
      <td className="px-4 py-3">
        {reward.status === 'pending' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onApprove(reward.id)}
              className="flex items-center gap-1 rounded-lg bg-matcha-700 text-white px-2.5 py-1 text-xs font-semibold hover:bg-matcha-800 transition"
            >
              <CheckCircle className="h-3 w-3" /> Genehmigen
            </button>
            <button
              onClick={() => setShowReject(!showReject)}
              className="flex items-center gap-1 rounded-lg border border-red-200 text-red-600 px-2.5 py-1 text-xs font-semibold hover:bg-red-50 transition"
            >
              <XCircle className="h-3 w-3" /> Ablehnen
            </button>
            {showReject && (
              <div className="flex items-center gap-1">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Grund…"
                  className="border rounded px-2 py-0.5 text-xs w-28"
                />
                <button
                  onClick={() => { onReject(reward.id, note); setShowReject(false); }}
                  className="text-xs bg-red-600 text-white rounded px-2 py-0.5 font-semibold"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        )}
        {reward.status === 'approved' && (
          <button
            onClick={() => onPaid(reward.id)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-blue-700 transition"
          >
            <Banknote className="h-3 w-3" /> Als ausgezahlt markieren
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Config Panel ──────────────────────────────────────────────────────────────

function ConfigPanel({
  config,
  onSave,
}: {
  config: RewardConfig | null;
  onSave: (cfg: Partial<RewardConfig>) => Promise<void>;
}) {
  const [rank1, setRank1] = useState(String(config?.rank1BonusEur ?? 20));
  const [rank2, setRank2] = useState(String(config?.rank2BonusEur ?? 12));
  const [rank3, setRank3] = useState(String(config?.rank3BonusEur ?? 7));
  const [minTours, setMinTours] = useState(String(config?.minToursRequired ?? 5));
  const [autoApprove, setAutoApprove] = useState(config?.autoApprove ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      rank1BonusEur: parseFloat(rank1) || 20,
      rank2BonusEur: parseFloat(rank2) || 12,
      rank3BonusEur: parseFloat(rank3) || 7,
      minToursRequired: parseInt(minTours, 10) || 5,
      autoApprove,
      active: true,
    });
    setSaving(false);
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="h-4 w-4 text-matcha-700" />
        <span className="font-bold text-sm">Prämien-Konfiguration</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Platz 1 (€)</label>
          <input
            type="number" min="0" step="0.50"
            value={rank1} onChange={(e) => setRank1(e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm font-medium"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Platz 2 (€)</label>
          <input
            type="number" min="0" step="0.50"
            value={rank2} onChange={(e) => setRank2(e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm font-medium"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Platz 3 (€)</label>
          <input
            type="number" min="0" step="0.50"
            value={rank3} onChange={(e) => setRank3(e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm font-medium"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Min. Touren</label>
          <input
            type="number" min="1"
            value={minTours} onChange={(e) => setMinTours(e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm font-medium"
          />
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox" id="autoApprove"
          checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="autoApprove" className="text-sm text-stone-700">
          Prämien automatisch genehmigen (ohne Admin-Bestätigung)
        </label>
      </div>
      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-matcha-700 hover:bg-matcha-800 text-white"
        size="sm"
      >
        {saving ? 'Speichern…' : 'Konfiguration speichern'}
      </Button>
    </Card>
  );
}

// ── History Section ───────────────────────────────────────────────────────────

function HistorySection({ locationId }: { locationId: string }) {
  const [history, setHistory] = useState<{
    weekStart: string; weekEnd: string; entries: WeeklyRankingEntry[];
  }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/delivery/admin/driver-ranking?action=history&location_id=${locationId}`);
    if (res.ok) {
      const d = await res.json() as { history: typeof history };
      setHistory(d.history);
    }
    setLoaded(true);
  }, [locationId]);

  if (!loaded) {
    return (
      <button
        onClick={load}
        className="flex items-center gap-2 text-sm text-matcha-700 font-semibold hover:underline"
      >
        <TrendingUp className="h-4 w-4" /> Verlauf laden (letzte 8 Wochen)
      </button>
    );
  }

  if (!history.length) {
    return <p className="text-sm text-muted-foreground">Noch keine Verlaufsdaten.</p>;
  }

  return (
    <div className="space-y-2">
      {history.map((week) => (
        <Card key={week.weekStart} className="overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === week.weekStart ? null : week.weekStart)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition"
          >
            {expanded === week.weekStart
              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="text-sm font-semibold">
              KW {fmtDate(week.weekStart)} – {fmtDate(week.weekEnd)}
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">{week.entries.length} Fahrer</span>
            {week.entries[0] && (
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-bold text-amber-700">{week.entries[0].driverName ?? '—'}</span>
              </div>
            )}
          </button>
          {expanded === week.weekStart && (
            <div className="border-t overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b">
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-4 py-2">Fahrer</th>
                    <th className="text-left px-4 py-2">Score</th>
                    <th className="text-left px-4 py-2">Touren</th>
                    <th className="text-left px-4 py-2">On-Time</th>
                    <th className="text-left px-4 py-2">Verdienst</th>
                  </tr>
                </thead>
                <tbody>
                  {week.entries.map((e) => (
                    <tr key={e.driverId} className="border-t border-border/50">
                      <td className="px-4 py-2">
                        <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black border', rankColor(e.rank))}>
                          {e.rank}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium">{e.driverName ?? e.driverId.slice(0, 8)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <span className="font-bold tabular-nums">{fmt(e.compositeScore)}</span>
                          <span className={cn('inline-flex px-1 py-0.5 rounded text-[9px] font-black border', gradeColor(e.grade))}>{e.grade}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 tabular-nums">{e.toursCompleted}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {e.onTimeRate != null ? `${Math.round(e.onTimeRate * 100)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtEur(e.totalEarningsEur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'ranking' | 'rewards' | 'history' | 'config';

export function DriverRankingClient({ locationId, employeeId, initial }: Props) {
  const [dashboard, setDashboard] = useState<RankingDashboard>(initial);
  const [tab, setTab] = useState<Tab>('ranking');
  const [computing, setComputing] = useState(false);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/delivery/admin/driver-ranking?location_id=${locationId}`);
    if (res.ok) setDashboard(await res.json() as RankingDashboard);
    setLoading(false);
  }, [locationId]);

  const handleCompute = useCallback(async () => {
    setComputing(true);
    await fetch('/api/delivery/admin/driver-ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'compute', location_id: locationId }),
    });
    await reload();
    setComputing(false);
  }, [locationId, reload]);

  const handleApprove = useCallback(async (rewardId: string) => {
    await fetch('/api/delivery/admin/driver-ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_reward', reward_id: rewardId, location_id: locationId }),
    });
    await reload();
  }, [locationId, reload]);

  const handleReject = useCallback(async (rewardId: string, note: string) => {
    await fetch('/api/delivery/admin/driver-ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject_reward', reward_id: rewardId, note, location_id: locationId }),
    });
    await reload();
  }, [locationId, reload]);

  const handlePaid = useCallback(async (rewardId: string) => {
    await fetch('/api/delivery/admin/driver-ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', reward_id: rewardId, location_id: locationId }),
    });
    await reload();
  }, [locationId, reload]);

  const handleSaveConfig = useCallback(async (cfg: Partial<{ rank1BonusEur: number; rank2BonusEur: number; rank3BonusEur: number; minToursRequired: number; autoApprove: boolean; notifyDriver: boolean; active: boolean }>) => {
    await fetch('/api/delivery/admin/driver-ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_config',
        location_id: locationId,
        rank1_bonus_eur: cfg.rank1BonusEur,
        rank2_bonus_eur: cfg.rank2BonusEur,
        rank3_bonus_eur: cfg.rank3BonusEur,
        min_tours_required: cfg.minToursRequired,
        auto_approve: cfg.autoApprove,
        notify_driver: cfg.notifyDriver,
        active: cfg.active,
      }),
    });
    await reload();
  }, [locationId, reload]);

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'rewards', label: 'Prämien', icon: Euro, badge: dashboard.pendingRewards },
    { id: 'history', label: 'Verlauf', icon: TrendingUp },
    { id: 'config', label: 'Konfiguration', icon: Settings },
  ];

  const weekLabel = dashboard.weekStart
    ? `KW ${new Date(dashboard.weekStart).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – ${new Date(dashboard.weekEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
    : '—';

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Users} label="Fahrer diese Woche"
          value={String(dashboard.totalDrivers)}
          sub={weekLabel}
        />
        <KpiCard
          icon={Target} label="Ø Score"
          value={fmt(dashboard.avgScore, 1)}
          sub="0–100 Punkte"
        />
        <KpiCard
          icon={Euro} label="Offene Prämien"
          value={`€${dashboard.pendingRewardsEur.toFixed(2)}`}
          sub={`${dashboard.pendingRewards} ausstehend`}
          accent={dashboard.pendingRewards > 0}
          iconClass="text-amber-600"
        />
        <KpiCard
          icon={Trophy} label="Beste/r Fahrer/in"
          value={dashboard.topDriver?.name?.split(' ')[0] ?? '—'}
          sub={dashboard.topDriver ? `Score ${fmt(dashboard.topDriver.score)} · ${dashboard.topDriver.grade}` : 'Noch kein Ranking'}
          accent={!!dashboard.topDriver}
          iconClass="text-amber-500"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              tab === t.id ? 'bg-matcha-700 text-white border-matcha-700' : 'bg-card hover:bg-muted',
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.badge && t.badge > 0 ? (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-black">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Aktualisieren
          </button>
          <button
            onClick={handleCompute}
            disabled={computing}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 text-white px-3 py-1.5 text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5" />
            {computing ? 'Berechne…' : 'Ranking berechnen'}
          </button>
        </div>
      </div>

      {/* ── Tab: Ranking ───────────────────────────────────────── */}
      {tab === 'ranking' && (
        <>
          {dashboard.currentRanking.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 gap-3">
              <Trophy className="h-10 w-10 text-amber-400 opacity-40" />
              <p className="text-sm text-muted-foreground">Noch kein Ranking für diese Woche berechnet.</p>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="rounded-lg bg-matcha-700 text-white px-4 py-2 text-sm font-semibold hover:bg-matcha-800 transition"
              >
                {computing ? 'Berechne…' : 'Ranking jetzt berechnen'}
              </button>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-sm">Wöchentliches Ranking · {weekLabel}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{dashboard.totalDrivers} Fahrer</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b">
                      <th className="text-left px-4 py-2">#</th>
                      <th className="text-left px-4 py-2">Fahrer</th>
                      <th className="text-left px-4 py-2">Score</th>
                      <th className="text-left px-4 py-2">Stopps</th>
                      <th className="text-left px-4 py-2">On-Time</th>
                      <th className="text-left px-4 py-2">Bewertung</th>
                      <th className="text-left px-4 py-2">Verdienst</th>
                      <th className="text-left px-4 py-2">Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.currentRanking.map((entry) => (
                      <RankingRow key={entry.driverId} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Tab: Prämien ───────────────────────────────────────── */}
      {tab === 'rewards' && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Award className="h-4 w-4 text-matcha-700" />
            <span className="font-bold text-sm">Offene Prämien · {weekLabel}</span>
            {dashboard.pendingRewards > 0 && (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                {dashboard.pendingRewards} ausstehend · €{dashboard.pendingRewardsEur.toFixed(2)}
              </span>
            )}
          </div>
          {dashboard.pendingRewardList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <CheckCircle className="h-8 w-8 opacity-30" />
              <p className="text-sm">Keine offenen Prämien.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b">
                    <th className="text-left px-4 py-2">Platz</th>
                    <th className="text-left px-4 py-2">Fahrer</th>
                    <th className="text-left px-4 py-2">Prämie</th>
                    <th className="text-left px-4 py-2">Woche</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.pendingRewardList.map((reward) => (
                    <RewardRow
                      key={reward.id}
                      reward={reward}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onPaid={handlePaid}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Verlauf ───────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          <HistorySection locationId={locationId} />
        </div>
      )}

      {/* ── Tab: Konfiguration ─────────────────────────────────── */}
      {tab === 'config' && (
        <ConfigPanel config={dashboard.rewardConfig} onSave={handleSaveConfig} />
      )}

      {/* Info-Box */}
      {tab === 'ranking' && (
        <Card className="px-4 py-3 bg-stone-50 text-[11px] text-stone-500 space-y-0.5">
          <p><strong>Berechnung:</strong> Composite Performance Score (0–100) aus Pünktlichkeit · Bewertung · Effizienz · Zuverlässigkeit · Aktivität · Volumen.</p>
          <p><strong>Prämien:</strong> Automatisch für Top-3 bei ≥ {dashboard.rewardConfig?.minToursRequired ?? 5} abgeschlossenen Touren. Konfigurierbar im Tab Konfiguration.</p>
          <p><strong>Cron:</strong> Ranking wird wöchentlich automatisch neu berechnet.</p>
        </Card>
      )}
    </div>
  );
}
