'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, Award } from 'lucide-react';

/**
 * Phase 1917 — Bestellungs-Qualitäts-Index (Kitchen)
 *
 * Ø Qualitätsscore der letzten 20 Bestellungen basierend auf
 * Zubereitungszeit + Vollständigkeit; Alert wenn <70; Trend; useMemo; Collapsible.
 */

interface OrderItem {
  name?: string;
  quantity?: number;
  status?: string;
}

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  prep_started_at?: string;
  ready_at?: string;
  prep_time_minutes?: number;
  items?: OrderItem[];
  expected_items?: number;
}

interface QualitaetsEintrag {
  id: string;
  qualitaets_score: number;
  vorbereitungszeit_score: number;
  vollstaendigkeits_score: number;
}

const ZIEL_PREP_MIN = 15;
const LETZTEN_N = 20;

function prepZeitScore(prepMin: number): number {
  if (prepMin <= 0) return 70;
  if (prepMin <= ZIEL_PREP_MIN) return 100;
  if (prepMin <= ZIEL_PREP_MIN * 1.5) return 80;
  if (prepMin <= ZIEL_PREP_MIN * 2) return 60;
  return 40;
}

function vollstaendigkeitsScore(order: Order): number {
  const items = order.items ?? [];
  if (items.length === 0) return 80;
  const erledigt = items.filter((i) => i.status === 'done' || i.status === 'ready' || !i.status).length;
  return Math.round((erledigt / items.length) * 100);
}

export function KitchenPhase1917BestellungsQualitaetsIndex({ orders, className }: { orders: Order[]; className?: string }) {
  const [offen, setOffen] = useState(true);

  const { eintraege, index, trend, alert } = useMemo(() => {
    const abgeschlossen = orders
      .filter((o) => o.status === 'ready' || o.status === 'picked_up' || o.status === 'delivered')
      .slice(-LETZTEN_N);

    const liste: QualitaetsEintrag[] = abgeschlossen.map((o) => {
      let prepMin: number | null = null;
      if (o.prep_time_minutes != null) prepMin = o.prep_time_minutes;
      else if (o.prep_started_at && o.ready_at)
        prepMin = (new Date(o.ready_at).getTime() - new Date(o.prep_started_at).getTime()) / 60_000;
      else if (o.created_at && o.ready_at)
        prepMin = (new Date(o.ready_at).getTime() - new Date(o.created_at).getTime()) / 60_000;

      const vorbereitungszeit_score = prepMin != null && prepMin > 0 ? prepZeitScore(prepMin) : 70;
      const vollstaendigkeits_score = vollstaendigkeitsScore(o);
      const qualitaets_score = Math.round(vorbereitungszeit_score * 0.6 + vollstaendigkeits_score * 0.4);

      return { id: o.id, qualitaets_score, vorbereitungszeit_score, vollstaendigkeits_score };
    });

    const index = liste.length > 0
      ? Math.round(liste.reduce((s, e) => s + e.qualitaets_score, 0) / liste.length)
      : 0;

    const fruehe = liste.slice(0, Math.floor(liste.length / 2));
    const spaet = liste.slice(Math.floor(liste.length / 2));
    const frueheAvg = fruehe.length > 0 ? fruehe.reduce((s, e) => s + e.qualitaets_score, 0) / fruehe.length : index;
    const spaetAvg = spaet.length > 0 ? spaet.reduce((s, e) => s + e.qualitaets_score, 0) / spaet.length : index;
    const delta = Math.round(spaetAvg - frueheAvg);

    const trend = delta > 3 ? 'steigend' as const : delta < -3 ? 'fallend' as const : 'stabil' as const;
    const alert = index > 0 && index < 70;

    return { eintraege: liste, index, trend, alert };
  }, [orders]);

  const TrendIcon = trend === 'steigend' ? TrendingUp : trend === 'fallend' ? TrendingDown : Minus;
  const trendFarbe = trend === 'steigend' ? 'text-green-600 dark:text-green-400' : trend === 'fallend' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400';
  const indexFarbe = index >= 80 ? 'text-green-600 dark:text-green-400' : index >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const ampelRing = index >= 80 ? 'stroke-green-500' : index >= 70 ? 'stroke-amber-500' : 'stroke-red-500';

  const circumference = 2 * Math.PI * 26;
  const dashoffset = circumference * (1 - index / 100);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Award className={cn('h-4 w-4 shrink-0', indexFarbe)} />
        <span className="text-xs font-bold uppercase tracking-wider">Qualitäts-Index</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted flex items-center gap-1', indexFarbe)}>
          <TrendIcon className="h-3 w-3" />
          {index > 0 ? index : '–'}/100
        </span>
        {alert && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            Unter 70!
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {alert && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">Qualitäts-Index unter 70</p>
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                  Letzte {eintraege.length} Bestellungen unter Qualitätsschwelle — Zubereitungszeit prüfen!
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {/* Score-Ring */}
            {index > 0 && (
              <div className="relative shrink-0">
                <svg width="68" height="68" className="-rotate-90">
                  <circle cx="34" cy="34" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
                  <circle
                    cx="34" cy="34" r="26" fill="none" strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashoffset}
                    strokeLinecap="round"
                    className={ampelRing}
                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn('text-base font-black tabular-nums leading-none', indexFarbe)}>{index}</span>
                  <span className="text-[8px] text-muted-foreground">/100</span>
                </div>
              </div>
            )}

            {/* KPI-Breakdown */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Zubereitungszeit (60%)</span>
                <span className="text-xs font-black tabular-nums">
                  {eintraege.length > 0
                    ? Math.round(eintraege.reduce((s, e) => s + e.vorbereitungszeit_score, 0) / eintraege.length)
                    : '–'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Vollständigkeit (40%)</span>
                <span className="text-xs font-black tabular-nums">
                  {eintraege.length > 0
                    ? Math.round(eintraege.reduce((s, e) => s + e.vollstaendigkeits_score, 0) / eintraege.length)
                    : '–'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Bestellungen analysiert</span>
                <span className="text-xs font-black tabular-nums">{eintraege.length}</span>
              </div>
            </div>
          </div>

          {/* Trend */}
          <div className={cn('flex items-center gap-1.5 text-xs font-semibold', trendFarbe)}>
            <TrendIcon className="h-4 w-4" />
            <span>
              {trend === 'steigend' ? 'Qualität verbessert sich' : trend === 'fallend' ? 'Qualität nimmt ab' : 'Qualität stabil'}
            </span>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Letzte {LETZTEN_N} abgeschlossene Bestellungen · Ziel Prep: {ZIEL_PREP_MIN} Min · useMemo
          </p>
        </div>
      )}
    </div>
  );
}
