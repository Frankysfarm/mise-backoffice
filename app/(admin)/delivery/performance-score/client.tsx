'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PerformanceDashboard, PerformanceScoreSnapshot, PerformanceTrendRow } from '@/lib/delivery/performance-score';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, Star, Users, TrendingUp, Award } from 'lucide-react';

const REFRESH_INTERVAL = 300; // 5 min

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(g: string) {
  if (g === 'A+') return 'text-emerald-300';
  if (g === 'A')  return 'text-emerald-400';
  if (g === 'B+') return 'text-lime-400';
  if (g === 'B')  return 'text-lime-500';
  if (g === 'C')  return 'text-amber-400';
  if (g === 'D')  return 'text-orange-400';
  return 'text-red-400';
}

function gradeBg(g: string) {
  if (g === 'A+') return 'bg-emerald-500/10 border-emerald-500/30';
  if (g === 'A')  return 'bg-emerald-500/10 border-emerald-500/20';
  if (g === 'B+') return 'bg-lime-500/10 border-lime-500/20';
  if (g === 'B')  return 'bg-lime-500/10 border-lime-500/20';
  if (g === 'C')  return 'bg-amber-500/10 border-amber-500/20';
  if (g === 'D')  return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-400';
  if (s >= 65) return 'text-lime-400';
  if (s >= 50) return 'text-amber-400';
  if (s >= 35) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(s: number) {
  if (s >= 80) return 'bg-emerald-500';
  if (s >= 65) return 'bg-lime-400';
  if (s >= 50) return 'bg-amber-400';
  if (s >= 35) return 'bg-orange-400';
  return 'bg-red-500';
}

function fmt(v: number | null | undefined, dec = 1, suffix = '') {
  if (v == null) return <span className="text-gray-500">—</span>;
  return <>{v.toFixed(dec)}{suffix}</>;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <span className="text-gray-500 text-xs">–</span>;
  const w = 140; const h = 36;
  const min = Math.min(...data); const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Score Arc ────────────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const R = 52; const CX = 64; const CY = 64;
  const startAngle = -210; const sweep = 240;
  const pct = Math.min(1, score / 100);
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcPt = (deg: number) => ({
    x: CX + R * Math.cos(toRad(deg)),
    y: CY + R * Math.sin(toRad(deg)),
  });
  const s = arcPt(startAngle);
  const e = arcPt(startAngle + sweep);
  const a = arcPt(startAngle + sweep * pct);
  const la = sweep * pct > 180 ? 1 : 0;
  const trackD = `M ${s.x} ${s.y} A ${R} ${R} 0 1 1 ${e.x} ${e.y}`;
  const fillD  = pct < 0.001 ? '' : `M ${s.x} ${s.y} A ${R} ${R} 0 ${la} 1 ${a.x} ${a.y}`;
  const color  = score >= 80 ? '#10b981' : score >= 65 ? '#a3e635' : score >= 50 ? '#f59e0b' : score >= 35 ? '#f97316' : '#ef4444';

  return (
    <svg width={128} height={128} className="mx-auto">
      <path d={trackD} fill="none" stroke="#1f2937" strokeWidth={10} strokeLinecap="round" />
      {fillD && <path d={fillD} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />}
      <text x={CX} y={CY - 4} textAnchor="middle" className="fill-white font-bold" fontSize={22}>{score}</text>
      <text x={CX} y={CY + 14} textAnchor="middle" className="fill-gray-400" fontSize={10}>/ 100</text>
    </svg>
  );
}

// ─── Dimension Bar ────────────────────────────────────────────────────────────

function DimBar({ label, score, weight, raw }: { label: string; score: number; weight: string; raw: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300 font-medium">{label}</span>
        <span className="text-gray-500">{weight}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreBg(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-bold w-10 text-right ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-gray-500 w-16 text-right">{raw}</span>
      </div>
    </div>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: PerformanceTrendRow[] }) {
  if (trend.length === 0) {
    return <div className="text-center text-gray-500 py-8 text-sm">Noch keine historischen Daten</div>;
  }
  const w = 600; const h = 120; const PAD = 8;
  const scores = trend.map(r => r.overallScore);
  const min = Math.max(0, Math.min(...scores) - 5);
  const max = Math.min(100, Math.max(...scores) + 5);
  const range = max - min || 1;
  const n = trend.length;

  const pts = trend.map((r, i) => ({
    x: PAD + (i / (n - 1)) * (w - PAD * 2),
    y: h - PAD - ((r.overallScore - min) / range) * (h - PAD * 2),
    r,
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`} className="min-w-[400px]">
        {/* grid lines */}
        {[0, 25, 50, 75, 100].map(v => {
          const y = h - PAD - ((v - min) / range) * (h - PAD * 2);
          if (y < 0 || y > h) return null;
          return (
            <g key={v}>
              <line x1={PAD} y1={y} x2={w - PAD} y2={y} stroke="#1f2937" strokeDasharray="4,4" />
              <text x={0} y={y + 3} fontSize={8} className="fill-gray-600">{v}</text>
            </g>
          );
        })}
        {/* fill area */}
        <polygon
          points={[`${pts[0].x},${h - PAD}`, ...pts.map(p => `${p.x},${p.y}`), `${pts[pts.length - 1].x},${h - PAD}`].join(' ')}
          fill="#10b981"
          fillOpacity={0.08}
        />
        <polyline points={polyline} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* dots + labels */}
        {pts.filter((_, i) => i % Math.max(1, Math.floor(n / 10)) === 0 || i === n - 1).map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={p.r.overallScore >= 80 ? '#10b981' : p.r.overallScore >= 50 ? '#f59e0b' : '#ef4444'} />
            <text x={p.x} y={h + 14} fontSize={7} textAnchor="middle" className="fill-gray-500">
              {p.r.scoreDate.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PerformanceScoreClient() {
  const [data, setData]         = useState<PerformanceDashboard | null>(null);
  const [loading, setLoading]   = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [tab, setTab]           = useState<'overview' | 'trend' | 'ranking'>('overview');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/performance-score');
      if (res.ok) setData(await res.json() as PerformanceDashboard);
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(() => setCountdown(c => {
      if (c <= 1) { void load(); return REFRESH_INTERVAL; }
      return c - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [load]);

  async function triggerSnapshot() {
    setSnapping(true);
    try {
      await fetch('/api/delivery/admin/performance-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapping(false);
    }
  }

  const latest = data?.latest ?? null;
  const trend  = data?.trend  ?? [];

  const trendScores = trend.map(t => t.overallScore);
  const delta = trendScores.length >= 2
    ? trendScores[trendScores.length - 1] - trendScores[trendScores.length - 2]
    : null;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">
          Auto-Refresh in {countdown}s
          {latest?.scoreDate && ` · Letzter Snapshot: ${latest.scoreDate}`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button size="sm" onClick={() => void triggerSnapshot()} disabled={snapping}>
            {snapping ? 'Läuft…' : 'Snapshot jetzt'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Clock className="h-3 w-3 text-matcha-700" /> Pünktlichkeit
          </div>
          <div className={`text-2xl font-bold font-display ${scoreColor(latest?.onTimeScore ?? 0)}`}>
            {latest ? latest.onTimeScore : '—'}
          </div>
          <div className="text-xs text-gray-500">{fmt(latest?.onTimeRatePct, 1, '% pünktlich')}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Star className="h-3 w-3 text-matcha-700" /> Zufriedenheit
          </div>
          <div className={`text-2xl font-bold font-display ${scoreColor(latest?.satisfactionScore ?? 0)}`}>
            {latest ? latest.satisfactionScore : '—'}
          </div>
          <div className="text-xs text-gray-500">{fmt(latest?.avgRating, 2, '/5 ★')}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Users className="h-3 w-3 text-matcha-700" /> Auslastung
          </div>
          <div className={`text-2xl font-bold font-display ${scoreColor(latest?.utilizationScore ?? 0)}`}>
            {latest ? latest.utilizationScore : '—'}
          </div>
          <div className="text-xs text-gray-500">{fmt(latest?.avgUtilizationPct, 1, '% Auslastung')}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-matcha-700" /> Marge
          </div>
          <div className={`text-2xl font-bold font-display ${scoreColor(latest?.marginScore ?? 0)}`}>
            {latest ? latest.marginScore : '—'}
          </div>
          <div className="text-xs text-gray-500">{fmt(latest?.avgMarginPct, 1, '% Marge')}</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-2">
        {(['overview', 'trend', 'ranking'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              tab === t ? 'bg-matcha-100 text-matcha-900' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'overview' ? 'Übersicht' : t === 'trend' ? '30-Tage-Trend' : 'Ranking'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Score Arc + grade */}
          <Card className="p-6 flex flex-col items-center gap-4">
            {latest ? (
              <>
                <ScoreArc score={latest.overallScore} />
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-2xl font-bold ${gradeBg(latest.grade)} ${gradeColor(latest.grade)}`}>
                  <Award className="h-5 w-5" />
                  Note {latest.grade}
                </div>
                {delta !== null && (
                  <p className={`text-sm font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs. Vortag
                  </p>
                )}
                <p className="text-xs text-gray-500">{latest.totalDeliveries} Lieferungen · {latest.activeDrivers} Fahrer aktiv</p>
              </>
            ) : (
              <div className="text-center text-gray-500 py-12">
                {loading ? 'Lade…' : 'Noch kein Snapshot für heute. Klicke "Snapshot jetzt".'}
              </div>
            )}
          </Card>

          {/* Dimensions + Recommendations */}
          <div className="space-y-4">
            {latest && (
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-300">Dimensionen</h3>
                <DimBar
                  label="Pünktlichkeit"
                  score={latest.onTimeScore}
                  weight="35%"
                  raw={`${latest.onTimeRatePct?.toFixed(1) ?? '—'}%`}
                />
                <DimBar
                  label="Zufriedenheit"
                  score={latest.satisfactionScore}
                  weight="30%"
                  raw={`${latest.avgRating?.toFixed(2) ?? '—'} ★`}
                />
                <DimBar
                  label="Auslastung"
                  score={latest.utilizationScore}
                  weight="20%"
                  raw={`${latest.avgUtilizationPct?.toFixed(1) ?? '—'}%`}
                />
                <DimBar
                  label="Marge"
                  score={latest.marginScore}
                  weight="15%"
                  raw={`${latest.avgMarginPct?.toFixed(1) ?? '—'}%`}
                />
                {latest.weakestDimension && (
                  <p className="text-xs text-amber-400 pt-1">
                    ⚠ Schwächste Dimension: <strong>{latest.weakestDimension}</strong>
                  </p>
                )}
              </Card>
            )}

            {/* Recommendations */}
            {(data?.recommendations ?? []).length > 0 && (
              <Card className="p-5 space-y-3">
                <h3 className="text-sm font-bold text-gray-300">Empfehlungen</h3>
                <ul className="space-y-2">
                  {(data?.recommendations ?? []).map((r, i) => (
                    <li key={i} className="text-xs text-gray-400 flex gap-2">
                      <span className="text-matcha-500 shrink-0">→</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Trend Tab */}
      {tab === 'trend' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-300">30-Tage Gesamt-Score Verlauf</h3>
            {trendScores.length > 0 && (
              <div className="flex items-center gap-3">
                <Sparkline data={trendScores} />
                <span className={`text-sm font-bold ${scoreColor(trendScores[trendScores.length - 1] ?? 0)}`}>
                  Ø {Math.round(trendScores.reduce((a, b) => a + b, 0) / trendScores.length)}
                </span>
              </div>
            )}
          </div>
          <TrendChart trend={trend} />

          {trend.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-border">
                    <th className="py-1.5 text-left">Datum</th>
                    <th className="py-1.5 text-right">Gesamt</th>
                    <th className="py-1.5 text-right">Note</th>
                    <th className="py-1.5 text-right">Pünktl.</th>
                    <th className="py-1.5 text-right">Zufried.</th>
                    <th className="py-1.5 text-right">Auslast.</th>
                    <th className="py-1.5 text-right">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {[...trend].reverse().slice(0, 30).map(r => (
                    <tr key={r.scoreDate} className="border-b border-border/50 hover:bg-card/50">
                      <td className="py-1.5 text-gray-400">{r.scoreDate}</td>
                      <td className={`py-1.5 text-right font-bold ${scoreColor(r.overallScore)}`}>{r.overallScore}</td>
                      <td className={`py-1.5 text-right font-bold ${gradeColor(r.grade)}`}>{r.grade}</td>
                      <td className="py-1.5 text-right text-gray-400">{r.onTimeScore}</td>
                      <td className="py-1.5 text-right text-gray-400">{r.satScore}</td>
                      <td className="py-1.5 text-right text-gray-400">{r.utilScore}</td>
                      <td className="py-1.5 text-right text-gray-400">{r.marginScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Ranking Tab */}
      {tab === 'ranking' && (
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-300">Standort-Ranking (Gesamt-Score)</h3>
          {(data?.ranking ?? []).length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">Noch keine Daten für andere Standorte</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-border">
                    <th className="py-1.5 text-left">Rang</th>
                    <th className="py-1.5 text-left">Standort</th>
                    <th className="py-1.5 text-right">Score</th>
                    <th className="py-1.5 text-right">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.ranking ?? []).map(r => (
                    <tr key={r.locationId} className="border-b border-border/50 hover:bg-card/50">
                      <td className="py-1.5 font-bold text-gray-400">
                        {r.liveRank === 1 ? '🥇' : r.liveRank === 2 ? '🥈' : r.liveRank === 3 ? '🥉' : `#${r.liveRank}`}
                      </td>
                      <td className="py-1.5 text-gray-300">{r.locationName}</td>
                      <td className={`py-1.5 text-right font-bold ${scoreColor(r.overallScore)}`}>{r.overallScore}</td>
                      <td className={`py-1.5 text-right font-bold ${gradeColor(r.grade)}`}>{r.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
