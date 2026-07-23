'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, TrendingDown, Minus, Package, Euro, Clock, Users, AlertTriangle, CheckCircle2, BarChart2 } from 'lucide-react';

type KpiData = {
  bestellungen: number;
  umsatz: number;
  avg_lieferzeit_min: number | null;
  on_time_rate: number | null;
  aktive_fahrer: number;
  storno_rate: number | null;
  avg_bewertung: number | null;
  bestellungen_gestern: number | null;
  umsatz_gestern: number | null;
};

type HourBar = {
  hour: number;
  count: number;
};

function Trend({ val, ref: refVal }: { val: number; ref: number | null }) {
  if (!refVal) return <Minus className="h-3 w-3 text-stone-300" />;
  const delta = val - refVal;
  if (delta > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (delta < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-300" />;
}

function deltaStr(val: number, ref: number | null, prefix = ''): string {
  if (!ref) return '';
  const d = val - ref;
  return `${d >= 0 ? '+' : ''}${prefix}${Math.abs(d) < 1 ? d.toFixed(1) : Math.round(d)}`;
}

export function LieferdienstPhase2665StatistikenFinalMasterHub({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [hours, setHours] = useState<HourBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);
      const now = new Date();

      let q = supabase
        .from('customer_orders')
        .select('id, gesamtbetrag, status, bestellt_am, geschaetzte_zubereitung_min')
        .gte('bestellt_am', todayStart.toISOString())
        .lte('bestellt_am', now.toISOString());
      if (locationId) q = q.eq('location_id', locationId);

      const { data: todayOrders } = await q;

      let qy = supabase
        .from('customer_orders')
        .select('id, gesamtbetrag, status')
        .gte('bestellt_am', yesterdayStart.toISOString())
        .lte('bestellt_am', yesterdayEnd.toISOString());
      if (locationId) qy = qy.eq('location_id', locationId);

      const { data: yOrders } = await qy;

      let dq = supabase
        .from('employee_shifts')
        .select('id')
        .eq('ist_aktiv', true);
      if (locationId) dq = dq.eq('location_id', locationId);
      const { data: activeDrivers } = await dq;

      const orders = todayOrders ?? [];
      const yOrd = yOrders ?? [];

      const bestellungen = orders.length;
      const umsatz = orders.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);
      const storniert = orders.filter(o => o.status === 'storniert').length;
      const stornoRate = bestellungen > 0 ? Math.round((storniert / bestellungen) * 100) : 0;

      const delivered = orders.filter(o => o.status === 'geliefert' || o.status === 'abgeschlossen');
      const avgMin = delivered.length > 0
        ? Math.round(delivered.reduce((s, o) => s + (o.geschaetzte_zubereitung_min ?? 30), 0) / delivered.length)
        : null;

      const onTime = avgMin !== null && avgMin <= 35 ? 100 : avgMin !== null ? Math.round(Math.max(0, (1 - (avgMin - 35) / 35) * 100)) : null;

      // Hour distribution
      const hourMap: Record<number, number> = {};
      for (const o of orders) {
        if (o.bestellt_am) {
          const h = new Date(o.bestellt_am).getHours();
          hourMap[h] = (hourMap[h] ?? 0) + 1;
        }
      }
      const currentHour = new Date().getHours();
      const barData: HourBar[] = Array.from({ length: 12 }, (_, i) => {
        const h = Math.max(0, currentHour - 11 + i);
        return { hour: h, count: hourMap[h] ?? 0 };
      });
      setHours(barData);

      setKpi({
        bestellungen,
        umsatz,
        avg_lieferzeit_min: avgMin,
        on_time_rate: onTime,
        aktive_fahrer: activeDrivers?.length ?? 0,
        storno_rate: stornoRate,
        avg_bewertung: null,
        bestellungen_gestern: yOrd.length || null,
        umsatz_gestern: yOrd.length ? yOrd.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0) : null,
      });
      setLoading(false);
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading || !kpi) return null;

  const maxBar = Math.max(...hours.map(h => h.count), 1);
  const currentHour = new Date().getHours();

  const kpis = [
    {
      label: 'Bestellungen',
      value: kpi.bestellungen,
      ref: kpi.bestellungen_gestern,
      format: (v: number) => String(v),
      icon: <Package className="h-3.5 w-3.5" />,
      alert: false,
    },
    {
      label: 'Umsatz',
      value: kpi.umsatz,
      ref: kpi.umsatz_gestern,
      format: (v: number) => `€${v.toFixed(0)}`,
      icon: <Euro className="h-3.5 w-3.5" />,
      alert: false,
    },
    {
      label: 'Ø Lieferzeit',
      value: kpi.avg_lieferzeit_min ?? 0,
      ref: null,
      format: (v: number) => kpi.avg_lieferzeit_min ? `${v}min` : '—',
      icon: <Clock className="h-3.5 w-3.5" />,
      alert: kpi.avg_lieferzeit_min !== null && kpi.avg_lieferzeit_min > 45,
    },
    {
      label: 'Pünktlichkeit',
      value: kpi.on_time_rate ?? 0,
      ref: null,
      format: (v: number) => kpi.on_time_rate !== null ? `${v}%` : '—',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      alert: kpi.on_time_rate !== null && kpi.on_time_rate < 80,
    },
    {
      label: 'Fahrer aktiv',
      value: kpi.aktive_fahrer,
      ref: null,
      format: (v: number) => String(v),
      icon: <Users className="h-3.5 w-3.5" />,
      alert: kpi.aktive_fahrer === 0,
    },
    {
      label: 'Stornorate',
      value: kpi.storno_rate ?? 0,
      ref: null,
      format: (v: number) => `${v}%`,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      alert: (kpi.storno_rate ?? 0) > 10,
    },
  ];

  const alertCount = kpis.filter(k => k.alert).length;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Statistiken Master Hub</span>
          <span className="text-[10px] bg-matcha-100 text-matcha-700 rounded-full px-2 py-0.5 font-bold">Heute</span>
        </div>
        {alertCount > 0 && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold">{alertCount} Ampel rot</span>
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kpis.map(k => (
          <div
            key={k.label}
            className={`rounded-xl border p-3 flex flex-col gap-1 ${
              k.alert ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-100'
            }`}
          >
            <div className={`flex items-center gap-1.5 ${k.alert ? 'text-red-500' : 'text-stone-400'}`}>
              {k.icon}
              <span className="text-[9px] font-bold uppercase tracking-wide">{k.label}</span>
            </div>
            <div className={`text-xl font-black tabular-nums leading-none ${k.alert ? 'text-red-700' : 'text-stone-800'}`}>
              {k.format(k.value)}
            </div>
            {k.ref !== null && (
              <div className="flex items-center gap-1 text-[8px] text-stone-400">
                <Trend val={k.value} ref={k.ref} />
                <span>vs. gestern ({deltaStr(k.value, k.ref)})</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hour bar chart */}
      <div className="px-3 pb-3">
        <div className="rounded-xl border bg-stone-50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-2">Stundenverlauf (letzte 12h)</div>
          <div className="flex items-end gap-1 h-16">
            {hours.map(bar => (
              <div key={bar.hour} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    bar.hour === currentHour
                      ? 'bg-matcha-600'
                      : 'bg-matcha-200'
                  }`}
                  style={{ height: `${Math.round((bar.count / maxBar) * 52)}px`, minHeight: bar.count > 0 ? '4px' : '0' }}
                />
                <span className="text-[7px] text-stone-300 font-medium">{bar.hour}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
