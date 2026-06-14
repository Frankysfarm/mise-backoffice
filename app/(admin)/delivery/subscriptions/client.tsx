'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Plus, ToggleLeft, ToggleRight, XCircle,
  Users, Euro, TrendingUp, Package, Clock, CheckCircle,
  Repeat, BadgePercent,
} from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  planType: 'weekly' | 'monthly' | 'annual';
  priceEur: number;
  freeDeliveriesPerPeriod: number | null;
  discountPct: number;
  minOrderValueEur: number | null;
  isActive: boolean;
  createdAt: string;
}

interface Subscription {
  id: string;
  planId: string;
  planName: string;
  planType: 'weekly' | 'monthly' | 'annual';
  priceEur: number;
  customerEmail: string;
  customerPhone: string | null;
  customerName: string | null;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  currentPeriodEnd: string;
  deliveriesUsedThisPeriod: number;
  totalDeliveriesAllTime: number;
  totalPaidEur: number;
  totalSavingsEur: number;
  createdAt: string;
}

interface Overview {
  activeCount: number;
  cancelledCount: number;
  pausedCount: number;
  expiredCount: number;
  mrrEur: number;
  totalRevenueEur: number;
  totalSavingsEur: number;
  totalDeliveries: number;
  planCount: number;
}

interface Dashboard {
  overview: Overview;
  plans: SubscriptionPlan[];
  recentSubscriptions: Subscription[];
  expiringSoon: Subscription[];
}

// ── Formatierung ──────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function planTypeLabel(t: string) {
  return t === 'weekly' ? 'Wöchentlich' : t === 'monthly' ? 'Monatlich' : 'Jährlich';
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Aktiv',       cls: 'bg-green-100 text-green-800' },
    paused:    { label: 'Pausiert',    cls: 'bg-amber-100 text-amber-800' },
    cancelled: { label: 'Gekündigt',   cls: 'bg-red-100 text-red-800' },
    expired:   { label: 'Abgelaufen', cls: 'bg-gray-100 text-gray-600' },
  };
  const { label, cls } = map[s] ?? { label: s, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ── KPI-Karte ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = 'text-indigo-600' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Neuer Plan — Modal ────────────────────────────────────────────────────────

function CreatePlanModal({
  locationId, onClose, onCreated,
}: { locationId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
  const [priceEur, setPriceEur] = useState('4.99');
  const [freeDeliveries, setFreeDeliveries] = useState('');
  const [discountPct, setDiscountPct] = useState('0');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name ist Pflicht'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/delivery/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_plan',
          location_id: locationId,
          name: name.trim(),
          description: description.trim() || null,
          planType,
          priceEur: parseFloat(priceEur),
          freeDeliveriesPerPeriod: freeDeliveries ? parseInt(freeDeliveries, 10) : null,
          discountPct: parseInt(discountPct, 10),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Fehler');
      } else {
        onCreated();
        onClose();
      }
    } catch { setError('Netzwerkfehler'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Neuer Abo-Plan</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Planname *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Flatrate Basic"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Beschreibung</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="z. B. Unbegrenzt kostenlose Lieferungen"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Laufzeit</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={planType} onChange={(e) => setPlanType(e.target.value as 'weekly' | 'monthly' | 'annual')}
              >
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
                <option value="annual">Jährlich</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Preis (€)</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={priceEur} onChange={(e) => setPriceEur(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Gratis-Lieferungen / Periode</label>
              <input
                type="number" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={freeDeliveries} onChange={(e) => setFreeDeliveries(e.target.value)}
                placeholder="leer = unbegrenzt"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Rabatt % (alternativ)</label>
              <input
                type="number" min="0" max="100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={discountPct} onChange={(e) => setDiscountPct(e.target.value)}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Speichere…' : 'Plan erstellen'}
        </button>
      </form>
    </div>
  );
}

// ── Neues Abo — Modal ─────────────────────────────────────────────────────────

function CreateSubscriptionModal({
  locationId, plans, onClose, onCreated,
}: { locationId: string; plans: SubscriptionPlan[]; onClose: () => void; onCreated: () => void }) {
  const activePlans = plans.filter((p) => p.isActive);
  const [planId, setPlanId] = useState(activePlans[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('E-Mail ist Pflicht'); return; }
    if (!planId) { setError('Plan auswählen'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/delivery/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_subscription',
          location_id: locationId,
          planId,
          customerEmail: email.trim(),
          customerName: name.trim() || null,
          customerPhone: phone.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Fehler');
      } else {
        onCreated();
        onClose();
      }
    } catch { setError('Netzwerkfehler'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Neues Abonnement</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Abo-Plan *</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={planId} onChange={(e) => setPlanId(e.target.value)}
            >
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {fmtEur(p.priceEur)} / {planTypeLabel(p.planType)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Kunden-E-Mail *</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kunde@beispiel.de"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Telefon</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 171…"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || activePlans.length === 0}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Speichere…' : activePlans.length === 0 ? 'Kein aktiver Plan vorhanden' : 'Abonnement anlegen'}
        </button>
      </form>
    </div>
  );
}

// ── Haupt-Client ──────────────────────────────────────────────────────────────

export function SubscriptionsClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'plans' | 'subscribers' | 'expiring'>('plans');
  const [statusFilter, setStatusFilter] = useState<'active' | 'cancelled' | 'paused' | 'expired' | 'all'>('all');
  const [allSubs, setAllSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [renewingAll, setRenewingAll] = useState(false);
  const [togglingPlan, setTogglingPlan] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/subscriptions?location_id=${locationId}&action=dashboard`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  async function loadAllSubs() {
    setSubsLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/subscriptions?location_id=${locationId}&action=list&status=${statusFilter}&limit=100`
      );
      if (res.ok) {
        const d = await res.json();
        setAllSubs(d.subscriptions ?? []);
      }
    } finally {
      setSubsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'subscribers') loadAllSubs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter, locationId]);

  async function togglePlan(planId: string) {
    setTogglingPlan(planId);
    try {
      await fetch('/api/delivery/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_plan', location_id: locationId, planId }),
      });
      await load();
    } finally {
      setTogglingPlan(null); }
  }

  async function cancelSub(subId: string) {
    if (!confirm('Abonnement wirklich kündigen?')) return;
    setCancellingId(subId);
    try {
      await fetch('/api/delivery/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_subscription', location_id: locationId, subscriptionId: subId }),
      });
      await Promise.all([load(), loadAllSubs()]);
    } finally { setCancellingId(null); }
  }

  async function renewAll() {
    setRenewingAll(true);
    try {
      await fetch('/api/delivery/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew_all', location_id: locationId }),
      });
      await load();
    } finally { setRenewingAll(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={18} />
        Lade Abonnements…
      </div>
    );
  }

  const ov = data?.overview;
  const plans = data?.plans ?? [];

  return (
    <div className="space-y-6 p-4">
      {/* Modals */}
      {showCreatePlan && (
        <CreatePlanModal
          locationId={locationId}
          onClose={() => setShowCreatePlan(false)}
          onCreated={load}
        />
      )}
      {showCreateSub && (
        <CreateSubscriptionModal
          locationId={locationId}
          plans={plans}
          onClose={() => setShowCreateSub(false)}
          onCreated={load}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreatePlan(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={14} /> Neuer Plan
          </button>
          <button
            onClick={() => setShowCreateSub(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 text-sm font-medium hover:bg-indigo-50"
          >
            <Users size={14} /> Abonnement anlegen
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={renewAll}
            disabled={renewingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Repeat size={14} className={renewingAll ? 'animate-spin' : ''} />
            {renewingAll ? 'Verlängere…' : 'Abos verlängern'}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
          >
            <RefreshCw size={14} /> Neu laden
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users size={16} />}
          label="Aktive Abos"
          value={String(ov?.activeCount ?? 0)}
          sub={`${ov?.pausedCount ?? 0} pausiert · ${ov?.cancelledCount ?? 0} gekündigt`}
          color="text-green-600"
        />
        <KpiCard
          icon={<Euro size={16} />}
          label="MRR"
          value={fmtEur(ov?.mrrEur ?? 0)}
          sub={`Gesamt ${fmtEur(ov?.totalRevenueEur ?? 0)}`}
          color="text-indigo-600"
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Kunden-Ersparnisse"
          value={fmtEur(ov?.totalSavingsEur ?? 0)}
          sub={`Gesamt ${ov?.totalDeliveries ?? 0} Lieferungen`}
          color="text-amber-600"
        />
        <KpiCard
          icon={<Package size={16} />}
          label="Pläne"
          value={String(ov?.planCount ?? 0)}
          sub={`${plans.filter((p) => p.isActive).length} aktiv`}
          color="text-purple-600"
        />
      </div>

      {/* Bald-ablaufend Banner */}
      {(data?.expiringSoon?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <Clock size={14} /> {data!.expiringSoon.length} Abonnement{data!.expiringSoon.length > 1 ? 's' : ''} läuft in 3 Tagen ab
          </p>
          <div className="flex flex-wrap gap-2">
            {data!.expiringSoon.slice(0, 5).map((s) => (
              <span key={s.id} className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                {s.customerEmail} — {fmtDate(s.currentPeriodEnd)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['plans', 'subscribers', 'expiring'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'plans' ? `Pläne (${plans.length})` : t === 'subscribers' ? 'Abonnenten' : `Bald ablaufend (${data?.expiringSoon?.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* Tab: Pläne */}
      {tab === 'plans' && (
        <div className="space-y-3">
          {plans.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <BadgePercent size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Noch keine Pläne — ersten Plan erstellen</p>
            </div>
          )}
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border p-4 flex items-start justify-between gap-4 ${
                plan.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{plan.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {plan.isActive ? 'Aktiv' : 'Inaktiv'}
                  </span>
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                    {planTypeLabel(plan.planType)}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-xs text-gray-500">{plan.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  <span className="font-medium text-gray-900">{fmtEur(plan.priceEur)} / {planTypeLabel(plan.planType)}</span>
                  {plan.freeDeliveriesPerPeriod != null && (
                    <span>{plan.freeDeliveriesPerPeriod}× Gratis-Lieferung / Periode</span>
                  )}
                  {plan.discountPct > 0 && <span>{plan.discountPct}% Rabatt auf Liefergebühr</span>}
                  {plan.minOrderValueEur != null && (
                    <span>ab {fmtEur(plan.minOrderValueEur)} Bestellwert</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => togglePlan(plan.id)}
                disabled={togglingPlan === plan.id}
                className="text-gray-400 hover:text-indigo-600 transition-colors shrink-0"
                title={plan.isActive ? 'Deaktivieren' : 'Aktivieren'}
              >
                {togglingPlan === plan.id
                  ? <RefreshCw size={18} className="animate-spin" />
                  : plan.isActive
                    ? <ToggleRight size={22} className="text-green-500" />
                    : <ToggleLeft size={22} />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Abonnenten */}
      {tab === 'subscribers' && (
        <div className="space-y-3">
          {/* Status-Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'active', 'paused', 'cancelled', 'expired'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'Alle' : s === 'active' ? 'Aktiv' : s === 'paused' ? 'Pausiert' : s === 'cancelled' ? 'Gekündigt' : 'Abgelaufen'}
              </button>
            ))}
          </div>

          {subsLoading ? (
            <div className="flex items-center justify-center h-24 text-gray-400">
              <RefreshCw className="animate-spin mr-2" size={16} /> Lade…
            </div>
          ) : allSubs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Keine Abonnements gefunden</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Kunde</th>
                    <th className="text-left px-4 py-2">Plan</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-4 py-2">Genutzt</th>
                    <th className="text-right px-4 py-2">Gespart</th>
                    <th className="text-right px-4 py-2">Periode bis</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{sub.customerName ?? sub.customerEmail}</p>
                        <p className="text-xs text-gray-400">{sub.customerEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{sub.planName}</p>
                        <p className="text-xs text-gray-400">{fmtEur(sub.priceEur)} / {planTypeLabel(sub.planType)}</p>
                      </td>
                      <td className="px-4 py-3">{statusBadge(sub.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-gray-700">{sub.deliveriesUsedThisPeriod}</span>
                        <span className="text-xs text-gray-400"> / Periode</span>
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {fmtEur(sub.totalSavingsEur)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {fmtDate(sub.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sub.status === 'active' && (
                          <button
                            onClick={() => cancelSub(sub.id)}
                            disabled={cancellingId === sub.id}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Kündigen"
                          >
                            {cancellingId === sub.id
                              ? <RefreshCw size={14} className="animate-spin" />
                              : <XCircle size={16} />
                            }
                          </button>
                        )}
                        {sub.status !== 'active' && (
                          <CheckCircle size={16} className="text-gray-200 ml-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Bald ablaufend */}
      {tab === 'expiring' && (
        <div className="space-y-3">
          {(data?.expiringSoon?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Keine ablaufenden Abos in den nächsten 3 Tagen</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Kunde</th>
                    <th className="text-left px-4 py-2">Plan</th>
                    <th className="text-right px-4 py-2">Läuft ab</th>
                    <th className="text-right px-4 py-2">Lieferungen</th>
                    <th className="text-right px-4 py-2">Gespart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.expiringSoon ?? []).map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{sub.customerName ?? sub.customerEmail}</p>
                        <p className="text-xs text-gray-400">{sub.customerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{sub.planName}</td>
                      <td className="px-4 py-3 text-right text-amber-600 font-medium">
                        {fmtDate(sub.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {sub.totalDeliveriesAllTime}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {fmtEur(sub.totalSavingsEur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Kürzliche Abos */}
      {tab === 'plans' && (data?.recentSubscriptions?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Zuletzt hinzugefügte Abonnenten</h3>
          <div className="space-y-2">
            {(data?.recentSubscriptions ?? []).slice(0, 5).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {sub.customerName ?? sub.customerEmail}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{sub.planName}</span>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(sub.status)}
                  <span className="text-xs text-gray-400">{fmtDate(sub.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
