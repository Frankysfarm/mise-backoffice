'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, ChefHat, CheckCircle2, Clock, TrendingDown, TrendingUp, Zap } from 'lucide-react';

interface SchichtKpi {
  bestellungenGesamt: number;
  bestellungenFertig: number;
  avgPrepMin: number;
  punctualityPct: number;         // how many finished within target time
  longestOrderMin: number;
  fastestOrderMin: number;
  stornoquotePct: number;
  score: number;                   // 0-100 composite
  schichtStunden: number;
}

interface Props {
  locationId?: string | null;
  orders: Array<{
    status: string;
    bestellt_am: string | null;
    fertig_am: string | null;
    geschaetzte_zubereitung_min: number | null;
  }>;
}

function calcSchichtKpi(orders: Props['orders']): SchichtKpi {
  const fertig = orders.filter((o) => ['fertig', 'unterwegs', 'geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
  const storno = orders.filter((o) => o.status === 'storniert');

  const prepTimes = fertig
    .filter((o) => o.bestellt_am && o.fertig_am)
    .map((o) => (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000);

  const avgPrepMin = prepTimes.length > 0 ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : 0;

  const targets = fertig.filter((o) => o.geschaetzte_zubereitung_min && o.bestellt_am && o.fertig_am);
  const punctual = targets.filter((o) => {
    const actual = (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000;
    return actual <= (o.geschaetzte_zubereitung_min! * 1.2);
  });
  const punctualityPct = targets.length > 0 ? (punctual.length / targets.length) * 100 : 100;

  const stornoquotePct = orders.length > 0 ? (storno.length / orders.length) * 100 : 0;

  const schichtStart = orders.reduce((earliest, o) => {
    if (!o.bestellt_am) return earliest;
    const t = new Date(o.bestellt_am).getTime();
    return t < earliest ? t : earliest;
  }, Date.now());
  const schichtStunden = (Date.now() - schichtStart) / 3_600_000;

  const score = Math.round(
    punctualityPct * 0.4 +
    Math.max(0, 100 - avgPrepMin * 2.5) * 0.3 +
    Math.max(0, 100 - stornoquotePct * 10) * 0.3,
  );

  return {
    bestellungenGesamt: orders.length,
    bestellungenFertig: fertig.length,
    avgPrepMin: Math.round(avgPrepMin * 10) / 10,
    punctualityPct: Math.round(punctualityPct),
    longestOrderMin: prepTimes.length > 0 ? Math.round(Math.max(...prepTimes)) : 0,
    fastestOrderMin: prepTimes.length > 0 ? Math.round(Math.min(...prepTimes)) : 0,
    stornoquotePct: Math.round(stornoquotePct * 10) / 10,
    score: Math.min(100, Math.max(0, score)),
    schichtStunden: Math.round(schichtStunden * 10) / 10,
  };
}

function scoreGrade(s: number): { label: string; color: string; bg: string } {
  if (s >= 90) return { label: 'Exzellent', color: 'text-matcha-700', bg: 'bg-matcha-100' };
  if (s >= 75) return { label: 'Gut', color: 'text-matcha-600', bg: 'bg-matcha-50' };
  if (s >= 60) return { label: 'OK', color: 'text-amber-700', bg: 'bg-amber-50' };
  return { label: 'Verbesserung nötig', color: 'text-red-700', bg: 'bg-red-50' };
}

export function KitchenSchichtKpiZusammenfassung({ orders, locationId }: Props) {
  const kpi = calcSchichtKpi(orders);
  const grade = scoreGrade(kpi.score);

  if (orders.length === 0) return null;

  const scoreDeg = (kpi.score / 100) * 180;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
            <Award className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Schicht-KPI Zusammenfassung</div>
            <div className="text-[10px] text-stone-400">{kpi.schichtStunden > 0 ? `${kpi.schichtStunden} Std aktiv` : 'Aktuelle Schicht'}</div>
          </div>
        </div>
        <div className={cn('rounded-full px-3 py-1 text-xs font-bold', grade.bg, grade.color)}>
          {grade.label}
        </div>
      </div>

      <div className="p-4">
        {/* Score gauge */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex h-20 w-20 items-center justify-center shrink-0">
            {/* Semi-circle background */}
            <svg className="absolute inset-0" viewBox="0 0 80 80" fill="none">
              <path
                d="M 10 50 A 30 30 0 0 1 70 50"
                stroke="#e7e5e4"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 30 30 0 0 1 70 50"
                stroke={kpi.score >= 75 ? '#4d7c35' : kpi.score >= 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(kpi.score / 100) * 94.2} 94.2`}
              />
            </svg>
            <div className="flex flex-col items-center mt-4">
              <span className={cn('text-2xl font-black tabular-nums leading-none', grade.color)}>
                {kpi.score}
              </span>
              <span className="text-[9px] text-stone-400">Score</span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            {[
              {
                icon: ChefHat,
                label: 'Ø Zubereitungszeit',
                value: `${kpi.avgPrepMin} Min`,
                color: kpi.avgPrepMin > 25 ? 'text-red-600' : kpi.avgPrepMin > 18 ? 'text-amber-600' : 'text-matcha-700',
              },
              {
                icon: CheckCircle2,
                label: 'Pünktlichkeit',
                value: `${kpi.punctualityPct}%`,
                color: kpi.punctualityPct >= 80 ? 'text-matcha-700' : kpi.punctualityPct >= 60 ? 'text-amber-600' : 'text-red-600',
              },
              {
                icon: Clock,
                label: 'Schnellste',
                value: kpi.fastestOrderMin > 0 ? `${kpi.fastestOrderMin} Min` : '-',
                color: 'text-matcha-600',
              },
              {
                icon: Zap,
                label: 'Bestellungen',
                value: `${kpi.bestellungenFertig}/${kpi.bestellungenGesamt}`,
                color: 'text-stone-700',
              },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-lg bg-stone-50 p-2">
                <Icon className={cn('h-3 w-3 mb-1', color)} />
                <div className={cn('text-sm font-black tabular-nums', color)}>{value}</div>
                <div className="text-[9px] text-stone-400 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Storno warning */}
        {kpi.stornoquotePct > 5 && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <span className="text-xs text-red-700">
              Stornoquote {kpi.stornoquotePct}% — über Ziel (5%)
            </span>
          </div>
        )}

        {/* Positive summary */}
        {kpi.score >= 80 && (
          <div className="rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
            <span className="text-xs text-matcha-700">
              Starke Schicht — {kpi.bestellungenFertig} Bestellungen in {kpi.avgPrepMin} Min Ø
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
