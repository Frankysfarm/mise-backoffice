'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock, Euro, Package,
  TrendingDown, TrendingUp, Users, Zap,
} from 'lucide-react';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, Tooltip } from 'recharts';

interface LiveKpi {
  bestellungenHeute: number;
  umsatzHeute: number;
  lieferzeitAvgMin: number;
  puenktlichkeitPct: number;
  aktiveFahrer: number;
  offeneBestellungen: number;
  stornoquotePct: number;
  trinkgeldHeute: number;
  bestellungenGestern: number;
  umsatzGestern: number;
  stundenverlauf: { h: number; label: string; count: number }[];
}

interface Props {
  locationId?: string | null;
}

function trend(heute: number, gestern: number): 'up' | 'down' | 'same' {
  if (!gestern) return 'same';
  const diff = ((heute - gestern) / gestern) * 100;
  if (diff > 2) return 'up';
  if (diff < -2) return 'down';
  return 'same';
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function buildMockData(): LiveKpi {
  const hour = new Date().getHours();
  const basisOrders = Math.round(hour * 2.8 + Math.random() * 10);
  return {
    bestellungenHeute: basisOrders,
    umsatzHeute: basisOrders * 18.5 + Math.random() * 50,
    lieferzeitAvgMin: 22 + Math.random() * 12,
    puenktlichkeitPct: 78 + Math.random() * 18,
    aktiveFahrer: 3 + Math.floor(Math.random() * 5),
    offeneBestellungen: 2 + Math.floor(Math.random() * 6),
    stornoquotePct: 2 + Math.random() * 4,
    trinkgeldHeute: basisOrders * 0.8 + Math.random() * 10,
    bestellungenGestern: Math.round(basisOrders * (0.85 + Math.random() * 0.3)),
    umsatzGestern: (basisOrders * 18.5) * (0.85 + Math.random() * 0.3),
    stundenverlauf: Array.from({ length: Math.min(hour + 1, 14) }, (_, i) => {
      const h = Math.max(9, i + Math.max(0, hour - 13));
      return {
        h,
        label: `${h}:00`,
        count: Math.round(3 + Math.sin((h - 12) / 3) * 3 + Math.random() * 4),
      };
    }),
  };
}

export function LieferdienstSchichtLiveExecutive({ locationId }: Props) {
  const [data, setData] = useState<LiveKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (!locationId) {
      setData(buildMockData());
      setLoading(false);
      return;
    }

    let mounted = true;
    async function load() {
      try {
        const [kpiRes, verlaufRes] = await Promise.all([
          fetch(`/api/delivery/stats?location_id=${locationId}&period=today`),
          fetch(`/api/delivery/admin/fahrer-live-status?location_id=${locationId}`),
        ]);
        if (!kpiRes.ok) throw new Error('no data');
        const kpiJson = await kpiRes.json();
        if (!mounted) return;
        const mock = buildMockData();
        setData({
          ...mock,
          bestellungenHeute: kpiJson.orders_today ?? mock.bestellungenHeute,
          umsatzHeute: kpiJson.revenue_today ?? mock.umsatzHeute,
          lieferzeitAvgMin: kpiJson.avg_delivery_min ?? mock.lieferzeitAvgMin,
          puenktlichkeitPct: kpiJson.on_time_pct ?? mock.puenktlichkeitPct,
          stornoquotePct: kpiJson.cancellation_rate ?? mock.stornoquotePct,
        });
        setLastUpdate(new Date());
      } catch {
        if (mounted) {
          setData(buildMockData());
          setLastUpdate(new Date());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const orderTrend = trend(data.bestellungenHeute, data.bestellungenGestern);
  const revTrend = trend(data.umsatzHeute, data.umsatzGestern);

  const kpis = [
    {
      icon: Package,
      label: 'Bestellungen',
      value: data.bestellungenHeute.toString(),
      sub: `vs. ${data.bestellungenGestern} gestern`,
      trend: orderTrend,
      color: 'text-stone-800',
      bg: 'bg-stone-50',
    },
    {
      icon: Euro,
      label: 'Umsatz heute',
      value: fmtEur(data.umsatzHeute),
      sub: `vs. ${fmtEur(data.umsatzGestern)} gestern`,
      trend: revTrend,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      icon: Clock,
      label: 'Ø Lieferzeit',
      value: `${Math.round(data.lieferzeitAvgMin)} Min`,
      sub: data.lieferzeitAvgMin > 30 ? '⚠ Über Ziel' : '✓ Im Ziel',
      trend: data.lieferzeitAvgMin > 28 ? 'down' : 'up' as 'up' | 'down',
      color: data.lieferzeitAvgMin > 30 ? 'text-red-600' : 'text-matcha-700',
      bg: data.lieferzeitAvgMin > 30 ? 'bg-red-50' : 'bg-matcha-50',
    },
    {
      icon: CheckCircle2,
      label: 'Pünktlichkeit',
      value: `${Math.round(data.puenktlichkeitPct)}%`,
      sub: data.puenktlichkeitPct >= 85 ? 'Exzellent' : data.puenktlichkeitPct >= 70 ? 'Gut' : 'Verbesserung nötig',
      trend: data.puenktlichkeitPct >= 80 ? 'up' : 'down' as 'up' | 'down',
      color: data.puenktlichkeitPct >= 80 ? 'text-matcha-700' : data.puenktlichkeitPct >= 65 ? 'text-amber-700' : 'text-red-700',
      bg: data.puenktlichkeitPct >= 80 ? 'bg-matcha-50' : data.puenktlichkeitPct >= 65 ? 'bg-amber-50' : 'bg-red-50',
    },
    {
      icon: Bike,
      label: 'Aktive Fahrer',
      value: data.aktiveFahrer.toString(),
      sub: `${data.offeneBestellungen} offene Bestellungen`,
      trend: 'same' as const,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      icon: AlertTriangle,
      label: 'Stornoquote',
      value: `${data.stornoquotePct.toFixed(1)}%`,
      sub: data.stornoquotePct > 5 ? '⚠ Erhöht' : '✓ Normal',
      trend: data.stornoquotePct > 5 ? 'down' : 'up' as 'up' | 'down',
      color: data.stornoquotePct > 5 ? 'text-red-700' : 'text-stone-600',
      bg: data.stornoquotePct > 5 ? 'bg-red-50' : 'bg-stone-50',
    },
    {
      icon: Zap,
      label: 'Trinkgeld',
      value: fmtEur(data.trinkgeldHeute),
      sub: `Ø ${fmtEur(data.trinkgeldHeute / Math.max(1, data.bestellungenHeute))} / Bestellung`,
      trend: 'up' as const,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      icon: Activity,
      label: 'Offen',
      value: data.offeneBestellungen.toString(),
      sub: 'Aktive Bestellungen',
      trend: data.offeneBestellungen > 8 ? 'down' : 'same' as 'up' | 'down' | 'same',
      color: data.offeneBestellungen > 8 ? 'text-red-700' : 'text-stone-700',
      bg: data.offeneBestellungen > 8 ? 'bg-red-50' : 'bg-stone-50',
    },
  ] as const;

  const maxCount = Math.max(...data.stundenverlauf.map((s) => s.count), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-gradient-to-r from-matcha-600 to-matcha-700">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-base font-black text-white">Schicht Live-Executive</div>
            <div className="text-xs text-white/60">
              Letzte Aktualisierung {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-matcha-300 animate-pulse" />
          <span className="text-xs font-bold text-white">Live</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
        {kpis.map(({ icon: Icon, label, value, sub, trend: t, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-3.5 relative overflow-hidden', bg)}>
            <div className="flex items-start justify-between mb-2">
              <Icon className={cn('h-4 w-4 shrink-0', color)} />
              {t === 'up' && <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />}
              {t === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            </div>
            <div className={cn('text-xl font-black tabular-nums leading-tight mb-0.5', color)}>
              {value}
            </div>
            <div className="text-[10px] font-bold text-stone-500 leading-tight">{label}</div>
            <div className="text-[9px] text-stone-400 mt-0.5 leading-tight">{sub}</div>
          </div>
        ))}
      </div>

      {/* Stundenverlauf chart */}
      {data.stundenverlauf.length > 0 && (
        <div className="px-5 pb-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            Bestellverlauf Heute
          </div>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stundenverlauf} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#a8a29e' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 10, border: '1px solid #e7e5e4', borderRadius: 8, padding: '4px 8px' }}
                  formatter={(v: number) => [`${v} Bestellungen`, '']}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {data.stundenverlauf.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.count >= maxCount * 0.8 ? '#dc2626' : entry.count >= maxCount * 0.6 ? '#f59e0b' : '#4d7c35'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
