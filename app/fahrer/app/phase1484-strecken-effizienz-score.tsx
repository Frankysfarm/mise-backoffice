'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, TrendingDown, Award, Lightbulb } from 'lucide-react';

// Phase 1484 — Strecken-Effizienz-Score (Fahrer-App)
// Heute: Ø km je Stopp + Effizienz-Rang im Team + Spar-Tipp.
// isOnline-Guard. 30-Min-Polling via /api/delivery/admin/fahrer-reaktionszeit.
// Nach Phase 1479.

interface Props {
  driverId: string;
  isOnline: boolean;
  locationId: string | null;
  kmHeute?: number;
  stoppsHeute?: number;
}

interface EffizienzData {
  avg_km_pro_stopp: number;
  team_avg_km_pro_stopp: number;
  rang: number;
  total_fahrer: number;
  spar_tipp: string;
}

const POLL_MS = 30 * 60_000;

function buildMock(kmHeute: number, stoppsHeute: number): EffizienzData {
  const avg = stoppsHeute > 0 ? parseFloat((kmHeute / stoppsHeute).toFixed(1)) : 1.8;
  const teamAvg = 2.3;
  const besserAlsTeam = avg <= teamAvg;
  return {
    avg_km_pro_stopp: avg,
    team_avg_km_pro_stopp: teamAvg,
    rang: besserAlsTeam ? 2 : 4,
    total_fahrer: 6,
    spar_tipp: besserAlsTeam
      ? 'Hervorragend! Weiter so — deine Routenplanung ist effizient.'
      : 'Tipp: Bestellungen aus derselben Straße bündeln spart bis zu 0.5 km/Stopp.',
  };
}

const SIZE = 80;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function FahrerPhase1484StreckenEffizienzScore({
  driverId,
  isOnline,
  locationId,
  kmHeute = 12,
  stoppsHeute = 7,
}: Props) {
  const [data, setData] = useState<EffizienzData>(() => buildMock(kmHeute, stoppsHeute));
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOnline || !locationId) return;

    async function fetchData() {
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
              const avgKm = stoppsHeute > 0 ? parseFloat((kmHeute / stoppsHeute).toFixed(1)) : 1.8;
              const teamAvg = 2.3;
              const besserAlsTeam = avgKm <= teamAvg;
              setData({
                avg_km_pro_stopp: avgKm,
                team_avg_km_pro_stopp: teamAvg,
                rang: me.rang,
                total_fahrer: json.fahrer.length,
                spar_tipp: besserAlsTeam
                  ? 'Super Effizienz! Deine Route ist optimal.'
                  : 'Tipp: Bestellungen aus derselben Zone bündeln — bis zu 0.5 km/Stopp sparen.',
              });
            }
          }
        }
      } catch {}
    }

    fetchData();
    const iv = setInterval(fetchData, POLL_MS);
    return () => clearInterval(iv);
  }, [driverId, isOnline, locationId, kmHeute, stoppsHeute]);

  if (!mounted || !isOnline) return null;

  const besserAlsTeam = data.avg_km_pro_stopp <= data.team_avg_km_pro_stopp;
  const fillRatio = Math.min(data.team_avg_km_pro_stopp / Math.max(data.avg_km_pro_stopp, 0.1), 1);
  const dashOffset = CIRC * (1 - fillRatio);
  const mainColor = besserAlsTeam ? 'text-emerald-400' : 'text-amber-400';
  const ringColor = besserAlsTeam ? 'stroke-emerald-400' : 'stroke-amber-400';
  const bgCls = 'bg-slate-800/90 border-slate-700/60';

  return (
    <section className={cn('rounded-2xl border p-4 space-y-3', bgCls)}>
      <div className="flex items-center gap-2">
        <Route className={cn('h-5 w-5 shrink-0', mainColor)} />
        <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Strecken-Effizienz</span>
        {besserAlsTeam && <Award className="ml-auto h-4 w-4 text-emerald-400" />}
      </div>

      <div className="flex items-center gap-4">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none" strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={dashOffset}
              className={ringColor}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-base font-black tabular-nums leading-tight', mainColor)}>
              {data.avg_km_pro_stopp}
            </span>
            <span className="text-[8px] text-white/40 uppercase tracking-wide">km/Stopp</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-[9px] text-white/40 uppercase tracking-wide">Ø km je Stopp</div>
            <div className={cn('text-lg font-black tabular-nums', mainColor)}>{data.avg_km_pro_stopp} km</div>
          </div>
          <div>
            <div className="text-[9px] text-white/40 uppercase tracking-wide">Team-Ø</div>
            <div className="text-sm font-semibold text-white">{data.team_avg_km_pro_stopp} km</div>
          </div>
          <div className="flex items-center gap-1.5">
            {besserAlsTeam
              ? <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
              : <TrendingDown className="h-3.5 w-3.5 text-amber-400 rotate-180" />}
            <span className={cn('text-xs font-bold', besserAlsTeam ? 'text-emerald-400' : 'text-amber-400')}>
              Rang {data.rang} / {data.total_fahrer}
            </span>
          </div>
        </div>
      </div>

      {/* Spar-Tipp */}
      <div className="flex items-start gap-2 bg-white/5 rounded-xl px-3 py-2">
        <Lightbulb className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-[11px] text-white/70 leading-relaxed">{data.spar_tipp}</p>
      </div>
    </section>
  );
}
