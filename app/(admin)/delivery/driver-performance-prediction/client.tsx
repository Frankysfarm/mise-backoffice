'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, RefreshCw, TrendingUp, TrendingDown, Minus,
  Star, AlertTriangle, CheckCircle2, Clock, BarChart2,
  ChevronUp, ChevronDown, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PredictionDashboard,
  PredictionWithDriver,
  PerformanceTier,
} from '@/lib/delivery/driver-performance-prediction';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtPct(val: number) {
  return `${Math.round(val * 100)} %`;
}

function tierLabel(tier: PerformanceTier) {
  return { top: 'Top', good: 'Gut', average: 'Mittel', at_risk: 'Risiko' }[tier];
}

function tierColor(tier: PerformanceTier) {
  return {
    top:     'bg-emerald-100 text-emerald-700',
    good:    'bg-blue-100 text-blue-700',
    average: 'bg-amber-100 text-amber-700',
    at_risk: 'bg-red-100 text-red-700',
  }[tier];
}

function tierDot(tier: PerformanceTier) {
  return {
    top:     'bg-emerald-500',
    good:    'bg-blue-500',
    average: 'bg-amber-400',
    at_risk: 'bg-red-500',
  }[tier];
}

function confColor(score: number) {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 45) return 'text-amber-500';
  return 'text-red-500';
}

function ConfBar({ score }: { score: number }) {
  const fill =
    score >= 70 ? 'bg-emerald-500' :
    score >= 45 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', fill)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn('text-xs font-bold w-7 text-right', confColor(score))}>{score}</span>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 flex gap-3 items-start">
      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold mt-0.5 leading-none">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-slate-400" />;
}

function computeTrend(onTime: number): 'up' | 'down' | 'flat' {
  if (onTime >= 0.82) return 'up';
  if (onTime < 0.65) return 'down';
  return 'flat';
}

// ─── Driver Row ───────────────────────────────────────────────────────────────

function DriverRow({ pred, idx }: { pred: PredictionWithDriver; idx: number }) {
  const [open, setOpen] = useState(false);
  const fw = pred.featureWeights;
  const trend = computeTrend(pred.predictedOnTimeRate);

  return (
    <>
      <tr
        className={cn(
          'border-b hover:bg-slate-50/60 cursor-pointer transition',
          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30',
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-4 py-3 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full shrink-0', tierDot(pred.performanceTier))} />
            {pred.driverName ?? '—'}
          </div>
          {pred.vehicleType && (
            <div className="text-[10px] text-muted-foreground mt-0.5 ml-4">{pred.vehicleType}</div>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full', tierColor(pred.performanceTier))}>
            {tierLabel(pred.performanceTier)}
          </span>
        </td>
        <td className="px-4 py-3 text-center text-sm font-bold">
          {pred.predictedTours.toFixed(1)}
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1 text-sm font-bold">
            <TrendIcon trend={trend} />
            {fmtPct(pred.predictedOnTimeRate)}
          </div>
        </td>
        <td className="px-4 py-3 text-center text-sm">
          {pred.predictedAvgMin !== null ? `${pred.predictedAvgMin.toFixed(0)} min` : '—'}
        </td>
        <td className="px-4 py-3">
          <ConfBar score={pred.confidenceScore} />
        </td>
        <td className="px-4 py-3 text-center text-sm text-muted-foreground">
          {pred.accuracyScore !== null
            ? <span className={cn('font-bold', pred.accuracyScore >= 80 ? 'text-emerald-600' : pred.accuracyScore >= 60 ? 'text-amber-500' : 'text-red-500')}>{pred.accuracyScore.toFixed(0)}%</span>
            : <span className="text-slate-300">—</span>
          }
        </td>
        <td className="px-4 py-3 text-center text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4 mx-auto" /> : <ChevronDown className="h-4 w-4 mx-auto" />}
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50/60 border-b">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-white border p-3">
                <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Basis-Touren (Ø)</div>
                <div className="text-xl font-display font-bold">{fw.base_tours_pct.toFixed(1)}</div>
                <div className="text-muted-foreground mt-0.5">30-Tage-Schnitt</div>
              </div>
              <div className="rounded-lg bg-white border p-3">
                <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Trend (7 Tage)</div>
                <div className={cn('text-xl font-display font-bold', fw.trend_factor > 0 ? 'text-emerald-600' : fw.trend_factor < 0 ? 'text-red-500' : 'text-slate-500')}>
                  {fw.trend_factor > 0 ? '+' : ''}{(fw.trend_factor * 100).toFixed(1)} %
                </div>
                <div className="text-muted-foreground mt-0.5">Touren-Slope</div>
              </div>
              <div className="rounded-lg bg-white border p-3">
                <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Momentum (3d)</div>
                <div className={cn('text-xl font-display font-bold', fw.momentum > 0 ? 'text-emerald-600' : fw.momentum < 0 ? 'text-red-500' : 'text-slate-500')}>
                  {fw.momentum > 0 ? '+' : ''}{(fw.momentum * 100).toFixed(1)} %
                </div>
                <div className="text-muted-foreground mt-0.5">vs. Vorperiode</div>
              </div>
              <div className="rounded-lg bg-white border p-3">
                <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Snapshots</div>
                <div className="text-xl font-display font-bold">{fw.snapshots_used}</div>
                <div className="text-muted-foreground mt-0.5">Tage Datenbasis</div>
              </div>
              {fw.reliability_score !== null && (
                <div className="rounded-lg bg-white border p-3">
                  <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Zuverlässigkeit</div>
                  <div className={cn('text-xl font-display font-bold', fw.reliability_score >= 70 ? 'text-emerald-600' : fw.reliability_score >= 40 ? 'text-amber-500' : 'text-red-500')}>
                    {fw.reliability_score}
                  </div>
                  <div className="text-muted-foreground mt-0.5">Score 0–100</div>
                </div>
              )}
              {fw.wellbeing_score !== null && (
                <div className="rounded-lg bg-white border p-3">
                  <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Wellbeing</div>
                  <div className={cn('text-xl font-display font-bold', fw.wellbeing_score >= 70 ? 'text-emerald-600' : fw.wellbeing_score >= 40 ? 'text-amber-500' : 'text-red-500')}>
                    {fw.wellbeing_score.toFixed(0)}
                  </div>
                  <div className="text-muted-foreground mt-0.5">Composite 0–100</div>
                </div>
              )}
              {fw.route_proficiency_avg !== null && (
                <div className="rounded-lg bg-white border p-3">
                  <div className="font-bold text-muted-foreground uppercase tracking-wide mb-1">Route Proficiency</div>
                  <div className={cn('text-xl font-display font-bold', fw.route_proficiency_avg >= 70 ? 'text-emerald-600' : fw.route_proficiency_avg >= 40 ? 'text-amber-500' : 'text-red-500')}>
                    {fw.route_proficiency_avg.toFixed(0)}
                  </div>
                  <div className="text-muted-foreground mt-0.5">PLZ-Ø (Phase 231)</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function DriverPredictionClient() {
  const [data, setData] = useState<PredictionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [tab, setTab] = useState<'all' | 'top' | 'at_risk'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-performance-prediction?action=dashboard');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const handleRebuild = async () => {
    setRebuilding(true);
    await fetch('/api/delivery/admin/driver-performance-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rebuild' }),
    });
    await load();
    setRebuilding(false);
  };

  const displayed = (data?.predictions ?? []).filter((p) => {
    if (tab === 'top') return p.performanceTier === 'top';
    if (tab === 'at_risk') return p.performanceTier === 'at_risk';
    return true;
  });

  const s = data?.summary;
  const acc = data?.accuracy7d;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Fahrer-Performance-Prognose</h1>
            <p className="text-sm text-muted-foreground">
              Multi-Faktor-ML · Trend + Momentum + Zuverlässigkeit + Wellbeing + Route-Learning
            </p>
          </div>
        </div>
        <button
          onClick={handleRebuild}
          disabled={rebuilding || loading}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={cn('h-4 w-4', rebuilding && 'animate-spin')} />
          {rebuilding ? 'Berechne…' : 'Neu berechnen'}
        </button>
      </div>

      {/* KPI Cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Fahrer prognostiziert"
            value={s.total_drivers}
            sub={`Ø Konfidenz: ${s.avg_confidence}%`}
            icon={<BarChart2 className="h-4 w-4" />}
            color="bg-matcha-100 text-matcha-800"
          />
          <KpiCard
            label="Top-Fahrer heute"
            value={s.top_tier}
            sub={`${s.good_tier} Gut / ${s.average_tier} Mittel`}
            icon={<Star className="h-4 w-4" />}
            color="bg-emerald-100 text-emerald-700"
          />
          <KpiCard
            label="Risiko-Fahrer"
            value={s.at_risk_tier}
            sub="Eingriff empfohlen"
            icon={<AlertTriangle className="h-4 w-4" />}
            color={s.at_risk_tier > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}
          />
          <KpiCard
            label="Prognost. Touren heute"
            value={s.predicted_total_tours.toFixed(0)}
            sub="Alle aktiven Fahrer"
            icon={<Zap className="h-4 w-4" />}
            color="bg-blue-100 text-blue-700"
          />
        </div>
      )}

      {/* Accuracy Stats */}
      {acc && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-base font-bold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-matcha-600" />
            Prognose-Genauigkeit (letzte 7 Tage)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Abgeglichene Prognosen</div>
              <div className="font-display text-xl font-bold mt-0.5">{acc.settled_count}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Ø Genauigkeit</div>
              <div className={cn('font-display text-xl font-bold mt-0.5', acc.avg_accuracy_score >= 80 ? 'text-emerald-600' : acc.avg_accuracy_score >= 60 ? 'text-amber-500' : 'text-red-500')}>
                {acc.avg_accuracy_score.toFixed(1)} %
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Ø Fehler</div>
              <div className="font-display text-xl font-bold mt-0.5">{acc.avg_error_pct.toFixed(1)} %</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Perfekte Prognosen (≥90%)</div>
              <div className="font-display text-xl font-bold mt-0.5 text-emerald-600">{acc.perfect_predictions}</div>
            </div>
          </div>
        </div>
      )}

      {/* 7-Tage Tier-Verteilung */}
      {data?.tierDistribution && data.tierDistribution.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-base font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-matcha-600" />
            Tier-Verteilung (7 Tage)
          </h2>
          <div className="flex gap-1 h-20 items-end">
            {data.tierDistribution.map((pt) => {
              const total = pt.top + pt.good + pt.average + pt.at_risk || 1;
              return (
                <div key={pt.date} className="flex-1 flex flex-col-reverse gap-px" title={pt.date}>
                  {pt.at_risk > 0 && <div className="bg-red-400 rounded-sm" style={{ height: `${(pt.at_risk / total) * 100}%` }} />}
                  {pt.average > 0 && <div className="bg-amber-400 rounded-sm" style={{ height: `${(pt.average / total) * 100}%` }} />}
                  {pt.good > 0 && <div className="bg-blue-400 rounded-sm" style={{ height: `${(pt.good / total) * 100}%` }} />}
                  {pt.top > 0 && <div className="bg-emerald-500 rounded-sm" style={{ height: `${(pt.top / total) * 100}%` }} />}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Top</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />Gut</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Mittel</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />Risiko</span>
          </div>
        </div>
      )}

      {/* Predictions Table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Tab Bar */}
        <div className="flex border-b">
          {([
            ['all',     `Alle (${s?.total_drivers ?? 0})`],
            ['top',     `Top (${s?.top_tier ?? 0})`],
            ['at_risk', `Risiko (${s?.at_risk_tier ?? 0})`],
          ] as [typeof tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-5 py-3 text-sm font-semibold border-b-2 transition',
                tab === key
                  ? 'border-matcha-600 text-matcha-700'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center px-4 text-xs text-muted-foreground gap-1">
            <Clock className="h-3 w-3" />
            5-Min Auto-Refresh
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Lade Prognosen…</div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Keine Prognosen vorhanden — klicke auf &quot;Neu berechnen&quot;
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs font-bold uppercase tracking-wide text-muted-foreground bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Fahrer</th>
                <th className="px-4 py-3 text-center">Tier</th>
                <th className="px-4 py-3 text-center">Touren</th>
                <th className="px-4 py-3 text-center">Pünktlichkeit</th>
                <th className="px-4 py-3 text-center">Ø Zeit</th>
                <th className="px-4 py-3 text-left">Konfidenz</th>
                <th className="px-4 py-3 text-center">Genauigkeit</th>
                <th className="px-4 py-3 text-center w-8" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((pred, idx) => (
                <DriverRow key={pred.id} pred={pred} idx={idx} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
