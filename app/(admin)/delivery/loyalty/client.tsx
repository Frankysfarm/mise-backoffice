'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Star, Gift, TrendingUp, Users, Coins, RefreshCw, Plus, Minus,
  FlaskConical, PlayCircle, PauseCircle, CheckCircle2, Trash2,
  ChevronDown, ChevronUp, BarChart3, Zap, Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface LoyaltyKpis {
  totalAccounts: number;
  activeAccounts: number;
  totalPointsOutstanding: number;
  totalLifetimeEarned: number;
  tierBreakdown: { bronze: number; silver: number; gold: number; platinum: number };
  avgPointsPerAccount: number;
  redemptionRate: number;
}

interface LeaderboardEntry {
  rank: number;
  accountId: string;
  customerEmail: string;
  customerName: string | null;
  totalPoints: number;
  lifetimePoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lastActivityAt: string;
}

interface AbVariant {
  id: string;
  testId: string;
  name: string;
  description: string | null;
  pointsMultiplier: number;
  allocationPct: number;
}

interface AbTest {
  id: string;
  locationId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  variants: AbVariant[];
}

interface AbMetrics {
  variantId: string;
  variantName: string;
  pointsMultiplier: number;
  allocationPct: number;
  assignedCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  totalPointsEarned: number;
  orderConversionPct: number;
  avgOrderValue: number;
}

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_META: Record<LoyaltyTier, { label: string; color: string; bg: string; icon: string }> = {
  bronze:   { label: 'Bronze',   color: 'text-amber-700',  bg: 'bg-amber-100',  icon: '🥉' },
  silver:   { label: 'Silber',   color: 'text-slate-500',  bg: 'bg-slate-100',  icon: '🥈' },
  gold:     { label: 'Gold',     color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '🥇' },
  platinum: { label: 'Platin',   color: 'text-purple-600', bg: 'bg-purple-100', icon: '💎' },
};

const STATUS_META: Record<AbTest['status'], { label: string; color: string; bg: string }> = {
  draft:     { label: 'Entwurf',    color: 'text-slate-600',   bg: 'bg-slate-100' },
  active:    { label: 'Aktiv',      color: 'text-emerald-700', bg: 'bg-emerald-100' },
  paused:    { label: 'Pausiert',   color: 'text-amber-700',   bg: 'bg-amber-100' },
  completed: { label: 'Abgeschlossen', color: 'text-blue-700', bg: 'bg-blue-100' },
};

function TierBadge({ tier }: { tier: LoyaltyTier }) {
  const m = TIER_META[tier];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', m.bg, m.color)}>
      {m.icon} {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: AbTest['status'] }) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', m.bg, m.color)}>
      {m.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-foreground' }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ── A/B Tests Panel ────────────────────────────────────────────────────────────

function AbTestsPanel({ locationId }: { locationId: string }) {
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [metricsMap, setMetricsMap] = useState<Record<string, AbMetrics[]>>({});
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [variants, setVariants] = useState([
    { name: 'Kontrolle',  description: 'Normale Punkte',  pointsMultiplier: 1.0, allocationPct: 50 },
    { name: 'Variante A', description: '+50 % Bonuspunkte', pointsMultiplier: 1.5, allocationPct: 50 },
  ]);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [syncingTestId, setSyncingTestId] = useState<string | null>(null);
  const [syncTargets, setSyncTargets] = useState('');
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/loyalty-ab?location_id=${locationId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { tests: AbTest[] };
      setTests(data.tests);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void loadTests(); }, [loadTests]);

  async function loadMetrics(testId: string) {
    if (metricsMap[testId]) return;
    try {
      const res = await fetch(`/api/delivery/admin/loyalty-ab?location_id=${locationId}&test_id=${testId}`);
      if (!res.ok) return;
      const data = await res.json() as { metrics: AbMetrics[] };
      setMetricsMap(prev => ({ ...prev, [testId]: data.metrics }));
    } catch { /* ignore */ }
  }

  function toggleExpand(testId: string) {
    if (expandedId === testId) {
      setExpandedId(null);
    } else {
      setExpandedId(testId);
      void loadMetrics(testId);
    }
  }

  async function changeStatus(testId: string, newStatus: 'active' | 'paused' | 'completed') {
    try {
      const res = await fetch('/api/delivery/admin/loyalty-ab', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: testId, status: newStatus, location_id: locationId }),
      });
      if (!res.ok) throw new Error(await res.text());
      void loadTests();
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    }
  }

  async function deleteTest(testId: string) {
    if (!confirm('Entwurf wirklich löschen?')) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/loyalty-ab?test_id=${testId}&location_id=${locationId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await res.text());
      void loadTests();
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    }
  }

  async function syncTest(testId: string) {
    const ids = syncTargets.split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) { setSyncResult('Keine Ziel-Location-IDs eingegeben'); return; }
    try {
      const res = await fetch('/api/delivery/admin/loyalty-ab/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_location_id: locationId, test_id: testId, target_location_ids: ids }),
      });
      const data = await res.json() as { created?: string[]; skipped?: string[]; errors?: Array<{ locationId: string; error: string }> };
      const parts: string[] = [];
      if (data.created?.length) parts.push(`✓ Erstellt in: ${data.created.join(', ')}`);
      if (data.skipped?.length) parts.push(`↷ Übersprungen: ${data.skipped.join(', ')}`);
      if (data.errors?.length) parts.push(`✗ Fehler: ${data.errors.map((e) => `${e.locationId}: ${e.error}`).join('; ')}`);
      setSyncResult(parts.join(' | ') || 'Fertig');
      setSyncTargets('');
    } catch (err) {
      setSyncResult(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    }
  }

  async function submitCreate() {
    setCreateMsg(null);
    const totalPct = variants.reduce((s, v) => s + v.allocationPct, 0);
    if (!newName.trim()) { setCreateMsg('Name erforderlich'); return; }
    if (totalPct !== 100) { setCreateMsg(`Summe der Anteile muss 100 sein (aktuell: ${totalPct})`); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/delivery/admin/loyalty-ab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          variants,
        }),
      });
      const data = await res.json() as { test?: AbTest; error?: string };
      if (!res.ok) { setCreateMsg(`Fehler: ${data.error ?? 'Unbekannt'}`); return; }
      setNewName('');
      setNewDesc('');
      setVariants([
        { name: 'Kontrolle',  description: 'Normale Punkte',     pointsMultiplier: 1.0, allocationPct: 50 },
        { name: 'Variante A', description: '+50 % Bonuspunkte', pointsMultiplier: 1.5, allocationPct: 50 },
      ]);
      setShowCreate(false);
      void loadTests();
    } catch (err) {
      setCreateMsg(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setCreating(false);
    }
  }

  function updateVariant(idx: number, field: keyof typeof variants[0], value: string | number) {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  }

  function addVariant() {
    if (variants.length >= 4) return;
    setVariants(prev => [...prev, { name: `Variante ${String.fromCharCode(64 + prev.length)}`, description: '', pointsMultiplier: 1.0, allocationPct: 0 }]);
  }

  function removeVariant(idx: number) {
    if (variants.length <= 2) return;
    setVariants(prev => prev.filter((_, i) => i !== idx));
  }

  const pctSum = variants.reduce((s, v) => s + v.allocationPct, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Teste verschiedene Punkte-Multiplikatoren auf Ihren Kunden. Nur ein Test gleichzeitig aktiv.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => void loadTests()}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Neuer Test
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-purple-500" />
            Neuen A/B-Test erstellen
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Test-Name (z.B. Doppelpunkte-Wochenende)"
              className="rounded-md border bg-background px-3 py-2 text-sm col-span-2 md:col-span-1"
            />
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Beschreibung (optional)"
              className="rounded-md border bg-background px-3 py-2 text-sm col-span-2 md:col-span-1"
            />
          </div>

          {/* Varianten */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Varianten
              </span>
              <span className={cn('text-xs', pctSum === 100 ? 'text-emerald-600' : 'text-rose-600')}>
                Summe: {pctSum} % {pctSum !== 100 && '(muss 100 sein)'}
              </span>
            </div>
            {variants.map((v, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={v.name}
                  onChange={e => updateVariant(idx, 'name', e.target.value)}
                  placeholder="Name"
                  className="col-span-3 rounded-md border bg-background px-2 py-1.5 text-sm"
                />
                <input
                  value={v.description}
                  onChange={e => updateVariant(idx, 'description', e.target.value)}
                  placeholder="Beschreibung"
                  className="col-span-4 rounded-md border bg-background px-2 py-1.5 text-sm"
                />
                <div className="col-span-2 flex items-center gap-1">
                  <input
                    type="number"
                    value={v.pointsMultiplier}
                    onChange={e => updateVariant(idx, 'pointsMultiplier', parseFloat(e.target.value) || 1)}
                    step={0.1}
                    min={0.1}
                    max={10}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">×</span>
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <input
                    type="number"
                    value={v.allocationPct}
                    onChange={e => updateVariant(idx, 'allocationPct', parseInt(e.target.value, 10) || 0)}
                    min={1}
                    max={99}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">%</span>
                </div>
                <div className="col-span-1 flex justify-center">
                  {variants.length > 2 && (
                    <button
                      onClick={() => removeVariant(idx)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {variants.length < 4 && (
              <button
                onClick={addVariant}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Variante hinzufügen
              </button>
            )}
          </div>

          {createMsg && (
            <p className={cn('text-sm', createMsg.startsWith('Fehler') ? 'text-rose-600' : 'text-emerald-600')}>
              {createMsg}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => void submitCreate()}
              disabled={creating || pctSum !== 100}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Erstelle…' : 'Als Entwurf speichern'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setCreateMsg(null); }}
              className="rounded-md border px-4 py-1.5 text-sm hover:bg-accent"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Tests-Liste */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Lade Tests…</div>
      ) : tests.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm text-muted-foreground">
            Noch keine A/B-Tests. Erstelle deinen ersten Test um verschiedene Punkte-Multiplikatoren zu vergleichen.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map(test => {
            const isExpanded = expandedId === test.id;
            const metrics    = metricsMap[test.id] ?? [];

            return (
              <div key={test.id} className="rounded-lg border bg-card overflow-hidden">
                {/* Test-Header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <FlaskConical className="h-4 w-4 text-purple-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{test.name}</span>
                      <StatusBadge status={test.status} />
                    </div>
                    {test.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{test.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {test.variants.length} Varianten
                      {test.startAt && ` · gestartet ${new Date(test.startAt).toLocaleDateString('de-DE')}`}
                    </div>
                  </div>

                  {/* Aktions-Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {test.status === 'draft' && (
                      <>
                        <button
                          onClick={() => void changeStatus(test.id, 'active')}
                          title="Aktivieren"
                          className="rounded-md bg-emerald-100 p-1.5 text-emerald-700 hover:bg-emerald-200"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void deleteTest(test.id)}
                          title="Löschen"
                          className="rounded-md bg-rose-100 p-1.5 text-rose-700 hover:bg-rose-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {test.status === 'active' && (
                      <>
                        <button
                          onClick={() => void changeStatus(test.id, 'paused')}
                          title="Pausieren"
                          className="rounded-md bg-amber-100 p-1.5 text-amber-700 hover:bg-amber-200"
                        >
                          <PauseCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void changeStatus(test.id, 'completed')}
                          title="Abschließen"
                          className="rounded-md bg-blue-100 p-1.5 text-blue-700 hover:bg-blue-200"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {test.status === 'paused' && (
                      <>
                        <button
                          onClick={() => void changeStatus(test.id, 'active')}
                          title="Fortsetzen"
                          className="rounded-md bg-emerald-100 p-1.5 text-emerald-700 hover:bg-emerald-200"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void changeStatus(test.id, 'completed')}
                          title="Abschließen"
                          className="rounded-md bg-blue-100 p-1.5 text-blue-700 hover:bg-blue-200"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setSyncingTestId(syncingTestId === test.id ? null : test.id);
                        setSyncResult(null);
                      }}
                      title="Zu anderen Standorten synchronisieren"
                      className="rounded-md bg-violet-100 p-1.5 text-violet-700 hover:bg-violet-200"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleExpand(test.id)}
                      className="rounded-md border p-1.5 hover:bg-accent"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Sync-Panel */}
                {syncingTestId === test.id && (
                  <div className="border-t bg-violet-50 px-4 py-3">
                    <p className="mb-2 text-xs font-medium text-violet-700">
                      Test zu anderen Standorten kopieren (Entwurf)
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={syncTargets}
                        onChange={(e) => setSyncTargets(e.target.value)}
                        placeholder="Location-IDs, kommagetrennt"
                        className="flex-1 rounded border border-violet-200 bg-white px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => void syncTest(test.id)}
                        className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        Sync
                      </button>
                    </div>
                    {syncResult && (
                      <p className="mt-1.5 text-xs text-violet-600">{syncResult}</p>
                    )}
                  </div>
                )}

                {/* Expanded: Metriken */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4 bg-muted/20">
                    {/* Varianten-Übersicht */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Varianten-Konfiguration
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {test.variants.map(v => (
                          <div key={v.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                            <span className="text-sm font-medium">{v.name}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 text-purple-600 font-medium">
                                <Zap className="h-3 w-3" />{v.pointsMultiplier}×
                              </span>
                              <span>{v.allocationPct} %</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metriken */}
                    {metrics.length > 0 ? (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <BarChart3 className="h-3.5 w-3.5" /> Metriken im Vergleich
                        </h4>

                        {/* Metriken-Grid */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-xs text-muted-foreground">
                                <th className="text-left pb-2 font-medium">Variante</th>
                                <th className="text-right pb-2 font-medium">Multiplikator</th>
                                <th className="text-right pb-2 font-medium">Zugewiesen</th>
                                <th className="text-right pb-2 font-medium">Bestellungen</th>
                                <th className="text-right pb-2 font-medium">Conversion</th>
                                <th className="text-right pb-2 font-medium">Ø Bestellwert</th>
                                <th className="text-right pb-2 font-medium">Umsatz</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {metrics.map((m, mIdx) => {
                                // Lift vs. erste Variante (Kontrolle)
                                const baseConv = metrics[0]?.orderConversionPct ?? 0;
                                const lift     = baseConv > 0
                                  ? ((m.orderConversionPct - baseConv) / baseConv * 100)
                                  : 0;
                                const isControl = mIdx === 0;

                                return (
                                  <tr key={m.variantId} className="hover:bg-accent/30">
                                    <td className="py-2 font-medium">{m.variantName}</td>
                                    <td className="py-2 text-right">
                                      <span className={cn(
                                        'inline-flex items-center gap-0.5 font-mono text-xs px-1.5 py-0.5 rounded',
                                        m.pointsMultiplier > 1 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600',
                                      )}>
                                        <Zap className="h-2.5 w-2.5" />{m.pointsMultiplier}×
                                      </span>
                                    </td>
                                    <td className="py-2 text-right text-muted-foreground">{m.assignedCustomers}</td>
                                    <td className="py-2 text-right">{m.totalOrders}</td>
                                    <td className="py-2 text-right">
                                      <span>{m.orderConversionPct.toFixed(1)} %</span>
                                      {!isControl && lift !== 0 && (
                                        <span className={cn(
                                          'ml-1.5 text-xs',
                                          lift > 0 ? 'text-emerald-600' : 'text-rose-600',
                                        )}>
                                          {lift > 0 ? '+' : ''}{lift.toFixed(1)} %
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 text-right">
                                      {m.avgOrderValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                    <td className="py-2 text-right font-medium">
                                      {m.totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Conversion-Rate Balken */}
                        <div className="mt-3 space-y-2">
                          {metrics.map(m => {
                            const maxConv = Math.max(...metrics.map(x => x.orderConversionPct), 1);
                            const barW    = maxConv > 0 ? (m.orderConversionPct / maxConv) * 100 : 0;
                            return (
                              <div key={m.variantId}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">{m.variantName}</span>
                                  <span className="font-medium">{m.orderConversionPct.toFixed(1)} % Conv.</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                                    style={{ width: `${barW}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        {test.status === 'draft'
                          ? 'Test ist noch nicht aktiv — keine Metriken vorhanden.'
                          : 'Noch keine Ereignisse aufgezeichnet.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function LoyaltyAdminClient({ locationId }: { locationId: string | null }) {
  const [tab, setTab]               = useState<'overview' | 'abtests'>('overview');
  const [kpis, setKpis]             = useState<LoyaltyKpis | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adjustEmail, setAdjustEmail]   = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting]   = useState(false);
  const [adjustMsg, setAdjustMsg]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/loyalty?location_id=${locationId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { kpis: LoyaltyKpis; leaderboard: LeaderboardEntry[] };
      setKpis(data.kpis);
      setLeaderboard(data.leaderboard);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  async function submitAdjust(sign: 1 | -1) {
    const pts = parseInt(adjustPoints, 10);
    if (!adjustEmail || !pts || !adjustReason) {
      setAdjustMsg('E-Mail, Punkte und Grund erforderlich');
      return;
    }
    setAdjusting(true);
    setAdjustMsg(null);
    try {
      const res = await fetch('/api/delivery/admin/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          email: adjustEmail,
          points: pts * sign,
          reason: adjustReason,
        }),
      });
      const data = await res.json() as { ok: boolean; newBalance?: number; reason?: string };
      if (data.ok) {
        setAdjustMsg(`✓ Neuer Kontostand: ${data.newBalance} Punkte`);
        setAdjustEmail('');
        setAdjustPoints('');
        setAdjustReason('');
        void load();
      } else {
        setAdjustMsg(`Fehler: ${data.reason ?? 'Unbekannt'}`);
      }
    } catch (e) {
      setAdjustMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setAdjusting(false);
    }
  }

  if (!locationId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Kein Standort zugeordnet.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Loyalty-Punkte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            10 Punkte pro € · 100 Punkte = 1 € Rabatt · Tier-System Bronze/Silber/Gold/Platin
          </p>
        </div>
        {tab === 'overview' && (
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Aktualisieren
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Übersicht
          </span>
        </TabButton>
        <TabButton active={tab === 'abtests'} onClick={() => setTab('abtests')}>
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> A/B Tests
          </span>
        </TabButton>
      </div>

      {/* ── Tab: Übersicht ── */}
      {tab === 'overview' && (
        <>
          {loading && (
            <div className="text-center text-muted-foreground py-8">Lade Daten…</div>
          )}

          {!loading && kpis && (
            <>
              {/* KPI-Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users}      label="Loyalty-Konten"    value={kpis.totalAccounts}  sub={`${kpis.activeAccounts} aktiv (30 T.)`} />
                <StatCard icon={Coins}      label="Punkte ausstehend" value={kpis.totalPointsOutstanding.toLocaleString('de-DE')} sub={`≙ ${(kpis.totalPointsOutstanding * 0.01).toFixed(2)} € Wert`} />
                <StatCard icon={TrendingUp} label="Lifetime vergeben" value={kpis.totalLifetimeEarned.toLocaleString('de-DE')} sub={`Ø ${kpis.avgPointsPerAccount} P./Konto`} />
                <StatCard icon={Gift}       label="Einlösungsrate"    value={`${kpis.redemptionRate} %`} sub="eingelöst vs. verdient" />
              </div>

              {/* Tier-Verteilung */}
              <div className="rounded-lg border bg-card p-4">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-yellow-500" /> Tier-Verteilung
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  {(['bronze','silver','gold','platinum'] as LoyaltyTier[]).map((tier) => {
                    const m     = TIER_META[tier];
                    const count = kpis.tierBreakdown[tier];
                    return (
                      <div key={tier} className={cn('rounded-lg p-3 text-center', m.bg)}>
                        <div className="text-2xl mb-1">{m.icon}</div>
                        <div className={cn('font-semibold text-sm', m.color)}>{m.label}</div>
                        <div className="text-xl font-bold mt-1">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="rounded-lg border bg-card">
                <div className="px-4 py-3 border-b font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Top-Kunden Leaderboard
                </div>
                {leaderboard.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Noch keine Loyalty-Punkte vergeben.
                  </div>
                ) : (
                  <div className="divide-y">
                    {leaderboard.map((entry) => (
                      <div key={entry.accountId} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50">
                        <div className="w-8 text-center font-bold text-lg text-muted-foreground">
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{entry.customerName ?? entry.customerEmail}</div>
                          <div className="text-xs text-muted-foreground truncate">{entry.customerEmail}</div>
                        </div>
                        <TierBadge tier={entry.tier} />
                        <div className="text-right">
                          <div className="font-bold text-sm">{entry.totalPoints.toLocaleString('de-DE')} P</div>
                          <div className="text-xs text-muted-foreground">{entry.lifetimePoints.toLocaleString('de-DE')} gesamt</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Manuelle Punkte-Anpassung */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-sm mb-3">Manuelle Punkte-Anpassung</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="email"
                value={adjustEmail}
                onChange={(e) => setAdjustEmail(e.target.value)}
                placeholder="Kunden-E-Mail"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                placeholder="Punkte (z.B. 100)"
                min={1}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Begründung"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => void submitAdjust(1)}
                disabled={adjusting}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Hinzufügen
              </button>
              <button
                onClick={() => void submitAdjust(-1)}
                disabled={adjusting}
                className="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Minus className="h-3.5 w-3.5" /> Abziehen
              </button>
            </div>
            {adjustMsg && (
              <p className={cn('mt-2 text-sm', adjustMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600')}>
                {adjustMsg}
              </p>
            )}
          </div>

          {!loading && kpis && kpis.totalAccounts === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Noch kein Loyalty-Konto angelegt. Punkte werden automatisch nach jeder Lieferung vergeben,
              sofern eine E-Mail-Adresse in der Bestellung hinterlegt ist.
            </div>
          )}
        </>
      )}

      {/* ── Tab: A/B Tests ── */}
      {tab === 'abtests' && (
        <AbTestsPanel locationId={locationId} />
      )}
    </div>
  );
}
