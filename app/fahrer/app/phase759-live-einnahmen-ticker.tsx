'use client';

import { useCallback, useEffect, useState } from 'react';
import { Euro, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  driverId: string;
  locationId: string;
}

const TAGES_ZIEL = 120;

function ringPfad(pct: number, r: number, cx: number, cy: number) {
  const umfang = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * umfang;
  return { strokeDasharray: `${dash} ${umfang}` };
}

export function FahrerPhase759LiveEinnahmenTicker({ driverId, locationId }: Props) {
  const [einnahmen, setEinnahmen] = useState<number | null>(null);
  const [trinkgeld, setTrinkgeld] = useState<number | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-monats-statistik?location_id=${locationId}&driver_id=${driverId}`);
      const j = await r.json();
      if (!j.ok) return;
      const ich = (j.fahrer ?? []).find((f: { driver_id: string; einnahmen30?: number; trinkgeld30?: number }) => f.driver_id === driverId);
      if (ich) {
        const einnahmen30 = ich.einnahmen30 ?? 0;
        const trinkgeld30 = ich.trinkgeld30 ?? 0;
        setEinnahmen(Math.round((einnahmen30 / 30) * 10) / 10);
        setTrinkgeld(Math.round((trinkgeld30 / 30) * 10) / 10);
      }
    } catch { /* silent */ }
  }, [driverId, locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 60_000);
    return () => clearInterval(t);
  }, [laden]);

  const pct = einnahmen !== null ? Math.min((einnahmen / TAGES_ZIEL) * 100, 100) : 0;
  const ringR = 32;
  const ringCX = 40;
  const ringCY = 40;
  const ring = ringPfad(pct, ringR, ringCX, ringCY);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold">Einnahmen-Ticker</span>
          {einnahmen !== null && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Ø {einnahmen.toFixed(1)} €/Tag
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 pt-1">
          {einnahmen === null ? (
            <p className="text-xs text-muted-foreground">Lade Einnahmen…</p>
          ) : (
            <div className="flex items-center gap-4">
              {/* SVG-Ring */}
              <div className="relative shrink-0">
                <svg width={80} height={80} className="-rotate-90">
                  <circle cx={ringCX} cy={ringCY} r={ringR} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted" />
                  <circle
                    cx={ringCX} cy={ringCY} r={ringR} fill="none"
                    stroke={pct >= 100 ? '#10b981' : pct >= 60 ? '#3b82f6' : '#f59e0b'}
                    strokeWidth={6} strokeLinecap="round"
                    {...ring}
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black tabular-nums">{Math.round(pct)}%</span>
                </div>
              </div>

              {/* KPI */}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Ø Tageseinnahmen (30d)</p>
                  <p className="text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    {einnahmen.toFixed(2)} €
                  </p>
                </div>
                {trinkgeld !== null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">davon Ø Trinkgeld</p>
                    <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      + {trinkgeld.toFixed(2)} €
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground">Tagesziel</p>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{TAGES_ZIEL} €</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
