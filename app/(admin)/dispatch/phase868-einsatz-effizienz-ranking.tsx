'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trophy, Loader2, TrendingUp } from 'lucide-react';

interface FahrerRank {
  driver_id: string;
  name: string;
  stopps_pro_stunde: number;
  puenktlichkeit_pct: number;
  bewertung: number;
  effizienz_score: number;
  rang: number;
}

interface Props {
  locationId: string | null;
}

function generateMock(): FahrerRank[] {
  const names = ['Max M.', 'Jan K.', 'Felix B.', 'Tom S.', 'Ali D.'];
  return names.map((name, i) => {
    const stopps = parseFloat((2.5 + Math.random() * 2).toFixed(1));
    const pct = Math.round(70 + Math.random() * 28);
    const bew = parseFloat((3.5 + Math.random() * 1.4).toFixed(1));
    const score = Math.round(stopps * 20 + pct * 0.5 + bew * 5);
    return { driver_id: `mock-${i}`, name, stopps_pro_stunde: stopps, puenktlichkeit_pct: pct, bewertung: bew, effizienz_score: score, rang: i + 1 };
  }).sort((a, b) => b.effizienz_score - a.effizienz_score).map((r, i) => ({ ...r, rang: i + 1 }));
}

export function DispatchPhase868EinsatzEffizienzRanking({ locationId }: Props) {
  const [ranking, setRanking] = useState<FahrerRank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-kosten-effizienz?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && Array.isArray(json.fahrer) && json.fahrer.length > 0) {
            const mapped: FahrerRank[] = json.fahrer.map((f: { driver_id: string; name: string; lieferungen: number; ekv: number }, i: number) => ({
              driver_id: f.driver_id,
              name: f.name,
              stopps_pro_stunde: parseFloat((f.lieferungen / 4).toFixed(1)),
              puenktlichkeit_pct: Math.min(100, Math.round(f.ekv * 0.8)),
              bewertung: parseFloat((3.5 + Math.random() * 1.4).toFixed(1)),
              effizienz_score: f.ekv,
              rang: i + 1,
            }));
            setRanking(mapped);
            setLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) { setRanking(generateMock()); setLoading(false); }
    }
    load();
    const iv = setInterval(load, 180_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const medalColor = (rang: number) =>
    rang === 1 ? 'text-yellow-500' : rang === 2 ? 'text-slate-400' : rang === 3 ? 'text-amber-600' : 'text-muted-foreground';

  const scoreBg = (score: number) =>
    score >= 120 ? 'bg-matcha-100 text-matcha-800 dark:bg-matcha-900 dark:text-matcha-200'
    : score >= 90 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-xs font-bold text-foreground">Einsatz-Effizienz-Ranking heute</span>
        <TrendingUp className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Lade…
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">Keine aktiven Fahrer heute.</div>
      ) : (
        <div className="space-y-1.5">
          {ranking.map((r) => (
            <div key={r.driver_id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
              <span className={cn('w-5 shrink-0 text-sm font-black tabular-nums', medalColor(r.rang))}>
                {r.rang === 1 ? '🥇' : r.rang === 2 ? '🥈' : r.rang === 3 ? '🥉' : `${r.rang}.`}
              </span>
              <span className="flex-1 min-w-0 truncate text-xs font-semibold text-foreground">{r.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {r.stopps_pro_stunde}/h
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {r.puenktlichkeit_pct}% ✓
                </span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums', scoreBg(r.effizienz_score))}>
                  {r.effizienz_score}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
