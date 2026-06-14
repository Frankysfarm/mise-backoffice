'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Gift, CheckCircle, Clock, DollarSign, TrendingUp,
  RefreshCw, Plus, Trash2, Star, Zap, Target,
} from 'lucide-react';
import type { BonusConfig, BonusEvent, BonusSummary } from '@/lib/delivery/driver-bonus';

interface Dashboard {
  configs:  BonusConfig[];
  events:   BonusEvent[];
  summary:  BonusSummary[];
  kpis: {
    totalPending:  number;
    totalApproved: number;
    totalPaid:     number;
    pendingEur:    number;
    approvedEur:   number;
    paidEur:       number;
  };
}

interface Props { locationId: string; }

const BONUS_TYPE_LABELS: Record<string, string> = {
  deliveries_count: 'Lieferungen-Anzahl',
  on_time_rate:     'Pünktlichkeitsrate',
  min_rating:       'Mindest-Rating',
  custom:           'Manuell',
};

const BONUS_TYPE_ICONS: Record<string, React.ReactNode> = {
  deliveries_count: <Zap className="h-4 w-4" />,
  on_time_rate:     <Target className="h-4 w-4" />,
  min_rating:       <Star className="h-4 w-4" />,
  custom:           <Gift className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  approved:  'bg-blue-100 text-blue-800',
  paid:      'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

function fmtEur(v: number) { return `€ ${v.toFixed(2)}`; }
function fmtPct(v: number) { return `${(v * 100).toFixed(0)}%`; }

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${color}`}>
        {icon}{label}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function DriverBonusClient({ locationId }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<'events' | 'configs' | 'summary'>('events');
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [busy,      setBusy]      = useState(false);
  const [showNewConfig, setShowNewConfig] = useState(false);
  const [statusFilter, setStatusFilter]   = useState<string>('pending');

  // New config form state
  const [newCfg, setNewCfg] = useState({
    bonus_type: 'deliveries_count',
    label: '',
    threshold_value: '',
    bonus_amount_eur: '',
    period: 'daily',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/driver-bonus?location_id=${locationId}`);
      if (r.ok) setDashboard(await r.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleStatusUpdate = async (status: 'approved' | 'paid' | 'cancelled') => {
    if (!selected.size) return;
    setBusy(true);
    try {
      await fetch(`/api/delivery/admin/driver-bonus?location_id=${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: [...selected], status }),
      });
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleEvaluate = async () => {
    setBusy(true);
    try {
      await fetch(`/api/delivery/admin/driver-bonus?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate', location_id: locationId }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleAddConfig = async () => {
    if (!newCfg.label || !newCfg.threshold_value || !newCfg.bonus_amount_eur) return;
    setBusy(true);
    try {
      await fetch(`/api/delivery/admin/driver-bonus?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_config', location_id: locationId, ...newCfg }),
      });
      setShowNewConfig(false);
      setNewCfg({ bonus_type: 'deliveries_count', label: '', threshold_value: '', bonus_amount_eur: '', period: 'daily' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/delivery/admin/driver-bonus?location_id=${locationId}&config_id=${configId}`, {
        method: 'DELETE',
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const filteredEvents = (dashboard?.events ?? []).filter(
    (e) => statusFilter === 'all' || e.status === statusFilter,
  );

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <RefreshCw className="h-6 w-6 animate-spin mr-2" />Lädt…
    </div>
  );

  const kpis = dashboard?.kpis;

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Ausstehend"
          value={String(kpis?.totalPending ?? 0)}
          sub={fmtEur(kpis?.pendingEur ?? 0)}
          color="bg-amber-100 text-amber-700"
        />
        <KpiCard
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          label="Genehmigt"
          value={String(kpis?.totalApproved ?? 0)}
          sub={fmtEur(kpis?.approvedEur ?? 0)}
          color="bg-blue-100 text-blue-700"
        />
        <KpiCard
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Ausgezahlt"
          value={String(kpis?.totalPaid ?? 0)}
          sub={fmtEur(kpis?.paidEur ?? 0)}
          color="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          icon={<Gift className="h-3.5 w-3.5" />}
          label="Bonus-Regeln"
          value={String(dashboard?.configs?.length ?? 0)}
          color="bg-purple-100 text-purple-700"
        />
        <KpiCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Gesamt (30d)"
          value={fmtEur((kpis?.pendingEur ?? 0) + (kpis?.approvedEur ?? 0) + (kpis?.paidEur ?? 0))}
          color="bg-gray-100 text-gray-700"
        />
        <KpiCard
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Fahrer prämiert"
          value={String(dashboard?.summary?.length ?? 0)}
          color="bg-indigo-100 text-indigo-700"
        />
      </div>

      {/* Aktionsleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleEvaluate}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          Boni heute auswerten
        </button>
        {selected.size > 0 && (
          <>
            <button
              onClick={() => handleStatusUpdate('approved')}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {selected.size} genehmigen
            </button>
            <button
              onClick={() => handleStatusUpdate('paid')}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <DollarSign className="h-4 w-4" />
              Als ausgezahlt markieren
            </button>
            <button
              onClick={() => handleStatusUpdate('cancelled')}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Stornieren
            </button>
          </>
        )}
        <button
          onClick={load}
          disabled={busy}
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />Aktualisieren
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-6">
        {(['events', 'summary', 'configs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'events' ? 'Bonus-Events' : t === 'summary' ? 'Fahrer-Übersicht' : 'Bonus-Regeln'}
          </button>
        ))}
      </div>

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex gap-2">
            {(['pending', 'approved', 'paid', 'cancelled', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s === 'pending' ? 'Ausstehend' : s === 'approved' ? 'Genehmigt' : s === 'paid' ? 'Ausgezahlt' : s === 'cancelled' ? 'Storniert' : 'Alle'}
              </button>
            ))}
          </div>

          {filteredEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-gray-400 text-sm">
              Keine Bonus-Events für diesen Status.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="w-8 px-3 py-2"><input type="checkbox" onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(filteredEvents.map((ev) => ev.id)));
                      else setSelected(new Set());
                    }} /></th>
                    <th className="px-3 py-2 text-left">Fahrer</th>
                    <th className="px-3 py-2 text-left">Typ</th>
                    <th className="px-3 py-2 text-left">Datum</th>
                    <th className="px-3 py-2 text-right">Erreicht</th>
                    <th className="px-3 py-2 text-right">Bonus</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEvents.map((ev) => (
                    <tr key={ev.id} className={`hover:bg-gray-50 ${selected.has(ev.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(ev.id)}
                          onChange={() => toggleSelect(ev.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{ev.driverName ?? ev.driverId.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 text-gray-600">
                          {BONUS_TYPE_ICONS[ev.bonusType]}
                          {BONUS_TYPE_LABELS[ev.bonusType] ?? ev.bonusType}
                        </div>
                        {ev.notes && <p className="text-xs text-gray-400 mt-0.5">{ev.notes}</p>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{ev.referenceDate}</td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {ev.bonusType === 'deliveries_count'
                          ? `${ev.achievedValue} Lief.`
                          : ev.bonusType === 'on_time_rate'
                          ? fmtPct(ev.achievedValue)
                          : ev.bonusType === 'min_rating'
                          ? `★ ${ev.achievedValue.toFixed(1)}`
                          : '–'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                        {fmtEur(ev.bonusAmountEur)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ev.status]}`}>
                          {ev.status === 'pending' ? 'Ausstehend' : ev.status === 'approved' ? 'Genehmigt' : ev.status === 'paid' ? 'Ausgezahlt' : 'Storniert'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fahrer-Zusammenfassung Tab */}
      {tab === 'summary' && (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {!dashboard?.summary?.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">Noch keine Bonus-Daten.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Fahrer</th>
                  <th className="px-4 py-2 text-right">Boni Gesamt</th>
                  <th className="px-4 py-2 text-right">Ausstehend</th>
                  <th className="px-4 py-2 text-right">Genehmigt</th>
                  <th className="px-4 py-2 text-right">Ausgezahlt</th>
                  <th className="px-4 py-2 text-right">Letzter Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dashboard.summary.map((s) => (
                  <tr key={s.driverId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {s.driverName ?? s.driverId.slice(0, 8)}
                      <span className="ml-2 text-xs text-gray-400">{s.totalBonuses} Boni</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtEur(s.totalEur)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{s.pendingCount > 0 ? fmtEur(s.pendingEur) : '–'}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{s.approvedCount > 0 ? fmtEur(s.approvedEur) : '–'}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{s.paidCount > 0 ? fmtEur(s.paidEur) : '–'}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{s.latestBonusDate ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Bonus-Regeln Tab */}
      {tab === 'configs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewConfig((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />Neue Bonus-Regel
            </button>
          </div>

          {showNewConfig && (
            <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-900">Neue Bonus-Regel</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
                  <select
                    value={newCfg.bonus_type}
                    onChange={(e) => setNewCfg((c) => ({ ...c, bonus_type: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="deliveries_count">Lieferungen-Anzahl</option>
                    <option value="on_time_rate">Pünktlichkeitsrate</option>
                    <option value="min_rating">Mindest-Rating</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bezeichnung</label>
                  <input
                    type="text"
                    value={newCfg.label}
                    onChange={(e) => setNewCfg((c) => ({ ...c, label: e.target.value }))}
                    placeholder="z. B. 10 Lieferungen Tagesbonus"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Schwellenwert {newCfg.bonus_type === 'deliveries_count' ? '(Anzahl)' : newCfg.bonus_type === 'on_time_rate' ? '(0.0–1.0)' : '(1–5)'}
                  </label>
                  <input
                    type="number"
                    value={newCfg.threshold_value}
                    onChange={(e) => setNewCfg((c) => ({ ...c, threshold_value: e.target.value }))}
                    step={newCfg.bonus_type === 'deliveries_count' ? '1' : '0.05'}
                    placeholder={newCfg.bonus_type === 'deliveries_count' ? '10' : newCfg.bonus_type === 'on_time_rate' ? '0.90' : '4.5'}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bonus-Betrag (€)</label>
                  <input
                    type="number"
                    value={newCfg.bonus_amount_eur}
                    onChange={(e) => setNewCfg((c) => ({ ...c, bonus_amount_eur: e.target.value }))}
                    step="0.50"
                    placeholder="5.00"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Periode</label>
                  <select
                    value={newCfg.period}
                    onChange={(e) => setNewCfg((c) => ({ ...c, period: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="daily">Täglich</option>
                    <option value="weekly">Wöchentlich</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewConfig(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Abbrechen
                </button>
                <button
                  onClick={handleAddConfig}
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </div>
          )}

          {!dashboard?.configs?.length ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-gray-400 text-sm">
              Noch keine Bonus-Regeln. Klicke auf „Neue Bonus-Regel".
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboard.configs.map((cfg) => (
                <div key={cfg.id} className="flex items-start justify-between rounded-xl border bg-white p-4 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {BONUS_TYPE_ICONS[cfg.bonusType]}
                        {BONUS_TYPE_LABELS[cfg.bonusType]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cfg.enabled ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">{cfg.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Schwelle: {cfg.bonusType === 'deliveries_count'
                        ? `${cfg.thresholdValue} Lief.`
                        : cfg.bonusType === 'on_time_rate'
                        ? fmtPct(cfg.thresholdValue)
                        : `★ ${cfg.thresholdValue}`}
                      {' · '}
                      {cfg.period === 'daily' ? 'Täglich' : 'Wöchentlich'}
                    </p>
                    <p className="text-sm font-semibold text-emerald-700 mt-1">{fmtEur(cfg.bonusAmountEur)} Bonus</p>
                  </div>
                  <button
                    onClick={() => cfg.id && handleDeleteConfig(cfg.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    title="Regel löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
