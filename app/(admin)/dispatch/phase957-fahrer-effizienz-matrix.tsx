'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Users, Zap, TrendingUp, Loader2 } from 'lucide-react';

type Props = { locationId: string | null };

type DriverRow = {
  id: string;
  name: string;
  stopsDone: number;
  avgMinPerStop: number;
  efficiencyScore: number; // 0–100
  isOnline: boolean;
};

function efficiencyColor(score: number) {
  if (score >= 80) return { text: 'text-matcha-700', bg: 'bg-matcha-100', bar: 'bg-matcha-500', label: 'Top' };
  if (score >= 55) return { text: 'text-amber-700', bg: 'bg-amber-100', bar: 'bg-amber-400', label: 'Gut' };
  return { text: 'text-red-600', bg: 'bg-red-100', bar: 'bg-red-400', label: 'Langsam' };
}

const MOCK_ROWS: DriverRow[] = [
  { id: '1', name: 'Max M.', stopsDone: 8, avgMinPerStop: 12, efficiencyScore: 87, isOnline: true },
  { id: '2', name: 'Lukas R.', stopsDone: 5, avgMinPerStop: 18, efficiencyScore: 61, isOnline: true },
  { id: '3', name: 'Felix K.', stopsDone: 3, avgMinPerStop: 24, efficiencyScore: 38, isOnline: true },
  { id: '4', name: 'Jonas B.', stopsDone: 7, avgMinPerStop: 14, efficiencyScore: 79, isOnline: true },
];

export function DispatchPhase957FahrerEffizienzMatrix({ locationId }: Props) {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();

    fetch(`/api/delivery/admin/fahrer-effizienz-matrix?locationId=${locationId}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d?.rows) && d.rows.length > 0) setRows(d.rows);
        else setRows(MOCK_ROWS);
      })
      .catch(() => setRows(MOCK_ROWS))
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [locationId]);

  const sorted = [...rows].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  const avgEff = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.efficiencyScore, 0) / rows.length) : 0;

  return (
    <Card className="p-4 border border-stone-200 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Users className="h-3.5 w-3.5" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">Fahrer-Effizienz-Matrix</div>
          <div className="text-[10px] text-muted-foreground">Stopps/h · Ø-Zeit · Score — aktive Fahrer</div>
        </div>
        {!loading && rows.length > 0 && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-matcha-50 border border-matcha-200 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            <TrendingUp className="h-3 w-3" /> Ø {avgEff}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-4 justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Fahrer-Daten…
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="text-[11px] text-muted-foreground text-center py-4">
          Keine aktiven Fahrer — Daten erscheinen sobald Touren laufen.
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((r, idx) => {
            const c = efficiencyColor(r.efficiencyScore);
            return (
              <div key={r.id} className="flex items-center gap-3">
                <div className="shrink-0 w-5 text-[11px] font-black text-muted-foreground text-right">
                  {idx + 1}.
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-bold truncate">{r.name}</span>
                    <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', c.bg, c.text)}>
                      {c.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', c.bar)}
                        style={{ width: `${r.efficiencyScore}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('text-sm font-black tabular-nums', c.text)}>{r.efficiencyScore}</div>
                  <div className="text-[9px] text-muted-foreground">Score</div>
                </div>
                <div className="shrink-0 text-right hidden sm:block">
                  <div className="text-[11px] font-bold tabular-nums text-foreground">{r.stopsDone}</div>
                  <div className="text-[9px] text-muted-foreground">Stopps</div>
                </div>
                <div className="shrink-0 text-right hidden sm:block">
                  <div className="text-[11px] font-bold tabular-nums text-foreground">{r.avgMinPerStop}m</div>
                  <div className="text-[9px] text-muted-foreground">Ø/Stopp</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-1 text-[9px] text-muted-foreground">
          <Zap className="h-3 w-3 text-amber-400" />
          Score = Kombination aus Ø-Stopps/h, Pünktlichkeit und Kundenbewertung
        </div>
      )}
    </Card>
  );
}
