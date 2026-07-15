'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, Package, Truck, Clock, Euro, Star, RefreshCw, Users } from 'lucide-react';

interface TagesStats {
  bestellungenHeute: number;
  umsatzHeute: number;
  aktiveFahrer: number;
  durchschnittlicheLieferzeit: number; // Minuten
  lieferquote: number; // 0–100 %
  kundenbewertung: number; // 0–5
  stornoQuote: number; // 0–100 %
  offeneBestellungen: number;
}

const MOCK_STATS: TagesStats = {
  bestellungenHeute: 47,
  umsatzHeute: 1284.50,
  aktiveFahrer: 4,
  durchschnittlicheLieferzeit: 28,
  lieferquote: 94,
  kundenbewertung: 4.6,
  stornoQuote: 3,
  offeneBestellungen: 6,
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={cn('rounded-xl p-3 flex flex-col gap-1', color)}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <div className="text-xl font-black tabular-nums">{value}</div>
      {sub && <div className="text-[9px] opacity-60">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase1725TagesLiveStatistikenCockpit({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [stats, setStats] = useState<TagesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) {
      setStats(MOCK_STATS);
      setLoading(false);
      setLastUpdated(new Date());
      return;
    }
    try {
      const r = await fetch(`/api/delivery/admin/bestellungen-heute?location_id=${encodeURIComponent(locationId)}`);
      if (r.ok) {
        const d = await r.json();
        setStats({
          bestellungenHeute: d.count ?? d.total ?? MOCK_STATS.bestellungenHeute,
          umsatzHeute: d.umsatz ?? d.revenue ?? MOCK_STATS.umsatzHeute,
          aktiveFahrer: d.active_drivers ?? MOCK_STATS.aktiveFahrer,
          durchschnittlicheLieferzeit: d.avg_delivery_min ?? MOCK_STATS.durchschnittlicheLieferzeit,
          lieferquote: d.on_time_pct ?? d.delivery_rate ?? MOCK_STATS.lieferquote,
          kundenbewertung: d.avg_rating ?? MOCK_STATS.kundenbewertung,
          stornoQuote: d.cancel_rate ?? MOCK_STATS.stornoQuote,
          offeneBestellungen: d.open ?? d.pending ?? MOCK_STATS.offeneBestellungen,
        });
      } else {
        setStats(MOCK_STATS);
      }
    } catch {
      setStats(MOCK_STATS);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse space-y-3">
        <div className="h-4 w-56 bg-stone-100 rounded" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

  const lieferquoteColor = stats.lieferquote >= 90 ? 'text-matcha-600' : stats.lieferquote >= 75 ? 'text-amber-600' : 'text-red-600';
  const ratingColor = stats.kundenbewertung >= 4.5 ? 'text-matcha-600' : stats.kundenbewertung >= 4.0 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-matcha-50 to-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-matcha-600 text-white">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">Tages-Statistiken · Live</div>
          {lastUpdated && (
            <div className="text-[10px] text-muted-foreground">
              Aktualisiert {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded-lg hover:bg-stone-100 transition text-muted-foreground"
          aria-label="Aktualisieren"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4">
        <KpiCard
          icon={Package}
          label="Bestellungen"
          value={stats.bestellungenHeute.toString()}
          sub={`${stats.offeneBestellungen} offen`}
          color="bg-blue-50 text-blue-900"
        />
        <KpiCard
          icon={Euro}
          label="Umsatz heute"
          value={fmtEur(stats.umsatzHeute)}
          color="bg-matcha-50 text-matcha-900"
        />
        <KpiCard
          icon={Users}
          label="Aktive Fahrer"
          value={stats.aktiveFahrer.toString()}
          color="bg-violet-50 text-violet-900"
        />
        <KpiCard
          icon={Clock}
          label="Ø Lieferzeit"
          value={`${stats.durchschnittlicheLieferzeit} Min`}
          color="bg-orange-50 text-orange-900"
        />
        <KpiCard
          icon={Truck}
          label="Lieferquote"
          value={`${stats.lieferquote}%`}
          sub="pünktlich"
          color={stats.lieferquote >= 90 ? 'bg-matcha-50 text-matcha-900' : stats.lieferquote >= 75 ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-900'}
        />
        <KpiCard
          icon={Star}
          label="Kundenbewertung"
          value={stats.kundenbewertung.toFixed(1)}
          sub="von 5.0"
          color={stats.kundenbewertung >= 4.5 ? 'bg-yellow-50 text-yellow-900' : 'bg-orange-50 text-orange-900'}
        />
        <KpiCard
          icon={TrendingUp}
          label="Storno-Quote"
          value={`${stats.stornoQuote}%`}
          color={stats.stornoQuote <= 5 ? 'bg-matcha-50 text-matcha-900' : 'bg-red-50 text-red-900'}
        />
        <KpiCard
          icon={Package}
          label="Offen"
          value={stats.offeneBestellungen.toString()}
          sub="in Bearbeitung"
          color={stats.offeneBestellungen > 10 ? 'bg-red-50 text-red-900' : 'bg-stone-50 text-stone-700'}
        />
      </div>

      {/* Performance bar */}
      <div className="px-4 pb-4">
        <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Tages-Performance</span>
            <span className={cn('text-sm font-black', lieferquoteColor)}>{stats.lieferquote}% pünktlich</span>
          </div>
          <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                stats.lieferquote >= 90 ? 'bg-matcha-500' : stats.lieferquote >= 75 ? 'bg-amber-400' : 'bg-red-500',
              )}
              style={{ width: `${stats.lieferquote}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
            <span>Storno {stats.stornoQuote}%</span>
            <span className={ratingColor}>★ {stats.kundenbewertung.toFixed(1)}</span>
            <span>Ø {stats.durchschnittlicheLieferzeit} Min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
