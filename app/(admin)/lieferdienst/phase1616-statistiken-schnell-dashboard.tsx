'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart2, Clock, Euro, Package, Star, TrendingUp, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stats = {
  bestellungen_heute: number;
  umsatz_heute: number;
  geliefert_heute: number;
  storniert_heute: number;
  avg_lieferzeit_min: number | null;
  avg_bewertung: number | null;
  fahrer_online: number;
  puenktlichkeit_pct: number | null;
};

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-stone-100 px-3 py-2.5 flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-stone-400">
        <Icon className={cn('h-3 w-3 shrink-0', color ?? 'text-stone-400')} />
        {label}
      </div>
      <div className={cn('text-2xl font-black tabular-nums leading-none', color ?? 'text-stone-800')}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-stone-400">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase1616StatistikenSchnellDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createClient();

    const load = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [
        { count: bestCount },
        { data: umsatzData },
        { count: geliefertCount },
        { count: stornoCount },
        { data: zeiten },
        { data: bewertungen },
        { data: fahrerOnline },
      ] = await Promise.all([
        sb.from('customer_orders').select('id', { count: 'exact', head: true }).gte('bestellt_am', todayISO),
        sb.from('customer_orders').select('gesamtbetrag').gte('bestellt_am', todayISO).in('status', ['geliefert', 'abgeholt', 'abgeschlossen']),
        sb.from('customer_orders').select('id', { count: 'exact', head: true }).gte('bestellt_am', todayISO).in('status', ['geliefert', 'abgeholt', 'abgeschlossen']),
        sb.from('customer_orders').select('id', { count: 'exact', head: true }).gte('bestellt_am', todayISO).eq('status', 'storniert'),
        sb.from('customer_orders').select('bestellt_am, geliefert_am').gte('bestellt_am', todayISO).in('status', ['geliefert', 'abgeholt']).not('geliefert_am', 'is', null),
        sb.from('delivery_ratings').select('gesamt_score').gte('erstellt_am', todayISO),
        sb.from('driver_status').select('id', { count: 'exact', head: true }).eq('ist_online', true),
      ]);

      const umsatz = ((umsatzData ?? []) as any[]).reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);

      const lieferzeiten = ((zeiten ?? []) as any[])
        .filter((o: any) => o.bestellt_am && o.geliefert_am)
        .map((o: any) => (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000);
      const avgLieferzeit = lieferzeiten.length > 0
        ? lieferzeiten.reduce((s: number, v: number) => s + v, 0) / lieferzeiten.length
        : null;
      const puenktlich = lieferzeiten.filter((t: number) => t <= 45).length;
      const puenktlichkeitPct = lieferzeiten.length > 0 ? Math.round((puenktlich / lieferzeiten.length) * 100) : null;

      const avgBewertung = bewertungen && (bewertungen as any[]).length > 0
        ? (bewertungen as any[]).reduce((s: number, r: any) => s + (r.gesamt_score ?? 0), 0) / (bewertungen as any[]).length
        : null;

      setStats({
        bestellungen_heute: bestCount ?? 0,
        umsatz_heute: umsatz,
        geliefert_heute: geliefertCount ?? 0,
        storniert_heute: stornoCount ?? 0,
        avg_lieferzeit_min: avgLieferzeit !== null ? Math.round(avgLieferzeit) : null,
        avg_bewertung: avgBewertung !== null ? Math.round(avgBewertung * 10) / 10 : null,
        fahrer_online: (fahrerOnline as any)?.count ?? 0,
        puenktlichkeit_pct: puenktlichkeitPct,
      });
    };

    setLoading(true);
    load().finally(() => setLoading(false));

    const iv = setInterval(load, 60_000);
    const ch = sb.channel('ph1616-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();

    return () => { clearInterval(iv); sb.removeChannel(ch); };
  }, []);

  if (loading) return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 animate-pulse h-28" />
  );
  if (!stats) return null;

  const stornoRate = stats.bestellungen_heute > 0
    ? Math.round((stats.storniert_heute / stats.bestellungen_heute) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-200 bg-white">
        <BarChart2 className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-stone-700">
          Statistiken · Heute
        </span>
        <span className="ml-auto text-[10px] text-stone-400 font-bold">Live</span>
        <span className="relative flex h-2 w-2 ml-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-matcha-500" />
        </span>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
        <KpiTile
          icon={Package}
          label="Bestellungen"
          value={stats.bestellungen_heute}
          sub={`${stats.geliefert_heute} geliefert`}
          color="text-stone-700"
        />
        <KpiTile
          icon={Euro}
          label="Umsatz"
          value={`${stats.umsatz_heute.toFixed(0)} €`}
          sub="gelieferte Bestellungen"
          color="text-matcha-700"
        />
        <KpiTile
          icon={Clock}
          label="Ø Lieferzeit"
          value={stats.avg_lieferzeit_min !== null ? `${stats.avg_lieferzeit_min} Min` : '—'}
          sub={stats.puenktlichkeit_pct !== null ? `${stats.puenktlichkeit_pct}% pünktl.` : undefined}
          color={
            stats.avg_lieferzeit_min === null ? 'text-stone-400' :
            stats.avg_lieferzeit_min <= 35 ? 'text-matcha-700' :
            stats.avg_lieferzeit_min <= 45 ? 'text-amber-700' : 'text-red-700'
          }
        />
        <KpiTile
          icon={Truck}
          label="Fahrer online"
          value={stats.fahrer_online}
          sub={stornoRate > 0 ? `${stornoRate}% Storno` : 'kein Storno'}
          color={stats.fahrer_online >= 2 ? 'text-matcha-700' : stats.fahrer_online === 1 ? 'text-amber-700' : 'text-red-700'}
        />
      </div>

      {/* Secondary strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-stone-200 bg-white">
        {stats.avg_bewertung !== null && (
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
            <span className="text-sm font-black tabular-nums text-stone-700">
              {stats.avg_bewertung.toFixed(1)}
            </span>
            <span className="text-[10px] text-stone-400">Ø Bewertung</span>
          </div>
        )}
        {stats.puenktlichkeit_pct !== null && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className={cn(
              'h-3.5 w-3.5',
              stats.puenktlichkeit_pct >= 90 ? 'text-matcha-600' :
              stats.puenktlichkeit_pct >= 75 ? 'text-amber-600' : 'text-red-600',
            )} />
            <span className={cn(
              'text-sm font-black tabular-nums',
              stats.puenktlichkeit_pct >= 90 ? 'text-matcha-700' :
              stats.puenktlichkeit_pct >= 75 ? 'text-amber-700' : 'text-red-700',
            )}>
              {stats.puenktlichkeit_pct}%
            </span>
            <span className="text-[10px] text-stone-400">pünktlich</span>
          </div>
        )}
        <div className={cn(
          'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full',
          stornoRate === 0 ? 'bg-matcha-100 text-matcha-700' :
          stornoRate < 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
        )}>
          {stornoRate}% Storno
        </div>
      </div>
    </div>
  );
}
