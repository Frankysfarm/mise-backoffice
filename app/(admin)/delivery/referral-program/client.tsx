'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Gift, Users, TrendingUp, Award, RefreshCw, Loader2,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReferralProgram {
  id: string;
  is_enabled: boolean;
  referrer_reward_eur: number;
  referee_reward_eur: number;
  min_order_eur: number;
  valid_days: number;
  max_referrals_per_user: number;
  requires_first_order: boolean;
}

interface ReferralStats {
  total_referral_codes: number;
  active_referrers: number;
  total_conversions: number;
  rewarded_conversions: number;
  pending_conversions: number;
  total_rewards_eur: number;
  conversion_rate_pct: number;
}

interface TopReferrer {
  code_id: string;
  customer_token: string;
  code: string;
  uses_count: number;
  rewarded_count: number;
  total_earned_eur: number;
  created_at: string;
}

interface ReferralConversion {
  id: string;
  referee_token: string;
  order_id: string | null;
  status: 'pending' | 'delivered' | 'rewarded' | 'expired' | 'cancelled';
  referrer_reward_eur: number;
  referee_reward_eur: number;
  rewarded_at: string | null;
  created_at: string;
}

interface DashboardData {
  program: ReferralProgram | null;
  stats: ReferralStats | null;
  top_referrers: TopReferrer[];
  recent_conversions: ReferralConversion[];
}

// ── Utils ──────────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return `${Number(n).toFixed(2).replace('.', ',')} €`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function statusBadge(status: ReferralConversion['status']) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:   { label: 'Ausstehend', cls: 'bg-amber-100 text-amber-800',  icon: <Clock size={11} /> },
    delivered: { label: 'Geliefert',  cls: 'bg-blue-100 text-blue-800',    icon: <CheckCircle2 size={11} /> },
    rewarded:  { label: 'Belohnt',    cls: 'bg-emerald-100 text-emerald-800', icon: <Star size={11} /> },
    expired:   { label: 'Abgelaufen', cls: 'bg-gray-100 text-gray-500',    icon: <XCircle size={11} /> },
    cancelled: { label: 'Storniert',  cls: 'bg-red-100 text-red-700',      icon: <XCircle size={11} /> },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>
      {s.icon}{s.label}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
        </div>
        <div className={cn('rounded-lg p-2', color)}>{icon}</div>
      </div>
    </div>
  );
}

// ── Settings Form ─────────────────────────────────────────────────────────────

function ProgramSettingsForm({
  program,
  locationId,
  onSaved,
}: {
  program: ReferralProgram | null;
  locationId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    referrer_reward_eur:    program?.referrer_reward_eur ?? 3,
    referee_reward_eur:     program?.referee_reward_eur ?? 2,
    min_order_eur:          program?.min_order_eur ?? 10,
    valid_days:             program?.valid_days ?? 30,
    max_referrals_per_user: program?.max_referrals_per_user ?? 20,
    requires_first_order:   program?.requires_first_order ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/delivery/admin/referral-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_program', ...form }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (json.ok) { setMsg('Gespeichert ✓'); onSaved(); }
      else setMsg(json.error ?? 'Fehler');
    } finally {
      setSaving(false);
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type: 'number' | 'checkbox' = 'number',
    step?: string,
  ) => (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-zinc-700 flex-1">{label}</label>
      {type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={form[key] as boolean}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
        />
      ) : (
        <input
          type="number"
          step={step ?? '1'}
          min="0"
          value={form[key] as number}
          onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
          className="w-28 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-right"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {field('Belohnung für Empfehler (€)', 'referrer_reward_eur', 'number', '0.50')}
      {field('Willkommens-Gutschein für Neukunden (€)', 'referee_reward_eur', 'number', '0.50')}
      {field('Mindestbestellwert zur Aktivierung (€)', 'min_order_eur', 'number', '0.50')}
      {field('Gutschein-Gültigkeit (Tage)', 'valid_days')}
      {field('Max. Empfehlungen pro Nutzer', 'max_referrals_per_user')}
      {field('Nur bei erster Bestellung des Geworbenen', 'requires_first_order', 'checkbox')}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Einstellungen speichern
        </button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function ReferralProgramClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'referrers' | 'conversions' | 'settings'>('overview');
  const [isPending, startTransition] = useTransition();
  const [toggling, setToggling] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/referral-program');
      const json = await res.json() as DashboardData & { ok: boolean };
      if (json.ok !== false) setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleProgram() {
    if (!data) return;
    setToggling(true);
    try {
      await fetch('/api/delivery/admin/referral-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_program',
          is_enabled: !data.program?.is_enabled,
        }),
      });
      await load();
    } finally {
      setToggling(false);
    }
  }

  async function processRewards() {
    startTransition(async () => {
      await fetch('/api/delivery/admin/referral-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_rewards' }),
      });
      await load();
    });
  }

  const stats = data?.stats;
  const program = data?.program;
  const enabled = program?.is_enabled ?? false;

  const TABS = [
    { key: 'overview',    label: 'Übersicht' },
    { key: 'referrers',   label: 'Top-Empfehler' },
    { key: 'conversions', label: 'Konversionen' },
    { key: 'settings',    label: 'Einstellungen' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleProgram}
            disabled={toggling}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              enabled
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
            )}
          >
            {toggling ? (
              <Loader2 size={14} className="animate-spin" />
            ) : enabled ? (
              <ToggleRight size={16} />
            ) : (
              <ToggleLeft size={16} />
            )}
            {enabled ? 'Programm aktiv' : 'Programm inaktiv'}
          </button>

          {data?.stats?.pending_conversions != null && data.stats.pending_conversions > 0 && (
            <button
              onClick={processRewards}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
              {data.stats.pending_conversions} Belohnungen verarbeiten
            </button>
          )}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Aktive Empfehler"
          value={loading ? '…' : String(stats?.active_referrers ?? 0)}
          sub={`von ${stats?.total_referral_codes ?? 0} Codes`}
          icon={<Users size={18} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
        <KpiCard
          label="Konversionen gesamt"
          value={loading ? '…' : String(stats?.total_conversions ?? 0)}
          sub={`${stats?.rewarded_conversions ?? 0} belohnt`}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          color="bg-emerald-50"
        />
        <KpiCard
          label="Konversionsrate"
          value={loading ? '…' : `${stats?.conversion_rate_pct ?? 0} %`}
          sub="Empfehlungen → Bestellungen"
          icon={<Award size={18} className="text-amber-600" />}
          color="bg-amber-50"
        />
        <KpiCard
          label="Belohnungen gesamt"
          value={loading ? '…' : fmtEur(stats?.total_rewards_eur ?? 0)}
          sub={`${stats?.pending_conversions ?? 0} ausstehend`}
          icon={<Gift size={18} className="text-rose-600" />}
          color="bg-rose-50"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900">Programm-Konfiguration</h3>
          {program ? (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ['Empfehler-Belohnung', fmtEur(program.referrer_reward_eur)],
                ['Neukunden-Gutschein', fmtEur(program.referee_reward_eur)],
                ['Mindestbestellwert', fmtEur(program.min_order_eur)],
                ['Gutschein-Gültigkeit', `${program.valid_days} Tage`],
                ['Max. pro Nutzer', `${program.max_referrals_per_user} Empfehlungen`],
                ['Nur Erstkunden', program.requires_first_order ? 'Ja' : 'Nein'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500">{k}</p>
                  <p className="mt-0.5 font-semibold text-zinc-900">{v}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Noch kein Programm konfiguriert. Wechsle zum Tab "Einstellungen".</p>
          )}

          {data?.recent_conversions && data.recent_conversions.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-zinc-900 pt-2">Letzte Konversionen</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                      <th className="pb-2 pr-4 font-medium">Datum</th>
                      <th className="pb-2 pr-4 font-medium">Geworbener</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Belohnung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_conversions.slice(0, 8).map(c => (
                      <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                        <td className="py-2 pr-4 text-zinc-500">{fmtDate(c.created_at)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-zinc-600">
                          {c.referee_token.slice(0, 12)}…
                        </td>
                        <td className="py-2 pr-4">{statusBadge(c.status)}</td>
                        <td className="py-2 text-right text-zinc-700">
                          {fmtEur(c.referrer_reward_eur + c.referee_reward_eur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'referrers' && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900">Top-Empfehler</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-400 text-sm">Lädt…</div>
          ) : (data?.top_referrers?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-sm">Noch keine Empfehler.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Kunde</th>
                  <th className="px-4 py-3 font-medium text-right">Nutzungen</th>
                  <th className="px-4 py-3 font-medium text-right">Belohnt</th>
                  <th className="px-4 py-3 font-medium text-right">Verdient</th>
                </tr>
              </thead>
              <tbody>
                {(data?.top_referrers ?? []).map((r, i) => (
                  <tr key={r.code_id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-400">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{r.code}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {r.customer_token.slice(0, 14)}…
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">{r.uses_count}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{r.rewarded_count}</td>
                    <td className="px-4 py-3 text-right text-zinc-900 font-semibold">{fmtEur(r.total_earned_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'conversions' && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900">Alle Konversionen (letzte 20)</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-400 text-sm">Lädt…</div>
          ) : (data?.recent_conversions?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-sm">Noch keine Konversionen.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                  <th className="px-4 py-3 font-medium">Datum</th>
                  <th className="px-4 py-3 font-medium">Geworbener</th>
                  <th className="px-4 py-3 font-medium">Bestellung</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Empfehler</th>
                  <th className="px-4 py-3 font-medium text-right">Neukunde</th>
                  <th className="px-4 py-3 font-medium">Belohnt am</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_conversions ?? []).map(c => (
                  <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-500">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {c.referee_token.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {c.order_id ? c.order_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3 text-right text-indigo-700">{fmtEur(c.referrer_reward_eur)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{fmtEur(c.referee_reward_eur)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {c.rewarded_at ? fmtDate(c.rewarded_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className="flex w-full items-center justify-between text-sm font-semibold text-zinc-900"
          >
            Programm-Einstellungen bearbeiten
            {settingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {settingsOpen && (
            <ProgramSettingsForm
              program={data?.program ?? null}
              locationId={locationId}
              onSaved={load}
            />
          )}

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1">
            <p className="font-medium">Wie funktioniert das Empfehlungs-Programm?</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Jeder Kunde erhält einen eindeutigen 8-stelligen Code</li>
              <li>Der Geworbene gibt den Code beim Checkout ein</li>
              <li>Nach erfolgreicher Lieferung werden beide Gutscheine automatisch erstellt</li>
              <li>Der Empfehler sieht seinen Code in der Bestellbestätigung</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
