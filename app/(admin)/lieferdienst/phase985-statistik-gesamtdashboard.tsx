'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Euro, Clock, Package, Star,
  Users, MapPin, ChevronDown, ChevronUp, Loader2, Target, Zap, Award,
} from 'lucide-react';

/**
 * Phase 985 — Statistik-Gesamtdashboard (Lieferdienst)
 *
 * Umfassendes Statistiken-Dashboard mit:
 * - 8 Kern-KPIs (Umsatz, Bestellungen, Ø Lieferzeit, Pünktlichkeit,
 *   Stornoquote, Ø Bewertung, Aktive Fahrer, Touren heute)
 * - Trend-Ampeln vs. Vortag
 * - Top-Fahrer und beste Zone
 * - Stündlicher Umsatz-Balken (einfach, keine externe Chart-Lib)
 * Polling: 90s. Fallback: Mock-Daten.
 */

interface Stats {
  umsatzEur: number;
  umsatzTrend: number;
  bestellungen: number;
  bestellungenTrend: number;
  avgLieferzeitMin: number;
  lieferzeitTrend: number;
  puenktlichkeitPct: number;
  puenktlichkeitTrend: number;
  stornoquotePct: number;
  stornoquoteTrend: number;
  avgBewertung: number;
  bewertungTrend: number;
  aktiveFahrer: number;
  fahrer_trend: number;
  tourenHeute: number;
  touren_trend: number;
  topFahrer: string | null;
  besteZone: string | null;
  stundenUmsatz: { stunde: number; umsatz: number }[];
}

const MOCK: Stats = {
  umsatzEur: 2140.75,
  umsatzTrend: +12.4,
  bestellungen: 89,
  bestellungenTrend: +8.2,
  avgLieferzeitMin: 26.8,
  lieferzeitTrend: -3.1,
  puenktlichkeitPct: 91,
  puenktlichkeitTrend: +4.5,
  stornoquotePct: 2.8,
  stornoquoteTrend: -1.2,
  avgBewertung: 4.7,
  bewertungTrend: +0.2,
  aktiveFahrer: 5,
  fahrer_trend: +1,
  tourenHeute: 24,
  touren_trend: +3,
  topFahrer: 'M. Bauer',
  besteZone: 'Zone A',
  stundenUmsatz: [
    { stunde: 11, umsatz: 85 }, { stunde: 12, umsatz: 320 }, { stunde: 13, umsatz: 410 },
    { stunde: 14, umsatz: 195 }, { stunde: 15, umsatz: 140 }, { stunde: 16, umsatz: 160 },
    { stunde: 17, umsatz: 280 }, { stunde: 18, umsatz: 380 }, { stunde: 19, umsatz: 170 },
  ],
};

interface Props {
  locationId: string | null;
}

function TrendIndicator({ value, higherIsBetter }: { value: number; higherIsBetter: boolean }) {
  const good = higherIsBetter ? value > 0.2 : value < -0.2;
  const bad  = higherIsBetter ? value < -0.2 : value > 0.2;
  const cls  = good ? 'text-matcha-600 dark:text-matcha-400' : bad ? 'text-red-600 dark:text-red-400' : 'text-zinc-400';
  const Icon = good ? TrendingUp : bad ? TrendingDown : Minus;
  return (
    <span className={cn('flex items-center gap-0.5 text-[9px] font-bold', cls)}>
      <Icon className="h-2.5 w-2.5" />
      {value > 0 ? '+' : ''}{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
    </span>
  );
}

function fmt(n: number, type: 'eur' | 'pct' | 'min' | 'stars' | 'int'): string {
  if (type === 'eur') return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  if (type === 'pct') return n.toFixed(1) + ' %';
  if (type === 'min') return n.toFixed(1) + ' Min';
  if (type === 'stars') return n.toFixed(1) + ' ★';
  return String(Math.round(n));
}

export function LieferdienstPhase985StatistikGesamtdashboard({ locationId }: Props) {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<'kpi' | 'verlauf'>('kpi');

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/stats?location_id=${locationId}`
        : '/api/delivery/admin/stats';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('api');
      const json = await res.json();
      setData(json);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [load]);

  const s = data ?? MOCK;
  const maxUmsatz = Math.max(...s.stundenUmsatz.map(h => h.umsatz), 1);

  const kpis = [
    { label: 'Umsatz heute', value: fmt(s.umsatzEur, 'eur'), trend: s.umsatzTrend, higherIsBetter: true, icon: <Euro className="h-3.5 w-3.5" />, bg: 'bg-matcha-50 dark:bg-matcha-900/20', iconBg: 'bg-matcha-100 dark:bg-matcha-800 text-matcha-700 dark:text-matcha-300' },
    { label: 'Bestellungen', value: fmt(s.bestellungen, 'int'), trend: s.bestellungenTrend, higherIsBetter: true, icon: <Package className="h-3.5 w-3.5" />, bg: 'bg-blue-50 dark:bg-blue-900/20', iconBg: 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300' },
    { label: 'Ø Lieferzeit', value: fmt(s.avgLieferzeitMin, 'min'), trend: s.lieferzeitTrend, higherIsBetter: false, icon: <Clock className="h-3.5 w-3.5" />, bg: 'bg-orange-50 dark:bg-orange-900/20', iconBg: 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300' },
    { label: 'Pünktlichkeit', value: fmt(s.puenktlichkeitPct, 'pct'), trend: s.puenktlichkeitTrend, higherIsBetter: true, icon: <Target className="h-3.5 w-3.5" />, bg: 'bg-violet-50 dark:bg-violet-900/20', iconBg: 'bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300' },
    { label: 'Stornoquote', value: fmt(s.stornoquotePct, 'pct'), trend: s.stornoquoteTrend, higherIsBetter: false, icon: <BarChart3 className="h-3.5 w-3.5" />, bg: 'bg-red-50 dark:bg-red-900/20', iconBg: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300' },
    { label: 'Ø Bewertung', value: fmt(s.avgBewertung, 'stars'), trend: s.bewertungTrend, higherIsBetter: true, icon: <Star className="h-3.5 w-3.5" />, bg: 'bg-amber-50 dark:bg-amber-900/20', iconBg: 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300' },
    { label: 'Aktive Fahrer', value: fmt(s.aktiveFahrer, 'int'), trend: s.fahrer_trend, higherIsBetter: true, icon: <Users className="h-3.5 w-3.5" />, bg: 'bg-teal-50 dark:bg-teal-900/20', iconBg: 'bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300' },
    { label: 'Touren heute', value: fmt(s.tourenHeute, 'int'), trend: s.touren_trend, higherIsBetter: true, icon: <Zap className="h-3.5 w-3.5" />, bg: 'bg-indigo-50 dark:bg-indigo-900/20', iconBg: 'bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300' },
  ];

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          <span className="text-sm font-bold">Statistik-Gesamtdashboard</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-mono tabular-nums text-muted-foreground">
            {fmt(s.umsatzEur, 'eur')} heute
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Section tabs */}
          <div className="flex gap-2 border-b pb-2">
            {(['kpi', 'verlauf'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSection(tab)}
                className={cn(
                  'text-xs font-bold px-3 py-1.5 rounded-lg transition',
                  section === tab
                    ? 'bg-matcha-100 dark:bg-matcha-800 text-matcha-700 dark:text-matcha-300'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'kpi' ? 'KPI-Übersicht' : 'Stunden-Verlauf'}
              </button>
            ))}
          </div>

          {section === 'kpi' && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {kpis.map(kpi => (
                  <div key={kpi.label} className={cn('rounded-xl p-3 flex flex-col gap-1', kpi.bg)}>
                    <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px]', kpi.iconBg)}>
                      {kpi.icon}
                    </div>
                    <div className="text-lg font-black tabular-nums leading-tight">{kpi.value}</div>
                    <div className="text-[9px] text-muted-foreground font-medium leading-tight">{kpi.label}</div>
                    <TrendIndicator value={kpi.trend} higherIsBetter={kpi.higherIsBetter} />
                  </div>
                ))}
              </div>

              {/* Top-Fahrer / Beste Zone */}
              {(s.topFahrer || s.besteZone) && (
                <div className="flex flex-wrap gap-2">
                  {s.topFahrer && (
                    <div className="flex items-center gap-2 rounded-xl border bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                      <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Top-Fahrer</div>
                        <div className="text-sm font-black text-amber-700 dark:text-amber-300">{s.topFahrer}</div>
                      </div>
                    </div>
                  )}
                  {s.besteZone && (
                    <div className="flex items-center gap-2 rounded-xl border bg-matcha-50 dark:bg-matcha-900/20 px-3 py-2">
                      <MapPin className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
                      <div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Beste Zone</div>
                        <div className="text-sm font-black text-matcha-700 dark:text-matcha-300">{s.besteZone}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {section === 'verlauf' && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Umsatz je Stunde (heute)</div>
              <div className="flex items-end gap-1.5 h-28">
                {s.stundenUmsatz.map(h => {
                  const heightPct = (h.umsatz / maxUmsatz) * 100;
                  return (
                    <div key={h.stunde} className="flex flex-col items-center gap-1 flex-1">
                      <div className="text-[8px] text-muted-foreground font-mono tabular-nums">
                        {h.umsatz > 0 ? Math.round(h.umsatz) : ''}
                      </div>
                      <div className="w-full rounded-t-md bg-matcha-400 dark:bg-matcha-600 transition-all" style={{ height: `${Math.max(4, heightPct)}%` }} />
                      <div className="text-[8px] text-muted-foreground">{h.stunde}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[9px] text-muted-foreground text-center mt-1">Uhrzeit (h)</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
