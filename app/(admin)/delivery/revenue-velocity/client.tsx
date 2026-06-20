'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RevenueVelocityDashboard, RevenueVelocityComparison, RevenueVelocityHour } from '@/lib/delivery/revenue-velocity';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Euro, ShoppingCart, Zap, Clock } from 'lucide-react';

const REFRESH_INTERVAL = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(v: number | null | undefined) {
  if (v == null) return '—';
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtHour(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-gray-500 text-xs">—</span>;
  const pos = pct >= 0;
  const Icon = pct > 1 ? TrendingUp : pct < -1 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon className="h-3 w-3" />
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function PaceLabel({ label }: { label: RevenueVelocityDashboard['paceLabel'] }) {
  const map: Record<string, { text: string; cls: string }> = {
    ahead:    { text: 'Über Plan',   cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
    on_track: { text: 'Im Plan',     cls: 'bg-blue-500/10    text-blue-300    border-blue-500/30' },
    behind:   { text: 'Unter Plan',  cls: 'bg-amber-500/10   text-amber-300   border-amber-500/30' },
    no_data:  { text: 'Kein Verlauf', cls: 'bg-gray-800      text-gray-400    border-gray-700' },
  };
  const { text, cls } = map[label] ?? map.no_data;
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>{text}</span>
  );
}

// ─── KPI-Karte ────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
}) {
  return (
    <Card className="bg-gray-900 border-gray-700/50 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs font-medium">{label}</span>
        <span className="text-gray-600">{icon}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      <div className="flex items-center gap-2">
        {sub && <span className="text-gray-500 text-xs">{sub}</span>}
        {delta !== undefined && <DeltaBadge pct={delta} />}
      </div>
    </Card>
  );
}

// ─── Stunden-Balken-Chart ─────────────────────────────────────────────────────

function HourBarChart({ rows }: { rows: RevenueVelocityHour[] }) {
  if (rows.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-8">Noch keine Daten für heute</div>;
  }
  const maxRev = Math.max(...rows.map((r) => r.revenueEur), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {rows.map((r) => {
        const pct = (r.revenueEur / maxRev) * 100;
        const h   = fmtHour(r.hourBucket);
        const col = r.revenueEur >= maxRev * 0.8 ? 'bg-emerald-500' :
                    r.revenueEur >= maxRev * 0.5 ? 'bg-blue-500'    : 'bg-gray-600';
        return (
          <div key={r.hourBucket} className="flex flex-col items-center gap-1 flex-1 group relative" title={`${h}: ${fmtEur(r.revenueEur)} / ${r.ordersCount} Bestellungen`}>
            <div className="w-full flex flex-col items-center justify-end h-28">
              <div className={`w-full rounded-t ${col} transition-all`} style={{ height: `${Math.max(2, pct)}%` }} />
            </div>
            <span className="text-gray-600 text-[9px] leading-none rotate-90 whitespace-nowrap">{h}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Vergleichs-Linien-Chart ──────────────────────────────────────────────────

function ComparisonLineChart({ data }: { data: RevenueVelocityComparison[] }) {
  const nowHour = new Date().getHours();
  const relevant = data.filter((d) => d.today != null || d.yesterday != null || d.lastWeek != null);
  if (relevant.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-8">Noch keine Vergleichsdaten</div>;
  }

  const W = 600; const H = 120;
  const allVals = data.flatMap((d) => [d.today, d.yesterday, d.lastWeek].filter((v) => v != null)) as number[];
  const maxV = Math.max(...allVals, 1);

  const toX = (h: number) => (h / 23) * W;
  const toY = (v: number | null) => v == null ? null : H - (v / maxV) * H;

  function buildPath(key: 'today' | 'yesterday' | 'lastWeek') {
    const pts = data
      .map((d) => ({ x: toX(d.hour), y: toY(d[key]) }))
      .filter((p) => p.y != null) as { x: number; y: number }[];
    if (pts.length < 2) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  const todayPath    = buildPath('today');
  const ydPath       = buildPath('yesterday');
  const lwPath       = buildPath('lastWeek');
  const nowX         = toX(nowHour);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ minWidth: 320 }}>
        {/* Heute-Linie */}
        {ydPath && <path d={ydPath} fill="none" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 2" />}
        {lwPath && <path d={lwPath} fill="none" stroke="#4b5563" strokeWidth={1} strokeDasharray="2 3" />}
        {todayPath && <path d={todayPath} fill="none" stroke="#10b981" strokeWidth={2} />}
        {/* Now-Marker */}
        <line x1={nowX} y1={0} x2={nowX} y2={H} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 2" />
        {/* Legende */}
        <g transform={`translate(8,${H + 10})`}>
          <line x1={0} y1={0} x2={20} y2={0} stroke="#10b981" strokeWidth={2} />
          <text x={24} y={4} fill="#9ca3af" fontSize={9}>Heute</text>
          <line x1={60} y1={0} x2={80} y2={0} stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={84} y={4} fill="#9ca3af" fontSize={9}>Gestern</text>
          <line x1={130} y1={0} x2={150} y2={0} stroke="#4b5563" strokeWidth={1} strokeDasharray="2 3" />
          <text x={154} y={4} fill="#9ca3af" fontSize={9}>Vorwoche</text>
          <line x1={200} y1={0} x2={220} y2={0} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 2" />
          <text x={224} y={4} fill="#9ca3af" fontSize={9}>Jetzt</text>
        </g>
      </svg>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function RevenueVelocityClient() {
  const [data, setData]       = useState<RevenueVelocityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [tab, setTab]         = useState<'today' | 'compare'>('today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/revenue-velocity');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as RevenueVelocityDashboard;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { void load(); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  const handleSnapshot = async () => {
    await fetch('/api/delivery/admin/revenue-velocity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshot' }),
    });
    await load();
  };

  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Header-Zeile */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {data && <PaceLabel label={data.paceLabel} />}
          <span className="text-gray-500 text-xs">Refresh in {countdown}s</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={handleSnapshot}>
            <Zap className="h-3 w-3 mr-1" /> Snapshot
          </Button>
          <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
          </Button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Euro className="h-4 w-4" />}
          label="Heutiger Umsatz"
          value={fmtEur(data?.todayRevenue ?? null)}
          sub="Gesamtumsatz seit Mitternacht"
          delta={data?.revenueDeltaPct}
        />
        <KpiCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Bestellungen Heute"
          value={data ? String(data.todayOrders) : '—'}
          sub={data ? `${data.deliveryShare}% Lieferung` : undefined}
          delta={data?.ordersDeltaPct}
        />
        <KpiCard
          icon={<Zap className="h-4 w-4" />}
          label="Aktuelle Velocity"
          value={fmtEur(data?.currentVelocity ?? null)}
          sub={`Peak: ${fmtEur(data?.peakVelocity ?? null)}`}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Schicht-Prognose"
          value={fmtEur(data?.shiftProjection ?? null)}
          sub={data ? `Ø Bestellwert ${fmtEur(data.avgOrderValue)}` : undefined}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['today', 'compare'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === t
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t === 'today' ? 'Heutiger Verlauf' : 'Heute vs. Gestern'}
          </button>
        ))}
      </div>

      {/* Chart-Bereich */}
      <Card className="bg-gray-900 border-gray-700/50 p-5">
        {tab === 'today' ? (
          <>
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" /> Umsatz je Stunde (Heute)
            </h3>
            {data ? <HourBarChart rows={data.hourlyToday} /> : <div className="text-gray-500 text-sm text-center py-8">Lade…</div>}
          </>
        ) : (
          <>
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500" /> Vergleich: Heute · Gestern · Vorwoche
            </h3>
            {data ? <ComparisonLineChart data={data.comparison} /> : <div className="text-gray-500 text-sm text-center py-8">Lade…</div>}
          </>
        )}
      </Card>

      {/* Stunden-Tabelle */}
      {data && data.hourlyToday.length > 0 && (
        <Card className="bg-gray-900 border-gray-700/50 overflow-hidden">
          <div className="p-4 border-b border-gray-700/50">
            <h3 className="text-sm font-medium text-gray-300">Stunden-Detail</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-4 py-2">Stunde</th>
                  <th className="text-right px-4 py-2">Umsatz</th>
                  <th className="text-right px-4 py-2">Bestellungen</th>
                  <th className="text-right px-4 py-2">Ø Wert</th>
                  <th className="text-right px-4 py-2">Lieferung</th>
                  <th className="text-right px-4 py-2">Abholung</th>
                </tr>
              </thead>
              <tbody>
                {[...data.hourlyToday].reverse().map((r) => (
                  <tr key={r.hourBucket} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 font-medium text-gray-200">{fmtHour(r.hourBucket)}</td>
                    <td className="px-4 py-2 text-right text-emerald-400 font-medium">{fmtEur(r.revenueEur)}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{r.ordersCount}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{r.avgOrderValue != null ? fmtEur(r.avgOrderValue) : '—'}</td>
                    <td className="px-4 py-2 text-right text-blue-400">{r.deliveryCount}</td>
                    <td className="px-4 py-2 text-right text-purple-400">{r.pickupCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data && (
        <p className="text-gray-600 text-xs text-right">
          Letzte Aktualisierung: {new Date(data.snappedAt).toLocaleTimeString('de-DE')}
        </p>
      )}
    </div>
  );
}
