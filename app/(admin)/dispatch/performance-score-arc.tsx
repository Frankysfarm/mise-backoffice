'use client';

/**
 * DispatchPerformanceScoreArc — Phase 255
 *
 * Delivery Performance Score (0-100) als SVG-Arc-Gauge im Dispatch-Board.
 * Zeigt aktuellen Gesamt-Score + 4 Dimensionen (Pünktlichkeit / Zufriedenheit /
 * Auslastung / Marge) und eine kompakte 7-Tage Trend-Linie.
 *
 * Datenquelle: GET /api/delivery/admin/performance-score?action=dashboard
 *              GET /api/delivery/admin/performance-score?action=trend&days=7
 * Polling: alle 5 Minuten.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Loader2, RefreshCw, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScoreLatest {
  totalScore: number;
  grade: string;
  onTimeScore: number;
  satisfactionScore: number;
  utilizationScore: number;
  marginScore: number;
  date: string;
}

interface TrendPoint { date: string; totalScore: number }

interface DashboardData {
  latest: ScoreLatest | null;
  trend?: TrendPoint[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A+': return '#16a34a';
    case 'A':  return '#22c55e';
    case 'B':  return '#3b82f6';
    case 'C':  return '#f59e0b';
    case 'D':  return '#f97316';
    default:   return '#ef4444';
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A+': return 'bg-green-100 text-green-800';
    case 'A':  return 'bg-emerald-50 text-emerald-700';
    case 'B':  return 'bg-blue-50 text-blue-700';
    case 'C':  return 'bg-amber-50 text-amber-700';
    case 'D':  return 'bg-orange-50 text-orange-700';
    default:   return 'bg-red-50 text-red-700';
  }
}

// SVG Arc: score 0-100, 180° sweep (bottom semicircle)
function ArcGauge({ score, grade }: { score: number; grade: string }) {
  const R = 44;
  const cx = 56;
  const cy = 52;
  const circumference = Math.PI * R; // half circle
  const filled = circumference * (score / 100);
  const color = gradeColor(grade);

  // Arc path: left → right via bottom (180° arc)
  const startX = cx - R;
  const endX   = cx + R;
  const arcY   = cy;

  return (
    <svg viewBox="0 0 112 60" className="w-28 h-[60px]" aria-hidden>
      {/* Track */}
      <path
        d={`M ${startX} ${arcY} A ${R} ${R} 0 0 1 ${endX} ${arcY}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill — dasharray trick on a half-circle path */}
      <path
        d={`M ${startX} ${arcY} A ${R} ${R} 0 0 1 ${endX} ${arcY}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset="0"
      />
      {/* Score label */}
      <text x={cx} y={arcY - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill="currentColor">
        {score}
      </text>
      <text x={cx} y={arcY + 11} textAnchor="middle" fontSize="8" fill="#9ca3af">
        / 100
      </text>
    </svg>
  );
}

function DimBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.round((value / max) * 100)}%` }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums w-6 text-right">{Math.round(value)}</span>
    </div>
  );
}

function MiniTrend({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  const scores = points.map(p => p.totalScore);
  const min = Math.max(0, Math.min(...scores) - 5);
  const max = Math.min(100, Math.max(...scores) + 5);
  const range = max - min || 1;
  const W = 80;
  const H = 24;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * W;
    const y = H - ((s - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last = scores[scores.length - 1];
  const prev = scores[scores.length - 2];
  const trend = last > prev + 1 ? 'up' : last < prev - 1 ? 'down' : 'flat';

  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-6 shrink-0">
        <polyline points={pts} fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {trend === 'up'   && <TrendingUp  className="h-3 w-3 text-green-500" />}
      {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
      {trend === 'flat' && <Minus       className="h-3 w-3 text-muted-foreground" />}
      <span className="text-[10px] text-muted-foreground">7 Tage</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DispatchPerformanceScoreArc({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = locationId ? `&location_id=${locationId}` : '';
      const [d, t] = await Promise.all([
        fetch(`/api/delivery/admin/performance-score?action=dashboard${qs}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/delivery/admin/performance-score?action=trend&days=7${qs}`).then(r => r.ok ? r.json() : null),
      ]);
      if (d) setData(d);
      if (t?.trend) setTrend(t.trend);
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Performance-Score wird geladen…
      </Card>
    );
  }

  const latest = data?.latest;
  if (!latest) return null;

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold">Performance Score</span>
          <span className={cn('text-xs font-black rounded-full px-2 py-0.5', gradeBg(latest.grade))}>
            {latest.grade}
          </span>
        </div>
        <button onClick={load} className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted" aria-label="Aktualisieren">
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {/* Arc + dims */}
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <ArcGauge score={Math.round(latest.totalScore)} grade={latest.grade} />
          <MiniTrend points={trend} />
        </div>
        <div className="flex-1 space-y-1.5 pt-1">
          <DimBar label="Pünktlichkeit"   value={latest.onTimeScore}       max={35} color="bg-green-500" />
          <DimBar label="Zufriedenheit"   value={latest.satisfactionScore} max={30} color="bg-blue-500" />
          <DimBar label="Auslastung"      value={latest.utilizationScore}  max={20} color="bg-amber-500" />
          <DimBar label="Marge"           value={latest.marginScore}       max={15} color="bg-purple-500" />
        </div>
      </div>

      {/* Expand: recommendations */}
      {(data as any)?.recommendations?.length > 0 && (
        <div>
          <button
            onClick={() => setOpen(v => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {open ? '▲' : '▼'} Empfehlungen ({(data as any).recommendations.length})
          </button>
          {open && (
            <ul className="mt-2 space-y-1">
              {((data as any).recommendations as string[]).map((r, i) => (
                <li key={i} className="text-[11px] text-muted-foreground before:content-['•'] before:mr-1">{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
