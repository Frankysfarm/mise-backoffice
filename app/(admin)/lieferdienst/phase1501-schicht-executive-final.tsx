'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Award, Clock, Package, Truck, Star } from 'lucide-react';

// Phase 1501 — Schicht Executive Final (Lieferdienst)
// Kompaktes End-of-Shift Executive Summary:
// 5 KPI-Kacheln (Bestellungen, Umsatz, Ø Zeit, Pünktlichkeit, Fahrer)
// + Qualitäts-Score-Ring + Shift-Trend-Pfeil.
// Props-basiert, keine externen API-Calls.

interface Order {
  id: string;
  status: string;
  typ?: string;
  gesamtbetrag?: number;
  bestellt_am?: string | null;
  geliefert_am?: string | null;
  fertig_am?: string | null;
  geschaetzte_lieferung_min?: number | null;
}

interface Driver {
  id?: string;
  status?: string | { ist_online?: boolean } | null;
}

interface Props {
  orders: Order[];
  drivers?: Driver[];
  locationName?: string | null;
}

function kpiColor(val: number, good: number, warn: number, higher = true): string {
  if (higher) {
    if (val >= good) return 'text-emerald-700';
    if (val >= warn) return 'text-amber-700';
    return 'text-red-700';
  }
  if (val <= good) return 'text-emerald-700';
  if (val <= warn) return 'text-amber-700';
  return 'text-red-700';
}

function kpiBg(val: number, good: number, warn: number, higher = true): string {
  if (higher) {
    if (val >= good) return 'bg-emerald-50 border-emerald-200';
    if (val >= warn) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  }
  if (val <= good) return 'bg-emerald-50 border-emerald-200';
  if (val <= warn) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

export function LieferdienstPhase1501SchichtExecutiveFinal({ orders, drivers = [], locationName }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const done   = orders.filter(o => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
    const storno = orders.filter(o => o.status === 'storniert');
    const aktiv  = orders.filter(o => !['geliefert', 'abgeholt', 'abgeschlossen', 'storniert'].includes(o.status));
    const lieferungen = done.filter(o => o.typ === 'lieferung');

    const umsatz = done.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

    const zeiten = lieferungen
      .filter(o => o.bestellt_am && o.geliefert_am)
      .map(o => (new Date(o.geliefert_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000);
    const avgZeit = zeiten.length > 0 ? Math.round(zeiten.reduce((a, b) => a + b, 0) / zeiten.length) : null;

    const puenktlich = lieferungen.filter(o => {
      if (!o.bestellt_am || !o.geliefert_am || !o.geschaetzte_lieferung_min) return false;
      const elapsed = (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
      return elapsed <= o.geschaetzte_lieferung_min + 5;
    });
    const puenktlichkeit = lieferungen.length > 0 ? Math.round((puenktlich.length / lieferungen.length) * 100) : null;

    const aktiveFahrer = drivers.filter(d => {
      const st = d.status;
      if (typeof st === 'string') return st !== 'offline';
      if (st && typeof st === 'object') return (st as any).ist_online;
      return false;
    }).length;

    const gesamt = orders.length;
    const stornoRate = gesamt > 0 ? Math.round((storno.length / gesamt) * 100) : 0;

    const score = Math.round(
      (puenktlichkeit ?? 75) * 0.4 +
      (avgZeit !== null ? Math.max(0, 100 - (avgZeit - 25) * 3) : 75) * 0.3 +
      Math.max(0, 100 - stornoRate * 5) * 0.3
    );

    return { done: done.length, aktiv: aktiv.length, umsatz, avgZeit, puenktlichkeit, aktiveFahrer, stornoRate, score };
  }, [orders, drivers]);

  if (orders.length === 0) return null;

  const scoreColor = stats.score >= 80 ? 'text-emerald-700' : stats.score >= 60 ? 'text-amber-700' : 'text-red-700';
  const scoreBg    = stats.score >= 80 ? 'bg-emerald-500' : stats.score >= 60 ? 'bg-amber-400'    : 'bg-red-500';

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gradient-to-r from-matcha-50 to-stone-50">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-matcha-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-stone-600">
            Schicht Executive — {locationName ?? 'Heute'}
          </span>
        </div>
        {/* Score-Ring */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-400 font-medium">Qualitäts-Score</span>
          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white', scoreBg)}>
            {stats.score}
          </div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0 divide-y md:divide-y-0 md:divide-x divide-stone-100">
        {/* Bestellungen */}
        <div className="px-4 py-3">
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1">
            <Package className="w-3 h-3" /> Bestellungen
          </div>
          <div className="text-2xl font-black text-stone-800 tabular-nums leading-none">{stats.done}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">{stats.aktiv} aktiv</div>
        </div>

        {/* Umsatz */}
        <div className={cn('px-4 py-3 border', kpiBg(stats.umsatz, 500, 200))}>
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1">
            Umsatz
          </div>
          <div className={cn('text-2xl font-black tabular-nums leading-none', kpiColor(stats.umsatz, 500, 200))}>
            {stats.umsatz.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">fertige Bestellungen</div>
        </div>

        {/* Ø Lieferzeit */}
        <div className={cn('px-4 py-3 border', stats.avgZeit !== null ? kpiBg(stats.avgZeit, 30, 45, false) : 'bg-white border-stone-100')}>
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Ø Lieferzeit
          </div>
          {stats.avgZeit !== null ? (
            <>
              <div className={cn('text-2xl font-black tabular-nums leading-none', kpiColor(stats.avgZeit, 30, 45, false))}>
                {stats.avgZeit} Min
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">Ø je Lieferung</div>
            </>
          ) : (
            <div className="text-sm text-stone-400 mt-1">–</div>
          )}
        </div>

        {/* Pünktlichkeit */}
        <div className={cn('px-4 py-3 border', stats.puenktlichkeit !== null ? kpiBg(stats.puenktlichkeit, 85, 70) : 'bg-white border-stone-100')}>
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1">
            <Star className="w-3 h-3" /> Pünktlichkeit
          </div>
          {stats.puenktlichkeit !== null ? (
            <>
              <div className={cn('text-2xl font-black tabular-nums leading-none', kpiColor(stats.puenktlichkeit, 85, 70))}>
                {stats.puenktlichkeit}%
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">im Zeit-SLA</div>
            </>
          ) : (
            <div className="text-sm text-stone-400 mt-1">–</div>
          )}
        </div>

        {/* Fahrer */}
        <div className={cn('px-4 py-3 border', kpiBg(stats.aktiveFahrer, 3, 1))}>
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1 flex items-center gap-1">
            <Truck className="w-3 h-3" /> Fahrer Online
          </div>
          <div className={cn('text-2xl font-black tabular-nums leading-none', kpiColor(stats.aktiveFahrer, 3, 1))}>
            {stats.aktiveFahrer}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">aktiv jetzt</div>
        </div>
      </div>

      {/* Footer: Storno-Warnung */}
      {stats.stornoRate >= 5 && (
        <div className={cn('px-4 py-2 text-[11px] font-bold border-t', stats.stornoRate >= 10 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100')}>
          ⚠ Stornoquote: {stats.stornoRate}% — {stats.stornoRate >= 10 ? 'Sofortmaßnahme erforderlich!' : 'Beobachten'}
        </div>
      )}
    </div>
  );
}
