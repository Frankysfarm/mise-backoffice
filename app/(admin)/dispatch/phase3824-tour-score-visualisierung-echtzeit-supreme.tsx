'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, MapPin, Clock, AlertTriangle, Bike, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 3824 — Tour-Score & Visualisierung Echtzeit Supreme
 * Trophy-Icon amber; Flotten-KPI-Grid Ø/Top/Aktiv/Alerts;
 * Score-Balken 0–100 je Fahrer; Stopp-Dot-Timeline farbkodiert ausstehend/unterwegs/geliefert;
 * Sub-KPIs Pünktlichkeit/Lieferzeit/Bewertung aufklappbar;
 * Alert Score<70; 20-Sek-Polling; Mock-Fallback.
 */

interface StoppPunkt {
  id: string;
  nr: number;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
}

interface FahrerScore {
  fahrer_id: string;
  name: string;
  score: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  bewertung: number;
  stopps: StoppPunkt[];
  aktiv: boolean;
}

interface ApiData {
  fahrer: FahrerScore[];
  flotten_avg: number;
  top_score: number;
  aktiv_count: number;
  alert_count: number;
}

const MOCK: ApiData = {
  flotten_avg: 81,
  top_score: 94,
  aktiv_count: 4,
  alert_count: 1,
  fahrer: [
    {
      fahrer_id: 'f1', name: 'Jonas K.', score: 94, puenktlichkeit_pct: 96, avg_lieferzeit_min: 22.4, bewertung: 4.9, aktiv: true,
      stopps: [
        { id: 's1', nr: 1, status: 'geliefert', eta_min: null },
        { id: 's2', nr: 2, status: 'geliefert', eta_min: null },
        { id: 's3', nr: 3, status: 'unterwegs', eta_min: 8 },
        { id: 's4', nr: 4, status: 'ausstehend', eta_min: 22 },
      ],
    },
    {
      fahrer_id: 'f2', name: 'Maria S.', score: 88, puenktlichkeit_pct: 90, avg_lieferzeit_min: 24.1, bewertung: 4.7, aktiv: true,
      stopps: [
        { id: 's5', nr: 1, status: 'geliefert', eta_min: null },
        { id: 's6', nr: 2, status: 'unterwegs', eta_min: 5 },
        { id: 's7', nr: 3, status: 'ausstehend', eta_min: 18 },
      ],
    },
    {
      fahrer_id: 'f3', name: 'Felix B.', score: 72, puenktlichkeit_pct: 76, avg_lieferzeit_min: 28.3, bewertung: 4.5, aktiv: true,
      stopps: [
        { id: 's8', nr: 1, status: 'unterwegs', eta_min: 12 },
        { id: 's9', nr: 2, status: 'ausstehend', eta_min: 28 },
        { id: 's10', nr: 3, status: 'ausstehend', eta_min: 42 },
      ],
    },
    {
      fahrer_id: 'f4', name: 'Lena W.', score: 65, puenktlichkeit_pct: 68, avg_lieferzeit_min: 31.5, bewertung: 4.2, aktiv: true,
      stopps: [
        { id: 's11', nr: 1, status: 'ausstehend', eta_min: 15 },
        { id: 's12', nr: 2, status: 'ausstehend', eta_min: 30 },
      ],
    },
  ],
};

function scoreBarColor(s: number) {
  if (s >= 85) return 'bg-emerald-500';
  if (s >= 70) return 'bg-yellow-400';
  return 'bg-red-500';
}

function scoreTextColor(s: number) {
  if (s >= 85) return 'text-emerald-700 dark:text-emerald-400';
  if (s >= 70) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
}

function stoppDot(status: StoppPunkt['status']) {
  if (status === 'geliefert') return 'bg-emerald-500';
  if (status === 'unterwegs') return 'bg-blue-500 ring-2 ring-blue-200 animate-pulse';
  return 'bg-zinc-300 dark:bg-zinc-600';
}

export function DispatchPhase3824TourScoreVisualisierungEchtzeitSupreme() {
  const [data, setData]       = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data: rows } = await sb
        .from('driver_shifts')
        .select('driver_id, drivers(name), performance_score, punctuality_pct, avg_delivery_min, avg_rating, is_active')
        .eq('is_active', true)
        .order('performance_score', { ascending: false })
        .limit(6);
      if (rows && rows.length > 0) {
        const mapped: FahrerScore[] = rows.map((r: any) => ({
          fahrer_id: r.driver_id,
          name: r.drivers?.name ?? 'Fahrer',
          score: r.performance_score ?? 75,
          puenktlichkeit_pct: r.punctuality_pct ?? 80,
          avg_lieferzeit_min: r.avg_delivery_min ?? 25,
          bewertung: r.avg_rating ?? 4.5,
          aktiv: true,
          stopps: [],
        }));
        const avg = mapped.reduce((a, f) => a + f.score, 0) / mapped.length;
        setData({
          fahrer: mapped,
          flotten_avg: Math.round(avg),
          top_score: mapped[0]?.score ?? 0,
          aktiv_count: mapped.length,
          alert_count: mapped.filter(f => f.score < 70).length,
        });
      }
    } catch { /* mock */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const id = setInterval(fetch_, 20_000); return () => clearInterval(id); }, [fetch_]);

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="font-semibold text-sm">Tour-Score Echtzeit Supreme</span>
          {loading && <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />}
        </div>
        <span className="text-xs text-zinc-500">20s Polling</span>
      </div>

      {/* Flotten-KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Flotten-Ø', value: data.flotten_avg, suffix: '' },
          { label: 'Top-Score', value: data.top_score,   suffix: '' },
          { label: 'Aktiv',    value: data.aktiv_count,  suffix: '' },
          { label: 'Alerts',   value: data.alert_count,  suffix: '' },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-center">
            <div className={`text-base font-bold ${k.label === 'Alerts' && k.value > 0 ? 'text-red-600' : 'text-zinc-800 dark:text-zinc-100'}`}>{k.value}{k.suffix}</div>
            <div className="text-[10px] text-zinc-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{data.alert_count} Fahrer Score unter 70 — Maßnahmen einleiten!</span>
        </div>
      )}

      {/* Fahrer-Karten */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const open = expanded === f.fahrer_id;
          return (
            <div key={f.fahrer_id} className="rounded-lg border dark:border-zinc-700 overflow-hidden">
              <button
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setExpanded(open ? null : f.fahrer_id)}
              >
                {/* Name + score text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{f.name}</span>
                    <span className={`font-bold text-sm ml-2 ${scoreTextColor(f.score)}`}>{f.score}</span>
                  </div>
                  {/* Score bar */}
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${scoreBarColor(f.score)}`} style={{ width: `${f.score}%` }} />
                  </div>
                </div>
                {/* Stopp dots */}
                <div className="flex items-center gap-1 shrink-0">
                  {f.stopps.map(s => (
                    <span key={s.id} className={`h-2.5 w-2.5 rounded-full ${stoppDot(s.status)}`} title={`Stopp ${s.nr}: ${s.status}`} />
                  ))}
                  {f.stopps.length === 0 && <span className="text-[10px] text-zinc-400">–</span>}
                </div>
              </button>

              {/* Expanded sub-KPIs */}
              {open && (
                <div className="px-3 pb-2 border-t dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center">
                    <div className="text-sm font-semibold">{f.puenktlichkeit_pct}%</div>
                    <div className="text-[10px] text-zinc-500">Pünktlichkeit</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{f.avg_lieferzeit_min.toFixed(1)} min</div>
                    <div className="text-[10px] text-zinc-500">Ø Lieferzeit</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{f.bewertung.toFixed(1)} ★</div>
                    <div className="text-[10px] text-zinc-500">Bewertung</div>
                  </div>
                  {f.stopps.filter(s => s.eta_min !== null).map(s => (
                    <div key={s.id} className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <MapPin className="h-2.5 w-2.5" />
                      Stopp {s.nr}: {s.eta_min} min
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
