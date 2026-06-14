'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, TrendingUp, Users, Star, Play, Pause, CheckCircle,
  Trash2, Plus, RefreshCw, ChevronDown, ChevronUp, BarChart2, X,
  Zap, ShoppingCart, DollarSign, Award,
} from 'lucide-react';
import type { AbTest, AbMetrics } from '@/lib/delivery/loyalty-ab';

interface Props { locationId: string }

const STATUS_CONFIG = {
  draft:     { label: 'Entwurf',    color: 'bg-gray-100 text-gray-700' },
  active:    { label: 'Aktiv',      color: 'bg-emerald-100 text-emerald-700' },
  paused:    { label: 'Pausiert',   color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Abgeschlossen', color: 'bg-blue-100 text-blue-700' },
} as const;

function fmtPct(v: number) { return `${v.toFixed(1)} %`; }
function fmtEur(v: number) { return `€ ${v.toFixed(2)}`; }
function fmtX(v: number)   { return `${v.toFixed(1)}×`; }

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${accent}`}>
        {icon}{label}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: AbTest['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {cfg.label}
    </span>
  );
}

function VariantMetricRow({ m }: { m: AbMetrics }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-sm text-gray-900">{m.variantName}</span>
          <span className="text-xs text-gray-500 bg-white border rounded-full px-2 py-0.5">
            {fmtX(m.pointsMultiplier)} Punkte · {m.allocationPct}% Traffic
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="text-center bg-white rounded p-2 border">
          <p className="font-bold text-gray-900">{m.assignedCustomers}</p>
          <p className="text-gray-500">Kunden</p>
        </div>
        <div className="text-center bg-white rounded p-2 border">
          <p className="font-bold text-gray-900">{fmtPct(m.orderConversionPct)}</p>
          <p className="text-gray-500">Bestellrate</p>
        </div>
        <div className="text-center bg-white rounded p-2 border">
          <p className="font-bold text-gray-900">{fmtEur(m.avgOrderValue)}</p>
          <p className="text-gray-500">Ø Bestellwert</p>
        </div>
        <div className="text-center bg-white rounded p-2 border">
          <p className="font-bold text-gray-900">{fmtEur(m.totalRevenue)}</p>
          <p className="text-gray-500">Gesamt-Umsatz</p>
        </div>
      </div>
    </div>
  );
}

interface TestCardProps {
  test: AbTest;
  locationId: string;
  onRefresh: () => void;
}

function TestCard({ test, locationId, onRefresh }: TestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [metrics,  setMetrics]  = useState<AbMetrics[] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [busy,     setBusy]     = useState(false);

  const loadMetrics = useCallback(async () => {
    if (!expanded) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/delivery/admin/loyalty-ab?location_id=${locationId}&test_id=${test.id}`,
      );
      if (r.ok) {
        const d = await r.json() as { metrics: AbMetrics[] };
        setMetrics(d.metrics);
      }
    } finally {
      setLoading(false);
    }
  }, [expanded, locationId, test.id]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const changeStatus = async (status: 'active' | 'paused' | 'completed') => {
    setBusy(true);
    try {
      await fetch('/api/delivery/admin/loyalty-ab', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id:     test.id,
          status,
          location_id: locationId,
        }),
      });
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteTest = async () => {
    if (!confirm(`Test "${test.name}" wirklich löschen?`)) return;
    setBusy(true);
    try {
      await fetch(
        `/api/delivery/admin/loyalty-ab?test_id=${test.id}&location_id=${locationId}`,
        { method: 'DELETE' },
      );
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{test.name}</h3>
            <StatusBadge status={test.status} />
          </div>
          {test.description && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{test.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{test.variants.length} Varianten</span>
            {test.startAt && (
              <span>Start: {new Date(test.startAt).toLocaleDateString('de-DE')}</span>
            )}
            {test.endAt && (
              <span>Ende: {new Date(test.endAt).toLocaleDateString('de-DE')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {test.status === 'draft' && (
            <button
              onClick={() => changeStatus('active')}
              disabled={busy}
              title="Test aktivieren"
              className="flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> Aktivieren
            </button>
          )}
          {test.status === 'active' && (
            <>
              <button
                onClick={() => changeStatus('paused')}
                disabled={busy}
                title="Test pausieren"
                className="flex items-center gap-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Pause className="h-3.5 w-3.5" /> Pausieren
              </button>
              <button
                onClick={() => changeStatus('completed')}
                disabled={busy}
                title="Test abschließen"
                className="flex items-center gap-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" /> Abschließen
              </button>
            </>
          )}
          {test.status === 'paused' && (
            <button
              onClick={() => changeStatus('active')}
              disabled={busy}
              title="Test fortsetzen"
              className="flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> Fortsetzen
            </button>
          )}
          {(test.status === 'draft' || test.status === 'completed') && (
            <button
              onClick={deleteTest}
              disabled={busy}
              title="Test löschen"
              className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Variants summary bar */}
      <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
        {test.variants.map((v) => (
          <span key={v.id} className="text-xs rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5">
            {v.name} · {fmtX(v.pointsMultiplier)} · {v.allocationPct}%
          </span>
        ))}
      </div>

      {/* Expanded metrics */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-gray-50 pt-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Varianten-Metriken</span>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Lade Metriken…</p>
          ) : metrics && metrics.length > 0 ? (
            metrics.map((m) => <VariantMetricRow key={m.variantId} m={m} />)
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Noch keine Metriken — Test muss aktiv sein und Kunden zugewiesen haben.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Test Form ──────────────────────────────────────────────────────────

interface Variant {
  name: string;
  description: string;
  pointsMultiplier: number;
  allocationPct: number;
}

const DEFAULT_VARIANTS: Variant[] = [
  { name: 'Kontrolle', description: 'Standard-Punkte', pointsMultiplier: 1.0, allocationPct: 50 },
  { name: 'Variante B', description: 'Doppelte Punkte', pointsMultiplier: 2.0, allocationPct: 50 },
];

function CreateTestForm({ locationId, onCreated, onCancel }: {
  locationId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName]           = useState('');
  const [desc, setDesc]           = useState('');
  const [variants, setVariants]   = useState<Variant[]>(DEFAULT_VARIANTS);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const totalPct = variants.reduce((s, v) => s + (v.allocationPct || 0), 0);

  const addVariant = () => {
    setVariants((vs) => [
      ...vs,
      { name: `Variante ${String.fromCharCode(65 + vs.length)}`, description: '', pointsMultiplier: 1.5, allocationPct: 0 },
    ]);
  };

  const removeVariant = (idx: number) => {
    setVariants((vs) => vs.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, field: keyof Variant, value: string | number) => {
    setVariants((vs) => vs.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError('Testname ist erforderlich'); return; }
    if (variants.length < 2) { setError('Mindestens 2 Varianten erforderlich'); return; }
    if (totalPct !== 100) { setError(`Traffic-Summe muss 100% sein (aktuell: ${totalPct}%)`); return; }
    if (variants.some((v) => !v.name.trim())) { setError('Alle Varianten brauchen einen Namen'); return; }

    setBusy(true);
    try {
      const r = await fetch('/api/delivery/admin/loyalty-ab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || undefined,
          location_id: locationId,
          variants: variants.map((v) => ({
            name: v.name.trim(),
            description: v.description.trim() || undefined,
            pointsMultiplier: Number(v.pointsMultiplier),
            allocationPct: Number(v.allocationPct),
          })),
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? 'Fehler beim Erstellen');
        return;
      }
      onCreated();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-500" />
          Neuen A/B-Test erstellen
        </h3>
        <button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-700 block mb-1">Testname *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Doppelpunkte für Stammkunden"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-700 block mb-1">Beschreibung</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Optionale Beschreibung des Testzwecks"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">
            Varianten ({variants.length}) — Summe: {' '}
            <span className={totalPct === 100 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
              {totalPct}%
            </span>
          </label>
          <button
            type="button"
            onClick={addVariant}
            className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Variante hinzufügen
          </button>
        </div>

        <div className="space-y-2">
          {variants.map((v, idx) => (
            <div key={idx} className="rounded-lg border bg-gray-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-violet-600 w-5">{String.fromCharCode(65 + idx)}</span>
                <input
                  value={v.name}
                  onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                  placeholder="Varianten-Name"
                  className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                {variants.length > 2 && (
                  <button onClick={() => removeVariant(idx)} className="text-gray-400 hover:text-red-500 p-0.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Punkte-Multiplikator</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={v.pointsMultiplier}
                    onChange={(e) => updateVariant(idx, 'pointsMultiplier', parseFloat(e.target.value) || 1)}
                    className="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Traffic-Anteil (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="99"
                    value={v.allocationPct}
                    onChange={(e) => updateVariant(idx, 'allocationPct', parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={submit}
          disabled={busy || totalPct !== 100}
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          Test erstellen
        </button>
      </div>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function LoyaltyAbClient({ locationId }: Props) {
  const [tests,       setTests]       = useState<AbTest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/loyalty-ab?location_id=${locationId}`);
      if (r.ok) {
        const d = await r.json() as { tests: AbTest[] };
        setTests(d.tests ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const activeTests     = tests.filter((t) => t.status === 'active');
  const draftTests      = tests.filter((t) => t.status === 'draft');
  const completedTests  = tests.filter((t) => t.status === 'completed');
  const totalVariants   = tests.reduce((s, t) => s + t.variants.length, 0);

  const filtered = statusFilter === 'all'
    ? tests
    : tests.filter((t) => t.status === statusFilter);

  const handleCreated = () => {
    setShowCreate(false);
    load();
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={<FlaskConical className="h-3 w-3" />}
          label="Alle Tests"
          value={tests.length}
          sub={`${draftTests.length} Entwurf`}
          accent="bg-violet-100 text-violet-700"
        />
        <KpiCard
          icon={<Play className="h-3 w-3" />}
          label="Aktiv"
          value={activeTests.length}
          sub={activeTests.length > 0 ? activeTests[0].name.slice(0, 20) : 'Kein aktiver Test'}
          accent="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          icon={<TrendingUp className="h-3 w-3" />}
          label="Varianten gesamt"
          value={totalVariants}
          sub={`Ø ${tests.length > 0 ? (totalVariants / tests.length).toFixed(1) : 0} pro Test`}
          accent="bg-blue-100 text-blue-700"
        />
        <KpiCard
          icon={<CheckCircle className="h-3 w-3" />}
          label="Abgeschlossen"
          value={completedTests.length}
          sub="mit Ergebnissen"
          accent="bg-gray-100 text-gray-700"
        />
      </div>

      {/* Hint when active test exists */}
      {activeTests.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <Award className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-800">
              Test „{activeTests[0].name}" läuft gerade
            </p>
            <p className="text-emerald-700 mt-0.5">
              Kunden werden deterministisch einer Variante zugewiesen. Öffne den Test um Live-Metriken zu sehen.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-1">
          {(['all', 'draft', 'active', 'paused', 'completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'all' ? 'Alle' : STATUS_CONFIG[s].label}
              {s === 'all' ? ` (${tests.length})` : ` (${tests.filter((t) => t.status === s).length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Neuer Test
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreateTestForm
          locationId={locationId}
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Tests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Lade Tests…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 p-10 text-center">
          <FlaskConical className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {statusFilter === 'all' ? 'Noch keine A/B-Tests' : `Keine ${STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label ?? statusFilter}-Tests`}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Erstelle deinen ersten Test um zu messen, welcher Punktemultiplikator Bestellungen am meisten ankurbelt.
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Ersten Test erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              locationId={locationId}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-xl border bg-violet-50 border-violet-200 p-4 text-sm text-violet-800 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <Users className="h-4 w-4" /> So funktionieren A/B-Tests
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-violet-700 ml-1">
          <li>Kunden werden deterministisch (per Hash) einer Variante zugeteilt — keine Zufallsschwankungen</li>
          <li>Jede Variante hat einen eigenen Punktemultiplikator (z. B. 1×, 2×, 3×)</li>
          <li>Traffic-Anteil bestimmt wie viele Kunden die Variante sehen (Summe muss 100% ergeben)</li>
          <li>Nur ein Test kann gleichzeitig aktiv sein — aktiviere zuerst einen anderen Test, bevor du diesen startest</li>
          <li>Abgeschlossene Tests können nicht mehr reaktiviert, aber analysiert werden</li>
        </ul>
      </div>
    </div>
  );
}
