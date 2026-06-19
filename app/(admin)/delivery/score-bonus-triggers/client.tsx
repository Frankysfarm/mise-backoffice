'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Trophy, RefreshCw, Plus, Trash2, CheckCircle2, DollarSign,
  ToggleLeft, ToggleRight, ChevronRight, Clock, Star, Target,
} from 'lucide-react';
import type {
  ScoreBonusTrigger,
  ScoreBonusGrant,
  BonusTriggerType,
  TriggerPeriod,
  GrantStatus,
} from '@/lib/delivery/driver-score-trigger';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function eur(v: number | null | undefined) {
  if (v == null) return '—';
  return `€${v.toFixed(2)}`;
}

function kpiCard(
  title: string,
  value: string,
  sub: string,
  Icon: React.ComponentType<{ className?: string }>,
  color: string,
) {
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

const STATUS_LABEL: Record<GrantStatus, string> = {
  pending:   'Ausstehend',
  approved:  'Genehmigt',
  paid:      'Ausgezahlt',
  cancelled: 'Storniert',
};

const STATUS_COLOR: Record<GrantStatus, string> = {
  pending:   'bg-amber-900/30 text-amber-400',
  approved:  'bg-emerald-900/30 text-emerald-400',
  paid:      'bg-blue-900/30 text-blue-400',
  cancelled: 'bg-slate-700 text-slate-400',
};

const PERIOD_LABEL: Record<TriggerPeriod, string> = {
  week:  'Woche',
  month: 'Monat',
};

const BONUS_TYPE_LABEL: Record<BonusTriggerType, string> = {
  flat_eur:      'Fixbetrag (€)',
  provision_pct: 'Provision (%)',
};

// ─────────────────────────────────────────────────────────────
// Trigger create/edit modal
// ─────────────────────────────────────────────────────────────

interface TriggerForm {
  label: string;
  scoreThreshold: number;
  bonusType: BonusTriggerType;
  bonusValue: number;
  period: TriggerPeriod;
  scorePeriod: TriggerPeriod;
  enabled: boolean;
}

const DEFAULT_FORM: TriggerForm = {
  label:          '',
  scoreThreshold: 80,
  bonusType:      'flat_eur',
  bonusValue:     10,
  period:         'week',
  scorePeriod:    'week',
  enabled:        true,
};

function TriggerModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Partial<TriggerForm>;
  onSave: (form: TriggerForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TriggerForm>({ ...DEFAULT_FORM, ...initial });
  const [saving, setSaving] = useState(false);

  function textField(key: keyof TriggerForm, label: string, placeholder?: string) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">{label}</span>
        <input
          type="text"
          value={form[key] as string}
          placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="rounded bg-slate-700 border border-slate-600 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>
    );
  }

  function numField(key: keyof TriggerForm, label: string, step = '1') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">{label}</span>
        <input
          type="number"
          step={step}
          value={form[key] as number}
          onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
          className="rounded bg-slate-700 border border-slate-600 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>
    );
  }

  function selectField<T extends string>(
    key: keyof TriggerForm,
    label: string,
    options: { value: T; label: string }[],
  ) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">{label}</span>
        <select
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value as T }))}
          className="rounded bg-slate-700 border border-slate-600 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-400" />
            Trigger {initial.label ? 'bearbeiten' : 'erstellen'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={e => void handleSubmit(e)} className="p-5 space-y-4">
          {textField('label', 'Bezeichnung', 'z.B. Score ≥ 80 → +10 €/Woche')}
          {numField('scoreThreshold', 'Score-Schwelle (0–100)', '1')}
          {selectField<BonusTriggerType>('bonusType', 'Bonus-Typ', [
            { value: 'flat_eur', label: 'Fixbetrag (€)' },
            { value: 'provision_pct', label: 'Provision (% auf Wochenumsatz)' },
          ])}
          {numField(
            'bonusValue',
            form.bonusType === 'flat_eur' ? 'Betrag (€)' : 'Prozentsatz (%)',
            '0.01',
          )}
          {selectField<TriggerPeriod>('period', 'Auszahlungsperiode', [
            { value: 'week', label: 'Wöchentlich' },
            { value: 'month', label: 'Monatlich' },
          ])}
          {selectField<TriggerPeriod>('scorePeriod', 'Score-Bewertungsperiode', [
            { value: 'week', label: 'Wöchentlicher Score' },
            { value: 'month', label: 'Monatlicher Score' },
          ])}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
              className="w-4 h-4 rounded accent-violet-500"
            />
            <span className="text-sm text-slate-300">Sofort aktivieren</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !form.label.trim()}
              className="flex-1 py-2 rounded-lg bg-violet-700 text-white text-sm hover:bg-violet-600 disabled:opacity-50"
            >
              {saving ? 'Speichere…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────

type Tab = 'triggers' | 'grants';
type GrantFilter = 'all' | GrantStatus;

interface Dashboard {
  triggers: ScoreBonusTrigger[];
  grants: ScoreBonusGrant[];
  kpis: {
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
    pendingEur: number;
    approvedEur: number;
    paidEur: number;
    triggersActive: number;
  };
}

export function ScoreBonusTriggerClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('grants');
  const [filter, setFilter] = useState<GrantFilter>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Partial<TriggerForm> | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/delivery/admin/score-bonus-triggers?action=dashboard');
      if (r.ok) setData(await r.json() as Dashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Trigger actions ──────────────────────────────────────────

  async function handleToggle(t: ScoreBonusTrigger) {
    await fetch('/api/delivery/admin/score-bonus-triggers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_trigger', triggerId: t.id, enabled: !t.enabled }),
    });
    void load();
  }

  async function handleDelete(triggerId: string) {
    if (!confirm('Trigger löschen? Alle zugehörigen Grants werden ebenfalls gelöscht.')) return;
    setBusy(true);
    try {
      await fetch('/api/delivery/admin/score-bonus-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_trigger', triggerId }),
      });
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTrigger(form: TriggerForm) {
    if (editId) {
      await fetch('/api/delivery/admin/score-bonus-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_trigger',
          triggerId: editId,
          label:          form.label,
          scoreThreshold: form.scoreThreshold,
          bonusValue:     form.bonusValue,
          enabled:        form.enabled,
        }),
      });
    } else {
      await fetch('/api/delivery/admin/score-bonus-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_trigger', ...form }),
      });
    }
    setModal(null);
    setEditId(null);
    void load();
  }

  function openEdit(t: ScoreBonusTrigger) {
    setEditId(t.id);
    setModal({
      label:          t.label,
      scoreThreshold: t.scoreThreshold,
      bonusType:      t.bonusType,
      bonusValue:     t.bonusValue,
      period:         t.period,
      scorePeriod:    t.scorePeriod,
      enabled:        t.enabled,
    });
  }

  // ── Grant actions ────────────────────────────────────────────

  async function handleGrantAction(status: 'approved' | 'paid' | 'cancelled') {
    if (!selected.size) return;
    setBusy(true);
    try {
      await fetch('/api/delivery/admin/score-bonus-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    'update_grant',
          grant_ids: Array.from(selected),
          status,
        }),
      });
      setSelected(new Set());
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function handleEvaluate() {
    setBusy(true);
    try {
      await fetch('/api/delivery/admin/score-bonus-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate' }),
      });
      void load();
    } finally {
      setBusy(false);
    }
  }

  // ── Filtered grants ──────────────────────────────────────────

  const grants = (data?.grants ?? []).filter(
    g => filter === 'all' || g.status === filter,
  );

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selected.size === grants.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(grants.map(g => g.id)));
    }
  }

  // ── Render ───────────────────────────────────────────────────

  if (loading && !data) {
    return <div className="p-8 text-slate-400 text-sm">Lade Score-Bonus-Daten…</div>;
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-6 p-6">
      {/* Trigger modal */}
      {modal !== null && (
        <TriggerModal
          initial={modal}
          onSave={handleSaveTrigger}
          onClose={() => { setModal(null); setEditId(null); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-violet-400" />
            Score-Bonus-Trigger
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Automatische Boni wenn Fahrer-Composite-Score eine Schwelle übersteigt
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleEvaluate()}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-600 text-sm disabled:opacity-50"
          >
            <Target className="h-3.5 w-3.5" />
            {busy ? 'Scanne…' : 'Jetzt scannen'}
          </button>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCard(
          'Aktive Trigger',
          String(kpis?.triggersActive ?? 0),
          `${(data?.triggers ?? []).length} gesamt`,
          Target,
          'text-violet-400 bg-violet-900/30',
        )}
        {kpiCard(
          'Ausstehende Grants',
          String(kpis?.totalPending ?? 0),
          `${eur(kpis?.pendingEur ?? 0)} offen`,
          Clock,
          'text-amber-400 bg-amber-900/30',
        )}
        {kpiCard(
          'Genehmigt',
          String(kpis?.totalApproved ?? 0),
          `${eur(kpis?.approvedEur ?? 0)} freigegeben`,
          CheckCircle2,
          'text-emerald-400 bg-emerald-900/30',
        )}
        {kpiCard(
          'Ausgezahlt (60 Tage)',
          String(kpis?.totalPaid ?? 0),
          `${eur(kpis?.paidEur ?? 0)} ausgezahlt`,
          DollarSign,
          'text-blue-400 bg-blue-900/30',
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {(['grants', 'triggers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'grants' ? `Grants (${data?.grants?.length ?? 0})` : `Trigger (${data?.triggers?.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* ── Tab: Grants ─────────────────────────────────────── */}
      {tab === 'grants' && (
        <div className="space-y-4">
          {/* Filter + batch actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              {(['all', 'pending', 'approved', 'paid', 'cancelled'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSelected(new Set()); }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    filter === f ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Alle' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
            {selected.size > 0 && (
              <div className="flex gap-2 ml-auto">
                <span className="text-xs text-slate-400 self-center">{selected.size} ausgewählt</span>
                <button
                  onClick={() => void handleGrantAction('approved')}
                  disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs hover:bg-emerald-600 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Genehmigen
                </button>
                <button
                  onClick={() => void handleGrantAction('paid')}
                  disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs hover:bg-blue-600 disabled:opacity-50"
                >
                  <DollarSign className="h-3.5 w-3.5" /> Auszahlen
                </button>
                <button
                  onClick={() => void handleGrantAction('cancelled')}
                  disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/60 text-red-300 text-xs hover:bg-red-900"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Stornieren
                </button>
              </div>
            )}
          </div>

          {/* Grants table */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {!grants.length ? (
              <p className="text-slate-400 text-sm p-6 text-center">
                Keine Grants für diesen Filter.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="py-2.5 pl-4 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === grants.length && grants.length > 0}
                        onChange={toggleAll}
                        className="accent-violet-500"
                      />
                    </th>
                    <th className="py-2.5 px-3 text-left">Fahrer</th>
                    <th className="py-2.5 px-3 text-left">Trigger</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                    <th className="py-2.5 px-3 text-center">Periode</th>
                    <th className="py-2.5 px-3 text-right">Bonus</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 pr-4 text-right">Ausgelöst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {grants.map(g => (
                    <tr key={g.id} className={`hover:bg-slate-750 ${selected.has(g.id) ? 'bg-violet-900/20' : ''}`}>
                      <td className="py-2.5 pl-4">
                        <input
                          type="checkbox"
                          checked={selected.has(g.id)}
                          onChange={() => toggleSelect(g.id)}
                          className="accent-violet-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-white">{g.driverName ?? 'Unbekannt'}</p>
                        <p className="text-xs text-slate-500 font-mono">{g.driverId.slice(0, 8)}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="text-white">{g.triggerLabel ?? '—'}</p>
                        <p className="text-xs text-slate-500">
                          Schwelle: {g.scoreThreshold ?? '—'} · {BONUS_TYPE_LABEL[g.bonusType]}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-bold ${g.compositeScore >= 90 ? 'text-emerald-400' : g.compositeScore >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                          {g.compositeScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-300 text-xs">{g.periodStart}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {g.bonusType === 'flat_eur'
                          ? <span className="text-emerald-400">{eur(g.bonusValue)}</span>
                          : <span className="text-amber-400">{g.bonusValue}%{g.resolvedEur != null ? ` (${eur(g.resolvedEur)})` : ''}</span>
                        }
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[g.status]}`}>
                          {STATUS_LABEL[g.status]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-xs text-slate-500">
                        {new Date(g.evaluatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        <br />
                        {new Date(g.evaluatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Triggers ───────────────────────────────────── */}
      {tab === 'triggers' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditId(null); setModal(DEFAULT_FORM); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-700 text-white hover:bg-violet-600 text-sm"
            >
              <Plus className="h-4 w-4" /> Trigger erstellen
            </button>
          </div>

          {!(data?.triggers?.length) ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
              <Target className="h-8 w-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Noch keine Trigger konfiguriert.</p>
              <p className="text-slate-500 text-xs mt-1">Erstelle einen Trigger um automatisch Boni bei Score-Schwellen auszulösen.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data!.triggers.map(t => (
                <div
                  key={t.id}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className={`rounded-lg p-2 ${t.enabled ? 'bg-violet-900/40 text-violet-400' : 'bg-slate-700 text-slate-500'}`}>
                    <Star className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{t.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Score ≥ {t.scoreThreshold} ({PERIOD_LABEL[t.scorePeriod]}) →{' '}
                      {t.bonusType === 'flat_eur'
                        ? `+${eur(t.bonusValue)} pro ${PERIOD_LABEL[t.period]}`
                        : `+${t.bonusValue}% Provision pro ${PERIOD_LABEL[t.period]}`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleToggle(t)}
                      className={`transition-colors ${t.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-300'}`}
                      title={t.enabled ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      {t.enabled
                        ? <ToggleRight className="h-6 w-6" />
                        : <ToggleLeft className="h-6 w-6" />
                      }
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1"
                    >
                      Bearbeiten <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void handleDelete(t.id)}
                      disabled={busy}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50"
                      title="Trigger löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info box */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">Wie funktioniert es?</p>
            <p>1. Konfiguriere Trigger mit Score-Schwelle (z.B. ≥ 80) und Bonus-Typ.</p>
            <p>2. Der Cron-Job evaluiert täglich automatisch alle Fahrer-Scores.</p>
            <p>3. Grants werden erstellt (idempotent — 1 Grant pro Fahrer×Trigger×Periode).</p>
            <p>4. Manager genehmigt Grants → Status: Genehmigt → Ausgezahlt.</p>
            <p className="text-amber-400/80">Provision (%): Betrag wird beim Genehmigen manuell eingetragen (Manager kennt Wochenumsatz).</p>
          </div>
        </div>
      )}
    </div>
  );
}
