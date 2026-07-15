'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bike, Car, Star, TrendingUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type DriverScoreRow = {
  id: string;
  vorname: string;
  nachname: string;
  fahrzeug: 'bike' | 'car' | string;
  ist_online: boolean;
  dispatch_score: number | null;
  aktive_stops: number;
  abgeschlossene_stops_heute: number;
  avg_lieferzeit_min: number | null;
  on_time_rate: number | null;
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    score >= 75 ? 'bg-matcha-500' :
    score >= 50 ? 'bg-saffron' :
    score >= 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        'text-sm font-black tabular-nums w-9 text-right shrink-0',
        score >= 75 ? 'text-matcha-700' : score >= 50 ? 'text-saffron-700' : score >= 30 ? 'text-amber-700' : 'text-red-700',
      )}>
        {Math.round(score)}
      </span>
    </div>
  );
}

function rank(i: number): React.ReactNode {
  if (i === 0) return <Trophy className="h-4 w-4 text-amber-500" />;
  if (i === 1) return <span className="text-[11px] font-black text-stone-400">2.</span>;
  if (i === 2) return <span className="text-[11px] font-black text-stone-500">3.</span>;
  return <span className="text-[11px] font-bold text-stone-300">{i + 1}.</span>;
}

export function DispatchPhase1664TourScoreLiveRangliste() {
  const [rows, setRows] = useState<DriverScoreRow[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const sb = createClient();
    const load = async () => {
      const { data: drivers } = await sb
        .from('employees')
        .select('id, vorname, nachname, status:driver_status(ist_online, fahrzeug, aktueller_batch_id)')
        .eq('rolle', 'fahrer')
        .eq('aktiv', true);

      if (!drivers) return;

      const today = new Date(); today.setHours(0, 0, 0, 0);

      const rowsRaw = await Promise.all(
        (drivers as any[]).map(async d => {
          const statusArr = Array.isArray(d.status) ? d.status : d.status ? [d.status] : [];
          const s = statusArr[0] ?? {};

          const { data: stops } = await sb
            .from('delivery_batch_stops')
            .select('id, geliefert_am, angekommen_am, reihenfolge')
            .eq('batch_id', s.aktueller_batch_id ?? '')
            .not('geliefert_am', 'is', null)
            .gte('geliefert_am', today.toISOString());

          const delivered = stops?.length ?? 0;

          const { data: scoreRow } = await sb
            .from('driver_scores')
            .select('gesamtscore, on_time_rate, avg_lieferzeit_min')
            .eq('employee_id', d.id)
            .order('berechnet_am', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: d.id,
            vorname: d.vorname,
            nachname: d.nachname,
            fahrzeug: s.fahrzeug ?? 'bike',
            ist_online: s.ist_online ?? false,
            dispatch_score: scoreRow?.gesamtscore ?? null,
            aktive_stops: s.aktueller_batch_id ? 1 : 0,
            abgeschlossene_stops_heute: delivered,
            avg_lieferzeit_min: scoreRow?.avg_lieferzeit_min ?? null,
            on_time_rate: scoreRow?.on_time_rate ?? null,
          } satisfies DriverScoreRow;
        }),
      );

      const sorted = rowsRaw
        .filter(r => r.ist_online)
        .sort((a, b) => (b.dispatch_score ?? 0) - (a.dispatch_score ?? 0));
      setRows(sorted);
    };

    load();
    const iv = setInterval(load, 30_000);
    setNow(Date.now());
    const tickIv = setInterval(() => setNow(Date.now()), 60_000);

    const ch = sb.channel('ph1664-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, load)
      .subscribe();

    return () => {
      clearInterval(iv);
      clearInterval(tickIv);
      sb.removeChannel(ch);
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <Star className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-stone-700">
          Fahrer Score · Live Rangliste
        </span>
        <span className="ml-auto text-[10px] font-bold text-stone-400">
          {rows.length} online
        </span>
      </div>

      {/* Table */}
      <div className="divide-y divide-stone-100">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
            {/* Rank */}
            <div className="w-5 flex items-center justify-center shrink-0">
              {rank(i)}
            </div>

            {/* Vehicle icon */}
            {row.fahrzeug === 'car'
              ? <Car className="h-4 w-4 text-stone-400 shrink-0" />
              : <Bike className="h-4 w-4 text-stone-400 shrink-0" />
            }

            {/* Name + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-stone-800 truncate">
                  {row.vorname} {row.nachname[0]}.
                </span>
                <span className="text-[9px] text-stone-400 shrink-0 tabular-nums">
                  {row.abgeschlossene_stops_heute} heute
                </span>
                {row.on_time_rate !== null && (
                  <span className={cn(
                    'text-[9px] font-bold shrink-0 tabular-nums',
                    row.on_time_rate >= 0.9 ? 'text-matcha-600' : row.on_time_rate >= 0.75 ? 'text-amber-600' : 'text-red-600',
                  )}>
                    {Math.round((row.on_time_rate ?? 0) * 100)}% pünktl.
                  </span>
                )}
              </div>
              {/* Score bar */}
              {row.dispatch_score !== null ? (
                <ScoreBar score={row.dispatch_score} />
              ) : (
                <span className="text-[10px] text-stone-300 italic">kein Score</span>
              )}
            </div>

            {/* Avg time */}
            {row.avg_lieferzeit_min !== null && (
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs font-bold tabular-nums text-stone-600">
                  {Math.round(row.avg_lieferzeit_min)}m
                </div>
                <div className="text-[8px] text-stone-400">Ø Zeit</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-t bg-stone-50">
        <TrendingUp className="h-3 w-3 text-stone-400" />
        <span className="text-[10px] text-stone-400">Score = Distanz · Last · Pünktlichkeit · Kundenzufriedenheit</span>
      </div>
    </div>
  );
}
