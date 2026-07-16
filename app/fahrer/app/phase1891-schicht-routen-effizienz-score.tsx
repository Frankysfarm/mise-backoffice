'use client';

/**
 * Phase 1891 — Schicht-Routen-Effizienz-Score (Fahrer-App)
 *
 * Score 0–100 für Routen-Effizienz der aktuellen Schicht.
 * KPIs: Stopps/h, Ø Stoppzeit, Effizienz vs. Schicht-Ziel (10 Stopps/h).
 * Score-Ring (SVG) + Ampel-Farbe. 2-Min-Polling. isOnline-Guard. Collapsible.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Route, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Stop {
  geliefert_am?: string | null;
  angekommen_am?: string | null;
}

interface Batch {
  startzeit?: string | null;
  endzeit?: string | null;
  stops?: Stop[];
}

interface ApiResponse {
  stopps_gesamt?: number;
  schicht_dauer_min?: number;
  avg_stopp_min?: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
  batches?: Batch[];
  className?: string;
}

const ZIEL_STOPPS_PRO_STUNDE = 10;

function calcScore(stoppsProH: number, avgStoppMin: number): number {
  const effizienz   = Math.min(100, (stoppsProH / ZIEL_STOPPS_PRO_STUNDE) * 100);
  const stoppScore  = Math.max(0, 100 - Math.max(0, avgStoppMin - 3) * 10); // <3min = 100, +10 Punkte Abzug pro Min über 3
  return Math.round(effizienz * 0.6 + stoppScore * 0.4);
}

function scoreColor(s: number) {
  if (s >= 80) return { stroke: '#10b981', text: 'text-emerald-600 dark:text-emerald-400' };
  if (s >= 60) return { stroke: '#f59e0b', text: 'text-yellow-600 dark:text-yellow-400' };
  return         { stroke: '#ef4444', text: 'text-red-600 dark:text-red-400' };
}

function ScoreRing({ score }: { score: number }) {
  const R = 22;
  const circ = 2 * Math.PI * R;
  const dash = (score / 100) * circ;
  const c = scoreColor(score);

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={R} fill="none" stroke="currentColor" className="text-border" strokeWidth="4" />
      <circle
        cx="28" cy="28" r={R} fill="none"
        stroke={c.stroke} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="900" fill={c.stroke} fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

export function FahrerPhase1891SchichtRoutenEffizienzScore({ driverId, locationId, isOnline, batches, className }: Props) {
  const [apiData, setApiData]   = useState<ApiResponse | null>(null);
  const [open, setOpen]         = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-effizienz?driverId=${driverId}&locationId=${locationId ?? ''}`);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setApiData(json);
        }
      } catch {
        // keep previous / use local calc
      }
    }

    load();
    const id = setInterval(load, 2 * 60_000);
    return () => clearInterval(id);
  }, [isOnline, driverId, locationId]);

  const { stoppsProH, avgStoppMin, gesamtStopps, score } = useMemo(() => {
    if (apiData) {
      const d   = apiData.schicht_dauer_min ?? 1;
      const sph = apiData.stopps_gesamt ? (apiData.stopps_gesamt / d) * 60 : 0;
      return {
        stoppsProH:   Math.round(sph * 10) / 10,
        avgStoppMin:  Math.round((apiData.avg_stopp_min ?? 0) * 10) / 10,
        gesamtStopps: apiData.stopps_gesamt ?? 0,
        score:        calcScore(sph, apiData.avg_stopp_min ?? 4),
      };
    }
    // Local calc from batches
    if (!batches || batches.length === 0) return { stoppsProH: 0, avgStoppMin: 0, gesamtStopps: 0, score: 0 };

    const allStops = batches.flatMap((b) => b.stops ?? []).filter((s) => s.geliefert_am);
    const earliest = batches
      .map((b) => b.startzeit ? new Date(b.startzeit).getTime() : Infinity)
      .reduce((a, b) => Math.min(a, b), Infinity);
    const durationMin = earliest === Infinity ? 1 : (Date.now() - earliest) / 60_000;
    const sph = allStops.length / (durationMin / 60);
    const spm = durationMin / Math.max(1, allStops.length);

    return {
      stoppsProH:   Math.round(sph * 10) / 10,
      avgStoppMin:  Math.round(spm * 10) / 10,
      gesamtStopps: allStops.length,
      score:        calcScore(sph, spm),
    };
  }, [apiData, batches]);

  if (!isOnline) return null;

  const c = scoreColor(score);

  return (
    <Card className={cn('p-3 space-y-2', className)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">Routen-Effizienz</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="flex items-center gap-3">
          <ScoreRing score={score} />

          <div className="flex-1 space-y-1.5">
            {[
              { label: 'Stopps/h',   value: `${stoppsProH}`,           ziel: `Ziel: ${ZIEL_STOPPS_PRO_STUNDE}` },
              { label: 'Ø Stoppzeit', value: `${avgStoppMin} Min`,      ziel: 'Ziel: <3 Min' },
              { label: 'Gesamt',      value: `${gesamtStopps} Stopps`,  ziel: '' },
            ].map((k) => (
              <div key={k.label} className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{k.label}</span>
                <div className="flex items-center gap-1.5">
                  {k.ziel && <span className="text-[9px] text-muted-foreground">{k.ziel}</span>}
                  <span className="text-xs font-bold text-foreground tabular-nums">{k.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && score > 0 && (
        <div className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1.5 ring-1',
          score >= 80 ? 'bg-emerald-50 dark:bg-emerald-950 ring-emerald-300' :
          score >= 60 ? 'bg-yellow-50 dark:bg-yellow-950 ring-yellow-300' :
                        'bg-red-50 dark:bg-red-950 ring-red-300',
        )}>
          <TrendingUp className={cn('h-3 w-3 shrink-0', c.text)} />
          <p className={cn('text-[10px] font-semibold', c.text)}>
            {score >= 80 ? 'Starke Effizienz — weiter so!' :
             score >= 60 ? 'Solide — noch Optimierungspotenzial.' :
                           'Effizienz unter Ziel — Routen prüfen.'}
          </p>
        </div>
      )}
    </Card>
  );
}
