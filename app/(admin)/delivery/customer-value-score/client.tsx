'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users2, RefreshCw, Loader2, Medal, TrendingUp, Euro, ShoppingBag, Clock } from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type CvsTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface CustomerValueScore {
  id: string;
  locationId: string;
  customerPhone: string;
  customerName: string | null;
  rfmScoreNorm: number;
  frequencyScore: number;
  monetaryScore: number;
  recencyScore: number;
  cvs: number;
  cvsTier: CvsTier;
  totalOrders: number;
  totalSpentEur: number;
  ordersLast30d: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  recencyDays: number | null;
  rfmSegment: string | null;
  computedAt: string;
}

interface CvsDistribution {
  locationId: string;
  totalCustomers: number;
  platinumCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  avgCvs: number;
  maxCvs: number;
  totalRevenueEur: number;
  avgRevenuePerCustomer: number;
  avgOrdersLast30d: number;
  lastComputedAt: string | null;
}

interface CvsDashboard {
  distribution: CvsDistribution | null;
  topCustomers: CustomerValueScore[];
  computedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<CvsTier, { label: string; color: string; bg: string; border: string; ring: string }> = {
  platinum: { label: 'Platinum',  color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200', ring: 'bg-purple-500' },
  gold:     { label: 'Gold',      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  ring: 'bg-amber-400'  },
  silver:   { label: 'Silber',    color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200',  ring: 'bg-slate-400'  },
  bronze:   { label: 'Bronze',    color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200', ring: 'bg-orange-400' },
};

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function relativeDate(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Gestern';
  return `Vor ${d} Tagen`;
}

// ── Score-Bar Komponente ──────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium">{fmt(value, 0)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

// ── CVS-Gauge ─────────────────────────────────────────────────────────────────

function CvsGauge({ cvs, tier }: { cvs: number; tier: CvsTier }) {
  const cfg = TIER_CONFIG[tier];
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (cvs / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f0f0f0" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={tier === 'platinum' ? '#9333ea' : tier === 'gold' ? '#f59e0b' : tier === 'silver' ? '#94a3b8' : '#f97316'}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.25}
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="38" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill="#1e293b">
          {fmt(cvs, 0)}
        </text>
      </svg>
      <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-semibold ${cfg.color}`}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── KPI-Karte ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-blue-600',
  bg = 'bg-blue-50',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Tier-Balken ───────────────────────────────────────────────────────────────

function TierBar({ dist }: { dist: CvsDistribution }) {
  const total = dist.totalCustomers;
  if (total === 0) return null;

  const tiers: { tier: CvsTier; count: number }[] = [
    { tier: 'platinum', count: dist.platinumCount },
    { tier: 'gold',     count: dist.goldCount     },
    { tier: 'silver',   count: dist.silverCount   },
    { tier: 'bronze',   count: dist.bronzeCount   },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Tier-Verteilung</h3>
      <div className="flex h-5 rounded-full overflow-hidden gap-0.5 mb-3">
        {tiers.map(({ tier, count }) => {
          const pct = (count / total) * 100;
          if (pct < 0.5) return null;
          const cfg = TIER_CONFIG[tier];
          return (
            <div
              key={tier}
              className={`${cfg.ring} transition-all`}
              style={{ width: `${pct}%`, minWidth: count > 0 ? '4px' : 0 }}
              title={`${cfg.label}: ${count} (${fmt(pct, 1)}%)`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiers.map(({ tier, count }) => {
          const cfg = TIER_CONFIG[tier];
          return (
            <div key={tier} className={`rounded-lg ${cfg.bg} ${cfg.border} border p-2 text-center`}>
              <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
              <p className="text-lg font-bold text-gray-900">{fmt(count)}</p>
              <p className="text-xs text-gray-400">{total > 0 ? fmt((count / total) * 100, 1) : '0'}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Kunden-Zeile ─────────────────────────────────────────────────────────────

function CustomerRow({ score, rank }: { score: CustomerValueScore; rank: number }) {
  const cfg = TIER_CONFIG[score.cvsTier];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden mb-2 ${expanded ? 'shadow-sm' : ''}`}>
      <button
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rang */}
        <span className="w-6 text-center text-sm font-bold text-gray-400 flex-shrink-0">
          {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : `#${rank}`}
        </span>

        {/* Gauge */}
        <div className="flex-shrink-0">
          <CvsGauge cvs={score.cvs} tier={score.cvsTier} />
        </div>

        {/* Name / Phone */}
        <div className="flex-1 min-w-0 ml-2">
          <p className="font-semibold text-gray-900 truncate text-sm">
            {score.customerName ?? score.customerPhone}
          </p>
          {score.customerName && (
            <p className="text-xs text-gray-400 truncate">{score.customerPhone}</p>
          )}
          <div className="mt-1">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {score.rfmSegment && (
              <span className="ml-1 text-xs text-gray-400">{score.rfmSegment}</span>
            )}
          </div>
        </div>

        {/* Rechte Spalten */}
        <div className="hidden sm:grid grid-cols-3 gap-4 flex-shrink-0 text-right">
          <div>
            <p className="text-xs text-gray-400">Bestellungen</p>
            <p className="text-sm font-bold text-gray-900">{fmt(score.totalOrders)}</p>
            <p className="text-xs text-gray-400">{fmt(score.ordersLast30d)} / 30d</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Umsatz</p>
            <p className="text-sm font-bold text-gray-900">{fmtEur(score.totalSpentEur)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Letzter Kauf</p>
            <p className="text-sm font-bold text-gray-900">{relativeDate(score.lastOrderAt)}</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ScoreBar label="RFM-Score" value={score.rfmScoreNorm} color="bg-blue-500" />
          <ScoreBar label="Frequenz-Pz." value={score.frequencyScore} color="bg-green-500" />
          <ScoreBar label="Umsatz-Pz." value={score.monetaryScore} color="bg-amber-500" />
          <ScoreBar label="Aktualität" value={score.recencyScore} color="bg-purple-500" />
          {score.firstOrderAt && (
            <div className="col-span-2 sm:col-span-4 text-xs text-gray-400 mt-1">
              Erster Kauf: {new Date(score.firstOrderAt).toLocaleDateString('de-DE')} ·
              Aktiv seit {score.recencyDays != null ? `${score.recencyDays} Tagen` : '—'} inaktiv
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────

export function CustomerValueScoreClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<CvsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | CvsTier>('all');
  const [tabData, setTabData] = useState<CustomerValueScore[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/customer-value-score?action=dashboard');
      if (!res.ok) throw new Error('API-Fehler');
      const data = await res.json() as CvsDashboard;
      setDashboard(data);
      setTabData(data.topCustomers ?? []);
    } catch {
      setError('Dashboard konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  // Tab-Wechsel: Tier-Filter
  useEffect(() => {
    if (activeTab === 'all') {
      setTabData(dashboard?.topCustomers ?? []);
      return;
    }
    setTabLoading(true);
    fetch(`/api/delivery/admin/customer-value-score?action=by_tier&tier=${activeTab}&limit=50`)
      .then(r => r.json())
      .then((d: CustomerValueScore[]) => setTabData(d))
      .catch(() => setTabData([]))
      .finally(() => setTabLoading(false));
  }, [activeTab, dashboard]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/customer-value-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute' }),
      });
      await loadDashboard();
    } finally {
      setComputing(false);
    }
  };

  const dist = dashboard?.distribution;
  const TABS: { id: 'all' | CvsTier; label: string }[] = [
    { id: 'all',      label: 'Alle Top-Kunden' },
    { id: 'platinum', label: '💎 Platinum' },
    { id: 'gold',     label: '🥇 Gold' },
    { id: 'silver',   label: '🥈 Silber' },
    { id: 'bronze',   label: '🥉 Bronze' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Lade CVS-Dashboard…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error} — Starte zuerst eine Berechnung.
        <button onClick={handleCompute} className="ml-3 underline text-sm">
          Jetzt berechnen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-indigo-600" />
          <span className="text-sm text-gray-500">
            {dist
              ? `${fmt(dist.totalCustomers)} Kunden bewertet · Ø CVS ${fmt(dist.avgCvs, 1)}`
              : 'Noch keine Scores berechnet'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void loadDashboard()}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Aktualisieren
          </button>
          <button
            onClick={handleCompute}
            disabled={computing}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {computing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Medal className="w-4 h-4" />
            )}
            {computing ? 'Berechne…' : 'CVS berechnen'}
          </button>
        </div>
      </div>

      {dist ? (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={Users2}
              label="Kunden bewertet"
              value={fmt(dist.totalCustomers)}
              sub={dist.lastComputedAt ? `Zuletzt ${relativeDate(dist.lastComputedAt)}` : undefined}
              color="text-indigo-600"
              bg="bg-indigo-50"
            />
            <KpiCard
              icon={TrendingUp}
              label="Ø CVS"
              value={fmt(dist.avgCvs, 1)}
              sub={`Max ${fmt(dist.maxCvs, 0)}`}
              color="text-green-600"
              bg="bg-green-50"
            />
            <KpiCard
              icon={Euro}
              label="Ø Umsatz / Kunde"
              value={fmtEur(dist.avgRevenuePerCustomer)}
              sub={`Gesamt ${fmtEur(dist.totalRevenueEur)}`}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <KpiCard
              icon={ShoppingBag}
              label="Ø Bestellungen / 30d"
              value={fmt(dist.avgOrdersLast30d, 2)}
              color="text-blue-600"
              bg="bg-blue-50"
            />
          </div>

          {/* Tier-Balken */}
          <TierBar dist={dist} />
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          Noch keine CVS-Daten. Klicke &quot;CVS berechnen&quot; um Scores zu generieren
          (Voraussetzung: RFM-Segmentierung muss bereits gelaufen sein).
        </div>
      )}

      {/* Kunden-Tab */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Tab-Leiste */}
        <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`whitespace-nowrap text-sm px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === t.id
                  ? 'bg-indigo-100 text-indigo-700 font-semibold'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
              {t.id !== 'all' && dist && (
                <span className="ml-1 text-xs opacity-70">
                  ({fmt(dist[`${t.id}Count` as keyof CvsDistribution] as number)})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3">
          {tabLoading ? (
            <div className="flex justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : tabData.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">
              Keine Kunden in diesem Tier.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2">{tabData.length} Kunden · Klicken zum Aufklappen</p>
              {tabData.map((score, i) => (
                <CustomerRow key={score.id} score={score} rank={i + 1} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Info-Box */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 mb-2">So wird der CVS berechnet</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <p className="font-medium text-blue-600">RFM-Score (35%)</p>
            <p>Normalisierter Quintil-Score aus Recency · Frequency · Monetary (3–15 → 0–100)</p>
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <p className="font-medium text-amber-600">Umsatz-Pz. (25%)</p>
            <p>Gesamtumsatz-Perzentil unter allen Location-Kunden</p>
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <p className="font-medium text-green-600">Frequenz-Pz. (20%)</p>
            <p>Bestellhäufigkeit-Perzentil unter allen Location-Kunden</p>
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <p className="font-medium text-purple-600">Aktualität (20%)</p>
            <p>Exponential-Abfall: 100 bei 0 Tagen, ~37 bei 30d, ~5 bei 90d</p>
          </div>
        </div>
        <p className="mt-2">Tier-Grenzen: 💎 Platinum ≥ 75 · 🥇 Gold ≥ 55 · 🥈 Silber ≥ 35 · 🥉 Bronze &lt; 35</p>
        <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> Automatische Neuberechnung täglich um 03:45 UTC</p>
      </div>
    </div>
  );
}
