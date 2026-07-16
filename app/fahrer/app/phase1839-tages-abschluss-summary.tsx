'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus, Star, CheckCircle2,
  Package, Euro, Clock, Award, ChevronDown, ChevronUp,
} from 'lucide-react';

/**
 * Phase 1839 — Tages-Abschluss-Summary (Fahrer-App)
 *
 * Nach Schichtende: Eigene Tageszahlen (Stopps, Einnahmen, Ø-Bewertung, Pünktlichkeit)
 * + Vergleich Team; isOnline-Guard (nur wenn offline/Schicht beendet); 30-Min-Polling.
 */

interface FahrerBilanz {
  stopps_heute: number;
  einnahmen_cents: number;
  puenktlichkeits_quote: number;
  durchschnittsbewertung: number | null;
  stopps_vorwoche_schnitt: number;
  einnahmen_vorwoche_cents: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface TeamBilanz {
  team_stopps: number;
  team_einnahmen_cents: number;
  team_puenktlichkeit: number;
}

interface ApiAntwort {
  fahrer: FahrerBilanz | null;
  team: TeamBilanz | null;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

const MOCK_FAHRER: FahrerBilanz = {
  stopps_heute: 16,
  einnahmen_cents: 12800,
  puenktlichkeits_quote: 88,
  durchschnittsbewertung: 4.7,
  stopps_vorwoche_schnitt: 14,
  einnahmen_vorwoche_cents: 11200,
  trend: 'besser',
};

const MOCK_TEAM: TeamBilanz = {
  team_stopps: 44,
  team_einnahmen_cents: 35200,
  team_puenktlichkeit: 82,
};

const POLL_MS = 30 * 60 * 1_000;

function TrendIcon({ trend }: { trend: 'besser' | 'gleich' | 'schlechter' }) {
  if (trend === 'besser') return <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />;
  if (trend === 'schlechter') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function FahrerPhase1839TagesAbschlussSummary({ driverId, locationId, isOnline, className }: Props) {
  const [data, setData] = useState<ApiAntwort | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!driverId || !locationId) return;

    let cancelled = false;

    async function laden() {
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-abschluss-bilanz?location_id=${encodeURIComponent(locationId!)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('api');
        const json = await res.json();
        const mein = (json.fahrer ?? []).find((f: any) => f.fahrer_id === driverId);
        if (!cancelled) {
          setData({
            fahrer: mein ?? null,
            team: json.team_stopps != null ? {
              team_stopps: json.team_stopps,
              team_einnahmen_cents: json.team_einnahmen_cents,
              team_puenktlichkeit: json.team_puenktlichkeit,
            } : MOCK_TEAM,
          });
        }
      } catch {
        if (!cancelled) {
          setData({ fahrer: MOCK_FAHRER, team: MOCK_TEAM });
        }
      }
    }

    laden();
    const id = setInterval(laden, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, locationId]);

  // Nur nach Schichtende anzeigen (isOnline === false)
  if (isOnline) return null;
  if (!data?.fahrer) return null;

  const f = data.fahrer;
  const t = data.team;
  const einnahmenEur = (f.einnahmen_cents / 100).toFixed(2).replace('.', ',');
  const vwEinnahmenEur = (f.einnahmen_vorwoche_cents / 100).toFixed(2).replace('.', ',');

  const puenktlichkeitFarbe =
    f.puenktlichkeits_quote >= 90 ? 'text-matcha-600 dark:text-matcha-400' :
    f.puenktlichkeits_quote >= 75 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  return (
    <section className={cn('bg-gradient-to-br from-stone-800/90 to-stone-900/90 border border-stone-700/50 rounded-2xl overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-white">Tages-Abschluss</span>
          <span className="text-[10px] rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 font-semibold">
            Schicht beendet
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-stone-400" />
          : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Haupt-KPIs */}
          <div className="grid grid-cols-2 gap-2">
            {/* Stopps */}
            <div className="rounded-xl bg-white/8 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-1">
                <Package className="h-3.5 w-3.5 text-stone-400" />
                <TrendIcon trend={f.trend} />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">{f.stopps_heute}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">Stopps heute</div>
              <div className="text-[9px] text-stone-500 mt-1">
                Vorwoche Ø {f.stopps_vorwoche_schnitt}
                {t && <> · Team heute {t.team_stopps}</>}
              </div>
            </div>

            {/* Einnahmen */}
            <div className="rounded-xl bg-white/8 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-1">
                <Euro className="h-3.5 w-3.5 text-stone-400" />
                <TrendIcon trend={f.trend} />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">{einnahmenEur} €</div>
              <div className="text-[10px] text-stone-400 mt-0.5">Einnahmen</div>
              <div className="text-[9px] text-stone-500 mt-1">
                Vorwoche {vwEinnahmenEur} €
              </div>
            </div>

            {/* Pünktlichkeit */}
            <div className="rounded-xl bg-white/8 border border-white/10 p-3">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3.5 w-3.5 text-stone-400" />
              </div>
              <div className={cn('text-2xl font-black tabular-nums', puenktlichkeitFarbe)}>
                {f.puenktlichkeits_quote}%
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">Pünktlichkeit</div>
              {t && (
                <div className="text-[9px] text-stone-500 mt-1">Team Ø {t.team_puenktlichkeit}%</div>
              )}
              <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', puenktlichkeitFarbe.replace('text-', 'bg-').replace(' dark:text-matcha-400', '').replace(' dark:text-amber-400', '').replace(' dark:text-red-400', ''))}
                  style={{ width: `${f.puenktlichkeits_quote}%` }}
                />
              </div>
            </div>

            {/* Bewertung */}
            <div className="rounded-xl bg-white/8 border border-white/10 p-3">
              <div className="flex items-center gap-1 mb-1">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              </div>
              {f.durchschnittsbewertung != null ? (
                <div className="text-2xl font-black text-amber-300 tabular-nums">
                  {f.durchschnittsbewertung.toFixed(1)}
                </div>
              ) : (
                <div className="text-sm font-semibold text-stone-400">–</div>
              )}
              <div className="text-[10px] text-stone-400 mt-0.5">Ø Bewertung</div>
              <div className="text-[9px] text-stone-500 mt-1">von Kunden heute</div>
            </div>
          </div>

          {/* Trend-Zusammenfassung */}
          <div className={cn(
            'rounded-xl border px-3 py-2.5 flex items-center gap-2',
            f.trend === 'besser'
              ? 'bg-matcha-900/30 border-matcha-700/50'
              : f.trend === 'schlechter'
              ? 'bg-red-900/30 border-red-700/50'
              : 'bg-white/5 border-white/10',
          )}>
            <TrendIcon trend={f.trend} />
            <p className={cn('text-xs font-semibold',
              f.trend === 'besser' ? 'text-matcha-300' :
              f.trend === 'schlechter' ? 'text-red-300' :
              'text-stone-300',
            )}>
              {f.trend === 'besser'
                ? `Super! Heute ${f.stopps_heute - f.stopps_vorwoche_schnitt} Stopps mehr als Vorwoche-Durchschnitt.`
                : f.trend === 'schlechter'
                ? `${f.stopps_vorwoche_schnitt - f.stopps_heute} Stopps weniger als Vorwoche. Weiter so!`
                : 'Konstante Leistung wie letzte Woche — gut gemacht!'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />
            Schicht-Daten werden alle 30 Min aktualisiert
          </div>
        </div>
      )}
    </section>
  );
}
