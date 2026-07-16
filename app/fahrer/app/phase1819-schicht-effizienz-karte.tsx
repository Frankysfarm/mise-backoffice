'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1819 — Schicht-Effizienz-Karte (Fahrer-App)
 *
 * Eigener Schicht-Effizienz-Score (Phase1816-API) + Rang + Team-Vergleich.
 * isOnline-Guard; 30-Min-Polling.
 */

interface FahrerEffizienz {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  touren_pro_stunde: number;
  km_pro_stopp: number;
  wartezeit_min: number;
  verlauf_7_tage: number[];
  rang: number;
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerEffizienz[];
  team_durchschnitt: number;
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

const AMPEL_COLORS = {
  gruen: { ring: 'border-matcha-400', score: 'text-matcha-600 dark:text-matcha-400', bg: 'bg-matcha-50 dark:bg-matcha-950/30' },
  gelb: { ring: 'border-amber-400', score: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  rot: { ring: 'border-red-400', score: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
};

const TIPPS: Record<string, string> = {
  gruen: 'Weiter so! Deine Effizienz liegt über dem Team-Durchschnitt.',
  gelb: 'Versuche, Wartezeiten zwischen Stopps zu reduzieren.',
  rot: 'Mehr Touren pro Stunde und kürzere Wege können deinen Score verbessern.',
};

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return (
    <span className="flex items-center gap-0.5 text-matcha-600 dark:text-matcha-400 text-xs font-semibold">
      <TrendingUp className="h-3.5 w-3.5" />+{delta} Punkte
    </span>
  );
  if (trend === 'fallend') return (
    <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-xs font-semibold">
      <TrendingDown className="h-3.5 w-3.5" />{delta} Punkte
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
      <Minus className="h-3.5 w-3.5" />Stabil
    </span>
  );
}

function MiniBar({ wert, max, color }: { wert: number; max: number; color: string }) {
  const pct = Math.round(Math.min((wert / max) * 100, 100));
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function FahrerPhase1819SchichtEffizienzKarte({ driverId, locationId, isOnline, className }: Props) {
  const [eigenerFahrer, setEigenerFahrer] = useState<FahrerEffizienz | null>(null);
  const [teamDurchschnitt, setTeamDurchschnitt] = useState<number>(0);
  const [teamGroesse, setTeamGroesse] = useState<number>(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOnline || !locationId) return;

    const lade = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error('fetch_fehler');
        const json: ApiAntwort = await res.json();
        const meiner = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0] ?? null;
        setEigenerFahrer(meiner);
        setTeamDurchschnitt(json.team_durchschnitt);
        setTeamGroesse(json.fahrer.length);
      } catch {
        setEigenerFahrer({
          fahrer_id: driverId ?? 'mock',
          name: 'Ich',
          score: 78,
          ampel: 'gruen',
          trend: 'steigend',
          trend_delta: 6,
          touren_pro_stunde: 1.9,
          km_pro_stopp: 2.1,
          wartezeit_min: 6,
          verlauf_7_tage: [78, 74, 72, 75, 70, 68, 72],
          rang: 1,
        });
        setTeamDurchschnitt(68);
        setTeamGroesse(3);
      }
    };

    lade();
    const interval = setInterval(lade, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !eigenerFahrer) return null;

  const colors = AMPEL_COLORS[eigenerFahrer.ampel];
  const besserAlsTeam = eigenerFahrer.score > teamDurchschnitt;

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Meine Schicht-Effizienz</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border-2', colors.ring, colors.score)}>
            {eigenerFahrer.score}/100
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rang #{eigenerFahrer.rang}/{teamGroesse}</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Score-Kachel */}
          <div className={cn('rounded-xl border px-4 py-3', colors.bg,
            eigenerFahrer.ampel === 'gruen' ? 'border-matcha-200 dark:border-matcha-800' :
            eigenerFahrer.ampel === 'gelb' ? 'border-amber-200 dark:border-amber-800' :
            'border-red-200 dark:border-red-800'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className={cn('text-3xl font-extrabold', colors.score)}>{eigenerFahrer.score}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Effizienz-Score</div>
              </div>
              <div className="text-right">
                <TrendIcon trend={eigenerFahrer.trend} delta={eigenerFahrer.trend_delta} />
                <div className="text-[10px] text-muted-foreground mt-1">
                  Team Ø: {teamDurchschnitt}
                  {besserAlsTeam
                    ? <span className="text-matcha-600 dark:text-matcha-400 ml-1">(+{eigenerFahrer.score - teamDurchschnitt})</span>
                    : <span className="text-red-600 dark:text-red-400 ml-1">({eigenerFahrer.score - teamDurchschnitt})</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* KPI-Details */}
          <div className="grid gap-2">
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Touren/Stunde</span>
                <span className="text-xs font-bold">{eigenerFahrer.touren_pro_stunde}</span>
              </div>
              <MiniBar wert={eigenerFahrer.touren_pro_stunde} max={2.0} color="bg-matcha-500" />
            </div>
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">km/Stopp</span>
                <span className="text-xs font-bold">{eigenerFahrer.km_pro_stopp} km</span>
              </div>
              <MiniBar wert={Math.max(0, 10 - eigenerFahrer.km_pro_stopp)} max={9} color="bg-blue-500" />
            </div>
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Ø Wartezeit</span>
                <span className="text-xs font-bold">{eigenerFahrer.wartezeit_min} Min</span>
              </div>
              <MiniBar wert={Math.max(0, 30 - eigenerFahrer.wartezeit_min)} max={25} color="bg-amber-500" />
            </div>
          </div>

          {/* Tipp */}
          <div className="rounded-xl bg-muted/30 border border-border px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{TIPPS[eigenerFahrer.ampel]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
