'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, MapPin, Star, Zap, Clock } from 'lucide-react';

/**
 * Phase 4000 — Tour-Score Live-Kommando
 * Flotten-KPI Avg/Top/Aktiv/Alerts; Score-Balken 0–100 je Fahrer;
 * Stopp-Dot-Timeline farbkodiert; Sub-KPIs aufklappbar;
 * Alert Score<70; 20-Sek-Polling; Mock-Fallback.
 */

interface Stopp {
  idx: number;
  status: 'geliefert' | 'aktiv' | 'ausstehend';
  eta_min: number | null;
  adresse?: string;
}

interface FahrerRow {
  id: string;
  name: string;
  score: number;
  puenktlichkeit: number;
  lieferzeit_min: number;
  bewertung: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  stopps: Stopp[];
}

interface FleetKpi {
  avg_score: number;
  top_score: number;
  alert_count: number;
  aktive_fahrer: number;
  touren_heute: number;
}

const MOCK_FLEET: FleetKpi = {
  avg_score: 76,
  top_score: 94,
  alert_count: 2,
  aktive_fahrer: 5,
  touren_heute: 18,
};

const MOCK_FAHRER: FahrerRow[] = [
  {
    id: 'f1', name: 'Max K.', score: 94, puenktlichkeit: 96, lieferzeit_min: 21, bewertung: 4.9,
    stopps_gesamt: 4, stopps_fertig: 3,
    stopps: [
      { idx: 0, status: 'geliefert', eta_min: null, adresse: 'Hauptstr. 12' },
      { idx: 1, status: 'geliefert', eta_min: null, adresse: 'Parkweg 5' },
      { idx: 2, status: 'geliefert', eta_min: null, adresse: 'Gartenstr. 8' },
      { idx: 3, status: 'aktiv',     eta_min: 5,    adresse: 'Lindenallee 3' },
    ],
  },
  {
    id: 'f2', name: 'Sara M.', score: 81, puenktlichkeit: 85, lieferzeit_min: 26, bewertung: 4.7,
    stopps_gesamt: 3, stopps_fertig: 1,
    stopps: [
      { idx: 0, status: 'geliefert', eta_min: null },
      { idx: 1, status: 'aktiv',     eta_min: 8 },
      { idx: 2, status: 'ausstehend', eta_min: 17 },
    ],
  },
  {
    id: 'f3', name: 'Jonas B.', score: 65, puenktlichkeit: 68, lieferzeit_min: 35, bewertung: 4.2,
    stopps_gesamt: 5, stopps_fertig: 2,
    stopps: [
      { idx: 0, status: 'geliefert', eta_min: null },
      { idx: 1, status: 'geliefert', eta_min: null },
      { idx: 2, status: 'aktiv',     eta_min: 10 },
      { idx: 3, status: 'ausstehend', eta_min: 19 },
      { idx: 4, status: 'ausstehend', eta_min: 28 },
    ],
  },
  {
    id: 'f4', name: 'Lena W.', score: 59, puenktlichkeit: 62, lieferzeit_min: 40, bewertung: 4.0,
    stopps_gesamt: 3, stopps_fertig: 0,
    stopps: [
      { idx: 0, status: 'aktiv',      eta_min: 13 },
      { idx: 1, status: 'ausstehend', eta_min: 23 },
      { idx: 2, status: 'ausstehend', eta_min: 33 },
    ],
  },
  {
    id: 'f5', name: 'Tim R.', score: 88, puenktlichkeit: 91, lieferzeit_min: 23, bewertung: 4.8,
    stopps_gesamt: 4, stopps_fertig: 2,
    stopps: [
      { idx: 0, status: 'geliefert', eta_min: null },
      { idx: 1, status: 'geliefert', eta_min: null },
      { idx: 2, status: 'aktiv',     eta_min: 6 },
      { idx: 3, status: 'ausstehend', eta_min: 15 },
    ],
  },
];

function scoreStyle(s: number) {
  if (s >= 80) return { bar: 'bg-emerald-500', txt: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30', badge: 'bg-emerald-100 text-emerald-700' };
  if (s >= 65) return { bar: 'bg-amber-400',   txt: 'text-amber-700',   bg: 'bg-amber-50 dark:bg-amber-950/30',   badge: 'bg-amber-100 text-amber-700' };
  return              { bar: 'bg-red-500',      txt: 'text-red-700',     bg: 'bg-red-50 dark:bg-red-950/30',       badge: 'bg-red-100 text-red-700' };
}

function stoppColor(s: Stopp['status']) {
  if (s === 'geliefert') return 'bg-emerald-500';
  if (s === 'aktiv')     return 'bg-blue-500 ring-2 ring-blue-300 animate-pulse';
  return 'bg-slate-300 dark:bg-slate-600';
}

export function DispatchPhase4000TourScoreLiveKommando({ locationId }: { locationId?: string | null }) {
  const [fleet, setFleet] = useState<FleetKpi>(MOCK_FLEET);
  const [fahrer, setFahrer] = useState<FahrerRow[]>(MOCK_FAHRER);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/tours?location_id=${locationId}&limit=10`);
      if (res.ok) {
        const d = await res.json();
        if (d?.fleet) setFleet(d.fleet);
        if (Array.isArray(d?.fahrer) && d.fahrer.length > 0) setFahrer(d.fahrer);
      }
    } catch { /* Mock-Fallback */ }
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const sorted = [...fahrer].sort((a, b) => b.score - a.score);
  const alerts = sorted.filter(f => f.score < 70);

  function toggle(id: string) {
    setExpanded(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 overflow-hidden bg-amber-50/30 dark:bg-amber-950/10">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/60 dark:bg-amber-900/20 border-b">
        <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-display text-xs font-black uppercase tracking-wider text-foreground">
          Tour-Score · Live-Kommando
        </span>
        {loading && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
        {alerts.length > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {alerts.length} Score &lt;70
          </span>
        )}
      </div>

      {/* Flotten-KPI-Grid */}
      <div className="grid grid-cols-4 divide-x border-b text-center bg-white/40 dark:bg-black/10">
        {[
          { label: 'Ø Score',    value: `${fleet.avg_score}`,          cls: fleet.avg_score >= 80 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Top Score',  value: `${fleet.top_score}`,          cls: 'text-emerald-600' },
          { label: 'Aktiv',      value: `${fleet.aktive_fahrer}`,      cls: 'text-foreground' },
          { label: 'Touren',     value: `${fleet.touren_heute}`,       cls: 'text-foreground' },
        ].map(kpi => (
          <div key={kpi.label} className="px-2 py-2">
            <div className="text-[8px] uppercase tracking-wide text-muted-foreground mb-0.5">{kpi.label}</div>
            <div className={`font-display text-sm font-black tabular-nums ${kpi.cls}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Fahrer-Liste */}
      <div className="divide-y">
        {sorted.map(f => {
          const ss = scoreStyle(f.score);
          const isOpen = expanded.has(f.id);
          const progress = f.stopps_gesamt > 0 ? Math.round((f.stopps_fertig / f.stopps_gesamt) * 100) : 0;

          return (
            <div key={f.id} className={`${ss.bg} transition-colors`}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggle(f.id)}
              >
                {/* Score-Badge */}
                <div className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black tabular-nums min-w-[38px] text-center ${ss.badge}`}>
                  {f.score}
                </div>

                {/* Name + Stopps */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-foreground truncate">{f.name}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{f.stopps_fertig}/{f.stopps_gesamt} Stopps</span>
                  </div>

                  {/* Stopp-Dots */}
                  <div className="flex items-center gap-1">
                    {f.stopps.map(s => (
                      <div
                        key={s.idx}
                        title={s.eta_min !== null ? `~${s.eta_min} Min` : s.status}
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${stoppColor(s.status)}`}
                      />
                    ))}
                    {f.stopps_gesamt > f.stopps.length && (
                      <span className="text-[8px] text-muted-foreground">+{f.stopps_gesamt - f.stopps.length}</span>
                    )}
                  </div>
                </div>

                {/* Score-Balken */}
                <div className="shrink-0 w-16">
                  <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                    <div className={`h-full rounded-full ${ss.bar}`} style={{ width: `${f.score}%` }} />
                  </div>
                  <div className="text-[8px] text-muted-foreground mt-0.5 text-right tabular-nums">{progress}%</div>
                </div>

                <div className={`shrink-0 text-[8px] transition-transform ${isOpen ? 'rotate-180' : ''} text-muted-foreground`}>▼</div>
              </button>

              {/* Aufgeklappte Sub-KPIs */}
              {isOpen && (
                <div className="px-4 pb-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Pünktlich',    value: `${f.puenktlichkeit}%`, good: f.puenktlichkeit >= 80, icon: <Clock className="h-3 w-3" /> },
                    { label: 'Lieferzeit',   value: `${f.lieferzeit_min} Min`, good: f.lieferzeit_min <= 28, icon: <MapPin className="h-3 w-3" /> },
                    { label: 'Bewertung',    value: `${f.bewertung.toFixed(1)} ★`, good: f.bewertung >= 4.5, icon: <Star className="h-3 w-3" /> },
                  ].map(kpi => (
                    <div key={kpi.label} className="rounded-lg bg-white/60 dark:bg-black/20 px-2 py-1.5 flex items-center gap-1.5">
                      <span className={kpi.good ? 'text-emerald-600' : 'text-amber-600'}>{kpi.icon}</span>
                      <div>
                        <div className="text-[8px] text-muted-foreground">{kpi.label}</div>
                        <div className={`text-[11px] font-black tabular-nums ${kpi.good ? 'text-emerald-700' : 'text-amber-700'}`}>{kpi.value}</div>
                      </div>
                    </div>
                  ))}

                  {/* Nächster aktiver Stopp */}
                  {(() => {
                    const next = f.stopps.find(s => s.status === 'aktiv');
                    if (!next) return null;
                    return (
                      <div className="col-span-3 flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 px-2 py-1.5">
                        <Zap className="h-3 w-3 text-blue-600 shrink-0" />
                        <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400">
                          Nächster Stopp{next.adresse ? `: ${next.adresse}` : ''}
                          {next.eta_min !== null ? ` · ~${next.eta_min} Min` : ''}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/20 text-[9px] text-muted-foreground">
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>Flotten-Avg {fleet.avg_score} · Alerts: {alerts.length}</span>
        <span className="ml-auto">20s-Polling · Klick = Details</span>
      </div>
    </div>
  );
}
