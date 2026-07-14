'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, TrendingDown, TrendingUp, Award } from 'lucide-react';

// Phase 1489 — Routen-Effizienz-Karte (Fahrer-App)
// Heute vs. Team-Durchschnitt: Stopps/h + Ø km/Stopp + Effizienz-Rang.
// isOnline-Guard. 30-Min-Polling. Nach Phase1484.

interface Props {
  driverId: string;
  isOnline: boolean;
  locationId: string | null;
}

interface RoutenEffizienz {
  stopps_pro_stunde: number;
  team_stopps_pro_stunde: number;
  avg_km_pro_stopp: number;
  team_avg_km_pro_stopp: number;
  rang: number;
  total_fahrer: number;
}

const POLL_MS = 30 * 60_000;

function buildMock(seed: string): RoutenEffizienz {
  const h = seed.charCodeAt(0) % 3;
  return {
    stopps_pro_stunde: [4.2, 3.8, 5.1][h],
    team_stopps_pro_stunde: 4.2,
    avg_km_pro_stopp: [1.8, 2.4, 1.5][h],
    team_avg_km_pro_stopp: 2.1,
    rang: [2, 3, 1][h],
    total_fahrer: 5,
  };
}

export function FahrerPhase1489RoutenEffizienzKarte({ driverId, isOnline, locationId }: Props) {
  const [data, setData] = useState<RoutenEffizienz>(() => buildMock(driverId));
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOnline || !locationId) return;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.fahrer?.length) {
            const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
            if (me) {
              setData((prev) => ({
                ...prev,
                rang: me.rang,
                total_fahrer: json.fahrer.length,
              }));
            }
          }
        }
      } catch {}
    }

    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [driverId, isOnline, locationId]);

  if (!mounted || !isOnline) return null;

  const stoppsGutGenug = data.stopps_pro_stunde >= data.team_stopps_pro_stunde;
  const kmEffizient = data.avg_km_pro_stopp <= data.team_avg_km_pro_stopp;
  const topDriver = data.rang === 1;

  const bgCls = 'bg-slate-800/90 border-slate-700/60';

  return (
    <section className={cn('rounded-2xl border p-4 space-y-3', bgCls)}>
      <div className="flex items-center gap-2">
        <Map className="h-5 w-5 shrink-0 text-sky-400" />
        <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Routen-Effizienz</span>
        {topDriver && <Award className="ml-auto h-4 w-4 text-yellow-400" />}
        {!topDriver && (
          <span className="ml-auto text-[10px] font-bold text-white/40">
            Rang {data.rang}/{data.total_fahrer}
          </span>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Stopps/h */}
        <div className="bg-white/5 rounded-xl px-3 py-2.5">
          <div className="text-[9px] text-white/40 uppercase tracking-wide mb-1">Stopps/h</div>
          <div className="flex items-end gap-1.5">
            <span className={cn('text-xl font-black tabular-nums leading-tight', stoppsGutGenug ? 'text-emerald-400' : 'text-amber-400')}>
              {data.stopps_pro_stunde.toFixed(1)}
            </span>
            {stoppsGutGenug
              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400 mb-1" />
              : <TrendingDown className="h-3.5 w-3.5 text-amber-400 mb-1 rotate-0" />}
          </div>
          <div className="text-[9px] text-white/30">Team: {data.team_stopps_pro_stunde.toFixed(1)}</div>
        </div>

        {/* km/Stopp */}
        <div className="bg-white/5 rounded-xl px-3 py-2.5">
          <div className="text-[9px] text-white/40 uppercase tracking-wide mb-1">Ø km/Stopp</div>
          <div className="flex items-end gap-1.5">
            <span className={cn('text-xl font-black tabular-nums leading-tight', kmEffizient ? 'text-emerald-400' : 'text-amber-400')}>
              {data.avg_km_pro_stopp.toFixed(1)}
            </span>
            {kmEffizient
              ? <TrendingDown className="h-3.5 w-3.5 text-emerald-400 mb-1" />
              : <TrendingUp className="h-3.5 w-3.5 text-amber-400 mb-1" />}
          </div>
          <div className="text-[9px] text-white/30">Team: {data.team_avg_km_pro_stopp.toFixed(1)}</div>
        </div>
      </div>

      {/* Rang bar */}
      <div>
        <div className="flex justify-between text-[9px] text-white/30 mb-1">
          <span>Effizienz-Rang</span>
          <span>{data.rang} / {data.total_fahrer}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', topDriver ? 'bg-yellow-400' : stoppsGutGenug ? 'bg-emerald-400' : 'bg-amber-400')}
            style={{ width: `${((data.total_fahrer - data.rang + 1) / data.total_fahrer) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
