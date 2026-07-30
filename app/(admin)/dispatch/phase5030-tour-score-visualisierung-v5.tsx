'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Route, CheckCircle2, Clock, AlertTriangle, Zap, MapPin, Euro } from 'lucide-react';

// Phase 5030 — Tour-Score Visualisierung V5
// Fleet-Score mit Verlauf; Fahrer-Rangliste tier-farbkodiert (Platin/Gold/Gut/Schwach)
// Stopp-Sequenz-Dots farbkodiert + Profit je Tour; Zonen-SLA-Matrix
// 20-Sek-Polling; Mock-Fallback

interface FahrerTour {
  id: string;
  fahrer: string;
  score: number;
  score_delta: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  stopps_gesamt: number;
  stopps_fertig: number;
  eta_min: number | null;
  zone: string;
  profit_eur: number;
  stopps: Array<{ status: 'fertig' | 'aktiv' | 'verspaetet' | 'ausstehend' }>;
  puenktlichkeit_pct: number;
  delay_risiko: boolean;
}

interface ZoneSla {
  zone: string;
  sla_pct: number;
  avg_eta_min: number;
  umsatz: number;
}

interface ApiData {
  fleet_score: number;
  fleet_delta: number;
  touren: FahrerTour[];
  zonen: ZoneSla[];
  alert: string | null;
}

const MOCK: ApiData = {
  fleet_score: 83,
  fleet_delta: 4,
  alert: null,
  touren: [
    { id: '1', fahrer: 'Jonas M.',  score: 96, score_delta: 2,  tier: 'platin', stopps_gesamt: 4, stopps_fertig: 3, eta_min: 8,  zone: 'Mitte', profit_eur: 18.40, puenktlichkeit_pct: 98, delay_risiko: false, stopps: [{ status: 'fertig' }, { status: 'fertig' }, { status: 'fertig' }, { status: 'aktiv' }] },
    { id: '2', fahrer: 'Anna B.',   score: 89, score_delta: -1, tier: 'gold',   stopps_gesamt: 3, stopps_fertig: 1, eta_min: 22, zone: 'Nord',  profit_eur: 12.10, puenktlichkeit_pct: 91, delay_risiko: false, stopps: [{ status: 'fertig' }, { status: 'aktiv' }, { status: 'ausstehend' }] },
    { id: '3', fahrer: 'Ben K.',    score: 74, score_delta: -5, tier: 'gut',    stopps_gesamt: 3, stopps_fertig: 1, eta_min: 35, zone: 'Süd',   profit_eur: 9.80,  puenktlichkeit_pct: 78, delay_risiko: true,  stopps: [{ status: 'fertig' }, { status: 'verspaetet' }, { status: 'ausstehend' }] },
    { id: '4', fahrer: 'Maria L.',  score: 61, score_delta: -8, tier: 'schwach',stopps_gesamt: 2, stopps_fertig: 0, eta_min: 41, zone: 'West',  profit_eur: 6.20,  puenktlichkeit_pct: 62, delay_risiko: true,  stopps: [{ status: 'verspaetet' }, { status: 'ausstehend' }] },
  ],
  zonen: [
    { zone: 'Mitte', sla_pct: 95, avg_eta_min: 24, umsatz: 480 },
    { zone: 'Nord',  sla_pct: 88, avg_eta_min: 31, umsatz: 290 },
    { zone: 'Süd',   sla_pct: 82, avg_eta_min: 28, umsatz: 340 },
    { zone: 'West',  sla_pct: 71, avg_eta_min: 38, umsatz: 160 },
  ],
};

const TIER_CONFIG: Record<FahrerTour['tier'], { label: string; bg: string; border: string; badge: string; ring: string }> = {
  platin:  { label: 'Platin',  bg: 'bg-slate-50',   border: 'border-slate-300', badge: 'bg-slate-700 text-white',       ring: 'bg-slate-500'   },
  gold:    { label: 'Gold',    bg: 'bg-amber-50',   border: 'border-amber-300', badge: 'bg-amber-500 text-white',       ring: 'bg-amber-400'   },
  gut:     { label: 'Gut',     bg: 'bg-green-50',   border: 'border-green-200', badge: 'bg-green-600 text-white',       ring: 'bg-green-500'   },
  schwach: { label: 'Schwach', bg: 'bg-red-50',     border: 'border-red-200',   badge: 'bg-red-600 text-white',         ring: 'bg-red-500'     },
};

const STOPP_DOT: Record<string, string> = {
  fertig:      'bg-matcha-500',
  aktiv:       'bg-indigo-500 animate-pulse',
  verspaetet:  'bg-red-500',
  ausstehend:  'bg-muted-foreground/30',
};

function ScoreBar({ score }: { score: number }) {
  const w = `${score}%`;
  const cls = score >= 85 ? 'bg-matcha-500' : score >= 70 ? 'bg-amber-400' : score >= 55 ? 'bg-orange-400' : 'bg-red-500';
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-1.5 rounded-full ${cls}`} style={{ width: w }} />
    </div>
  );
}

export function DispatchPhase5030TourScoreVisualisierungV5() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  async function fetchData() {
    try {
      const r = await fetch('/api/delivery/admin/tour-score-stats', { cache: 'no-store' });
      if (!r.ok) throw new Error('api');
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 20_000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;

  return (
    <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-violet-600 text-white hover:bg-violet-700 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" />
          <span className="font-bold text-sm">Tour-Score V5</span>
        </div>
        <div className="flex items-center gap-3">
          {d.fleet_delta !== 0 && (
            <div className="flex items-center gap-1 text-xs">
              {d.fleet_delta > 0
                ? <TrendingUp className="h-3.5 w-3.5 text-green-300" />
                : <TrendingDown className="h-3.5 w-3.5 text-red-300" />}
              <span className={d.fleet_delta > 0 ? 'text-green-300' : 'text-red-300'}>
                {d.fleet_delta > 0 ? '+' : ''}{d.fleet_delta}
              </span>
            </div>
          )}
          <div className={`rounded-full px-3 py-0.5 text-sm font-black ${d.fleet_score >= 85 ? 'bg-green-500' : d.fleet_score >= 70 ? 'bg-amber-400 text-black' : 'bg-red-500'}`}>
            {d.fleet_score}
          </div>
          <span className="text-xs opacity-60">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {d.alert}
        </div>
      )}

      {open && (
        <div className="p-3 space-y-2">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">Lade Tour-Daten…</div>
          ) : (
            <>
              {/* Driver Cards */}
              {d.touren.map((t) => {
                const tc = TIER_CONFIG[t.tier];
                const donePct = t.stopps_gesamt > 0 ? Math.round((t.stopps_fertig / t.stopps_gesamt) * 100) : 0;
                return (
                  <div key={t.id} className={`rounded-xl border-2 p-3 ${tc.bg} ${tc.border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{t.fahrer}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tc.badge}`}>{tc.label}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />{t.zone}
                        </span>
                        {t.delay_risiko && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
                            <AlertTriangle className="h-3 w-3" />Risiko
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-base text-foreground">{t.score}</div>
                        <div className={`text-[10px] font-semibold ${t.score_delta > 0 ? 'text-green-600' : t.score_delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {t.score_delta > 0 ? '+' : ''}{t.score_delta}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <ScoreBar score={t.score} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {/* Stop dots */}
                      <div className="flex items-center gap-1">
                        {t.stopps.map((s, i) => (
                          <div key={i} className={`h-3 w-3 rounded-full ${STOPP_DOT[s.status]}`} title={s.status} />
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-1">{t.stopps_fertig}/{t.stopps_gesamt}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {t.eta_min != null && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />{t.eta_min}m
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 font-semibold text-emerald-700">
                          <Euro className="h-3 w-3" />{t.profit_eur.toFixed(2)}
                        </span>
                        <span>{t.puenktlichkeit_pct}% pünktl.</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Zone SLA Matrix */}
              <div className="mt-3 rounded-xl border border-violet-100 overflow-hidden">
                <div className="px-3 py-2 bg-violet-50 text-xs font-semibold text-violet-700 border-b border-violet-100 flex items-center gap-1">
                  <Route className="h-3.5 w-3.5" />Zonen SLA
                </div>
                <div className="grid grid-cols-4 divide-x divide-violet-100">
                  {d.zonen.map((z) => (
                    <div key={z.zone} className="px-2 py-2 text-center">
                      <div className="text-[10px] font-bold text-muted-foreground">{z.zone}</div>
                      <div className={`text-sm font-black ${z.sla_pct >= 90 ? 'text-green-600' : z.sla_pct >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                        {z.sla_pct}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">{z.avg_eta_min}m</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
