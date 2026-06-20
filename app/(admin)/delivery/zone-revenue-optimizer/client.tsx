'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Zap, MapPin, BarChart3,
  ArrowUpRight, ArrowDownRight, DollarSign, Clock, Target,
} from 'lucide-react';
import { euro } from '@/lib/utils';

// ─── Types (mirrored from lib) ────────────────────────────────────────────────

type ZoneRevRec =
  | 'increase_surcharge' | 'decrease_surcharge' | 'increase_mov' | 'decrease_mov'
  | 'remove_zone' | 'expand_zone' | 'add_free_threshold' | 'investigate';

interface ZoneRevenueSnapshot {
  id: string; zoneName: string; snapshotDate: string;
  orderCount: number; revenueEur: number; feeRevenueEur: number;
  avgOrderValue: number | null; avgDistanceKm: number | null;
  onTimePct: number | null; cancellationPct: number | null;
  marginScore: number | null; costRatio: number | null;
}

interface ZoneRevenueRecommendation {
  id: string; zoneName: string; recType: ZoneRevRec; reason: string;
  suggestedSurcharge: number | null; suggestedMov: number | null;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'accepted' | 'dismissed' | 'applied';
  generatedAt: string; resolvedAt: string | null;
}

interface ZoneDashboardEntry {
  zoneName: string; label: string; surchargeEur: number; minOrderEur: number;
  minKm: number; maxKm: number;
  latest: ZoneRevenueSnapshot | null;
  trend30d: Array<{ date: string; revenueEur: number; orderCount: number; marginScore: number | null }>;
  recommendations: ZoneRevenueRecommendation[];
}

interface ZoneRevenueDashboard {
  locationId: string; refreshedAt: string;
  totalRevenueToday: number; totalOrdersToday: number;
  bestZone: string | null; worstZone: string | null; pendingRecs: number;
  zones: ZoneDashboardEntry[];
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-red-100 text-red-800 border-red-200',
};

const ZONE_RING_COLORS: Record<string, string> = {
  A: 'stroke-emerald-500',
  B: 'stroke-blue-500',
  C: 'stroke-amber-500',
  D: 'stroke-red-500',
};

function marginColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function urgencyBadge(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'high':     return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'normal':   return 'bg-blue-100 text-blue-700 border-blue-200';
    default:         return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function recTypeLabel(rt: ZoneRevRec): string {
  const map: Record<ZoneRevRec, string> = {
    increase_surcharge: 'Zuschlag erhöhen',
    decrease_surcharge: 'Zuschlag senken',
    increase_mov: 'MOV erhöhen',
    decrease_mov: 'MOV senken',
    remove_zone: 'Zone entfernen',
    expand_zone: 'Zone erweitern',
    add_free_threshold: 'Gratis-Schwelle einführen',
    investigate: 'Untersuchung',
  };
  return map[rt] ?? rt;
}

// Inline mini-bar chart for 30d trend
function MiniTrendBar({ data }: { data: ZoneDashboardEntry['trend30d'] }) {
  if (data.length === 0) return <span className="text-xs text-muted-foreground">Keine Daten</span>;
  const max = Math.max(...data.map((d) => d.revenueEur), 1);
  const last14 = data.slice(-14);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {last14.map((d, i) => {
        const h = Math.max(2, Math.round((d.revenueEur / max) * 32));
        return (
          <div key={i} title={`${d.date}: ${euro(d.revenueEur)}`}
            style={{ height: h }}
            className="w-2 rounded-sm bg-matcha-400 opacity-80 hover:opacity-100 transition-opacity" />
        );
      })}
    </div>
  );
}

// SVG margin gauge
function MarginGauge({ score, zone }: { score: number | null; zone: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const dash = (pct / 100) * circ;
  const ringClass = ZONE_RING_COLORS[zone] ?? 'stroke-gray-400';
  return (
    <svg width={72} height={72} className="-rotate-90">
      <circle cx={36} cy={36} r={r} fill="none" strokeWidth={7} className="stroke-gray-100" />
      <circle cx={36} cy={36} r={r} fill="none" strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        className={`${ringClass} transition-all duration-700`} />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="middle"
        className="fill-foreground text-[11px] font-semibold rotate-90"
        style={{ fontSize: 11, transform: 'rotate(90deg)', transformOrigin: '36px 36px' }}>
        {score != null ? `${score.toFixed(0)}` : '—'}
      </text>
    </svg>
  );
}

// ─── Zone Card ────────────────────────────────────────────────────────────────

function ZoneCard({ zone, onResolve }: { zone: ZoneDashboardEntry; onResolve: (id: string, action: 'accepted' | 'dismissed' | 'applied') => void }) {
  const [expanded, setExpanded] = useState(false);
  const s = zone.latest;
  const pendingRecs = zone.recommendations.filter((r) => r.status === 'pending');

  return (
    <div className={`rounded-2xl border bg-card shadow-sm overflow-hidden transition-all`}>
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border text-sm font-bold ${ZONE_COLORS[zone.zoneName] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
          {zone.zoneName}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{zone.label}</span>
            <span className="text-xs text-muted-foreground">{zone.minKm}–{zone.maxKm === 999 ? '∞' : zone.maxKm} km</span>
            {pendingRecs.length > 0 && (
              <span className="text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                {pendingRecs.length} Empfehlung{pendingRecs.length > 1 ? 'en' : ''}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Zuschlag: {euro(zone.surchargeEur)} · MOV: {euro(zone.minOrderEur)}
          </div>
        </div>
        <div className="flex-shrink-0">
          <MarginGauge score={s?.marginScore ?? null} zone={zone.zoneName} />
          <div className="text-center text-[10px] text-muted-foreground -mt-1">Margin</div>
        </div>
      </div>

      {/* KPI Row */}
      {s ? (
        <div className="grid grid-cols-4 gap-0 border-t divide-x text-center">
          {[
            { label: 'Bestellungen', value: s.orderCount },
            { label: 'Umsatz', value: euro(s.revenueEur) },
            { label: 'Pünktlich', value: s.onTimePct != null ? `${s.onTimePct.toFixed(0)}%` : '—' },
            { label: 'Storno', value: s.cancellationPct != null ? `${s.cancellationPct.toFixed(0)}%` : '—' },
          ].map((k) => (
            <div key={k.label} className="py-2 px-1">
              <div className="text-sm font-semibold">{k.value}</div>
              <div className="text-[10px] text-muted-foreground">{k.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t py-3 text-center text-xs text-muted-foreground">Noch keine Snapshot-Daten für heute</div>
      )}

      {/* Trend */}
      <div className="px-5 py-3 border-t">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">30-Tage-Trend (Umsatz)</div>
        <MiniTrendBar data={zone.trend30d} />
      </div>

      {/* Expand / Recommendations */}
      {pendingRecs.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-5 py-2.5 border-t text-sm font-medium text-matcha-700 hover:bg-matcha-50/50 transition-colors"
          >
            <span>Empfehlungen ({pendingRecs.length})</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div className="px-5 pb-4 space-y-2">
              {pendingRecs.map((rec) => (
                <div key={rec.id} className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyBadge(rec.urgency)} whitespace-nowrap`}>
                      {rec.urgency.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{recTypeLabel(rec.recType)}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{rec.reason}</div>
                      {(rec.suggestedSurcharge != null || rec.suggestedMov != null) && (
                        <div className="flex gap-3 mt-1 text-[11px] font-medium text-matcha-700">
                          {rec.suggestedSurcharge != null && <span>→ Zuschlag: {euro(rec.suggestedSurcharge)}</span>}
                          {rec.suggestedMov != null && <span>→ MOV: {euro(rec.suggestedMov)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => onResolve(rec.id, 'applied')}
                      className="flex-1 text-[11px] font-medium py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors flex items-center justify-center gap-1">
                      <CheckCircle size={11} /> Umsetzen
                    </button>
                    <button onClick={() => onResolve(rec.id, 'accepted')}
                      className="flex-1 text-[11px] font-medium py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex items-center justify-center gap-1">
                      <CheckCircle size={11} /> Bestätigt
                    </button>
                    <button onClick={() => onResolve(rec.id, 'dismissed')}
                      className="text-[11px] font-medium py-1 px-3 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                      <XCircle size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function ZoneRevenueOptimizerClient() {
  const [data, setData] = useState<ZoneRevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<'zones' | 'recs'>('zones');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/zone-revenue-optimizer');
      if (res.ok) setData(await res.json() as ZoneRevenueDashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/zone-revenue-optimizer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) await load();
    } finally {
      setActionLoading(false);
    }
  }, [load]);

  const resolveRec = useCallback(async (id: string, resolution: 'accepted' | 'dismissed' | 'applied') => {
    await post({ action: 'resolve', rec_id: id, resolution });
  }, [post]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-matcha-500 border-t-transparent" />
      </div>
    );
  }

  const d = data;
  if (!d) {
    return <div className="text-center py-16 text-muted-foreground">Daten konnten nicht geladen werden.</div>;
  }

  // All pending recommendations
  const allPendingRecs = d.zones.flatMap((z) => z.recommendations.filter((r) => r.status === 'pending'));
  const allRecs = d.zones.flatMap((z) => z.recommendations);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Zonen-Umsatz-Optimizer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rentabilität per Lieferzone · Empfehlungen für Zuschläge & MOV
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => post({ action: 'generate_recs' })} disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50">
            <Zap size={14} /> Empfehlungen
          </button>
          <button onClick={() => post({ action: 'snapshot' })} disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border bg-matcha-50 text-matcha-700 hover:bg-matcha-100 transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} /> Snapshot
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <DollarSign size={16} />, label: 'Umsatz Heute (Lieferung)', value: euro(d.totalRevenueToday), color: 'text-matcha-700' },
          { icon: <BarChart3 size={16} />, label: 'Bestellungen Heute', value: d.totalOrdersToday, color: 'text-blue-700' },
          { icon: <Target size={16} />, label: 'Beste Zone', value: d.bestZone ? `Zone ${d.bestZone}` : '—', color: 'text-emerald-700' },
          { icon: <AlertTriangle size={16} />, label: 'Offene Empfehlungen', value: d.pendingRecs, color: d.pendingRecs > 0 ? 'text-orange-600' : 'text-muted-foreground' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className={`flex items-center gap-1.5 mb-1 ${k.color}`}>{k.icon}<span className="text-xs font-medium">{k.label}</span></div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Zone summary chips */}
      <div className="flex flex-wrap gap-2">
        {d.zones.filter((z) => z.latest).map((z) => {
          const ms = z.latest!.marginScore;
          const good = ms != null && ms >= 70;
          const bad = ms != null && ms < 40;
          return (
            <span key={z.zoneName}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium
                ${bad ? 'bg-red-50 border-red-200 text-red-700' : good ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <MapPin size={11} />
              Zone {z.zoneName}
              {ms != null && (
                <>
                  {good ? <TrendingUp size={11} /> : bad ? <TrendingDown size={11} /> : <Minus size={11} />}
                  {ms.toFixed(0)}
                </>
              )}
            </span>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(['zones', 'recs'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${tab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'zones' ? `Zonen (${d.zones.length})` : `Alle Empfehlungen (${allPendingRecs.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Zones */}
      {tab === 'zones' && (
        <div className="grid md:grid-cols-2 gap-4">
          {d.zones.map((z) => (
            <ZoneCard key={z.zoneName} zone={z} onResolve={resolveRec} />
          ))}
        </div>
      )}

      {/* Tab: All Recommendations */}
      {tab === 'recs' && (
        <div className="space-y-3">
          {allRecs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Keine Empfehlungen vorhanden. Snapshot erstellen und Empfehlungen generieren.
            </div>
          )}
          {allRecs.map((rec) => (
            <div key={rec.id} className={`rounded-xl border p-4 ${rec.status !== 'pending' ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${urgencyBadge(rec.urgency)}`}>
                  {rec.urgency.toUpperCase()}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ZONE_COLORS[rec.zoneName] ?? 'bg-gray-100'}`}>
                      Zone {rec.zoneName}
                    </span>
                    <span className="text-sm font-medium">{recTypeLabel(rec.recType)}</span>
                    {rec.status !== 'pending' && (
                      <span className="text-[10px] text-muted-foreground">({rec.status})</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.reason}</p>
                  {(rec.suggestedSurcharge != null || rec.suggestedMov != null) && (
                    <div className="flex gap-3 mt-1 text-xs font-medium text-matcha-700">
                      {rec.suggestedSurcharge != null && <span>→ Zuschlag: {euro(rec.suggestedSurcharge)}</span>}
                      {rec.suggestedMov != null && <span>→ MOV: {euro(rec.suggestedMov)}</span>}
                    </div>
                  )}
                </div>
                {rec.status === 'pending' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => resolveRec(rec.id, 'applied')}
                      className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors" title="Umsetzen">
                      <CheckCircle size={14} />
                    </button>
                    <button onClick={() => resolveRec(rec.id, 'dismissed')}
                      className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title="Ablehnen">
                      <XCircle size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-right">
        Aktualisiert: {new Date(d.refreshedAt).toLocaleTimeString('de-DE')} · Auto-Refresh alle 5 Min
      </p>
    </div>
  );
}
