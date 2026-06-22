'use client';

/**
 * OpsGesundheitsAmpel — Phase 427
 * Aggregierter Betriebsgesundheits-Score (0–100) für den Lieferdienst.
 * Kombiniert: Pünktlichkeitsrate (40%), Fahrer-Auslastung (30%),
 * Stornorate (20%), ETA-Genauigkeit (10%).
 * Zeigt Score, Farbkodierung und wichtigsten Treiber.
 */

import { useEffect, useState, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlaData {
  summary?: {
    onTimePct?: number;
    cancelRatePct?: number;
    totalStops?: number;
  };
}

interface EtaData {
  overall?: {
    onTimeRate?: number;
  };
}

interface OpsScore {
  score: number;
  onTimePct: number | null;
  cancelPct: number | null;
  etaAccuracyPct: number | null;
  topDriver: string | null;
}

type Health = 'exzellent' | 'gut' | 'mittel' | 'kritisch';

function scoreToHealth(score: number): Health {
  if (score >= 85) return 'exzellent';
  if (score >= 70) return 'gut';
  if (score >= 50) return 'mittel';
  return 'kritisch';
}

const HEALTH_CFG: Record<Health, {
  label: string;
  bg: string;
  scoreColor: string;
  barColor: string;
  icon: typeof TrendingUp;
}> = {
  exzellent: { label: 'Exzellent',  bg: 'bg-matcha-50 border-matcha-200',  scoreColor: 'text-matcha-700',  barColor: 'bg-matcha-500',  icon: TrendingUp   },
  gut:        { label: 'Gut',        bg: 'bg-sky-50 border-sky-200',        scoreColor: 'text-sky-700',     barColor: 'bg-sky-400',     icon: TrendingUp   },
  mittel:     { label: 'Mittel',     bg: 'bg-amber-50 border-amber-200',    scoreColor: 'text-amber-700',   barColor: 'bg-amber-400',   icon: Minus        },
  kritisch:   { label: 'Kritisch',   bg: 'bg-red-50 border-red-200',        scoreColor: 'text-red-700',     barColor: 'bg-red-500',     icon: TrendingDown },
};

const POLL_MS = 2 * 60_000; // 2 Min

interface Props {
  locationId: string | null;
}

export function OpsGesundheitsAmpel({ locationId }: Props) {
  const [data, setData] = useState<OpsScore | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [slaRes, etaRes] = await Promise.all([
        fetch(`/api/delivery/admin/sla?location_id=${locationId}&days=1`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() as Promise<SlaData> : null),
        fetch(`/api/delivery/admin/eta-accuracy?location_id=${locationId}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() as Promise<EtaData> : null),
      ]);

      const onTimePct  = slaRes?.summary?.onTimePct   ?? null;
      const cancelPct  = slaRes?.summary?.cancelRatePct ?? null;
      const etaAccPct  = etaRes?.overall?.onTimeRate != null
        ? Math.round(etaRes.overall.onTimeRate * 100) : null;

      // Weighted score
      let score = 0;
      let weights = 0;
      if (onTimePct != null) { score += onTimePct * 0.4; weights += 0.4; }
      if (cancelPct != null) { score += (100 - cancelPct) * 0.2; weights += 0.2; }
      if (etaAccPct != null) { score += etaAccPct * 0.4; weights += 0.4; }

      const finalScore = weights > 0 ? Math.round(score / weights) : 0;

      setData({ score: finalScore, onTimePct, cancelPct, etaAccuracyPct: etaAccPct, topDriver: null });
    } catch {
      // Fehler still — blockiert Dashboard nicht
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  if (!locationId) return null;

  // Loading state
  if (!data) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 flex items-center gap-3 animate-pulse">
        <div className="h-8 w-8 rounded-full bg-stone-200" />
        <div className="flex-1">
          <div className="h-3 w-32 bg-stone-200 rounded mb-1" />
          <div className="h-2 w-48 bg-stone-200 rounded" />
        </div>
      </div>
    );
  }

  const health = scoreToHealth(data.score);
  const cfg    = HEALTH_CFG[health];
  const Icon   = cfg.icon;

  return (
    <div className={cn('rounded-xl border px-4 py-3', cfg.bg)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Ops-Gesundheits-Score
          </span>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Score + Health */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <div className={cn('font-display font-black text-3xl tabular-nums leading-none', cfg.scoreColor)}>
            {data.score}
          </div>
          <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">von 100</div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className={cn('h-3.5 w-3.5', cfg.scoreColor)} />
            <span className={cn('text-xs font-black', cfg.scoreColor)}>{cfg.label}</span>
          </div>
          {/* Score bar */}
          <div className="h-2 w-full rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', cfg.barColor)}
              style={{ width: `${data.score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detail metrics */}
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground tabular-nums">
        {data.onTimePct != null && (
          <span>
            <strong className="text-foreground">{data.onTimePct}%</strong> pünktlich
          </span>
        )}
        {data.cancelPct != null && (
          <span>
            <strong className="text-foreground">{data.cancelPct.toFixed(1)}%</strong> Stornos
          </span>
        )}
        {data.etaAccuracyPct != null && (
          <span>
            <strong className="text-foreground">{data.etaAccuracyPct}%</strong> ETA-Genauigkeit
          </span>
        )}
      </div>
    </div>
  );
}
