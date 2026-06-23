'use client';

/**
 * DispatchFahrerWochenScore — Phase 440
 * 7-Tage Score-Matrix je Fahrer: Pünktlichkeit, Touren, Ø-Score.
 * Zeigt horizontale Heatmap-Balken pro Tag, sortiert nach Gesamt-Score.
 * Daten aus /api/delivery/admin/fahrer-wochen-score (Fallback: Mock).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Bike, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface DayScore {
  date: string;
  label: string;
  score: number | null;
  deliveries: number;
  onTimePct: number | null;
}

interface DriverRow {
  driverId: string;
  name: string;
  days: DayScore[];
  avgScore: number;
  totalDeliveries: number;
  trend: 'up' | 'down' | 'flat';
}

function scoreBg(score: number | null): string {
  if (score == null) return 'bg-stone-100';
  if (score >= 85) return 'bg-matcha-500';
  if (score >= 70) return 'bg-amber-400';
  if (score >= 55) return 'bg-orange-400';
  return 'bg-red-400';
}

function scoreText(score: number | null): string {
  if (score == null) return '—';
  return `${Math.round(score)}`;
}

function buildMockData(): DriverRow[] {
  const names = ['Lars K.', 'Mehmet A.', 'Julia S.', 'Tom B.', 'Sina R.'];
  const today = new Date();
  const days: string[] = [];
  const dayLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
    dayLabels.push(d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' }));
  }

  return names.map((name, ni) => {
    const baseScore = 60 + ni * 7 + Math.random() * 10;
    const dayScores: DayScore[] = days.map((date, di) => {
      const worked = Math.random() > 0.25;
      const score = worked ? Math.min(100, baseScore + (Math.random() - 0.5) * 20) : null;
      return {
        date,
        label: dayLabels[di],
        score,
        deliveries: worked ? Math.floor(Math.random() * 15 + 5) : 0,
        onTimePct: score != null ? Math.min(100, score + (Math.random() - 0.5) * 15) : null,
      };
    });
    const worked = dayScores.filter(d => d.score != null);
    const avgScore = worked.length > 0
      ? worked.reduce((s, d) => s + (d.score ?? 0), 0) / worked.length
      : 0;
    const totalDeliveries = dayScores.reduce((s, d) => s + d.deliveries, 0);
    const recent = dayScores.slice(-3).filter(d => d.score != null).map(d => d.score ?? 0);
    const older = dayScores.slice(0, 4).filter(d => d.score != null).map(d => d.score ?? 0);
    const avgRecent = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : avgScore;
    const avgOlder = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avgScore;
    const trend: DriverRow['trend'] =
      avgRecent - avgOlder > 4 ? 'up' : avgOlder - avgRecent > 4 ? 'down' : 'flat';

    return { driverId: `driver-${ni}`, name, days: dayScores, avgScore, totalDeliveries, trend };
  }).sort((a, b) => b.avgScore - a.avgScore);
}

export function DispatchFahrerWochenScore({ locationId }: { locationId?: string | null }) {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    setLoading(true);
    const url = locationId
      ? `/api/delivery/admin/fahrer-wochen-score?location_id=${locationId}`
      : null;
    if (!url) {
      setRows(buildMockData());
      setLoading(false);
      return;
    }
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.rows?.length) {
          setRows(d.rows);
        } else {
          setRows(buildMockData());
        }
      })
      .catch(() => setRows(buildMockData()))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  if (!loading && rows.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Fahrer 7-Tage Score-Matrix
        </span>
        <button
          onClick={load}
          className="p-1 hover:bg-muted/40 rounded transition"
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
        </button>
        <button onClick={() => setOpen(v => !v)} className="p-1 hover:bg-muted/40 rounded">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      {open && (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Fahrer</th>
                  {rows[0]?.days.map(d => (
                    <th key={d.date} className="px-1 py-2 text-center font-semibold text-muted-foreground whitespace-nowrap">
                      {d.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Ø</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Lief.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(row => (
                  <tr key={row.driverId} className="hover:bg-muted/20 transition">
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{row.name}</span>
                        {row.trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-600" />}
                        {row.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                        {row.trend === 'flat' && <Minus className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </td>
                    {row.days.map(d => (
                      <td key={d.date} className="px-1 py-2 text-center">
                        <div
                          className={cn(
                            'inline-flex items-center justify-center w-8 h-6 rounded font-bold text-[10px] text-white',
                            scoreBg(d.score),
                          )}
                          title={d.score != null ? `Score: ${Math.round(d.score)} · ${d.deliveries} Lief.` : 'Kein Dienst'}
                        >
                          {d.score != null ? scoreText(d.score) : '·'}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        'font-black tabular-nums',
                        row.avgScore >= 85 ? 'text-matcha-700' : row.avgScore >= 70 ? 'text-amber-700' : 'text-red-600',
                      )}>
                        {Math.round(row.avgScore)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold tabular-nums text-foreground">
                      {row.totalDeliveries}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center gap-3 px-4 py-2 border-t bg-muted/10 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-matcha-500 inline-block" /> ≥85</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> 70–84</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> 55–69</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> &lt;55</span>
            <span className="ml-auto italic">Mock-Daten wenn kein API-Endpunkt</span>
          </div>
        </div>
      )}
    </div>
  );
}
