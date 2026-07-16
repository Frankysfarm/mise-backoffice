'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { BarChart2, Bike, CheckCircle2, Clock, Euro, Star, Target, TrendingUp, Users, Zap } from 'lucide-react';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

/**
 * Phase 1000 — Statistiken Echtzeit-Cockpit (Lieferdienst)
 *
 * Umfassendes Statistiken-Dashboard für den Lieferdienst:
 * - KPI-Kacheln: Umsatz, Bestellungen, Ø-Lieferzeit, Bewertung
 * - Stündliche Umsatz-Verteilung (Balkendiagramm)
 * - Fahrer-Performance-Übersicht
 * - Live-Aktualisierung alle 30 Sekunden
 */

interface Order {
  id: string;
  status: string;
  gesamtbetrag: number;
  bestellt_am: string | null;
  geliefert_am: string | null;
  fertig_am: string | null;
  bewertung?: number | null;
}

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  score?: number | null;
  status?: string | null;
}

interface Props {
  orders: Order[];
  drivers: Driver[];
  completedToday?: number | null;
  hourlyData?: { h: number; label: string; orders: number }[];
}

interface KpiKachel {
  label: string;
  wert: string;
  delta?: string | null;
  positiv?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  farbe: string;
}

function berechneKpis(orders: Order[], drivers: Driver[], completedToday: number | null): KpiKachel[] {
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const heuteOrders = orders.filter((o) => o.bestellt_am && new Date(o.bestellt_am) >= heute);
  const geliefert = heuteOrders.filter((o) => o.status === 'geliefert' || o.status === 'abgeschlossen');
  const umsatzHeute = geliefert.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
  const aktiveFahrer = drivers.filter((d) => d.status === 'online' || d.status === 'aktiv').length;

  const liefer_min: number[] = [];
  geliefert.forEach((o) => {
    if (o.bestellt_am && o.geliefert_am) {
      const diff = (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
      if (diff > 0 && diff < 180) liefer_min.push(diff);
    }
  });
  const avgLieferzeit = liefer_min.length > 0
    ? Math.round(liefer_min.reduce((a, b) => a + b, 0) / liefer_min.length)
    : null;

  const bewertungen = orders.filter((o) => o.bewertung).map((o) => o.bewertung!);
  const avgBewertung = bewertungen.length > 0
    ? (bewertungen.reduce((a, b) => a + b, 0) / bewertungen.length).toFixed(1)
    : null;

  return [
    {
      label: 'Umsatz heute',
      wert: euro(umsatzHeute),
      icon: Euro,
      farbe: 'text-matcha-600',
    },
    {
      label: 'Bestellungen',
      wert: String(completedToday ?? geliefert.length),
      icon: CheckCircle2,
      farbe: 'text-green-600',
    },
    {
      label: 'Ø Lieferzeit',
      wert: avgLieferzeit ? `${avgLieferzeit} Min` : '—',
      icon: Clock,
      farbe: avgLieferzeit && avgLieferzeit > 45 ? 'text-red-500' : 'text-blue-600',
    },
    {
      label: 'Aktive Fahrer',
      wert: String(aktiveFahrer),
      icon: Bike,
      farbe: 'text-purple-600',
    },
    {
      label: 'Bewertung',
      wert: avgBewertung ? `★ ${avgBewertung}` : '—',
      icon: Star,
      farbe: 'text-amber-500',
    },
    {
      label: 'Aktive Bestellungen',
      wert: String(orders.filter((o) => ['neu', 'bestätigt', 'in_zubereitung', 'unterwegs'].includes(o.status)).length),
      icon: Zap,
      farbe: 'text-orange-600',
    },
  ];
}

function KpiKachel({ kpi }: { kpi: KpiKachel }) {
  const Icon = kpi.icon;
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', kpi.farbe)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {kpi.label}
        </span>
      </div>
      <div className={cn('text-xl font-black tabular-nums', kpi.farbe)}>{kpi.wert}</div>
    </div>
  );
}

function FahrerPerformanceZeile({ driver }: { driver: Driver }) {
  const score = driver.score ?? 75;
  const online = driver.status === 'online' || driver.status === 'aktiv';
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className={cn(
        'w-2 h-2 rounded-full shrink-0',
        online ? 'bg-green-500' : 'bg-gray-300'
      )} />
      <span className="flex-1 text-xs text-gray-800 truncate">
        {driver.vorname} {driver.nachname}
      </span>
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            score >= 80 ? 'bg-matcha-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn(
        'text-[10px] font-bold w-8 text-right shrink-0',
        score >= 80 ? 'text-matcha-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
      )}>
        {score}
      </span>
    </div>
  );
}

export function LieferdienstPhase1000StatistikenEchtzeitCockpit({ orders, drivers, completedToday, hourlyData }: Props) {
  const [refreshAt, setRefreshAt] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setRefreshAt(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const kpis = berechneKpis(orders, drivers, completedToday ?? null);

  const chartData = (hourlyData ?? []).map((h) => ({
    name: h.label,
    value: h.orders,
    fill: h.orders >= 8 ? '#4d7c5f' : h.orders >= 4 ? '#f59e0b' : '#94a3b8',
  }));

  const onlineFahrer = drivers.filter((d) => d.status === 'online' || d.status === 'aktiv');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold">Statistiken Echtzeit</span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          Aktualisiert {new Date(refreshAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kpis.map((kpi) => (
          <KpiKachel key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* Stunden-Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Bestellungen nach Stunde
            </span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} barCategoryGap="20%">
              <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 8 }}
                formatter={(v) => [`${v} Bestellungen`, '']}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Fahrer-Performance */}
      {onlineFahrer.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Aktive Fahrer ({onlineFahrer.length})
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {onlineFahrer
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
              .slice(0, 8)
              .map((d) => (
                <FahrerPerformanceZeile key={d.id} driver={d} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
