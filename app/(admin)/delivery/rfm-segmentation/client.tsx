'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Users, TrendingUp, Euro, Clock, Star, Target, AlertTriangle,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type RfmSegment =
  | 'champion' | 'loyal' | 'potential_loyalist' | 'new_customer'
  | 'promising' | 'needs_attention' | 'at_risk' | 'cant_lose'
  | 'hibernating' | 'lost';

interface SegmentStats {
  segment: RfmSegment;
  customerCount: number;
  avgMonetaryEur: number;
  avgFrequency: number;
  avgRecencyDays: number;
  avgRfmScore: number;
  totalMonetaryEur: number;
}

interface RfmProfile {
  id: string;
  customerPhone: string;
  customerName: string | null;
  recencyDays: number;
  frequency: number;
  monetaryEur: number;
  rScore: number;
  fScore: number;
  mScore: number;
  rfmScore: number;
  segment: RfmSegment;
  computedAt: string;
}

interface Dashboard {
  totalCustomers: number;
  totalRevenueEur: number;
  avgOrderValue: number;
  topSegment: RfmSegment | null;
  segmentStats: SegmentStats[];
  topCustomers: RfmProfile[];
  computedAt: string | null;
}

// ── Segment-Meta ──────────────────────────────────────────────────────────────

const SEGMENT_META: Record<RfmSegment, { label: string; color: string; bg: string; description: string }> = {
  champion:           { label: 'Champions',                 color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   description: 'Beste Kunden: oft, viel, kürzlich' },
  loyal:              { label: 'Treue Kunden',              color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     description: 'Regelmäßig, hohe Frequenz' },
  potential_loyalist: { label: 'Fast-Treue',                color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', description: 'Kürzlich + mittlere Frequenz' },
  new_customer:       { label: 'Neukunden',                 color: 'text-cyan-700',   bg: 'bg-cyan-50 border-cyan-200',     description: 'Kürzlich, erste Bestellungen' },
  promising:          { label: 'Vielversprechend',          color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',     description: 'Mittelfrisch, frühe Phase' },
  needs_attention:    { label: 'Braucht Aufmerksamkeit',    color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   description: 'Drohen einzuschlafen' },
  at_risk:            { label: 'Abwanderungs-Risiko',       color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', description: 'Früher gut, jetzt inaktiv' },
  cant_lose:          { label: 'Darf nicht verloren gehen', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       description: 'Sehr wertvoll, fast weg' },
  hibernating:        { label: 'Schläfer',                  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',     description: 'Inaktiv, niedrige Werte' },
  lost:               { label: 'Verloren',                  color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-300',     description: 'Lange keine Bestellung mehr' },
};

const SEGMENT_ORDER: RfmSegment[] = [
  'champion', 'loyal', 'potential_loyalist', 'new_customer', 'promising',
  'needs_attention', 'at_risk', 'cant_lose', 'hibernating', 'lost',
];

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function maskPhone(phone: string) {
  return phone.length > 6 ? phone.slice(0, 3) + '***' + phone.slice(-3) : '***';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function ScoreBar({ score, max = 15 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-blue-500' : pct >= 35 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-5 text-right">{score}</span>
    </div>
  );
}

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

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function RfmSegmentationClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [activeSegment, setActiveSegment] = useState<RfmSegment | null>(null);
  const [segmentCustomers, setSegmentCustomers] = useState<RfmProfile[]>([]);
  const [segmentLoading, setSegmentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'top'>('overview');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/rfm-segmentation?action=dashboard');
      if (res.ok) setDashboard(await res.json() as Dashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/rfm-segmentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute' }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  const loadSegment = async (seg: RfmSegment) => {
    setActiveSegment(seg);
    setSegmentLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/rfm-segmentation?action=customers&segment=${seg}&limit=50`);
      if (res.ok) {
        const json = await res.json() as { customers: RfmProfile[] };
        setSegmentCustomers(json.customers);
      }
    } finally {
      setSegmentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const d = dashboard;
  const stats = d?.segmentStats ?? [];
  const topSegment = d?.topSegment;
  const topMeta = topSegment ? SEGMENT_META[topSegment] : null;
  const maxCount = Math.max(...stats.map((s) => s.customerCount), 1);

  // Sort segment stats in canonical order
  const orderedStats = SEGMENT_ORDER.map((seg) =>
    stats.find((s) => s.segment === seg),
  ).filter((s): s is SegmentStats => !!s);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['overview', 'segments', 'top'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'overview' ? 'Übersicht' : t === 'segments' ? 'Segmente' : 'Top-Kunden'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {d?.computedAt && (
            <span className="text-xs text-gray-400">Stand: {fmtDate(d.computedAt)}</span>
          )}
          <button
            onClick={load}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCompute}
            disabled={computing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {computing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
            {computing ? 'Berechne…' : 'Jetzt berechnen'}
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Analysierte Kunden"
          value={d?.totalCustomers.toLocaleString('de-DE') ?? '—'}
          sub={topMeta ? `Top-Segment: ${topMeta.label}` : undefined}
          color="text-indigo-600"
        />
        <KpiCard
          icon={<Euro className="w-4 h-4" />}
          label="Tracking-Umsatz (1J)"
          value={d ? fmtEur(d.totalRevenueEur) : '—'}
          sub="Letzte 365 Tage"
          color="text-green-600"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Ø Kundenwert"
          value={d ? fmtEur(d.avgOrderValue) : '—'}
          sub="pro Kunde"
          color="text-blue-600"
        />
        <KpiCard
          icon={<Star className="w-4 h-4" />}
          label="Segment-Vielfalt"
          value={String(orderedStats.length)}
          sub="aktive Segmente"
          color="text-amber-600"
        />
      </div>

      {/* ── Tab: Übersicht ── */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Segment-Verteilung</h3>
          {orderedStats.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Noch keine Daten — bitte Berechnung starten.</p>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {computing ? 'Berechne…' : 'Segmentierung berechnen'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {orderedStats.map((s) => {
                const meta = SEGMENT_META[s.segment];
                const barPct = Math.round((s.customerCount / maxCount) * 100);
                return (
                  <div key={s.segment} className="flex items-center gap-3">
                    <div className="w-36 shrink-0">
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    </div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: meta.color.replace('text-', '').replace('-700', '').replace('-600', ''),
                          opacity: 0.7,
                          // Use inline style for Tailwind dynamic colors
                        }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-gray-700">
                        {s.customerCount} Kunden · Ø {fmtEur(s.avgMonetaryEur)} · Ø {s.avgRecencyDays}T
                      </span>
                    </div>
                    <button
                      onClick={() => { setActiveTab('segments'); loadSegment(s.segment); }}
                      className="text-xs text-indigo-600 hover:underline shrink-0"
                    >
                      Details
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Erklärungsbox */}
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700 space-y-1">
            <p className="font-semibold">So funktioniert RFM-Segmentierung:</p>
            <p><strong>R</strong>ecency — Wie lange ist die letzte Bestellung her? (niedrig = besser)</p>
            <p><strong>F</strong>requency — Wie oft hat der Kunde bestellt?</p>
            <p><strong>M</strong>onetary — Wie viel hat der Kunde ausgegeben?</p>
            <p className="mt-1">Jede Dimension wird auf einer Skala von 1–5 bewertet (Quintile). Kombiniert ergibt das 10 Segmente für zielgenaue Push-Kampagnen.</p>
          </div>
        </div>
      )}

      {/* ── Tab: Segmente ── */}
      {activeTab === 'segments' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {SEGMENT_ORDER.map((seg) => {
              const meta = SEGMENT_META[seg];
              const isActive = activeSegment === seg;
              return (
                <button
                  key={seg}
                  onClick={() => loadSegment(seg)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isActive ? `${meta.bg} border-2` : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
                  {orderedStats.find((s) => s.segment === seg) && (
                    <p className="text-lg font-bold text-gray-800 mt-1">
                      {orderedStats.find((s) => s.segment === seg)!.customerCount}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {activeSegment && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {SEGMENT_META[activeSegment].label}
                  {segmentCustomers.length > 0 && (
                    <span className="ml-2 text-gray-400 font-normal">({segmentCustomers.length} Kunden)</span>
                  )}
                </h3>
                {segmentLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              </div>
              <div className="divide-y divide-gray-50">
                {segmentCustomers.length === 0 && !segmentLoading ? (
                  <p className="text-center text-sm text-gray-400 py-8">Keine Kunden in diesem Segment.</p>
                ) : (
                  segmentCustomers.map((c) => {
                    const expanded = expandedRow === c.id;
                    return (
                      <div key={c.id} className="px-4 py-2.5">
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => setExpandedRow(expanded ? null : c.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {c.customerName ?? maskPhone(c.customerPhone)}
                            </p>
                            <p className="text-xs text-gray-400">{maskPhone(c.customerPhone)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-gray-900">{fmtEur(c.monetaryEur)}</p>
                            <p className="text-xs text-gray-400">{c.frequency}× · {c.recencyDays}T</p>
                          </div>
                          <div className="w-20 shrink-0">
                            <ScoreBar score={c.rfmScore} />
                          </div>
                          {expanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                        </div>
                        {expanded && (
                          <div className="mt-2 ml-1 grid grid-cols-3 gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                            <div>
                              <p className="text-gray-400">R-Score</p>
                              <p className="font-semibold">{c.rScore}/5</p>
                            </div>
                            <div>
                              <p className="text-gray-400">F-Score</p>
                              <p className="font-semibold">{c.fScore}/5</p>
                            </div>
                            <div>
                              <p className="text-gray-400">M-Score</p>
                              <p className="font-semibold">{c.mScore}/5</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Top-Kunden ── */}
      {activeTab === 'top' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Top 10 Kunden nach RFM-Score</h3>
          </div>
          {(d?.topCustomers ?? []).length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Keine Daten — bitte Berechnung starten.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {(d?.topCustomers ?? []).map((c, idx) => {
                const meta = SEGMENT_META[c.segment];
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-300 w-7 text-center">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {c.customerName ?? maskPhone(c.customerPhone)}
                      </p>
                      <p className="text-xs text-gray-400">{maskPhone(c.customerPhone)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{fmtEur(c.monetaryEur)}</p>
                      <p className="text-xs text-gray-400">{c.frequency}× bestellt · {c.recencyDays}T</p>
                    </div>
                    <div className="w-20 shrink-0">
                      <ScoreBar score={c.rfmScore} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Telefonnummern werden maskiert angezeigt. Vollständige Daten nur für Support-Zwecke.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
