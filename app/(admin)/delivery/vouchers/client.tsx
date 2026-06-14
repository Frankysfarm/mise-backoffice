'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Tag, Plus, RefreshCw, XCircle, CheckCircle2, Users,
  Euro, BarChart2, Ticket, Search, Copy, Check,
  ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

type VoucherType = 'flat_eur' | 'percent' | 'free_delivery';
type VoucherStatus = 'active' | 'inactive' | 'expired' | 'exhausted';
type RfmSegment =
  | 'champion' | 'loyal' | 'potential_loyalist' | 'new_customer' | 'promising'
  | 'needs_attention' | 'at_risk' | 'cant_lose' | 'hibernating' | 'lost';

interface VoucherStats {
  id: string;
  code: string;
  voucher_type: VoucherType;
  discount_value: number;
  min_order_eur: number;
  max_discount_eur: number | null;
  max_uses: number | null;
  uses_count: number;
  valid_from: string;
  valid_until: string | null;
  target_segment: RfmSegment | null;
  campaign_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  status: VoucherStatus;
  redemption_count: number;
  total_discount_eur: number;
  total_order_volume: number;
  unique_customers: number;
}

interface Dashboard {
  summary: {
    total_vouchers: number;
    active_vouchers: number;
    total_redemptions: number;
    expired_vouchers: number;
    total_discount_eur: number;
    avg_discount_eur: number;
    unique_customers: number;
  };
  vouchers: VoucherStats[];
  top_performers: VoucherStats[];
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const TYPE_LABEL: Record<VoucherType, string> = {
  flat_eur: 'Festbetrag',
  percent: 'Prozent',
  free_delivery: 'Gratis-Lieferung',
};

const STATUS_COLORS: Record<VoucherStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-500',
  expired: 'bg-orange-100 text-orange-700',
  exhausted: 'bg-red-100 text-red-700',
};

const RFM_LABELS: Record<RfmSegment, string> = {
  champion: '🏆 Champions',
  loyal: '💎 Loyale',
  potential_loyalist: '⭐ Potentielle Loyale',
  new_customer: '🆕 Neukunden',
  promising: '🌱 Vielversprechende',
  needs_attention: '⚠️ Brauchen Aufmerksamkeit',
  at_risk: '🔴 Gefährdet',
  cant_lose: '❗ Nicht verlieren',
  hibernating: '😴 Schlafend',
  lost: '💔 Verloren',
};

function discountLabel(v: VoucherStats): string {
  if (v.voucher_type === 'flat_eur') return `${v.discount_value.toFixed(2)} €`;
  if (v.voucher_type === 'percent') {
    const cap = v.max_discount_eur != null ? ` (max ${v.max_discount_eur.toFixed(2)} €)` : '';
    return `${v.discount_value}%${cap}`;
  }
  return 'Lieferung gratis';
}

function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3 items-start">
      <div className={cn('p-2 rounded-lg', colorMap[color] ?? colorMap.blue)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onCreated,
  isBulk,
}: {
  onClose: () => void;
  onCreated: () => void;
  isBulk: boolean;
}) {
  const [form, setForm] = useState({
    code: '',
    voucher_type: 'flat_eur' as VoucherType,
    discount_value: '',
    min_order_eur: '',
    max_discount_eur: '',
    max_uses: '',
    max_uses_per_customer: '1',
    valid_until: '',
    target_segment: '' as RfmSegment | '',
    campaign_name: '',
    description: '',
    // bulk-only
    count: '10',
    prefix: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkCodes, setBulkCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      action: isBulk ? 'generate_bulk' : 'create',
      voucher_type: form.voucher_type,
      discount_value: Number(form.discount_value),
      min_order_eur: form.min_order_eur ? Number(form.min_order_eur) : 0,
      max_discount_eur: form.max_discount_eur ? Number(form.max_discount_eur) : undefined,
      max_uses: form.max_uses ? Number(form.max_uses) : undefined,
      max_uses_per_customer: Number(form.max_uses_per_customer),
      valid_until: form.valid_until || undefined,
      target_segment: form.target_segment || undefined,
      campaign_name: form.campaign_name || undefined,
      description: form.description || undefined,
    };

    if (isBulk) {
      body.count = Number(form.count);
      body.prefix = form.prefix;
    } else {
      body.code = form.code || undefined;
    }

    const res = await fetch('/api/delivery/admin/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { error?: string; codes?: string[]; voucher?: unknown };
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Fehler');
      return;
    }

    if (isBulk && data.codes) {
      setBulkCodes(data.codes);
    } else {
      onCreated();
      onClose();
    }
  }

  function copyAll() {
    navigator.clipboard.writeText(bulkCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {isBulk ? 'Bulk-Gutscheine generieren' : 'Neuer Gutschein'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {bulkCodes.length > 0 ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {bulkCodes.length} Codes generiert
              </p>
              <button
                onClick={copyAll}
                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Kopiert!' : 'Alle kopieren'}
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-xs space-y-1">
              {bulkCodes.map((c) => (
                <div key={c} className="text-gray-700">{c}</div>
              ))}
            </div>
            <button
              onClick={() => { onCreated(); onClose(); }}
              className="w-full bg-emerald-600 text-white py-2 rounded-xl font-medium"
            >
              Fertig
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            {!isBulk && (
              <div>
                <label className="text-xs font-medium text-gray-600">Code (leer = auto)</label>
                <input value={form.code} onChange={set('code')}
                  placeholder="z. B. SOMMER25"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                />
              </div>
            )}
            {isBulk && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Anzahl Codes</label>
                  <input type="number" value={form.count} onChange={set('count')} min={1} max={500}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Präfix</label>
                  <input value={form.prefix} onChange={set('prefix')} placeholder="z. B. SOMMER"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600">Typ *</label>
              <select value={form.voucher_type} onChange={set('voucher_type')}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="flat_eur">Festbetrag (€)</option>
                <option value="percent">Prozent (%)</option>
                <option value="free_delivery">Gratis-Lieferung</option>
              </select>
            </div>
            {form.voucher_type !== 'free_delivery' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Rabatt {form.voucher_type === 'flat_eur' ? '(€) *' : '(%) *'}
                  </label>
                  <input type="number" value={form.discount_value} onChange={set('discount_value')}
                    min={0} step={0.01} required
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                {form.voucher_type === 'percent' && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Max. Rabatt (€)</label>
                    <input type="number" value={form.max_discount_eur} onChange={set('max_discount_eur')}
                      min={0} step={0.01} placeholder="kein Limit"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Mindestbestellwert (€)</label>
                <input type="number" value={form.min_order_eur} onChange={set('min_order_eur')}
                  min={0} step={0.01} placeholder="0.00"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Max. Einlösungen</label>
                <input type="number" value={form.max_uses} onChange={set('max_uses')}
                  min={1} placeholder="unbegrenzt"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Max. pro Kunde</label>
                <input type="number" value={form.max_uses_per_customer} onChange={set('max_uses_per_customer')}
                  min={1}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Gültig bis</label>
                <input type="datetime-local" value={form.valid_until} onChange={set('valid_until')}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Ziel-Segment (optional)</label>
              <select value={form.target_segment} onChange={set('target_segment')}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Alle Kunden</option>
                {(Object.entries(RFM_LABELS) as [RfmSegment, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Kampagnenname</label>
                <input value={form.campaign_name} onChange={set('campaign_name')}
                  placeholder="z. B. Sommer 2026"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Beschreibung</label>
                <input value={form.description} onChange={set('description')}
                  placeholder="Anzeige im Checkout"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm"
              >
                Abbrechen
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Erstelle…' : isBulk ? 'Generieren' : 'Erstellen'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Voucher Row ───────────────────────────────────────────────────────────────

function VoucherRow({
  v,
  onDeactivate,
}: {
  v: VoucherStats;
  onDeactivate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(v.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const usagePct =
    v.max_uses != null ? Math.min(100, (v.uses_count / v.max_uses) * 100) : null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded((x) => !x)}
      >
        {/* Code */}
        <div className="font-mono font-bold text-gray-800 text-sm min-w-[120px]">{v.code}</div>

        {/* Status */}
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[v.status])}>
          {v.status === 'active' ? 'Aktiv' :
           v.status === 'expired' ? 'Abgelaufen' :
           v.status === 'exhausted' ? 'Erschöpft' : 'Inaktiv'}
        </span>

        {/* Type + Discount */}
        <span className="text-sm text-gray-600 flex-1">{discountLabel(v)}</span>

        {/* Redemptions */}
        <span className="text-xs text-gray-400 hidden sm:block">
          {v.uses_count}{v.max_uses != null ? `/${v.max_uses}` : ''} Einlösungen
        </span>

        {/* Segment */}
        {v.target_segment && (
          <span className="text-xs text-purple-600 hidden md:block">
            {RFM_LABELS[v.target_segment]}
          </span>
        )}

        {/* Copy + Deactivate */}
        <button
          onClick={(e) => { e.stopPropagation(); copyCode(); }}
          className="text-gray-400 hover:text-blue-600 p-1"
          title="Code kopieren"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </button>

        {v.is_active && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeactivate(v.id); }}
            className="text-gray-400 hover:text-red-500 p-1"
            title="Deaktivieren"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gray-400">Typ</p>
            <p className="font-medium text-gray-700">{TYPE_LABEL[v.voucher_type]}</p>
          </div>
          <div>
            <p className="text-gray-400">Mindestbestellwert</p>
            <p className="font-medium text-gray-700">{v.min_order_eur.toFixed(2)} €</p>
          </div>
          <div>
            <p className="text-gray-400">Einlösungen</p>
            <p className="font-medium text-gray-700">
              {v.redemption_count} ({v.unique_customers} Kunden)
            </p>
          </div>
          <div>
            <p className="text-gray-400">Ersparter Betrag</p>
            <p className="font-medium text-gray-700">{fmt(v.total_discount_eur)} €</p>
          </div>
          {v.total_order_volume > 0 && (
            <div>
              <p className="text-gray-400">Bestellvolumen</p>
              <p className="font-medium text-gray-700">{fmt(v.total_order_volume)} €</p>
            </div>
          )}
          {v.valid_until && (
            <div>
              <p className="text-gray-400">Gültig bis</p>
              <p className="font-medium text-gray-700">
                {new Date(v.valid_until).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
          {v.campaign_name && (
            <div>
              <p className="text-gray-400">Kampagne</p>
              <p className="font-medium text-gray-700">{v.campaign_name}</p>
            </div>
          )}
          {usagePct != null && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">Auslastung</p>
              <div className="bg-gray-200 rounded-full h-1.5">
                <div
                  className={cn('h-1.5 rounded-full', usagePct >= 90 ? 'bg-red-500' : usagePct >= 60 ? 'bg-amber-400' : 'bg-emerald-500')}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className="text-gray-400 mt-0.5">{usagePct.toFixed(0)}% ausgeschöpft</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export default function VouchersClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VoucherStatus | 'all'>('all');
  const [showModal, setShowModal] = useState<false | 'single' | 'bulk'>(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/delivery/admin/vouchers');
    if (res.ok) {
      const d = await res.json() as Dashboard;
      setDashboard(d);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDeactivate(id: string) {
    if (!confirm('Gutschein wirklich deaktivieren?')) return;
    setDeactivating(id);
    await fetch('/api/delivery/admin/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate', id }),
    });
    setDeactivating(null);
    void load();
  }

  const vouchers = dashboard?.vouchers ?? [];
  const filtered = vouchers.filter((v) => {
    const matchSearch =
      !search ||
      v.code.toLowerCase().includes(search.toLowerCase()) ||
      (v.campaign_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || v.status === filter;
    return matchSearch && matchFilter;
  });

  const s = dashboard?.summary;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Gutschein-Verwaltung</h1>
            <p className="text-sm text-gray-500">Promo-Codes, Rabatte & gezielte Angebote</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Aktualisieren
          </button>
          <button onClick={() => setShowModal('bulk')} className="flex items-center gap-1 text-sm bg-purple-600 text-white px-3 py-2 rounded-xl hover:bg-purple-700">
            <BarChart2 className="w-4 h-4" /> Bulk
          </button>
          <button onClick={() => setShowModal('single')} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Neu
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard icon={Tag} label="Aktive Gutscheine" value={s.active_vouchers} sub={`${s.total_vouchers} gesamt`} color="blue" />
          <KpiCard icon={CheckCircle2} label="Einlösungen" value={s.total_redemptions} sub={`${s.unique_customers} Kunden`} color="green" />
          <KpiCard icon={Euro} label="Rabatt vergeben" value={`${fmt(s.total_discount_eur)} €`} sub={`Ø ${fmt(s.avg_discount_eur)} € / Einlösung`} color="amber" />
          <KpiCard icon={Users} label="Abgelaufen" value={s.expired_vouchers} sub="Bereinigung möglich" color="purple" />
        </div>
      )}

      {/* Top Performer */}
      {(dashboard?.top_performers ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top-Gutscheine</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {dashboard!.top_performers.map((v) => (
              <div key={v.id} className="min-w-[160px] bg-gray-50 rounded-xl p-3 text-xs">
                <p className="font-mono font-bold text-gray-800 text-sm">{v.code}</p>
                <p className="text-gray-500 mt-1">{discountLabel(v)}</p>
                <p className="text-gray-400 mt-1">{v.redemption_count} Einlösungen</p>
                <p className="font-semibold text-emerald-700 mt-1">{fmt(v.total_discount_eur)} € Rabatt</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voucher List */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-700">Alle Gutscheine</h2>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code oder Kampagne suchen…"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as VoucherStatus | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          >
            <option value="all">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="expired">Abgelaufen</option>
            <option value="exhausted">Erschöpft</option>
            <option value="inactive">Inaktiv</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Lade…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {vouchers.length === 0
              ? 'Noch keine Gutscheine. Erstelle deinen ersten!'
              : 'Keine Gutscheine gefunden.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((v) => (
              <VoucherRow
                key={v.id}
                v={v}
                onDeactivate={deactivating === v.id ? () => {} : handleDeactivate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <CreateModal
          isBulk={showModal === 'bulk'}
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
