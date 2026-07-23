'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, MapPin, Target, TrendingUp, User, Zap } from 'lucide-react';

/**
 * Phase 3355 — Tour-Score & Visualisierung Kommando-Hub
 *
 * Score-Ring SVG 0–100 je aktiver Tour; farbkodierte Stopp-Timeline;
 * Sub-Scores Pünktlichkeit/Abschluss/Speed; Flotten-Ø-Score;
 * expandierbare Stopp-Liste; Alert Score <65; 20-Sek-Polling.
 */

interface StopVis {
  sequence: number;
  address: string;
  status: 'delivered' | 'en_route' | 'pending' | 'problem';
  eta_min: number | null;
}

interface TourRow {
  tour_id: string;
  fahrer_name: string;
  score: number;
  sub_puenktlichkeit: number;
  sub_abschluss: number;
  sub_speed: number;
  stops_total: number;
  stops_done: number;
  eta_return_min: number | null;
  stops: StopVis[];
}

interface ApiData {
  touren: TourRow[];
  fleet_avg_score: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fleet_avg_score: 74,
  alert_count: 1,
  touren: [
    {
      tour_id: 't1', fahrer_name: 'Julia F.', score: 88,
      sub_puenktlichkeit: 91, sub_abschluss: 90, sub_speed: 83,
      stops_total: 4, stops_done: 2, eta_return_min: 28,
      stops: [
        { sequence: 1, address: 'Hauptstr. 12', status: 'delivered', eta_min: null },
        { sequence: 2, address: 'Gartenweg 5',  status: 'delivered', eta_min: null },
        { sequence: 3, address: 'Parkstr. 9',   status: 'en_route',  eta_min: 6   },
        { sequence: 4, address: 'Lindenallee 3',status: 'pending',   eta_min: 15  },
      ],
    },
    {
      tour_id: 't2', fahrer_name: 'Max M.', score: 62,
      sub_puenktlichkeit: 58, sub_abschluss: 70, sub_speed: 60,
      stops_total: 3, stops_done: 0, eta_return_min: 45,
      stops: [
        { sequence: 1, address: 'Bahnhofstr. 7', status: 'en_route', eta_min: 9  },
        { sequence: 2, address: 'Marktplatz 1',  status: 'pending',  eta_min: 19 },
        { sequence: 3, address: 'Rosenweg 4',    status: 'pending',  eta_min: 28 },
      ],
    },
    {
      tour_id: 't3', fahrer_name: 'Sara K.', score: 76,
      sub_puenktlichkeit: 80, sub_abschluss: 75, sub_speed: 73,
      stops_total: 3, stops_done: 2, eta_return_min: 12,
      stops: [
        { sequence: 1, address: 'Elisenstr. 2', status: 'delivered', eta_min: null },
        { sequence: 2, address: 'Hubertusstr.', status: 'delivered', eta_min: null },
        { sequence: 3, address: 'Sternweg 8',   status: 'en_route',  eta_min: 4   },
      ],
    },
  ],
};

function scoreColor(s: number) {
  if (s >= 85) return { stroke: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-200 dark:border-emerald-800' };
  if (s >= 70) return { stroke: '#f59e0b', text: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950',   border: 'border-amber-200 dark:border-amber-800'   };
  if (s >= 55) return { stroke: '#f97316', text: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800' };
  return               { stroke: '#ef4444', text: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950',       border: 'border-red-200 dark:border-red-800'       };
}

function stopColor(s: StopVis['status']) {
  if (s === 'delivered') return 'bg-emerald-500';
  if (s === 'en_route')  return 'bg-blue-500';
  if (s === 'problem')   return 'bg-red-500';
  return 'bg-gray-300 dark:bg-gray-600';
}

function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const c = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={c.stroke} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={13} fontWeight="700" fill={c.stroke}>{score}</text>
    </svg>
  );
}

export function DispatchPhase3355TourScoreVisualisierungKommandoHub({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const r = await fetch(`/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`);
        if (r.ok && active) setData(await r.json());
        else if (active) setData(MOCK);
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const alerts = d.touren.filter(t => t.score < 65);
  const avgColor = scoreColor(d.fleet_avg_score);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Target className="w-4 h-4 text-violet-500" />
          Tour-Score &amp; Visualisierung
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Flotten-Ø</span>
          <span className={`font-bold ${avgColor.text}`}>{d.fleet_avg_score}</span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{alerts.length}</strong> Tour{alerts.length > 1 ? 'en' : ''} mit Score &lt; 65 — Sofortmaßnahme!</span>
        </div>
      )}

      <div className="space-y-2">
        {d.touren.map(tour => {
          const c = scoreColor(tour.score);
          const isOpen = expanded.has(tour.tour_id);
          const progressPct = Math.round((tour.stops_done / Math.max(1, tour.stops_total)) * 100);
          return (
            <div key={tour.tour_id} className={`rounded-lg border ${c.border} ${c.bg} p-3 space-y-2`}>
              <div className="flex items-center gap-3">
                <ScoreRing score={tour.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate">{tour.fahrer_name}</span>
                    {tour.eta_return_min !== null && (
                      <span className="text-[10px] text-muted-foreground shrink-0">↩ {tour.eta_return_min} min</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>⏱ {tour.sub_puenktlichkeit}</span>
                    <span>✓ {tour.sub_abschluss}</span>
                    <span>⚡ {tour.sub_speed}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
                    <div className={`h-full rounded-full ${c.stroke === '#10b981' ? 'bg-emerald-500' : c.stroke === '#f59e0b' ? 'bg-amber-400' : c.stroke === '#f97316' ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <button onClick={() => toggle(tour.tour_id)} className="text-muted-foreground hover:text-foreground ml-1 shrink-0">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Stopp-Timeline */}
              <div className="flex items-center gap-1">
                {tour.stops.map((s, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${stopColor(s.status)} ring-2 ring-white dark:ring-gray-800`} title={s.address} />
                    {i < tour.stops.length - 1 && <div className="w-4 h-px bg-gray-300 dark:bg-gray-600" />}
                  </div>
                ))}
                <span className="text-[10px] text-muted-foreground ml-2">{tour.stops_done}/{tour.stops_total} Stopps</span>
              </div>

              {isOpen && (
                <div className="space-y-1 pt-1 border-t border-black/10">
                  {tour.stops.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${stopColor(s.status)}`} />
                      <span className="flex-1 truncate text-muted-foreground">{s.address}</span>
                      {s.eta_min !== null && <span className="text-[10px] shrink-0">{s.eta_min} min</span>}
                      {s.status === 'delivered' && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 pt-1 border-t border-border">
        {[
          { label: 'Geliefert', dot: 'bg-emerald-500' },
          { label: 'Unterwegs', dot: 'bg-blue-500' },
          { label: 'Ausstehend', dot: 'bg-gray-300 dark:bg-gray-600' },
          { label: 'Problem', dot: 'bg-red-500' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${l.dot}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
