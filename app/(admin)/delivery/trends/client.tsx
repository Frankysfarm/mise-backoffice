'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DayStats {
  orders: number;
  delivered: number;
  avg_score: number | null;
}

interface TrendsData {
  today: DayStats;
  yesterday: DayStats;
  delta_orders: number;
  delta_delivered: number;
  _fallback?: boolean;
}

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="h-4 w-4 text-matcha-700" />;
  if (delta < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function TrendCard({
  label, today, yesterday, delta, unit = '',
}: {
  label: string;
  today: number | null;
  yesterday: number | null;
  delta: number;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-end gap-3">
        <div className="font-display text-3xl font-black">{today !== null ? `${today}${unit}` : '—'}</div>
        <div className={cn('flex items-center gap-1 mb-1 text-sm font-bold',
          delta > 0 ? 'text-matcha-700' : delta < 0 ? 'text-red-600' : 'text-muted-foreground')}>
          <TrendIcon delta={delta} />
          {delta > 0 ? `+${delta}` : delta}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Gestern: <span className="font-semibold">{yesterday !== null ? `${yesterday}${unit}` : '—'}</span>
      </div>
    </div>
  );
}

export function TrendsClient({ locationId }: { locationId: string }) {
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/trends?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.today) setTrends(d as TrendsData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Trends…</div>}

      {!loading && trends && (
        <>
          {trends._fallback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              Trend-Funktion noch nicht verfügbar (DB-Migration 006 ausstehend). Zeige Nullwerte.
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            <TrendCard
              label="Bestellungen heute"
              today={trends.today.orders}
              yesterday={trends.yesterday.orders}
              delta={trends.delta_orders}
            />
            <TrendCard
              label="Zugestellt heute"
              today={trends.today.delivered}
              yesterday={trends.yesterday.delivered}
              delta={trends.delta_delivered}
            />
            <TrendCard
              label="Ø Bewertung"
              today={trends.today.avg_score !== null ? Math.round(trends.today.avg_score * 10) / 10 : null}
              yesterday={trends.yesterday.avg_score !== null ? Math.round(trends.yesterday.avg_score * 10) / 10 : null}
              delta={trends.today.avg_score !== null && trends.yesterday.avg_score !== null
                ? Math.round((trends.today.avg_score - trends.yesterday.avg_score) * 10) / 10
                : 0}
            />
          </div>

          {/* Comparison table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b font-display font-bold text-sm">Vergleich Heute vs. Gestern</div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Kennzahl</th>
                  <th className="text-right px-4 py-2">Heute</th>
                  <th className="text-right px-4 py-2">Gestern</th>
                  <th className="text-right px-4 py-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Bestellungen', today: trends.today.orders, yesterday: trends.yesterday.orders, delta: trends.delta_orders },
                  { label: 'Zugestellt', today: trends.today.delivered, yesterday: trends.yesterday.delivered, delta: trends.delta_delivered },
                ].map(row => (
                  <tr key={row.label} className="border-t border-border">
                    <td className="px-4 py-2.5 text-sm font-medium">{row.label}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-right font-bold">{row.today}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-right text-muted-foreground">{row.yesterday}</td>
                    <td className={cn('px-4 py-2.5 text-sm tabular-nums text-right font-bold',
                      row.delta > 0 ? 'text-matcha-700' : row.delta < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
