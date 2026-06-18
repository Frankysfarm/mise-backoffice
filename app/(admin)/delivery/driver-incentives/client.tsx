'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Trophy, Zap, Star, Clock, TrendingUp, RefreshCw, Settings, CheckCircle2,
  ChevronRight, Flame, Moon,
} from 'lucide-react';
import type { IncentiveDashboard, IncentiveConfig, IncentiveType } from '@/lib/delivery/driver-incentives';

// ─────────────────────────────────────────────────────────────
// Types (client-side mirror)
// ─────────────────────────────────────────────────────────────

const INCENTIVE_LABELS: Record<IncentiveType, string> = {
  surge_multiplier:  'Surge-Multiplikator',
  quality_bonus:     'Qualitäts-Bonus',
  shift_milestone:   'Schicht-Meilenstein',
  rush_hour_flat:    'Stoßzeit-Pauschale',
  comeback_bonus:    'Comeback-Bonus',
};

const INCENTIVE_ICONS: Record<IncentiveType, React.ComponentType<{ className?: string }>> = {
  surge_multiplier:  Zap,
  quality_bonus:     Star,
  shift_milestone:   Trophy,
  rush_hour_flat:    Clock,
  comeback_bonus:    Moon,
};

const INCENTIVE_COLORS: Record<IncentiveType, string> = {
  surge_multiplier:  'text-amber-400 bg-amber-900/30',
  quality_bonus:     'text-emerald-400 bg-emerald-900/30',
  shift_milestone:   'text-violet-400 bg-violet-900/30',
  rush_hour_flat:    'text-sky-400 bg-sky-900/30',
  comeback_bonus:    'text-indigo-400 bg-indigo-900/30',
};

function formatEur(v: number) {
  return `€${v.toFixed(2)}`;
}

function kpiCard(title: string, value: string, sub: string, Icon: React.ComponentType<{ className?: string }>, color: string) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 flex gap-3 items-start">
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{title}</p>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Config editor modal
// ─────────────────────────────────────────────────────────────

const EMPTY_CONFIG: Partial<IncentiveConfig> & { incentiveType: IncentiveType } = {
  incentiveType:     'surge_multiplier',
  label:             '',
  isActive:          true,
  extraPct:          10,
  qualityScoreMin:   75,
  flatEur:           0.5,
  milestoneAt:       10,
  milestoneBonusEur: 5,
  rushHourStart:     11,
  rushHourEnd:       14,
  minOfflineHours:   8,
  comebackBonusEur:  3,
};

function ConfigModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Partial<IncentiveConfig> & { incentiveType: IncentiveType };
  onSave: (cfg: typeof EMPTY_CONFIG) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_CONFIG, ...initial });
  const [saving, setSaving] = useState(false);

  function field(name: keyof typeof form, label: string, type = 'number', step?: string) {
    const val = form[name];
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">{label}</span>
        <input
          type={type}
          step={step ?? '0.01'}
          value={val as string | number}
          onChange={e => setForm(f => ({ ...f, [name]: type === 'number' ? Number(e.target.value) : e.target.value }))}
          className="rounded bg-slate-700 border border-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-white font-semibold mb-4">Incentive konfigurieren</h3>

        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Typ</span>
            <select
              value={form.incentiveType}
              onChange={e => setForm(f => ({ ...f, incentiveType: e.target.value as IncentiveType }))}
              className="rounded bg-slate-700 border border-slate-600 px-2 py-1 text-sm text-white"
            >
              {(Object.keys(INCENTIVE_LABELS) as IncentiveType[]).map(t => (
                <option key={t} value={t}>{INCENTIVE_LABELS[t]}</option>
              ))}
            </select>
          </label>

          {field('label', 'Beschriftung (Anzeigename)', 'text')}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="accent-violet-500"
            />
            <span className="text-sm text-slate-300">Aktiv</span>
          </label>

          {form.incentiveType === 'surge_multiplier' && field('extraPct', 'Extra-% auf Liefergebühr bei Surge', 'number', '1')}
          {form.incentiveType === 'quality_bonus' && (
            <>
              {field('qualityScoreMin', 'Min. Qualitäts-Score (0–100)', 'number', '1')}
              {field('flatEur', 'Bonus EUR pro Lieferung', 'number', '0.10')}
            </>
          )}
          {form.incentiveType === 'shift_milestone' && (
            <>
              {field('milestoneAt', 'Meilenstein nach X Lieferungen', 'number', '1')}
              {field('milestoneBonusEur', 'Bonus EUR bei Meilenstein', 'number', '0.50')}
            </>
          )}
          {form.incentiveType === 'rush_hour_flat' && (
            <>
              {field('rushHourStart', 'Stoßzeit Start (UTC-Stunde 0–23)', 'number', '1')}
              {field('rushHourEnd', 'Stoßzeit Ende (UTC-Stunde 0–23)', 'number', '1')}
              {field('flatEur', 'Bonus EUR pro Lieferung', 'number', '0.10')}
            </>
          )}
          {form.incentiveType === 'comeback_bonus' && (
            <>
              {field('minOfflineHours', 'Min. Offline-Stunden vor Comeback', 'number', '1')}
              {field('comebackBonusEur', 'Comeback-Bonus EUR', 'number', '0.50')}
            </>
          )}
        </div>

        <div className="flex gap-2 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded bg-slate-700 text-slate-300 hover:bg-slate-600">
            Abbrechen
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              await onSave(form as typeof EMPTY_CONFIG);
              setSaving(false);
              onClose();
            }}
            disabled={saving}
            className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function DriverIncentivesClient() {
  const [dashboard, setDashboard] = useState<IncentiveDashboard | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'overview' | 'leaderboard' | 'config'>('overview');
  const [modalConfig, setModalConfig] = useState<(Partial<IncentiveConfig> & { incentiveType: IncentiveType }) | null>(null);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/driver-incentives?action=dashboard');
      const json = await res.json() as { ok: boolean; dashboard?: IncentiveDashboard };
      if (json.ok && json.dashboard) setDashboard(json.dashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleSaveConfig(cfg: typeof EMPTY_CONFIG) {
    await fetch('/api/delivery/admin/driver-incentives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_config', config: cfg }),
    });
    await load();
  }

  async function handleApprove() {
    setApproving(true);
    await fetch('/api/delivery/admin/driver-incentives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    await load();
    setApproving(false);
  }

  if (loading) {
    return <div className="p-8 text-slate-400 animate-pulse">Lade Incentive-Daten…</div>;
  }

  const d = dashboard;

  return (
    <div className="p-6 space-y-6">
      {modalConfig && (
        <ConfigModal
          initial={modalConfig}
          onSave={handleSaveConfig}
          onClose={() => setModalConfig(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-violet-400" />
            Echtzeit-Fahrer-Incentives
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Per-Lieferung Boni basierend auf Surge, Qualität, Schicht-Meilensteinen und Stoßzeiten
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </button>
          <button
            onClick={() => void handleApprove()}
            disabled={approving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-600 text-sm disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {approving ? 'Genehmigt…' : 'Alle genehmigen'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCard('Pool heute', formatEur(d?.totalPoolEurToday ?? 0), 'Alle Incentives heute', Zap, 'text-amber-400 bg-amber-900/30')}
        {kpiCard('Genehmigt', formatEur(d?.approvedEurToday ?? 0), `${d?.totalEventsToday ?? 0} Ereignisse`, CheckCircle2, 'text-emerald-400 bg-emerald-900/30')}
        {kpiCard('Ausstehend', formatEur(d?.pendingEurToday ?? 0), 'Warten auf Genehmigung', Clock, 'text-amber-400 bg-amber-900/30')}
        {kpiCard(
          'Top-Verdiener',
          d?.topEarner ? formatEur(d.topEarner.bonusEur) : '—',
          d?.topEarner?.driverName ?? 'Kein Fahrer',
          Trophy,
          'text-violet-400 bg-violet-900/30',
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {(['overview', 'leaderboard', 'config'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'overview' ? 'Übersicht' : t === 'leaderboard' ? 'Leaderboard' : 'Regeln'}
          </button>
        ))}
      </div>

      {/* Tab: Overview — recent events */}
      {tab === 'overview' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-white">Letzte Incentive-Ereignisse (heute)</span>
          </div>
          {!d?.recentEvents.length ? (
            <p className="text-slate-400 text-sm p-4">Noch keine Incentives heute.</p>
          ) : (
            <div className="divide-y divide-slate-700">
              {d.recentEvents.map(ev => {
                const IcoComp = INCENTIVE_ICONS[ev.incentiveType] ?? Zap;
                const color = INCENTIVE_COLORS[ev.incentiveType] ?? 'text-slate-400 bg-slate-700';
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`rounded-lg p-1.5 ${color}`}>
                      <IcoComp className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{ev.triggerLabel}</p>
                      <p className="text-xs text-slate-500">
                        Lieferung #{ev.shiftDeliveryNr} · {new Date(ev.earnedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-emerald-400">
                        +{formatEur(ev.bonusEur)}
                      </span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        ev.status === 'approved' || ev.status === 'paid'
                          ? 'bg-emerald-900/30 text-emerald-400'
                          : ev.status === 'pending'
                            ? 'bg-amber-900/30 text-amber-400'
                            : 'bg-slate-700 text-slate-400'
                      }`}>
                        {ev.status === 'approved' ? 'genehmigt' : ev.status === 'paid' ? 'ausgezahlt' : ev.status === 'pending' ? 'ausstehend' : 'storniert'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Flame className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-white">Incentive-Leaderboard (heute)</span>
          </div>
          {!d?.leaderboard.length ? (
            <p className="text-slate-400 text-sm p-4">Noch keine Einträge heute.</p>
          ) : (
            <div className="divide-y divide-slate-700">
              {d.leaderboard.map(entry => (
                <div key={entry.driverId} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    entry.rank === 1 ? 'bg-amber-500 text-white' :
                    entry.rank === 2 ? 'bg-slate-400 text-white' :
                    entry.rank === 3 ? 'bg-orange-700 text-white' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {entry.rank}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{entry.driverName ?? 'Unbekannt'}</p>
                    <p className="text-xs text-slate-500">{entry.eventsToday} Ereignisse · {formatEur(entry.confirmedEur)} bestätigt</p>
                  </div>
                  <span className="text-base font-bold text-emerald-400">{formatEur(entry.totalEurToday)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Config */}
      {tab === 'config' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setModalConfig({ ...EMPTY_CONFIG, incentiveType: 'surge_multiplier' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-700 text-white hover:bg-violet-600 text-sm"
            >
              <Settings className="h-3.5 w-3.5" /> Incentive hinzufügen
            </button>
          </div>

          {(Object.keys(INCENTIVE_LABELS) as IncentiveType[]).map(type => {
            const cfg = d?.configs.find(c => c.incentiveType === type);
            const IcoComp = INCENTIVE_ICONS[type];
            const color = INCENTIVE_COLORS[type];
            return (
              <div
                key={type}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4"
              >
                <div className={`rounded-lg p-2 ${color}`}>
                  <IcoComp className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{INCENTIVE_LABELS[type]}</p>
                  {cfg ? (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {cfg.label || '—'} ·{' '}
                      <span className={cfg.isActive ? 'text-emerald-400' : 'text-slate-500'}>
                        {cfg.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-0.5">Nicht konfiguriert</p>
                  )}
                </div>
                <button
                  onClick={() => setModalConfig(cfg
                    ? { ...cfg, incentiveType: type }
                    : { ...EMPTY_CONFIG, incentiveType: type }
                  )}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {cfg ? 'Bearbeiten' : 'Einrichten'}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
