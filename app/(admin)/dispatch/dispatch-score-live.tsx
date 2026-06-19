'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  Star, Zap, Clock, MapPin, Route, TrendingUp, TrendingDown, Minus,
  Award, Activity, Target,
} from 'lucide-react';

interface ScoreEntry {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  kundeAdresse: string | null;
  zone: string | null;
  betrag: number;
  fertigSec: number; // seconds waiting since fertig_am
  score: number | null;
  scoreFactors?: {
    f_distance?: number;
    f_load?: number;
    f_zone?: number;
    f_prep_time?: number;
    decision?: string | null;
  } | null;
}

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 80 ? 'text-emerald-600' :
    pct >= 60 ? 'text-amber-600' :
    pct >= 40 ? 'text-orange-600' :
    'text-red-600';
  const bg =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-amber-500' :
    pct >= 40 ? 'bg-orange-500' :
    'bg-red-500';
  const label =
    pct >= 80 ? 'Hoch' :
    pct >= 60 ? 'Mittel' :
    pct >= 40 ? 'Niedrig' :
    'Krit.';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('text-2xl font-black tabular-nums', color)}>{Math.round(pct)}</div>
      <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={cn('h-full rounded-full', bg)} style={{ width: `${pct}%` }} />
      </div>
      <div className={cn('text-[9px] font-bold uppercase tracking-wide', color)}>{label}</div>
    </div>
  );
}

function WaitTimePill({ sec }: { sec: number }) {
  const min = Math.floor(sec / 60);
  const isLong = min >= 10;
  const isMed = min >= 5;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
      isLong ? 'bg-red-100 text-red-700 animate-pulse' :
      isMed ? 'bg-amber-100 text-amber-700' :
      'bg-gray-100 text-gray-600',
    )}>
      <Clock size={8} />
      {min > 0 ? `${min} Min` : `${sec}s`}
    </span>
  );
}

function FactorBar({ label, value }: { label: string; value: number | undefined }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, value * 100));
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-gray-500 w-10 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[8px] text-gray-500 tabular-nums w-5 text-right">{Math.round(pct)}</span>
    </div>
  );
}

function ScoreCard({ entry }: { entry: ScoreEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-xl border bg-white transition-all cursor-pointer hover:shadow-sm',
        entry.score != null && entry.score >= 80 ? 'border-emerald-200' :
        entry.score != null && entry.score >= 60 ? 'border-amber-200' :
        entry.score != null && entry.score >= 40 ? 'border-orange-200' :
        entry.score != null ? 'border-red-200' :
        'border-gray-200',
      )}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Score gauge */}
        <div className="w-14 shrink-0">
          {entry.score != null ? (
            <ScoreGauge score={entry.score} />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="text-lg font-black text-gray-400">–</div>
              <div className="text-[9px] text-gray-400">Kein Score</div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-gray-500 font-mono">#{entry.bestellnummer}</span>
            {entry.zone && (
              <span className="text-[9px] font-bold bg-blue-50 text-blue-700 rounded-full px-1.5 py-0.5">
                Zone {entry.zone}
              </span>
            )}
            <WaitTimePill sec={entry.fertigSec} />
          </div>
          <div className="text-sm font-bold text-gray-900 truncate mt-0.5">{entry.kundeName}</div>
          {entry.kundeAdresse && (
            <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-gray-500">
              <MapPin size={8} className="shrink-0" />
              <span className="truncate">{entry.kundeAdresse}</span>
            </div>
          )}
          <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
            {euro(entry.betrag)}
          </div>
          {entry.scoreFactors?.decision && (
            <div className="mt-1 text-[9px] text-blue-600 font-medium italic truncate">
              {entry.scoreFactors.decision}
            </div>
          )}
        </div>
      </div>

      {/* Expanded factor bars */}
      {expanded && entry.scoreFactors && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-1">
          <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
            <Activity size={8} /> Score-Faktoren
          </div>
          <FactorBar label="Distanz" value={entry.scoreFactors.f_distance} />
          <FactorBar label="Auslastung" value={entry.scoreFactors.f_load} />
          <FactorBar label="Zone" value={entry.scoreFactors.f_zone} />
          <FactorBar label="Prep-Zeit" value={entry.scoreFactors.f_prep_time} />
        </div>
      )}
    </div>
  );
}

export function DispatchScoreLivePanel({
  orders,
}: {
  orders: {
    id: string;
    bestellnummer: string;
    status: string;
    kunde_name: string;
    kunde_adresse: string | null;
    gesamtbetrag: number;
    fertig_am: string | null;
    dispatch_score: number | null;
    delivery_zone: string | null;
  }[];
}) {
  const [scores, setScores] = useState<Map<string, ScoreEntry['scoreFactors']>>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const readyOrders = orders.filter((o) => o.status === 'fertig');
  if (readyOrders.length === 0) return null;

  const entries: ScoreEntry[] = readyOrders.map((o) => ({
    orderId: o.id,
    bestellnummer: o.bestellnummer,
    kundeName: o.kunde_name,
    kundeAdresse: o.kunde_adresse,
    zone: o.delivery_zone,
    betrag: o.gesamtbetrag,
    fertigSec: o.fertig_am ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 1000) : 0,
    score: o.dispatch_score,
    scoreFactors: scores.get(o.id) ?? null,
  })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  async function loadScore(orderId: string) {
    if (scores.has(orderId) || loadingId === orderId) return;
    setLoadingId(orderId);
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/score`);
      if (!res.ok) return;
      const data = await res.json();
      setScores((prev) => new Map(prev).set(orderId, data.score ?? null));
    } catch {} finally {
      setLoadingId(null);
    }
  }

  const avgScore = entries.filter((e) => e.score != null).reduce((s, e) => s + (e.score ?? 0), 0) /
    Math.max(1, entries.filter((e) => e.score != null).length);

  const highScore = entries.filter((e) => (e.score ?? 0) >= 80).length;
  const lowScore  = entries.filter((e) => (e.score ?? 0) < 40 && e.score != null).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-blue-600" />
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-800">
            Dispatch-Score Live
          </span>
          <span className="text-[9px] font-bold text-blue-500 bg-blue-100 rounded-full px-1.5 py-0.5">
            {readyOrders.length} bereit
          </span>
        </div>
        <div className="flex items-center gap-2">
          {highScore > 0 && (
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
              <Star size={8} /> {highScore} Top
            </span>
          )}
          {lowScore > 0 && (
            <span className="text-[9px] font-bold text-red-700 bg-red-100 rounded-full px-1.5 py-0.5 animate-pulse">
              {lowScore} krit.
            </span>
          )}
          {avgScore > 0 && (
            <span className="text-[9px] font-bold text-gray-600 tabular-nums">
              Ø {Math.round(avgScore)}
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {entries.map((entry) => (
          <div key={entry.orderId} onClick={() => loadScore(entry.orderId)}>
            <ScoreCard entry={entry} />
          </div>
        ))}
      </div>

      {/* Score distribution bar */}
      {entries.length > 1 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1 h-1.5 rounded-full overflow-hidden">
            {entries.map((e) => {
              const pct = Math.max(2, 100 / entries.length);
              const color =
                (e.score ?? 0) >= 80 ? 'bg-emerald-500' :
                (e.score ?? 0) >= 60 ? 'bg-amber-500' :
                (e.score ?? 0) >= 40 ? 'bg-orange-500' :
                e.score != null ? 'bg-red-500' : 'bg-gray-300';
              return <div key={e.orderId} className={cn('h-full', color)} style={{ flex: 1 }} />;
            })}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[8px] text-gray-400">Bester: {Math.round(entries[0]?.score ?? 0)}</span>
            <span className="text-[8px] text-gray-400">Schlechtester: {Math.round(entries.at(-1)?.score ?? 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
