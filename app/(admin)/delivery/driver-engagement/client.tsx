'use client';

// Phase 350: Fahrer-Engagement-Engine — Admin Dashboard

import React, { useCallback, useEffect, useState } from 'react';
import {
  Trophy,
  Medal,
  Zap,
  Users,
  RefreshCw,
  Settings,
  ListOrdered,
  Star,
  Award,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string | null;
  weeklyPoints: number;
  deliveries: number;
  onTimeRate: number | null;
  badgesCount: number;
}

interface Config {
  isEnabled: boolean;
  pointsPerDelivery: number;
  pointsPerOnTime: number;
  pointsPerTopRating: number;
  weeklyResetDay: number;
  weeklyResetHourUtc: number;
}

interface Dashboard {
  config: Config;
  weekStart: string;
  topDriver: LeaderboardEntry | null;
  leaderboard: LeaderboardEntry[];
  totalDriversWithPoints: number;
  totalPointsAwarded: number;
  totalBadgesEarned: number;
  avgWeeklyPoints: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-yellow-500 font-black text-lg">🥇</span>;
  if (rank === 2) return <span className="text-stone-400 font-black text-lg">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-black text-lg">🥉</span>;
  return <span className="text-sm text-stone-500 font-bold">#{rank}</span>;
}

function initials(name: string | null) {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatPct(v: number | null) {
  return v !== null ? `${v.toFixed(0)}%` : '–';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DriverEngagementClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'leaderboard' | 'badges' | 'config'>('leaderboard');
  const [configDraft, setConfigDraft] = useState<Partial<Config>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [driverProfile, setDriverProfile] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-engagement?action=dashboard');
      if (res.ok) {
        const d = await res.json() as Dashboard;
        setDashboard(d);
        setConfigDraft({
          isEnabled: d.config.isEnabled,
          pointsPerDelivery: d.config.pointsPerDelivery,
          pointsPerOnTime: d.config.pointsPerOnTime,
          pointsPerTopRating: d.config.pointsPerTopRating,
          weeklyResetHourUtc: d.config.weeklyResetHourUtc,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/driver-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', ...configDraftToApi(configDraft) }),
      });
      setSavedAt(new Date().toLocaleTimeString('de-DE'));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const computeLeaderboard = async () => {
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/driver-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute_leaderboard' }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  const doWeeklyReset = async () => {
    if (!confirm('Wöchentliche Punkte zurücksetzen? Das kann nicht rückgängig gemacht werden.')) return;
    setResetting(true);
    try {
      await fetch('/api/delivery/admin/driver-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'weekly_reset' }),
      });
      await load();
    } finally {
      setResetting(false);
    }
  };

  const loadDriverProfile = async (driverId: string) => {
    if (expandedDriver === driverId) {
      setExpandedDriver(null);
      setDriverProfile(null);
      return;
    }
    const res = await fetch(`/api/delivery/admin/driver-engagement?action=profile&driver_id=${driverId}`);
    if (res.ok) {
      setDriverProfile(await res.json());
      setExpandedDriver(driverId);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-matcha-600" />
      </div>
    );
  }

  const d = dashboard;

  const kpis = [
    { label: 'Fahrer mit Punkten', value: d?.totalDriversWithPoints ?? 0, icon: <Users className="h-5 w-5" />, color: 'text-matcha-700', bg: 'bg-matcha-50' },
    { label: 'Punkte diese Woche', value: (d?.totalPointsAwarded ?? 0).toLocaleString('de-DE'), icon: <Zap className="h-5 w-5" />, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Abzeichen gesamt', value: d?.totalBadgesEarned ?? 0, icon: <Award className="h-5 w-5" />, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Ø Punkte/Fahrer', value: d?.avgWeeklyPoints ?? 0, icon: <BarChart3 className="h-5 w-5" />, color: 'text-purple-700', bg: 'bg-purple-50' },
  ];

  const tabs = [
    { id: 'leaderboard' as const, label: 'Rangliste', icon: <ListOrdered className="h-4 w-4" /> },
    { id: 'badges' as const, label: 'Abzeichen', icon: <Trophy className="h-4 w-4" /> },
    { id: 'config' as const, label: 'Konfiguration', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Fahrer-Engagement Engine"
        description={`Gamification · Punkte, Abzeichen, Rangliste · Woche ab ${d?.weekStart ?? '–'}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={computeLeaderboard} disabled={computing}>
              <RefreshCw className={cn('h-4 w-4 mr-1', computing && 'animate-spin')} />
              Rangliste neu berechnen
            </Button>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren
            </Button>
          </div>
        }
      />

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mb-2', kpi.bg, kpi.color)}>
              {kpi.icon}
            </div>
            <div className={cn('text-2xl font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
          </Card>
        ))}
      </div>

      {/* Top-Fahrer Banner */}
      {d?.topDriver && (
        <Card className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-yellow-400 text-white flex items-center justify-center font-black text-lg">
              {initials(d.topDriver.driverName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{d.topDriver.driverName ?? 'Unbekannt'}</span>
                <span className="text-yellow-500 text-xl">🥇</span>
              </div>
              <div className="text-sm text-stone-600">
                {d.topDriver.weeklyPoints} Punkte · {d.topDriver.deliveries} Lieferungen · {formatPct(d.topDriver.onTimeRate)} pünktlich
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-stone-400">Top dieser Woche</div>
              <div className="font-black text-2xl text-yellow-600">{d.topDriver.weeklyPoints}</div>
              <div className="text-xs text-stone-500">Punkte</div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition',
              tab === t.id
                ? 'border-matcha-600 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Rangliste */}
      {tab === 'leaderboard' && (
        <div className="space-y-2">
          {!d?.leaderboard.length && (
            <Card className="p-8 text-center text-muted-foreground">
              Noch keine Ranglisten-Daten. Klicke auf „Rangliste neu berechnen".
            </Card>
          )}
          {d?.leaderboard.map((entry) => (
            <Card key={entry.driverId} className="overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-muted/30 transition"
                onClick={() => loadDriverProfile(entry.driverId)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 flex justify-center">{rankBadge(entry.rank)}</div>
                  <div className="h-9 w-9 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center font-bold text-sm">
                    {initials(entry.driverName)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{entry.driverName ?? 'Fahrer'}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.deliveries} Lieferungen · {formatPct(entry.onTimeRate)} pünktlich
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-lg text-matcha-700">{entry.weeklyPoints}</div>
                    <div className="text-xs text-muted-foreground">Punkte</div>
                  </div>
                  {entry.badgesCount > 0 && (
                    <div className="flex items-center gap-1 ml-2">
                      <Medal className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-semibold text-amber-700">{entry.badgesCount}</span>
                    </div>
                  )}
                  {expandedDriver === entry.driverId
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                </div>
              </button>

              {expandedDriver === entry.driverId && driverProfile && (
                <div className="border-t p-4 bg-muted/20 text-sm space-y-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-muted-foreground text-xs">Gesamt-Punkte</div>
                      <div className="font-bold">{(driverProfile.totalPointsAllTime as number).toLocaleString('de-DE')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Lieferungen gesamt</div>
                      <div className="font-bold">{driverProfile.deliveriesAllTime as number}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Streak</div>
                      <div className="font-bold">{driverProfile.currentStreak as number} 🔥</div>
                    </div>
                  </div>
                  {((driverProfile.earnedBadges as unknown[]) ?? []).length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Abzeichen</div>
                      <div className="flex flex-wrap gap-1">
                        {(driverProfile.earnedBadges as { badge: { name: string; icon: string }; earnedAt: string }[]).map((eb, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                            <Star className="h-3 w-3" /> {eb.badge.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={doWeeklyReset}
              disabled={resetting}
              className="text-red-600 hover:text-red-700 border-red-200"
            >
              {resetting ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              Wochenreset durchführen
            </Button>
          </div>
        </div>
      )}

      {/* Tab: Abzeichen */}
      {tab === 'badges' && (
        <div className="space-y-2">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="font-semibold">Verfügbare Abzeichen</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {d?.totalBadgesEarned ?? 0} insgesamt verdient
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: 'Starter', desc: '10 Lieferungen', icon: '📦', pts: 20 },
                { name: 'Routinier', desc: '50 Lieferungen', icon: '🚚', pts: 50 },
                { name: 'Profi', desc: '200 Lieferungen', icon: '🏅', pts: 100 },
                { name: 'Legende', desc: '500 Lieferungen', icon: '⭐', pts: 250 },
                { name: 'Punktesammler', desc: '100 Punkte/Woche', icon: '⚡', pts: 25 },
                { name: 'Highscorer', desc: '300 Punkte/Woche', icon: '🏆', pts: 75 },
                { name: 'Pünktlichkeits-Ass', desc: '≥90% pünktlich (20+ Lieferungen)', icon: '⏰', pts: 50 },
                { name: 'Zuverlässigkeits-König', desc: '≥95% pünktlich (50+ Lieferungen)', icon: '🛡️', pts: 150 },
              ].map((badge) => (
                <div key={badge.name} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20">
                  <span className="text-2xl">{badge.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{badge.name}</div>
                    <div className="text-xs text-muted-foreground">{badge.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-600">+{badge.pts} Bonus-Pts</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Konfiguration */}
      {tab === 'config' && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Engagement-Engine</div>
              <div className="text-sm text-muted-foreground">Punkte werden automatisch nach jeder Lieferung vergeben</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={configDraft.isEnabled ?? true}
                onChange={(e) => setConfigDraft((p) => ({ ...p, isEnabled: e.target.checked }))}
              />
              <div className="w-11 h-6 bg-stone-200 rounded-full peer peer-checked:bg-matcha-500 transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Punkte pro Lieferung', key: 'pointsPerDelivery' as keyof Config, min: 1, max: 100 },
              { label: 'Punkte bei Pünktlichkeit', key: 'pointsPerOnTime' as keyof Config, min: 0, max: 50 },
              { label: 'Punkte bei 5★ Bewertung', key: 'pointsPerTopRating' as keyof Config, min: 0, max: 100 },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium block mb-1">{field.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    value={Number(configDraft[field.key] ?? 0)}
                    onChange={(e) => setConfigDraft((p) => ({ ...p, [field.key]: Number(e.target.value) }))}
                    className="flex-1 accent-matcha-600"
                  />
                  <span className="w-10 text-center font-bold text-sm">{Number(configDraft[field.key] ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-xs">
            <label className="text-sm font-medium block mb-1">Wochenreset Uhrzeit (UTC)</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={23}
                value={Number(configDraft.weeklyResetHourUtc ?? 4)}
                onChange={(e) => setConfigDraft((p) => ({ ...p, weeklyResetHourUtc: Number(e.target.value) }))}
                className="flex-1 accent-matcha-600"
              />
              <span className="w-12 text-center font-bold text-sm">{Number(configDraft.weeklyResetHourUtc ?? 4)}:00</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            {savedAt && <span className="text-xs text-matcha-600">✓ Gespeichert um {savedAt}</span>}
            <Button onClick={saveConfig} disabled={saving} className="ml-auto">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              Konfiguration speichern
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function configDraftToApi(draft: Partial<Config>): Record<string, unknown> {
  return {
    is_enabled: draft.isEnabled,
    points_per_delivery: draft.pointsPerDelivery,
    points_per_on_time: draft.pointsPerOnTime,
    points_per_top_rating: draft.pointsPerTopRating,
    weekly_reset_hour_utc: draft.weeklyResetHourUtc,
  };
}
