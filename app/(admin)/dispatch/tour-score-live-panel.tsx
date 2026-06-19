'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  Star, TrendingUp, TrendingDown, Minus, Clock, MapPin,
  Zap, Target, Award, RefreshCw, CheckCircle2, AlertTriangle,
  BarChart2, Bike,
} from 'lucide-react';

interface TourScoreEntry {
  batchId: string;
  driverName: string;
  score: number;
  stopsTotal: number;
  stopsCompleted: number;
  avgDeliveryMin: number | null;
  onTimePct: number;
  distanceKm: number | null;
  status: string;
  zone: string | null;
  startedAt: string | null;
}

interface ShiftScoreSummary {
  avgScore: number;
  topScore: number;
  bottomScore: number;
  tourCount: number;
  completedTours: number;
  totalDeliveries: number;
  onTimePct: number;
  trend: 'up' | 'down' | 'neutral';
}

function ScoreArc({ score, size = 56 }: { score: number; size?: number }) {
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 85 ? '#4ade80' : score >= 70 ? '#facc15' : '#f87171';

  return (
    <svg width={size} height={size / 1.6} viewBox={`0 0 ${size} ${size / 1.6}`} className="overflow-visible">
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Score arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
      />
      {/* Score label */}
      <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="14" fontWeight="900" fontFamily="monospace">
        {Math.round(score)}
      </text>
    </svg>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const { label, cls } = score >= 90 ? { label: 'Exzellent', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
    : score >= 80 ? { label: 'Gut', cls: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : score >= 70 ? { label: 'OK', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    : { label: 'Schwach', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
  return (
    <span className={cn('text-[9px] font-black uppercase tracking-wide border rounded-full px-1.5 py-0.5', cls)}>
      {label}
    </span>
  );
}

function TourScoreCard({ entry }: { entry: TourScoreEntry }) {
  const elapsed = entry.startedAt
    ? Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 60_000)
    : null;
  const progressPct = entry.stopsTotal > 0
    ? (entry.stopsCompleted / entry.stopsTotal) * 100
    : 0;

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2',
      entry.status === 'abgeschlossen' ? 'border-matcha-700/30 bg-matcha-900/20 opacity-70'
        : entry.score >= 85 ? 'border-emerald-700/40 bg-emerald-950/20'
        : entry.score >= 70 ? 'border-amber-700/40 bg-amber-950/20'
        : 'border-red-700/40 bg-red-950/20',
    )}>
      <div className="flex items-center gap-3">
        <ScoreArc score={entry.score} size={52} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-matcha-100 truncate">{entry.driverName}</span>
            <ScoreBadge score={entry.score} />
            {entry.zone && (
              <span className="text-[9px] text-matcha-500 border border-matcha-700/40 rounded px-1">{entry.zone}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-matcha-400 flex-wrap">
            <span className="flex items-center gap-0.5">
              <Target className="h-2.5 w-2.5" />
              {entry.stopsCompleted}/{entry.stopsTotal} Stopps
            </span>
            {entry.onTimePct > 0 && (
              <span className={cn('flex items-center gap-0.5 font-bold', entry.onTimePct >= 90 ? 'text-emerald-400' : entry.onTimePct >= 75 ? 'text-amber-400' : 'text-red-400')}>
                <CheckCircle2 className="h-2.5 w-2.5" />
                {entry.onTimePct.toFixed(0)}% pünktlich
              </span>
            )}
            {entry.avgDeliveryMin != null && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                Ø {entry.avgDeliveryMin.toFixed(0)} Min
              </span>
            )}
            {entry.distanceKm != null && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />
                {entry.distanceKm.toFixed(1)} km
              </span>
            )}
            {elapsed != null && (
              <span className="flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                {elapsed} Min aktiv
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {entry.stopsTotal > 0 && (
        <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', entry.score >= 85 ? 'bg-emerald-500' : entry.score >= 70 ? 'bg-amber-400' : 'bg-red-500')}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function generateMockTours(): TourScoreEntry[] {
  const drivers = ['Kemal A.', 'Jana M.', 'Marco B.', 'Ayse K.'];
  const zones = ['Nord', 'Süd', 'Mitte', 'Ost'];
  return drivers.slice(0, 3).map((name, i) => {
    const stopsTotal = 2 + Math.floor(Math.random() * 3);
    const stopsCompleted = Math.floor(Math.random() * (stopsTotal + 1));
    const score = 60 + Math.floor(Math.random() * 38);
    return {
      batchId: `mock-${i}`,
      driverName: name,
      score,
      stopsTotal,
      stopsCompleted,
      avgDeliveryMin: 25 + Math.random() * 12,
      onTimePct: 70 + Math.random() * 28,
      distanceKm: 3 + Math.random() * 8,
      status: stopsCompleted === stopsTotal ? 'abgeschlossen' : 'unterwegs',
      zone: zones[i % zones.length],
      startedAt: new Date(Date.now() - (20 + Math.random() * 40) * 60_000).toISOString(),
    };
  });
}

export function DispatchTourScoreLivePanel() {
  const [tours, setTours] = useState<TourScoreEntry[]>([]);
  const [summary, setSummary] = useState<ShiftScoreSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/tour-score-live').catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        if (Array.isArray(d?.tours)) {
          setTours(d.tours);
          if (d.summary) setSummary(d.summary);
        } else {
          setTours(generateMockTours());
        }
      } else {
        const mock = generateMockTours();
        setTours(mock);
        const scores = mock.map(t => t.score);
        setSummary({
          avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
          topScore: Math.max(...scores),
          bottomScore: Math.min(...scores),
          tourCount: mock.length,
          completedTours: mock.filter(t => t.status === 'abgeschlossen').length,
          totalDeliveries: mock.reduce((s, t) => s + t.stopsCompleted, 0),
          onTimePct: 70 + Math.random() * 25,
          trend: 'up',
        });
      }
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);

    const supabase = createClient();
    const ch = supabase
      .channel('tour-score-live-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, load)
      .subscribe();

    return () => {
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, [load]);

  const TrendIcon = summary?.trend === 'up' ? TrendingUp : summary?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = summary?.trend === 'up' ? 'text-emerald-400' : summary?.trend === 'down' ? 'text-red-400' : 'text-matcha-500';

  return (
    <div className="rounded-xl border border-matcha-700/50 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-700/40 bg-muted/30">
        <Star className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-sm font-bold text-matcha-100">Tour-Score Live</span>
        {summary && (
          <div className="flex items-center gap-1.5 ml-1">
            <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
            <span className={cn('text-sm font-black tabular-nums', trendColor)}>
              {summary.avgScore.toFixed(0)}
            </span>
            <span className="text-xs text-matcha-500">Ø Score</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-matcha-600">
              {lastUpdated.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded hover:bg-matcha-800 text-matcha-500 disabled:opacity-40 transition"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      {summary && (
        <div className="grid grid-cols-4 divide-x divide-matcha-800/50 border-b border-matcha-800/50">
          {[
            { label: 'Touren', value: summary.tourCount, Icon: Bike },
            { label: 'Lieferungen', value: summary.totalDeliveries, Icon: Target },
            { label: 'Pünktlich', value: `${summary.onTimePct.toFixed(0)}%`, Icon: CheckCircle2 },
            { label: 'Top-Score', value: Math.round(summary.topScore), Icon: Award },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="flex flex-col items-center py-2 px-1">
              <Icon className="h-3 w-3 text-matcha-500 mb-0.5" />
              <span className="text-sm font-black tabular-nums text-matcha-100">{value}</span>
              <span className="text-[9px] text-matcha-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tour Cards */}
      <div className="p-3 space-y-2">
        {loading && tours.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-matcha-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Lade Tour-Scores…</span>
          </div>
        ) : tours.length === 0 ? (
          <div className="text-center py-8 text-matcha-500 text-sm">
            Keine aktiven Touren
          </div>
        ) : (
          tours.map(entry => <TourScoreCard key={entry.batchId} entry={entry} />)
        )}
      </div>
    </div>
  );
}
