'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, RefreshCw, TrendingUp, MapPin, Package,
  ChevronDown, ChevronUp, Info, AlertCircle, CheckCircle2,
} from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface GeoDemandRow {
  plz: string;
  zone_name: string | null;
  is_outside_zone: boolean;
  total_orders: number;
  total_revenue_eur: number;
  avg_distance_km: number | null;
  on_time_pct: number;
  days_with_data: number;
  last_seen_date: string;
}

interface ExpansionCandidate {
  plz: string;
  total_orders: number;
  total_revenue_eur: number;
  avg_distance_km: number | null;
  active_days: number;
  estimated_weekly_revenue: number;
  projected_annual_revenue: number;
  expansion_score: number;
}

interface Summary {
  covered_plzs: number;
  outside_plzs: number;
  total_orders_30d: number;
  total_revenue_30d: number;
  coverage_rate_pct: number;
  potential_annual_gain: number;
}

interface Dashboard {
  location_id: string;
  generated_at: string;
  summary: Summary;
  demand_map: GeoDemandRow[];
  expansion_candidates: ExpansionCandidate[];
  top_inside_plz: GeoDemandRow | null;
  top_candidate: ExpansionCandidate | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border border-green-200',
  B: 'bg-blue-100 text-blue-800 border border-blue-200',
  C: 'bg-amber-100 text-amber-800 border border-amber-200',
  D: 'bg-red-100 text-red-800 border border-red-200',
};

function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
}

function fmtKm(n: number | null): string {
  if (n == null) return '—';
  return n.toFixed(1) + ' km';
}

function scoreColor(score: number): string {
  if (score >= 200) return 'text-green-600';
  if (score >= 80)  return 'text-amber-600';
  return 'text-gray-500';
}

function barWidth(orders: number, max: number): string {
  if (max === 0) return '0%';
  return Math.round((orders / max) * 100) + '%';
}

// ─── KPI-Karte ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <Icon className={`h-5 w-5 mt-1 ${highlight ? 'text-green-500' : 'text-gray-400'}`} />
      </div>
    </div>
  );
}

// ─── PLZ-Zeile ────────────────────────────────────────────────────────────────

function DemandRow({ row, maxOrders }: { row: GeoDemandRow; maxOrders: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="w-16 shrink-0">
          <span className="font-mono font-semibold text-sm">{row.plz}</span>
        </div>
        {row.zone_name ? (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ZONE_COLORS[row.zone_name] ?? 'bg-gray-100 text-gray-600'}`}>
            Zone {row.zone_name}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border">Außerhalb</span>
        )}
        <div className="flex-1 mx-3">
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${row.is_outside_zone ? 'bg-orange-400' : 'bg-blue-500'}`}
              style={{ width: barWidth(row.total_orders, maxOrders) }}
            />
          </div>
        </div>
        <div className="w-10 text-right text-sm font-medium text-gray-700">
          {row.total_orders}
        </div>
        <div className="w-24 text-right text-sm text-gray-500">
          {fmtEur(row.total_revenue_eur)}
        </div>
        <div className="ml-2">
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-6 pb-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600 bg-gray-50">
          <div>
            <p className="text-xs text-gray-400">Ø Entfernung</p>
            <p className="font-medium">{fmtKm(row.avg_distance_km)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Pünktlichkeit</p>
            <p className="font-medium">{row.on_time_pct.toFixed(0)} %</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Aktive Tage</p>
            <p className="font-medium">{row.days_with_data}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Zuletzt gesehen</p>
            <p className="font-medium">{row.last_seen_date}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expansions-Karte ─────────────────────────────────────────────────────────

function CandidateCard({ c, rank }: { c: ExpansionCandidate; rank: number }) {
  const [open, setOpen] = useState(false);
  const scoreLabel =
    c.expansion_score >= 200 ? 'Hohes Potenzial' :
    c.expansion_score >= 80  ? 'Mittleres Potenzial' :
    'Geringes Potenzial';
  const scoreBadge =
    c.expansion_score >= 200 ? 'bg-green-100 text-green-800' :
    c.expansion_score >= 80  ? 'bg-amber-100 text-amber-800' :
    'bg-gray-100 text-gray-600';

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
        onClick={() => setOpen((p) => !p)}
      >
        <span className="text-lg font-bold text-gray-300 w-6">#{rank}</span>
        <span className="font-mono font-semibold text-base w-14">{c.plz}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreBadge}`}>
          {scoreLabel}
        </span>
        <div className="flex-1" />
        <div className="text-right">
          <p className="text-sm font-semibold text-green-700">{fmtEur(c.estimated_weekly_revenue)} / Woche</p>
          <p className="text-xs text-gray-400">{c.total_orders} Bestellungen (30 Tage)</p>
        </div>
        <div className="ml-2">
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t bg-gray-50 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Umsatz 30 Tage</p>
            <p className="font-semibold">{fmtEur(c.total_revenue_eur)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Ø Entfernung</p>
            <p className="font-semibold">{fmtKm(c.avg_distance_km)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Aktive Tage</p>
            <p className="font-semibold">{c.active_days}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Jahres-Potenzial</p>
            <p className={`font-semibold ${scoreColor(c.expansion_score)}`}>
              {fmtEur(c.projected_annual_revenue)}
            </p>
          </div>
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-400 mb-1">Expansion-Score</p>
            <div className="h-2 rounded-full bg-gray-200">
              <div
                className={`h-2 rounded-full ${c.expansion_score >= 200 ? 'bg-green-500' : c.expansion_score >= 80 ? 'bg-amber-400' : 'bg-gray-400'}`}
                style={{ width: `${Math.min(c.expansion_score / 5, 100)}%` }}
              />
            </div>
            <p className={`text-xs mt-1 font-medium ${scoreColor(c.expansion_score)}`}>
              Score: {c.expansion_score.toFixed(0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Client ─────────────────────────────────────────────────────────────

export function GeoDemandClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapLoading, setSnapLoading] = useState(false);
  const [tab, setTab] = useState<'map' | 'candidates'>('map');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/geo-demand?location_id=${locationId}`);
      if (res.ok) setData(await res.json() as Dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  // 2-Min Auto-Refresh
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 120_000);
    return () => clearInterval(id);
  }, [load]);

  const triggerSnapshot = async () => {
    setSnapLoading(true);
    try {
      await fetch('/api/delivery/admin/geo-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Lade Geo-Daten…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Globe className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <p>Keine Daten verfügbar. Täglich um 02:00 UTC werden Snapshots erstellt.</p>
        <button
          onClick={triggerSnapshot}
          disabled={snapLoading}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {snapLoading ? 'Erstelle Snapshot…' : 'Jetzt Snapshot erstellen'}
        </button>
      </div>
    );
  }

  const { summary, demand_map, expansion_candidates, top_candidate } = data;
  const maxOrders = Math.max(...demand_map.map((r) => r.total_orders), 1);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Letzte Aktualisierung: {new Date(data.generated_at).toLocaleString('de-DE')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={triggerSnapshot}
            disabled={snapLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Package className="h-4 w-4" />
            {snapLoading ? 'Läuft…' : 'Snapshot jetzt'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Abgedeckte PLZs"
          value={String(summary.covered_plzs)}
          sub="aktive Liefergebiete"
          icon={CheckCircle2}
        />
        <KpiCard
          label="PLZs außerhalb"
          value={String(summary.outside_plzs)}
          sub="mögliche Expansion"
          icon={AlertCircle}
        />
        <KpiCard
          label="Bestellungen 30d"
          value={summary.total_orders_30d.toLocaleString('de-DE')}
          sub="alle PLZs"
          icon={Package}
        />
        <KpiCard
          label="Umsatz 30d"
          value={fmtEur(summary.total_revenue_30d)}
          sub="alle PLZs"
          icon={TrendingUp}
        />
        <KpiCard
          label="Abdeckungsrate"
          value={summary.coverage_rate_pct + ' %'}
          sub="Bestellungen in Zone"
          icon={MapPin}
        />
        <KpiCard
          label="Expansions-Potenzial"
          value={fmtEur(summary.potential_annual_gain)}
          sub="Jahresumsatz (Kandidaten)"
          icon={Globe}
          highlight={summary.potential_annual_gain > 5000}
        />
      </div>

      {/* Top-Kandidat Banner */}
      {top_candidate && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">
              Bester Expansions-Kandidat: PLZ {top_candidate.plz}
            </p>
            <p className="text-xs text-green-700">
              {top_candidate.total_orders} Bestellungen in 30 Tagen außerhalb der Zone —
              geschätztes Potenzial {fmtEur(top_candidate.estimated_weekly_revenue)}/Woche
              ({fmtEur(top_candidate.projected_annual_revenue)}/Jahr)
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex border-b bg-gray-50">
          {(['map', 'candidates'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-white border-b-2 border-blue-600 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'map'
                ? `Nachfrage-Karte (${demand_map.length} PLZs)`
                : `Expansionskandidaten (${expansion_candidates.length})`}
            </button>
          ))}
        </div>

        {tab === 'map' && (
          <div>
            {/* Legende */}
            <div className="flex items-center gap-4 px-4 py-2 border-b text-xs text-gray-500 bg-gray-50">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded bg-blue-500" /> Innerhalb Zone
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded bg-orange-400" /> Außerhalb Zone
              </span>
              <span className="ml-auto">Balken = relative Bestellmenge</span>
            </div>
            <div className="divide-y">
              {demand_map.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">
                  Noch keine PLZ-Daten — Snapshot ab 02:00 UTC oder manuell auslösen.
                </p>
              ) : (
                demand_map.map((row) => (
                  <DemandRow key={row.plz} row={row} maxOrders={maxOrders} />
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'candidates' && (
          <div className="p-4 space-y-3">
            {expansion_candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Globe className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Keine Expansionskandidaten (mindestens 3 Bestellungen in 30 Tagen erforderlich).
              </div>
            ) : (
              expansion_candidates.map((c, i) => (
                <CandidateCard key={c.plz} c={c} rank={i + 1} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Info-Box */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-gray-700">So funktioniert die Geo-Demand-Analyse</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Täglich um 02:00 UTC werden alle Lieferbestellungen des Vortags nach PLZ aggregiert.</li>
              <li>PLZs werden anhand der Haversine-Distanz zur Location in Zonen A–D eingeteilt.</li>
              <li>PLZs außerhalb der konfigurierten Lieferzonen werden als Expansionskandidaten markiert.</li>
              <li>Der Expansion-Score berechnet sich aus Umsatz × Häufigkeit ÷ Distanz-Faktor.</li>
              <li>Jahres-Potenzial = Tages-Ø-Umsatz × 365 (konservative Schätzung ohne Saisonalität).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
