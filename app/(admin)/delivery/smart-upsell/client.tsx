'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Zap, TrendingUp, ShoppingCart, BarChart2, RefreshCw,
  Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Loader2,
  ChevronDown, ChevronUp, Package, Star, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpsellPair {
  id: string;
  item_a: string;
  item_b: string;
  pair_count: number;
  confidence_ab: number;
  confidence_ba: number;
  lift_score: number;
  support_score: number;
  last_rebuilt_at: string;
}

interface UpsellRule {
  id: string;
  name: string;
  trigger_item: string;
  suggested_item: string;
  headline: string | null;
  badge: string | null;
  extra_fee_eur: number;
  is_active: boolean;
  priority: number;
  max_per_day: number | null;
  impressions_today: number;
  total_impressions: number;
  total_conversions: number;
  created_at: string;
}

interface RulePerformance {
  rule_id: string;
  name: string;
  trigger_item: string;
  suggested_item: string;
  is_active: boolean;
  total_impressions: number;
  total_conversions: number;
  conversion_rate_pct: number;
  total_revenue_lift_eur: number;
  last_impression_at: string | null;
}

interface Dashboard {
  total_pairs: number;
  total_rules: number;
  active_rules: number;
  total_impressions_30d: number;
  total_conversions_30d: number;
  conversion_rate_pct: number;
  total_revenue_lift_eur: number;
  top_pairs: UpsellPair[];
  rule_performance: RulePerformance[];
  last_rebuilt_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number) { return `${v.toFixed(1)} %`; }
function fmtEur(v: number) { return `${v.toFixed(2)} €`; }
function fmtDate(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function LiftBadge({ lift }: { lift: number }) {
  const color = lift >= 2 ? 'bg-green-100 text-green-700' : lift >= 1.2 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', color)}>
      <ArrowUpRight className="w-3 h-3" />
      Lift {lift.toFixed(2)}×
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Create Rule Modal ─────────────────────────────────────────────────────────

function CreateRuleModal({
  locationId,
  onCreated,
  onClose,
}: {
  locationId: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    trigger_item: '',
    suggested_item: '',
    headline: 'Kunden mögen auch…',
    badge: '',
    extra_fee_eur: '0',
    priority: '0',
    max_per_day: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.name || !form.trigger_item || !form.suggested_item) {
      setError('Name, Auslöser-Artikel und Vorschlags-Artikel sind Pflichtfelder.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/delivery/admin/smart-upsell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id:    locationId,
        action:         'create_rule',
        name:           form.name,
        trigger_item:   form.trigger_item,
        suggested_item: form.suggested_item,
        headline:       form.headline || undefined,
        badge:          form.badge || undefined,
        extra_fee_eur:  Number(form.extra_fee_eur),
        priority:       Number(form.priority),
        max_per_day:    form.max_per_day ? Number(form.max_per_day) : null,
      }),
    });
    setSaving(false);
    if (res.ok) { onCreated(); onClose(); }
    else { const j = await res.json(); setError(j.error ?? 'Fehler'); }
  }

  function field(key: keyof typeof form, label: string, placeholder = '') {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Neue Upsell-Regel
        </h3>
        {field('name', 'Regelname', 'z.B. Pizza → Cola')}
        {field('trigger_item', 'Auslöser-Artikel (im Warenkorb)', 'Pizza Margherita')}
        {field('suggested_item', 'Vorschlag-Artikel', 'Coca Cola')}
        {field('headline', 'Überschrift', 'Kunden mögen auch…')}
        {field('badge', 'Badge (optional)', 'Bestseller')}
        <div className="grid grid-cols-2 gap-3">
          {field('extra_fee_eur', 'Aufpreis (€)', '0')}
          {field('priority', 'Priorität', '0')}
        </div>
        {field('max_per_day', 'Max. pro Tag (leer = unbegrenzt)', '')}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Regel erstellen
          </button>
          <button
            onClick={onClose}
            className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────

function RulesTab({
  rules,
  locationId,
  onRefresh,
}: {
  rules: UpsellRule[];
  locationId: string;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggleActive(rule: UpsellRule) {
    startTransition(async () => {
      await fetch('/api/delivery/admin/smart-upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'update_rule', rule_id: rule.id, is_active: !rule.is_active }),
      });
      onRefresh();
    });
  }

  async function deleteR(ruleId: string) {
    if (!confirm('Regel wirklich löschen?')) return;
    await fetch('/api/delivery/admin/smart-upsell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, action: 'delete_rule', rule_id: ruleId }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{rules.length} Regel{rules.length !== 1 ? 'n' : ''} definiert</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> Neue Regel
        </button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 flex flex-col items-center gap-3 text-slate-400">
          <Zap className="w-8 h-8" />
          <p className="text-sm font-medium">Noch keine Regeln</p>
          <p className="text-xs">Erstelle Regeln oder nutze die Paar-Analyse als Basis</p>
        </div>
      )}

      {rules.map(rule => (
        <div key={rule.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition"
            onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
          >
            <div className={cn('w-2 h-2 rounded-full', rule.is_active ? 'bg-green-500' : 'bg-slate-300')} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-sm truncate">{rule.name}</span>
                {rule.badge && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">
                    {rule.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                <span className="font-medium text-slate-700">{rule.trigger_item}</span>
                {' → '}
                <span className="font-medium text-blue-600">{rule.suggested_item}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-400">
                {rule.total_impressions > 0
                  ? `${((rule.total_conversions / rule.total_impressions) * 100).toFixed(0)} % CR`
                  : 'kein Daten'}
              </span>
              {expandedId === rule.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {expandedId === rule.id && (
            <div className="border-t px-4 py-3 bg-slate-50 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-800">{rule.total_impressions}</p>
                  <p className="text-xs text-slate-500">Impressions</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">{rule.total_conversions}</p>
                  <p className="text-xs text-slate-500">Conversions</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">
                    {rule.total_impressions > 0
                      ? `${((rule.total_conversions / rule.total_impressions) * 100).toFixed(1)} %`
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-500">Conv.-Rate</p>
                </div>
              </div>
              {rule.headline && <p className="text-xs text-slate-500">Headline: <em>{rule.headline}</em></p>}
              {rule.max_per_day && (
                <p className="text-xs text-slate-500">
                  Max/Tag: {rule.max_per_day} — heute: {rule.impressions_today}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(rule)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition',
                    rule.is_active
                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      : 'bg-green-100 text-green-700 hover:bg-green-200',
                  )}
                >
                  {rule.is_active ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                  {rule.is_active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
                <button
                  onClick={() => deleteR(rule.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                >
                  <Trash2 className="w-3 h-3" /> Löschen
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showCreate && (
        <CreateRuleModal
          locationId={locationId}
          onCreated={onRefresh}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ── Pairs Tab ─────────────────────────────────────────────────────────────────

function PairsTab({ pairs, lastRebuilt }: { pairs: UpsellPair[]; lastRebuilt: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {pairs.length} Paar{pairs.length !== 1 ? 'e' : ''} analysiert
        {lastRebuilt ? ` · letzte Analyse: ${fmtDate(lastRebuilt)}` : ''}
      </p>
      {pairs.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 flex flex-col items-center gap-3 text-slate-400">
          <BarChart2 className="w-8 h-8" />
          <p className="text-sm font-medium">Noch keine Paare</p>
          <p className="text-xs text-center px-8">
            Klicke „Paare neu berechnen" — mindestens 90 Tage Bestellhistorie wird analysiert
          </p>
        </div>
      )}
      <div className="space-y-2">
        {pairs.map(pair => (
          <div key={pair.id} className="rounded-xl border bg-white shadow-sm px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 text-sm">{pair.item_a}</span>
                  <span className="text-slate-400">+</span>
                  <span className="font-semibold text-blue-700 text-sm">{pair.item_b}</span>
                  <LiftBadge lift={Number(pair.lift_score)} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {pair.pair_count}× zusammen bestellt
                  {' · '}Conf. A→B: {(Number(pair.confidence_ab) * 100).toFixed(0)} %
                  {' · '}Conf. B→A: {(Number(pair.confidence_ba) * 100).toFixed(0)} %
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({ performance }: { performance: RulePerformance[] }) {
  return (
    <div className="space-y-3">
      {performance.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 flex flex-col items-center gap-3 text-slate-400">
          <TrendingUp className="w-8 h-8" />
          <p className="text-sm font-medium">Noch keine Performance-Daten</p>
          <p className="text-xs">Daten entstehen, sobald Upsells im Storefront angezeigt werden</p>
        </div>
      )}
      <div className="overflow-x-auto">
        {performance.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b">
                <th className="text-left py-2 pr-4 font-semibold">Regel</th>
                <th className="text-right py-2 px-2 font-semibold">Impressions</th>
                <th className="text-right py-2 px-2 font-semibold">Conversions</th>
                <th className="text-right py-2 px-2 font-semibold">CR</th>
                <th className="text-right py-2 pl-2 font-semibold">Revenue-Lift</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(p => (
                <tr key={p.rule_id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-1.5 h-1.5 rounded-full', p.is_active ? 'bg-green-500' : 'bg-slate-300')} />
                      <div>
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[180px]">
                          {p.trigger_item} → {p.suggested_item}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-2 px-2 text-slate-600">{p.total_impressions}</td>
                  <td className="text-right py-2 px-2 text-blue-600 font-semibold">{p.total_conversions}</td>
                  <td className="text-right py-2 px-2">
                    <span className={cn(
                      'font-semibold',
                      Number(p.conversion_rate_pct) >= 20 ? 'text-green-600'
                        : Number(p.conversion_rate_pct) >= 8 ? 'text-blue-600'
                        : 'text-slate-500',
                    )}>
                      {p.conversion_rate_pct != null ? fmtPct(Number(p.conversion_rate_pct)) : '—'}
                    </span>
                  </td>
                  <td className="text-right py-2 pl-2 text-green-600 font-semibold">
                    {fmtEur(Number(p.total_revenue_lift_eur))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

type Tab = 'performance' | 'rules' | 'pairs';

export function SmartUpsellClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('performance');

  const load = useCallback(async () => {
    setLoading(true);
    const [dashRes, rulesRes] = await Promise.all([
      fetch(`/api/delivery/admin/smart-upsell?location_id=${locationId}`).then(r => r.json()).catch(() => null),
      fetch(`/api/delivery/admin/smart-upsell?location_id=${locationId}&action=rules`).then(r => r.json()).catch(() => null),
    ]);
    if (dashRes) setData(dashRes as Dashboard);
    if (rulesRes?.rules) setRules(rulesRes.rules as UpsellRule[]);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  async function rebuild() {
    setRebuilding(true);
    await fetch('/api/delivery/admin/smart-upsell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, action: 'rebuild' }),
    });
    setRebuilding(false);
    await load();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'performance', label: 'Performance', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'rules',       label: 'Regeln',      icon: <Edit2 className="w-4 h-4" /> },
    { id: 'pairs',       label: 'Paar-Analyse', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4 pb-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Erkannte Paare"
          value={loading ? '…' : String(data?.total_pairs ?? 0)}
          sub="aus 90-Tage-Analyse"
          color="text-slate-800"
        />
        <KpiCard
          label="Impressions (30 Tage)"
          value={loading ? '…' : String(data?.total_impressions_30d ?? 0)}
          sub={`${data?.active_rules ?? 0} aktive Regeln`}
          color="text-blue-600"
        />
        <KpiCard
          label="Conversions (30 Tage)"
          value={loading ? '…' : String(data?.total_conversions_30d ?? 0)}
          sub={data ? `${fmtPct(data.conversion_rate_pct)} Conv.-Rate` : ''}
          color="text-green-600"
        />
        <KpiCard
          label="Revenue-Lift (30 Tage)"
          value={loading ? '…' : fmtEur(data?.total_revenue_lift_eur ?? 0)}
          sub="durch angenommene Upsells"
          color="text-emerald-600"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition',
                activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={rebuild}
            disabled={rebuilding}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 transition"
          >
            {rebuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Paare neu berechnen
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'performance' && (
        <PerformanceTab performance={data?.rule_performance ?? []} />
      )}
      {activeTab === 'rules' && (
        <RulesTab rules={rules} locationId={locationId} onRefresh={load} />
      )}
      {activeTab === 'pairs' && (
        <PairsTab pairs={data?.top_pairs ?? []} lastRebuilt={data?.last_rebuilt_at ?? null} />
      )}

      {/* Info Box */}
      <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> So funktioniert der Smart Upsell Engine</p>
        <ul className="list-disc pl-5 space-y-0.5 text-xs">
          <li><strong>Market-Basket-Analyse:</strong> Bestellungen der letzten 90 Tage werden auf Artikel-Kombinationen analysiert (Association Rule Mining).</li>
          <li><strong>Lift-Score:</strong> Lift &gt; 1.5 = statistisch bedeutsame Kombination. Lift &gt; 2 = starke Empfehlung.</li>
          <li><strong>Regeln überschreiben Analytics:</strong> Manuelle Regeln haben Priorität vor automatischen Paaren.</li>
          <li><strong>Storefront:</strong> API <code className="bg-blue-100 px-1 rounded">POST /api/delivery/upsell</code> liefert bis zu 3 Vorschläge pro Warenkorb.</li>
          <li><strong>Cron:</strong> Paare werden täglich um 04:00 UTC neu berechnet.</li>
        </ul>
      </div>
    </div>
  );
}
