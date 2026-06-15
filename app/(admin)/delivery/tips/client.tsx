'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BadgeEuro, Trophy, Settings, RefreshCw, Heart, TrendingUp } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TipConfig {
  isEnabled: boolean;
  suggestionsPct: number[];
  customAllowed: boolean;
  minTipEur: number;
  maxTipEur: number;
}

interface TipLeaderboardEntry {
  driverId: string;
  driverName: string | null;
  totalTips: number;
  totalTipEur: number;
  avgTipEur: number;
  bestSingleTip: number;
  daysWithTips: number;
  rank: number;
}

interface TodayDriver {
  driverId: string;
  driverName: string | null;
  tipCount: number;
  totalTipEur: number;
  avgTipEur: number;
}

interface TipSummary {
  totalTips30d: number;
  totalTipEur30d: number;
  avgTipEur30d: number;
  maxSingleTip30d: number;
  driversWithTips: number;
  tipsToday: number;
  tipEurToday: number;
}

interface TipDashboard {
  config: TipConfig;
  summary: TipSummary;
  leaderboard: TipLeaderboardEntry[];
  todayByDriver: TodayDriver[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rankColor(rank: number) {
  if (rank === 1) return 'bg-amber-100 text-amber-700 border-amber-300';
  if (rank === 2) return 'bg-slate-100 text-slate-600 border-slate-300';
  if (rank === 3) return 'bg-orange-50 text-orange-600 border-orange-200';
  return 'bg-muted text-muted-foreground border-border';
}

function eur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'leaderboard' | 'today' | 'config';

export function TipsClient({ locationId }: { locationId: string }) {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [data, setData] = useState<TipDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Config edit state
  const [cfgEnabled, setCfgEnabled] = useState(true);
  const [cfgPcts, setCfgPcts] = useState('5,10,15');
  const [cfgCustom, setCfgCustom] = useState(true);
  const [cfgMin, setCfgMin] = useState('0.50');
  const [cfgMax, setCfgMax] = useState('20.00');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/tips?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: TipDashboard | null) => {
        if (!d) return;
        setData(d);
        // Sync config edit state
        setCfgEnabled(d.config.isEnabled);
        setCfgPcts((d.config.suggestionsPct ?? [5, 10, 15]).join(','));
        setCfgCustom(d.config.customAllowed);
        setCfgMin(String(d.config.minTipEur));
        setCfgMax(String(d.config.maxTipEur));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    setSaveMsg(null);
    const pcts = cfgPcts.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0 && n <= 100);
    const body = {
      action: 'save_config',
      config: {
        isEnabled: cfgEnabled,
        suggestionsPct: pcts.length > 0 ? pcts : [5, 10, 15],
        customAllowed: cfgCustom,
        minTipEur: parseFloat(cfgMin) || 0.50,
        maxTipEur: parseFloat(cfgMax) || 20.00,
      },
    };
    try {
      const res = await fetch(`/api/delivery/admin/tips?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        setSaveMsg('Gespeichert ✓');
        load();
      } else {
        setSaveMsg('Fehler beim Speichern');
      }
    } catch {
      setSaveMsg('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  const runSnapshot = async () => {
    setSnapping(true);
    try {
      const res = await fetch(`/api/delivery/admin/tips?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      const d = await res.json();
      if (d.success) {
        load();
      }
    } catch {
      /* ignore */
    } finally {
      setSnapping(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'leaderboard', label: 'Leaderboard (30 Tage)' },
    { id: 'today', label: 'Heute' },
    { id: 'config', label: 'Konfiguration' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Band */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Trinkgelder (30 Tage)"
            value={String(data.summary.totalTips30d)}
            sub={`${eur(data.summary.totalTipEur30d)} gesamt`}
          />
          <KpiCard
            label="Ø Trinkgeld"
            value={eur(data.summary.avgTipEur30d)}
            sub="pro Bestellung mit Trinkgeld"
          />
          <KpiCard
            label="Höchstes Trinkgeld"
            value={eur(data.summary.maxSingleTip30d)}
            sub="30-Tage-Rekord"
          />
          <KpiCard
            label="Fahrer mit Trinkgeld"
            value={String(data.summary.driversWithTips)}
            sub={`${data.summary.tipsToday} Tips heute (${eur(data.summary.tipEurToday)})`}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-matcha-700 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <button
            onClick={runSnapshot}
            disabled={snapping}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', snapping && 'animate-spin')} />
            Snapshot jetzt
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Lade Trinkgeld-Daten…
        </div>
      )}

      {!loading && tab === 'leaderboard' && (
        <div className="space-y-2">
          {(!data?.leaderboard || data.leaderboard.length === 0) ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground text-sm">
              Noch keine Trinkgeld-Snapshots vorhanden. Klicke &quot;Snapshot jetzt&quot; um Daten zu erzeugen.
            </div>
          ) : (
            data.leaderboard.map((entry) => (
              <div key={entry.driverId} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                {/* Rank badge */}
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold',
                  rankColor(entry.rank),
                )}>
                  {entry.rank}
                </div>
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-sm font-bold text-matcha-700">
                  {initials(entry.driverName)}
                </div>
                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm text-foreground">
                    {entry.driverName ?? `Fahrer ${entry.driverId.slice(0, 6)}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.totalTips} Trinkgelder · {entry.daysWithTips} Tage
                  </p>
                </div>
                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Gesamt</p>
                    <p className="font-bold text-sm text-foreground">{eur(entry.totalTipEur)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ø</p>
                    <p className="font-semibold text-sm text-foreground">{eur(entry.avgTipEur)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rekord</p>
                    <p className="font-semibold text-sm text-amber-600">{eur(entry.bestSingleTip)}</p>
                  </div>
                </div>
                {entry.rank <= 3 && (
                  <Trophy className={cn(
                    'h-5 w-5 shrink-0',
                    entry.rank === 1 ? 'text-amber-500' : entry.rank === 2 ? 'text-slate-400' : 'text-orange-400',
                  )} />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {!loading && tab === 'today' && (
        <div className="space-y-2">
          {(!data?.todayByDriver || data.todayByDriver.length === 0) ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground text-sm">
              Noch keine Trinkgelder heute.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-2 font-semibold text-muted-foreground">Fahrer</th>
                    <th className="px-4 py-2 font-semibold text-muted-foreground text-right">Anzahl</th>
                    <th className="px-4 py-2 font-semibold text-muted-foreground text-right">Gesamt</th>
                    <th className="px-4 py-2 font-semibold text-muted-foreground text-right">Ø</th>
                  </tr>
                </thead>
                <tbody>
                  {data.todayByDriver.map((row) => (
                    <tr key={row.driverId} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 text-xs font-bold text-matcha-700">
                            {initials(row.driverName)}
                          </div>
                          <span className="font-medium text-foreground">
                            {row.driverName ?? `Fahrer ${row.driverId.slice(0, 6)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.tipCount}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{eur(row.totalTipEur)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{eur(row.avgTipEur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'config' && data && (
        <div className="max-w-md space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Trinkgeld-Einstellungen
            </h3>

            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Trinkgeld aktiviert</label>
              <button
                onClick={() => setCfgEnabled(v => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  cfgEnabled ? 'bg-matcha-700' : 'bg-slate-300',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  cfgEnabled ? 'translate-x-6' : 'translate-x-1',
                )} />
              </button>
            </div>

            {/* Suggestions */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Vorschläge (%, kommagetrennt)
              </label>
              <input
                type="text"
                value={cfgPcts}
                onChange={e => setCfgPcts(e.target.value)}
                placeholder="5,10,15"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-700"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">z.B. 5,10,15 → zeigt 5%, 10%, 15% als Buttons</p>
            </div>

            {/* Custom allowed */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Benutzerdefinierter Betrag</label>
              <button
                onClick={() => setCfgCustom(v => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  cfgCustom ? 'bg-matcha-700' : 'bg-slate-300',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  cfgCustom ? 'translate-x-6' : 'translate-x-1',
                )} />
              </button>
            </div>

            {/* Min/Max */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Min. Trinkgeld (€)</label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={cfgMin}
                  onChange={e => setCfgMin(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Max. Trinkgeld (€)</label>
                <input
                  type="number"
                  step="1.00"
                  min="0"
                  value={cfgMax}
                  onChange={e => setCfgMax(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-700"
                />
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button
                onClick={saveConfig}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-matcha-700 px-4 py-2 text-sm font-semibold text-white hover:bg-matcha-800 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                Speichern
              </button>
              {saveMsg && (
                <span className={cn('text-sm', saveMsg.includes('✓') ? 'text-matcha-700' : 'text-red-600')}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 text-sm text-matcha-800 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5"><Heart className="h-4 w-4" /> So funktioniert das Trinkgeld-System</p>
            <ul className="list-disc pl-4 space-y-1 text-[12px]">
              <li>Kunden können beim Checkout Trinkgeld angeben</li>
              <li>Storefront nutzt <code className="bg-matcha-100 px-1 rounded text-[11px]">GET /api/delivery/tip?location_id=…</code> für die Konfiguration</li>
              <li>Beim Bestellen <code className="bg-matcha-100 px-1 rounded text-[11px]">POST /api/delivery/tip</code> mit <code className="bg-matcha-100 px-1 rounded text-[11px]">orderId</code> + <code className="bg-matcha-100 px-1 rounded text-[11px]">tipEur</code></li>
              <li>Tages-Snapshots werden täglich um 01:30 UTC automatisch berechnet</li>
              <li>Manuelle Snapshots über &quot;Snapshot jetzt&quot; möglich</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
