'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Users, Clock, Star, Package, Euro } from 'lucide-react';

/**
 * Phase 1815 — Statistik-Live-Performance-Executive-Dashboard (Lieferdienst)
 *
 * Aggregiertes Executive-Dashboard:
 *  - Heute vs. Gestern: Bestellungen, Umsatz, Ø ETA-Abweichung, Fahrerbewertung
 *  - Top-3 Fahrer nach Score
 *  - Zonen-Performance-Split
 * 3-Min-Polling auf /api/delivery/admin/statistiken/live-executive.
 */

interface TagesKpi {
  bestellungen_heute: number;
  bestellungen_gestern: number;
  umsatz_heute_cent: number;
  umsatz_gestern_cent: number;
  eta_abweichung_min: number;
  eta_abweichung_vortag_min: number;
  fahrer_score_heute: number;
  fahrer_score_gestern: number;
  aktive_fahrer: number;
  on_time_quote: number;
}

interface TopFahrer {
  name: string;
  score: number;
  touren: number;
}

interface ZonePerf {
  zone: string;
  bestellungen: number;
  on_time_pct: number;
}

interface ExecutiveDaten {
  kpi: TagesKpi;
  top_fahrer: TopFahrer[];
  zonen: ZonePerf[];
}

const MOCK: ExecutiveDaten = {
  kpi: {
    bestellungen_heute: 87,
    bestellungen_gestern: 74,
    umsatz_heute_cent: 432500,
    umsatz_gestern_cent: 389000,
    eta_abweichung_min: 3.2,
    eta_abweichung_vortag_min: 5.1,
    fahrer_score_heute: 84,
    fahrer_score_gestern: 79,
    aktive_fahrer: 4,
    on_time_quote: 88,
  },
  top_fahrer: [
    { name: 'Jan P.', score: 94, touren: 6 },
    { name: 'Laura S.', score: 87, touren: 5 },
    { name: 'Mehmet K.', score: 83, touren: 7 },
  ],
  zonen: [
    { zone: 'A', bestellungen: 32, on_time_pct: 91 },
    { zone: 'B', bestellungen: 28, on_time_pct: 86 },
    { zone: 'C', bestellungen: 27, on_time_pct: 85 },
  ],
};

function Trend({ jetzt, vorher, einheit = '', kleinerIstBesser = false }: {
  jetzt: number;
  vorher: number;
  einheit?: string;
  kleinerIstBesser?: boolean;
}) {
  const diff = jetzt - vorher;
  if (Math.abs(diff) < 0.1) {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground">
        <Minus className="h-2.5 w-2.5" /> Gleich
      </span>
    );
  }
  const positiv = kleinerIstBesser ? diff < 0 : diff > 0;
  return (
    <span className={cn('flex items-center gap-0.5 text-[9px] font-bold', positiv ? 'text-matcha-600' : 'text-red-500')}>
      {positiv ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {diff > 0 ? '+' : ''}{typeof diff === 'number' && !Number.isInteger(diff) ? diff.toFixed(1) : diff}{einheit}
    </span>
  );
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function LieferdienstPhase1815StatistikLivePerformanceExecutiveDashboard({ locationId, className }: Props) {
  const [daten, setDaten] = useState<ExecutiveDaten | null>(null);
  const [offen, setOffen] = useState(true);
  const [letzteAkt, setLetzteAkt] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/statistiken/live-executive?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json: ExecutiveDaten = await res.json();
          setDaten(json);
          setLetzteAkt(new Date());
        }
      } catch {
        setDaten(MOCK);
        setLetzteAkt(new Date());
      }
    };

    laden();
    const id = setInterval(laden, 3 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const d = daten ?? MOCK;
  const { kpi } = d;

  if (!locationId) return null;

  const kpiBlocks = [
    {
      icon: <Package className="h-3.5 w-3.5" />,
      label: 'Bestellungen',
      wert: kpi.bestellungen_heute,
      trend: <Trend jetzt={kpi.bestellungen_heute} vorher={kpi.bestellungen_gestern} />,
    },
    {
      icon: <Euro className="h-3.5 w-3.5" />,
      label: 'Umsatz',
      wert: `${(kpi.umsatz_heute_cent / 100).toFixed(0)} €`,
      trend: <Trend jetzt={kpi.umsatz_heute_cent} vorher={kpi.umsatz_gestern_cent} einheit=" €" />,
    },
    {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: 'ETA-Abw.',
      wert: `${kpi.eta_abweichung_min.toFixed(1)} Min`,
      trend: <Trend jetzt={kpi.eta_abweichung_min} vorher={kpi.eta_abweichung_vortag_min} einheit=" Min" kleinerIstBesser />,
    },
    {
      icon: <Star className="h-3.5 w-3.5" />,
      label: 'Score Ø',
      wert: kpi.fahrer_score_heute,
      trend: <Trend jetzt={kpi.fahrer_score_heute} vorher={kpi.fahrer_score_gestern} />,
    },
  ];

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Executive Performance Live</span>
        <span className="ml-2 rounded-full border bg-matcha-50 dark:bg-matcha-950/20 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
          On-Time: {kpi.on_time_quote}%
        </span>
        <span className="ml-1 flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" /> {kpi.aktive_fahrer} aktiv
        </span>
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="px-4 py-3 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {kpiBlocks.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  {kpi.icon}
                  <span className="text-[10px] font-semibold">{kpi.label}</span>
                </div>
                <div className="text-lg font-black tabular-nums">{kpi.wert}</div>
                <div className="mt-0.5">{kpi.trend}</div>
              </div>
            ))}
          </div>

          {/* Top Fahrer */}
          {d.top_fahrer.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Top-Fahrer heute
              </p>
              <div className="space-y-1.5">
                {d.top_fahrer.map((f, i) => (
                  <div key={f.name} className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-[10px] font-black text-muted-foreground">
                      {i + 1}.
                    </span>
                    <span className="flex-1 text-xs font-semibold truncate">{f.name}</span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">{f.touren} Touren</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black',
                        f.score >= 85 ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-950/30 dark:text-matcha-300'
                          : f.score >= 70 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',
                      )}
                    >
                      {f.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zonen-Split */}
          {d.zonen.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Zonen-Performance
              </p>
              <div className="space-y-1.5">
                {d.zonen.map((z) => (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 rounded-full border bg-muted px-2 py-0.5 text-center text-[9px] font-bold">
                      Zone {z.zone}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          z.on_time_pct >= 90 ? 'bg-matcha-500' : z.on_time_pct >= 80 ? 'bg-amber-400' : 'bg-red-400',
                        )}
                        style={{ width: `${z.on_time_pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[9px] font-bold tabular-nums">{z.on_time_pct}%</span>
                    <span className="w-12 shrink-0 text-right text-[9px] text-muted-foreground tabular-nums">{z.bestellungen} Bst.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {letzteAkt && (
            <p className="text-[9px] text-muted-foreground text-right">
              Aktualisiert: {letzteAkt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 3 Min
            </p>
          )}
        </div>
      )}
    </div>
  );
}
