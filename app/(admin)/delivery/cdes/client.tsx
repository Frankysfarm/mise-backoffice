'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Star, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  RefreshCw, ShieldCheck, Clock, Truck, Bell, Zap, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface CdesStats {
  locationId: string;
  totalScored: number;
  avgScore: number;
  avgEtaScore: number;
  avgNotificationScore: number;
  avgDriverScore: number;
  avgAttemptScore: number;
  excellentCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  recoveriesTriggered: number;
  failedAttemptsTotal: number;
  lastComputedAt: string | null;
}

interface DayTrend {
  date: string;
  scoredCount: number;
  avgScore: number;
  excellentCount: number;
  poorCount: number;
  recoveriesCount: number;
}

interface LowScoreOrder {
  orderId: string;
  score: number;
  etaAccuracyScore: number;
  notificationScore: number;
  driverQualityScore: number;
  attemptScore: number;
  actualDeliveryMin: number | null;
  estimatedDeliveryMin: number | null;
  hadFailedAttempt: boolean;
  driverReliabilityTier: string | null;
  recoveryTriggered: boolean;
  recoveryCreditId: string | null;
  computedAt: string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function tierColor(score: number) {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-blue-600 bg-blue-50';
  if (score >= 40) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function tierLabel(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Gut';
  if (score >= 40) return 'Okay';
  return 'Kritisch';
}

function scoreBar(score: number, max: number) {
  const pct = max === 0 ? 0 : Math.round((score / max) * 100);
  let color = 'bg-green-500';
  const ratio = score / max;
  if (ratio < 0.4) color = 'bg-red-500';
  else if (ratio < 0.67) color = 'bg-amber-500';
  else if (ratio < 0.9) color = 'bg-blue-500';
  return { pct, color };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', tierColor(score))}>
      {score}
    </span>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function CdesClient({ locationId }: { locationId: string }) {
  const [stats, setStats] = useState<CdesStats | null>(null);
  const [trend, setTrend] = useState<DayTrend[]>([]);
  const [lowScores, setLowScores] = useState<LowScoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [days, setDays] = useState(14);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/cdes?location_id=${locationId}&days=${days}`,
      );
      if (!res.ok) return;
      const json = await res.json() as {
        stats: CdesStats | null;
        trend: DayTrend[];
        lowScores: LowScoreOrder[];
      };
      setStats(json.stats);
      setTrend(json.trend ?? []);
      setLowScores(json.lowScores ?? []);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId, days]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 5 * 60 * 1000); // 5-Min-Refresh
    return () => clearInterval(iv);
  }, [load]);

  async function triggerCompute() {
    setComputing(true);
    try {
      await fetch(`/api/delivery/admin/cdes?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch' }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  }

  // ── Trend-Chart ─────────────────────────────────────────────────────────────
  const maxTrendScore = 100;
  const chartH = 80;

  function TrendChart() {
    if (trend.length === 0) return (
      <div className="flex items-center justify-center h-20 text-xs text-gray-400">
        Noch keine Trend-Daten
      </div>
    );
    return (
      <div className="flex items-end gap-1 h-20">
        {trend.map((d) => {
          const h = Math.round((d.avgScore / maxTrendScore) * chartH);
          let barColor = 'bg-green-500';
          if (d.avgScore < 40) barColor = 'bg-red-400';
          else if (d.avgScore < 60) barColor = 'bg-amber-400';
          else if (d.avgScore < 80) barColor = 'bg-blue-400';
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              <div
                className={cn('w-full rounded-t transition-all', barColor)}
                style={{ height: `${h}px` }}
              />
              <span className="text-[9px] text-gray-400">{fmtDate(d.date)}</span>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                {d.date}: Ø {d.avgScore} ({d.scoredCount} Bestellungen)
                {d.poorCount > 0 && ` · ${d.poorCount}× kritisch`}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Komponenten-Balken ──────────────────────────────────────────────────────
  function ComponentBar({
    label,
    icon: Icon,
    score,
    max,
  }: {
    label: string;
    icon: React.ElementType;
    score: number;
    max: number;
  }) {
    const { pct, color } = scoreBar(score, max);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-gray-600">
            <Icon size={12} />
            {label}
          </span>
          <span className="font-semibold text-gray-800">{score}/{max}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Lade CDES-Daten…
      </div>
    );
  }

  const noData = !stats || stats.totalScored === 0;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border transition-colors',
                days === d
                  ? 'bg-matcha-600 text-white border-matcha-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-matcha-400',
              )}
            >
              {d} Tage
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[11px] text-gray-400">
              Aktualisiert {fmtTime(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={() => void triggerCompute()}
            disabled={computing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RotateCcw size={12} className={cn(computing && 'animate-spin')} />
            Scores berechnen
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {noData ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Star size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Noch keine Scores vorhanden</p>
          <p className="text-xs text-gray-400 mt-1">
            Klicke &quot;Scores berechnen&quot; um CDES für abgeschlossene Lieferungen zu erstellen.
          </p>
        </div>
      ) : (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Gesamt-Score */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Ø CDES</span>
                <Star size={14} className="text-amber-400" />
              </div>
              <div className={cn(
                'text-3xl font-bold',
                stats!.avgScore >= 80 ? 'text-green-600' :
                stats!.avgScore >= 60 ? 'text-blue-600' :
                stats!.avgScore >= 40 ? 'text-amber-600' : 'text-red-600',
              )}>
                {stats!.avgScore}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {tierLabel(stats!.avgScore)} · {stats!.totalScored} Bestellungen
              </div>
            </div>

            {/* Excellent / Good */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Excellent / Gut</span>
                <CheckCircle2 size={14} className="text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {stats!.excellentCount + stats!.goodCount}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {stats!.totalScored > 0
                  ? `${Math.round(((stats!.excellentCount + stats!.goodCount) / stats!.totalScored) * 100)}%`
                  : '–'} der Bestellungen ≥60
              </div>
            </div>

            {/* Kritisch */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Kritisch (&lt;40)</span>
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-600">{stats!.poorCount}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {stats!.recoveriesTriggered} Recovery-Gutschriften ausgestellt
              </div>
            </div>

            {/* Fehlversuche */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">Fehlversuche</span>
                <Truck size={14} className="text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-orange-600">{stats!.failedAttemptsTotal}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Bestellungen mit gescheiterter Zustellung
              </div>
            </div>
          </div>

          {/* Score-Verteilung + Trend */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Verteilung */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Score-Verteilung</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Excellent (80–100)', count: stats!.excellentCount, color: 'bg-green-500' },
                  { label: 'Gut (60–79)',         count: stats!.goodCount,     color: 'bg-blue-500'  },
                  { label: 'Okay (40–59)',         count: stats!.fairCount,     color: 'bg-amber-400' },
                  { label: 'Kritisch (0–39)',      count: stats!.poorCount,     color: 'bg-red-500'   },
                ].map(({ label, count, color }) => {
                  const pct = stats!.totalScored > 0
                    ? Math.round((count / stats!.totalScored) * 100)
                    : 0;
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{label}</span>
                        <span className="font-medium">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trend-Chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Ø Score — letzte {days} Tage
              </h3>
              <TrendChart />
              <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />
                  ≥80
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" />
                  60–79
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />
                  40–59
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />
                  &lt;40
                </span>
              </div>
            </div>
          </div>

          {/* Komponenten-Scores */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Score-Komponenten (Ø)</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <ComponentBar label="ETA-Genauigkeit"       icon={Clock}       score={stats!.avgEtaScore}          max={30} />
              <ComponentBar label="Benachrichtigungen"    icon={Bell}        score={stats!.avgNotificationScore} max={20} />
              <ComponentBar label="Fahrer-Verlässlichkeit" icon={ShieldCheck} score={stats!.avgDriverScore}       max={25} />
              <ComponentBar label="Zustellversuch"         icon={Zap}         score={stats!.avgAttemptScore}      max={25} />
            </div>
          </div>

          {/* Low-Score-Orders */}
          {lowScores.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  Kritische Bestellungen (Score &lt; 60)
                </h3>
                <span className="text-xs text-gray-400">{lowScores.length} Einträge</span>
              </div>
              <div className="divide-y divide-gray-50">
                {lowScores.map((o) => (
                  <div key={o.orderId} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                    {/* Score-Badge */}
                    <div className="flex-shrink-0">
                      <ScoreBadge score={o.score} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-500 truncate">
                          {o.orderId.slice(0, 8)}…
                        </span>
                        {o.hadFailedAttempt && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full">
                            Fehlversuch
                          </span>
                        )}
                        {o.recoveryTriggered && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full flex items-center gap-0.5">
                            <CheckCircle2 size={9} />
                            Recovery
                          </span>
                        )}
                        {o.driverReliabilityTier && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full',
                            o.driverReliabilityTier === 'critical'
                              ? 'bg-red-50 text-red-600'
                              : o.driverReliabilityTier === 'medium'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-600',
                          )}>
                            Fahrer: {o.driverReliabilityTier}
                          </span>
                        )}
                      </div>
                      {/* Komponenten-Mini-Scores */}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <Clock size={10} />
                          ETA {o.etaAccuracyScore}/30
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Bell size={10} />
                          Push {o.notificationScore}/20
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ShieldCheck size={10} />
                          Fahrer {o.driverQualityScore}/25
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Zap size={10} />
                          Versuch {o.attemptScore}/25
                        </span>
                      </div>
                      {/* Lieferzeit */}
                      {(o.actualDeliveryMin !== null || o.estimatedDeliveryMin !== null) && (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {o.estimatedDeliveryMin !== null && (
                            <span>Versprochen: {o.estimatedDeliveryMin} Min</span>
                          )}
                          {o.actualDeliveryMin !== null && (
                            <span className={cn(
                              'ml-2',
                              o.actualDeliveryMin > (o.estimatedDeliveryMin ?? 0) ? 'text-red-500' : 'text-green-600',
                            )}>
                              Tatsächlich: {o.actualDeliveryMin} Min
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Zeitstempel */}
                    <div className="flex-shrink-0 text-[11px] text-gray-400">
                      {fmtDate(o.computedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
