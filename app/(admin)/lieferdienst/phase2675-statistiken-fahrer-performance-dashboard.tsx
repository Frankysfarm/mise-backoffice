'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Award, Bike, Clock, Star, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Phase 2675 — Statistiken Fahrer-Performance-Dashboard (Lieferdienst)
 *
 * Fahrer-Rangliste mit Score+KPI-Grid; Schicht-Trend-BarChart;
 * Top-3 Badges; Alert-Strip; 2-Min-Polling.
 */

interface FahrerStat {
  id: string;
  name: string;
  score: number;
  lieferungen: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  bewertung: number;
  km_heute: number;
  aktiv: boolean;
  trend: 'up' | 'down' | 'stable';
}

interface StundenBar {
  hour: string;
  lieferungen: number;
  isCurrent: boolean;
}

interface ApiData {
  fahrer: FahrerStat[];
  stundenVerlauf: StundenBar[];
  gesamt_lieferungen: number;
  gesamt_umsatz_eur: number;
  alert_count: number;
}

const MOCK: ApiData = {
  gesamt_lieferungen: 94,
  gesamt_umsatz_eur: 2710.50,
  alert_count: 1,
  fahrer: [
    { id: 'f1', name: 'Julia F.',  score: 92, lieferungen: 24, avg_lieferzeit_min: 19, puenktlichkeit_pct: 96, bewertung: 4.9, km_heute: 38, aktiv: true,  trend: 'up'     },
    { id: 'f2', name: 'Sara K.',   score: 81, lieferungen: 20, avg_lieferzeit_min: 22, puenktlichkeit_pct: 85, bewertung: 4.7, km_heute: 31, aktiv: true,  trend: 'stable' },
    { id: 'f3', name: 'Max M.',    score: 74, lieferungen: 18, avg_lieferzeit_min: 25, puenktlichkeit_pct: 78, bewertung: 4.4, km_heute: 28, aktiv: true,  trend: 'up'     },
    { id: 'f4', name: 'Tim B.',    score: 62, lieferungen: 14, avg_lieferzeit_min: 29, puenktlichkeit_pct: 64, bewertung: 4.1, km_heute: 22, aktiv: true,  trend: 'down'   },
    { id: 'f5', name: 'Leon D.',   score: 55, lieferungen: 10, avg_lieferzeit_min: 33, puenktlichkeit_pct: 58, bewertung: 3.8, km_heute: 16, aktiv: false, trend: 'down'   },
    { id: 'f6', name: 'Anna W.',   score: 88, lieferungen: 8,  avg_lieferzeit_min: 20, puenktlichkeit_pct: 90, bewertung: 4.8, km_heute: 12, aktiv: false, trend: 'stable' },
  ],
  stundenVerlauf: Array.from({ length: 10 }, (_, i) => ({
    hour: `${String(12 + i).padStart(2, '0')}:00`,
    lieferungen: Math.round(3 + Math.random() * 12),
    isCurrent: i === 9,
  })),
};

function scoreColor(s: number): string {
  if (s >= 85) return 'text-emerald-600';
  if (s >= 70) return 'text-amber-600';
  if (s >= 55) return 'text-orange-600';
  return 'text-red-600';
}

function scoreBg(s: number): string {
  if (s >= 85) return 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800';
  if (s >= 70) return 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800';
  if (s >= 55) return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
  return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
}

function TrendIcon({ t }: { t: FahrerStat['trend'] }) {
  if (t === 'up')   return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (t === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <span className="w-3 h-3 text-gray-400 text-[10px] flex items-center">—</span>;
}

export function LieferdienstPhase2675StatistikFahrerPerformanceDashboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [chartMode, setChartMode] = useState<'lieferungen'>('lieferungen');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const r = await fetch(`/api/delivery/admin/statistiken-fahrer-performance?location_id=${locationId}`);
        if (r.ok && active) setData(await r.json());
        else if (active) setData(MOCK);
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const sorted = [...d.fahrer].sort((a, b) => b.score - a.score);
  const alerts = d.fahrer.filter(f => f.score < 65 && f.aktiv);

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Bike className="w-4 h-4 text-violet-500" />
          Fahrer-Performance
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{d.gesamt_lieferungen} Lieferungen</span>
          <span className="font-medium text-foreground">{d.gesamt_umsatz_eur.toFixed(2)} €</span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{alerts.map(a => a.name).join(', ')}</strong> — Score unter 65!</span>
        </div>
      )}

      {/* Top-3 Badges */}
      <div className="grid grid-cols-3 gap-2">
        {sorted.slice(0, 3).map((f, i) => (
          <div key={f.id} className="rounded-lg bg-muted/40 p-2 text-center">
            <div className="text-base">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
            <div className="text-xs font-semibold mt-0.5 truncate">{f.name.split(' ')[0]}</div>
            <div className={`text-lg font-bold ${scoreColor(f.score)}`}>{f.score}</div>
            <div className="text-[10px] text-muted-foreground">{f.lieferungen} Liefg.</div>
          </div>
        ))}
      </div>

      {/* Fahrer-Tabelle */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => (
          <div key={f.id} className={`rounded-lg border p-2.5 ${scoreBg(f.score)}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
              <div className={`w-2 h-2 rounded-full shrink-0 ${f.aktiv ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className="font-medium flex-1 truncate">{f.name}</span>
              <TrendIcon t={f.trend} />
              <span className={`text-base font-bold tabular-nums ${scoreColor(f.score)}`}>{f.score}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1.5 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{f.avg_lieferzeit_min}m</div>
              <div className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{f.puenktlichkeit_pct}%</div>
              <div className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-amber-400" />{f.bewertung}</div>
              <div className="flex items-center gap-0.5"><Activity className="w-2.5 h-2.5" />{f.km_heute}km</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stundenverlauf Chart */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">Lieferungen / Stunde</div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.stundenVerlauf} barSize={14}>
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(v: number) => [`${v} Liefg.`]}
                labelStyle={{ fontSize: 10 }}
              />
              <Bar dataKey="lieferungen" radius={[3, 3, 0, 0]}>
                {d.stundenVerlauf.map((h, i) => (
                  <Cell key={i} fill={h.isCurrent ? '#8b5cf6' : '#c4b5fd'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2">
        <span>2-Min-Polling • {new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}</span>
        <div className="flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
          </span>
          Live
        </div>
      </div>
    </div>
  );
}
