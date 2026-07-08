'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';

interface AbschlussData {
  heutRate: number | null;
  verlauf: Array<{ datum: string; gesamt: number; abgeschlossen: number; rate: number }>;
}

interface EffizienzData {
  fahrer: Array<{
    driver_id: string;
    touren_anzahl: number;
    lieferungen_pro_h: number;
    schicht_dauer_h: number;
    effizienz_score: number;
  }>;
}

const TOUREN_ZIEL = 8;
const STUNDEN_ZIEL = 6;
const EINNAHMEN_ZIEL = 80;

interface SvgRingProps {
  radius: number;
  stroke: number;
  pct: number;
  color: string;
  label: string;
  wert: string;
}

function SvgRing({ radius, stroke, pct, color, label, wert }: SvgRingProps) {
  const r = radius - stroke / 2;
  const umfang = 2 * Math.PI * r;
  const dash = Math.min(pct, 100) / 100 * umfang;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={radius * 2} height={radius * 2} className="-rotate-90">
        <circle cx={radius} cy={radius} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={radius} cy={radius} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${umfang}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="text-center -mt-1">
        <div className="text-sm font-black text-white tabular-nums">{wert}</div>
        <div className="text-[9px] text-blue-300 font-semibold uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

export function FahrerPhase783SchichtZielFortschrittsRing({
  driverId,
  locationId,
}: {
  driverId: string;
  locationId: string;
}) {
  const [abschluss, setAbschluss] = useState<AbschlussData | null>(null);
  const [effizienz, setEffizienz] = useState<EffizienzData | null>(null);

  useEffect(() => {
    if (!locationId || !driverId) return;
    let active = true;

    async function load() {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/delivery/admin/touren-abschluss-rate?location_id=${locationId}`),
          fetch(`/api/delivery/admin/fahrer-touren-effizienz?location_id=${locationId}`),
        ]);
        if (r1.ok && active) {
          const j = await r1.json();
          if (j.ok) setAbschluss(j);
        }
        if (r2.ok && active) {
          const j = await r2.json();
          if (j.ok) setEffizienz(j);
        }
      } catch {}
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [driverId, locationId]);

  const meineFahrer = effizienz?.fahrer.find((f) => f.driver_id === driverId);
  const tourenHeute = meineFahrer?.touren_anzahl ?? 0;
  const schichtH = meineFahrer?.schicht_dauer_h ?? 0;
  const effizienzScore = meineFahrer?.effizienz_score ?? 0;

  // Einnahmen-Schätzung: Ø 10 €/Tour (Basisvergütung)
  const einnahmenHeute = tourenHeute * 10;

  const tourenPct = Math.round((tourenHeute / TOUREN_ZIEL) * 100);
  const stundenPct = Math.round((schichtH / STUNDEN_ZIEL) * 100);
  const einnahmenPct = Math.round((einnahmenHeute / EINNAHMEN_ZIEL) * 100);

  const heutRate = abschluss?.heutRate ?? null;

  if (!meineFahrer && !abschluss) return null;

  return (
    <div className="rounded-xl border border-blue-500/30 bg-gradient-to-b from-blue-900/60 to-slate-800/80 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
          Schicht-Ziel-Fortschritt
        </span>
        {heutRate !== null && (
          <span className="ml-auto text-[10px] font-bold text-emerald-400">
            {heutRate}% Abschlussrate
          </span>
        )}
      </div>

      {/* Ring-Trio */}
      <div className="flex items-end justify-around py-1">
        <SvgRing
          radius={36}
          stroke={7}
          pct={tourenPct}
          color={tourenPct >= 100 ? '#22c55e' : tourenPct >= 60 ? '#3b82f6' : '#f59e0b'}
          label="Touren"
          wert={`${tourenHeute}/${TOUREN_ZIEL}`}
        />
        <SvgRing
          radius={44}
          stroke={8}
          pct={stundenPct}
          color={stundenPct >= 100 ? '#22c55e' : stundenPct >= 60 ? '#8b5cf6' : '#64748b'}
          label="Stunden"
          wert={`${schichtH.toFixed(1)}h`}
        />
        <SvgRing
          radius={36}
          stroke={7}
          pct={einnahmenPct}
          color={einnahmenPct >= 100 ? '#22c55e' : einnahmenPct >= 60 ? '#f59e0b' : '#64748b'}
          label="Einnahmen"
          wert={`€${einnahmenHeute}`}
        />
      </div>

      {/* Effizienz-Score-Leiste */}
      {effizienzScore > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wide">Effizienz-Score</span>
            <span className={`text-xs font-black tabular-nums ${
              effizienzScore >= 80 ? 'text-emerald-400' :
              effizienzScore >= 60 ? 'text-lime-400' :
              effizienzScore >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>{effizienzScore}/100</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                effizienzScore >= 80 ? 'bg-emerald-400' :
                effizienzScore >= 60 ? 'bg-lime-400' :
                effizienzScore >= 40 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${effizienzScore}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
