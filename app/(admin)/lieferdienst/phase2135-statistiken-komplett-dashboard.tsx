'use client';

/**
 * Phase 2135 – Statistiken-Komplett-Dashboard
 * Übersichtliches Dashboard mit den wichtigsten Liefer-KPIs:
 * Umsatz, Bestellungen, Ø Lieferzeit, Stornoquote, Ø Bewertung, Fahrer-Auslastung.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  TrendingUp, TrendingDown, Euro, Package, Clock, Star,
  XCircle, Users, BarChart3, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiData {
  umsatzHeute: number;
  bestellungenHeute: number;
  avgLieferzeitMin: number;
  stornoquotePct: number;
  avgBewertung: number;
  aktiveFahrer: number;
  umsatzGestern: number;
  bestellungenGestern: number;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color: 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'matcha';
}) {
  const colorMap = {
    green:   { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   border: 'border-amber-100' },
    red:     { bg: 'bg-red-50',     icon: 'text-red-600',     border: 'border-red-100' },
    purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  border: 'border-purple-100' },
    matcha:  { bg: 'bg-matcha-50',  icon: 'text-matcha-600',  border: 'border-matcha-100' },
  };
  const c = colorMap[color];

  return (
    <div className={cn('rounded-xl border p-3.5', c.bg, c.border)}>
      <div className="flex items-start justify-between mb-2">
        <Icon className={cn('h-4 w-4', c.icon)} />
        {trend && (
          trend === 'up' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> :
          trend === 'down' ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> : null
        )}
      </div>
      <p className="text-xl font-bold text-matcha-900 tabular-nums leading-none">{value}</p>
      <p className="text-xs font-medium text-matcha-600 mt-1">{label}</p>
      {sub && <p className="text-xs text-matcha-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Mock-Daten als Fallback
const MOCK: KpiData = {
  umsatzHeute: 2847_50,
  bestellungenHeute: 47,
  avgLieferzeitMin: 28,
  stornoquotePct: 3.2,
  avgBewertung: 4.7,
  aktiveFahrer: 5,
  umsatzGestern: 2612_00,
  bestellungenGestern: 41,
};

export function LieferdienstPhase2135StatistikenKomplettDashboard({
  locationId,
}: {
  locationId: string | null;
}) {
  const supabase = createClient();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  async function load() {
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const baseQuery = supabase
        .from('customer_orders')
        .select('id, gesamtbetrag, status, lieferzeit_min, bewertung, created_at');
      const q = locationId
        ? baseQuery.eq('location_id', locationId)
        : baseQuery;

      const { data: todayOrders } = await q
        .gte('created_at', todayStart.toISOString())
        .eq('typ', 'lieferung');

      const { data: yesterdayOrders } = await q
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString())
        .eq('typ', 'lieferung');

      const { count: aktiveFahrer } = await supabase
        .from('mise_drivers')
        .select('id', { count: 'exact', head: true })
        .eq('active', true);

      if (!todayOrders || todayOrders.length === 0) {
        setUseMock(true);
        setKpi(MOCK);
        return;
      }

      const delivered = todayOrders.filter(o =>
        ['geliefert', 'abgeholt_extern'].includes(o.status)
      );
      const storniert = todayOrders.filter(o => o.status === 'storniert');

      setKpi({
        umsatzHeute: todayOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0),
        bestellungenHeute: todayOrders.length,
        avgLieferzeitMin: delivered.length > 0
          ? Math.round(delivered.reduce((s, o) => s + (o.lieferzeit_min ?? 30), 0) / delivered.length)
          : 30,
        stornoquotePct: todayOrders.length > 0
          ? Math.round((storniert.length / todayOrders.length) * 1000) / 10
          : 0,
        avgBewertung: delivered.filter((o: any) => o.bewertung).length > 0
          ? Math.round(
              delivered.filter((o: any) => o.bewertung).reduce<number>((s, o: any) => s + ((o.bewertung as number) ?? 0), 0) /
              delivered.filter((o: any) => o.bewertung).length * 10
            ) / 10
          : 0,
        aktiveFahrer: aktiveFahrer ?? 0,
        umsatzGestern: (yesterdayOrders ?? []).reduce<number>((s, o: any) => s + ((o.gesamtbetrag as number | null) ?? 0), 0),
        bestellungenGestern: (yesterdayOrders ?? []).length,
      });
      setUseMock(false);
    } catch {
      setUseMock(true);
      setKpi(MOCK);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const umsatzTrend = kpi
    ? kpi.umsatzHeute >= kpi.umsatzGestern ? 'up' : 'down'
    : undefined;
  const bestellTrend = kpi
    ? kpi.bestellungenHeute >= kpi.bestellungenGestern ? 'up' : 'down'
    : undefined;

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-100 bg-matcha-50/50">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold text-matcha-800">Statistiken heute</span>
        </div>
        <div className="flex items-center gap-2">
          {useMock && <span className="text-xs text-matcha-400 italic">Demo</span>}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-matcha-100 transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-matcha-500', loading && 'animate-spin')} />
          </button>
          <span className="text-xs text-matcha-400">
            {lastRefreshed.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="p-4">
        {loading && !kpi ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-matcha-50 animate-pulse" />
            ))}
          </div>
        ) : kpi ? (
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Umsatz"
              value={(kpi.umsatzHeute / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              sub={`vs. ${(kpi.umsatzGestern / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} gestern`}
              icon={Euro}
              trend={umsatzTrend}
              color="green"
            />
            <KpiCard
              label="Bestellungen"
              value={String(kpi.bestellungenHeute)}
              sub={`gestern: ${kpi.bestellungenGestern}`}
              icon={Package}
              trend={bestellTrend}
              color="blue"
            />
            <KpiCard
              label="Ø Lieferzeit"
              value={`${kpi.avgLieferzeitMin} min`}
              sub={kpi.avgLieferzeitMin <= 30 ? 'Im Ziel ✓' : 'Über 30 min'}
              icon={Clock}
              trend={kpi.avgLieferzeitMin <= 30 ? 'up' : 'down'}
              color={kpi.avgLieferzeitMin <= 30 ? 'green' : 'amber'}
            />
            <KpiCard
              label="Stornoquote"
              value={`${kpi.stornoquotePct}%`}
              sub={kpi.stornoquotePct <= 5 ? 'Normal' : 'Erhöht!'}
              icon={XCircle}
              trend={kpi.stornoquotePct <= 5 ? 'up' : 'down'}
              color={kpi.stornoquotePct <= 5 ? 'green' : 'red'}
            />
            <KpiCard
              label="Ø Bewertung"
              value={kpi.avgBewertung > 0 ? `${kpi.avgBewertung} ★` : '—'}
              sub={kpi.avgBewertung >= 4.5 ? 'Ausgezeichnet' : kpi.avgBewertung >= 4 ? 'Gut' : 'Verbesserungsbedarf'}
              icon={Star}
              color={kpi.avgBewertung >= 4.5 ? 'green' : kpi.avgBewertung >= 4 ? 'amber' : 'red'}
            />
            <KpiCard
              label="Aktive Fahrer"
              value={String(kpi.aktiveFahrer)}
              sub="Online jetzt"
              icon={Users}
              color="matcha"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
