'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { euro } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Star, TrendingDown, TrendingUp, Users, Zap,
} from 'lucide-react';

// Phase 2640 — Statistiken-Schicht-Intelligence
// KPI-Grid (Umsatz, Bestellungen, Lieferzeit, Pünktlichkeit, Fahrer, Bewertung)
// mit Trendvergleich Vorwoche + Stunden-Barcode-Chart + Alert-Leiste.
// 2-Min-Polling.

type KpiKey = 'umsatz' | 'bestellungen' | 'lieferzeit' | 'puenktlichkeit' | 'fahrer' | 'bewertung';

interface KpiData {
  umsatz: number;
  bestellungen: number;
  lieferzeit: number;
  puenktlichkeit: number;
  fahrer: number;
  bewertung: number;
}

interface HourBucket {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface Alert {
  key: string;
  msg: string;
  level: 'warn' | 'crit';
}

const KPI_META: Record<KpiKey, {
  label: string;
  unit: string;
  format: (v: number) => string;
  ziel: number;
  warnBelow?: number;
  warnAbove?: number;
  icon: React.ElementType;
}> = {
  umsatz:       { label: 'Umsatz',       unit: '€',   format: v => euro(v),              ziel: 1500, icon: Zap },
  bestellungen: { label: 'Bestellungen', unit: '',    format: v => String(v),             ziel: 50,   icon: Activity },
  lieferzeit:   { label: 'Ø Lieferzeit', unit: 'min', format: v => `${v.toFixed(0)} min`, ziel: 30, warnAbove: 35, icon: Clock },
  puenktlichkeit:{ label: 'Pünktlichkeit',unit: '%',  format: v => `${v.toFixed(0)}%`,    ziel: 90, warnBelow: 80, icon: CheckCircle2 },
  fahrer:       { label: 'Akt. Fahrer',  unit: '',    format: v => String(v),             ziel: 5,   icon: Users },
  bewertung:    { label: 'Ø Bewertung',  unit: '★',   format: v => v.toFixed(1),          ziel: 4.5, warnBelow: 4.0, icon: Star },
};

function calcAlert(key: KpiKey, val: number): Alert | null {
  const m = KPI_META[key];
  if (m.warnBelow !== undefined && val < m.warnBelow) {
    return { key, msg: `${m.label} unter Ziel: ${m.format(val)}`, level: val < m.warnBelow * 0.9 ? 'crit' : 'warn' };
  }
  if (m.warnAbove !== undefined && val > m.warnAbove) {
    return { key, msg: `${m.label} zu hoch: ${m.format(val)}`, level: val > m.warnAbove * 1.1 ? 'crit' : 'warn' };
  }
  return null;
}

function KpiCard({ kpiKey, current, prev }: { kpiKey: KpiKey; current: number; prev: number }) {
  const m = KPI_META[kpiKey];
  const Icon = m.icon;
  const delta = prev > 0 ? ((current - prev) / prev) * 100 : 0;
  const goodUp = !['lieferzeit'].includes(kpiKey);
  const trending = delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat';
  const isGood = trending === 'up' ? goodUp : trending === 'down' ? !goodUp : true;
  const alert = calcAlert(kpiKey, current);

  return (
    <div className={cn(
      'rounded-lg border p-2.5 flex flex-col gap-1',
      alert?.level === 'crit' ? 'border-red-400 bg-red-50' :
      alert?.level === 'warn' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white',
    )}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-500 truncate">{m.label}</span>
      </div>
      <div className={cn(
        'text-lg font-bold leading-none',
        alert?.level === 'crit' ? 'text-red-700' :
        alert?.level === 'warn' ? 'text-yellow-700' : 'text-gray-900',
      )}>
        {m.format(current)}
      </div>
      <div className={cn(
        'flex items-center gap-0.5 text-xs',
        trending === 'flat' ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-500',
      )}>
        {trending === 'up' && <TrendingUp className="w-3 h-3" />}
        {trending === 'down' && <TrendingDown className="w-3 h-3" />}
        {trending !== 'flat' && <span>{Math.abs(delta).toFixed(0)}% vs Vorw.</span>}
        {trending === 'flat' && <span>Stabil</span>}
      </div>
    </div>
  );
}

export function LieferdienstPhase2640StatistikSchichtIntelligence() {
  const supabase = createClient();
  const [current, setCurrent] = useState<KpiData | null>(null);
  const [prev, setPrev] = useState<KpiData | null>(null);
  const [hours, setHours] = useState<HourBucket[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [mode, setMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekAgoStart = new Date(todayStart);
    weekAgoStart.setDate(weekAgoStart.getDate() - 7);
    const weekAgoEnd = new Date(todayStart);
    weekAgoEnd.setDate(weekAgoEnd.getDate() - 6);

    // Current shift data
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('id,gesamtbetrag,status,erstellt_um,liefer_minuten,zugestellt_am,bewertung')
      .gte('erstellt_um', todayStart.toISOString())
      .not('status', 'eq', 'storniert');

    // Last week same window
    const { data: prevOrders } = await supabase
      .from('orders')
      .select('id,gesamtbetrag,status,erstellt_um,liefer_minuten,zugestellt_am,bewertung')
      .gte('erstellt_um', weekAgoStart.toISOString())
      .lt('erstellt_um', weekAgoEnd.toISOString())
      .not('status', 'eq', 'storniert');

    // Active drivers
    const { count: activeDrivers } = await supabase
      .from('driver_shifts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aktiv');

    type OrderRow = { gesamtbetrag: number | null; liefer_minuten: number | null; bewertung: number | null };
    function extractKpi(rows: OrderRow[] | null, driverCount: number): KpiData {
      const arr = rows ?? [];
      const umsatz = arr.reduce((s: number, o: OrderRow) => s + (o.gesamtbetrag ?? 0), 0);
      const bestellungen = arr.length;
      const delivered = arr.filter((o: OrderRow) => o.liefer_minuten != null);
      const lieferzeit = delivered.length > 0
        ? delivered.reduce((s: number, o: OrderRow) => s + o.liefer_minuten!, 0) / delivered.length
        : 0;
      const onTime = delivered.filter((o: OrderRow) => (o.liefer_minuten ?? 99) <= 30).length;
      const puenktlichkeit = delivered.length > 0 ? (onTime / delivered.length) * 100 : 100;
      const rated = arr.filter((o: OrderRow) => o.bewertung != null);
      const bewertung = rated.length > 0
        ? rated.reduce((s: number, o: OrderRow) => s + o.bewertung!, 0) / rated.length
        : 0;
      return { umsatz, bestellungen, lieferzeit, puenktlichkeit, fahrer: driverCount, bewertung };
    }

    const cur = extractKpi(todayOrders, activeDrivers ?? 0);
    const prv = extractKpi(prevOrders, 0);

    setCurrent(cur);
    setPrev(prv);

    // Hour buckets
    const buckets = new Map<string, { bestellungen: number; umsatz: number }>();
    for (const o of todayOrders ?? []) {
      const h = new Date(o.erstellt_um).getHours();
      const key = `${String(h).padStart(2, '0')}:00`;
      const b = buckets.get(key) ?? { bestellungen: 0, umsatz: 0 };
      b.bestellungen++;
      b.umsatz += o.gesamtbetrag ?? 0;
      buckets.set(key, b);
    }
    const hoursArr: HourBucket[] = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stunde, v]) => ({ stunde, ...v }));
    setHours(hoursArr);

    // Alerts
    const newAlerts: Alert[] = [];
    for (const key of Object.keys(KPI_META) as KpiKey[]) {
      const a = calcAlert(key, cur[key]);
      if (a) newAlerts.push(a);
    }
    setAlerts(newAlerts);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading || !current) return null;

  const kpiKeys = Object.keys(KPI_META) as KpiKey[];
  const maxBar = Math.max(...hours.map(h => mode === 'bestellungen' ? h.bestellungen : h.umsatz), 1);

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-gray-800">Schicht-Intelligence</span>
        </div>
        <div className="text-xs text-gray-400">Polling 2 min</div>
      </div>

      {/* Alert strip */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {alerts.map(a => (
            <div
              key={a.key}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                a.level === 'crit' ? 'bg-red-600 text-white' : 'bg-yellow-100 text-yellow-800',
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {kpiKeys.map(k => (
          <KpiCard key={k} kpiKey={k} current={current[k]} prev={prev?.[k] ?? 0} />
        ))}
      </div>

      {/* Hour chart */}
      {hours.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-600">Stundenverlauf</span>
            <div className="flex gap-1">
              {(['bestellungen', 'umsatz'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded transition-colors',
                    mode === m ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100',
                  )}
                >
                  {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={hours} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v) => { const n = typeof v === 'number' ? v : 0; return mode === 'umsatz' ? [euro(n), 'Umsatz'] : [n, 'Bestellungen']; }}
                contentStyle={{ fontSize: 11, padding: '4px 8px' }}
              />
              <Bar dataKey={mode} radius={[3, 3, 0, 0]}>
                {hours.map((h, i) => {
                  const val = mode === 'bestellungen' ? h.bestellungen : h.umsatz;
                  const ratio = val / maxBar;
                  return (
                    <Cell
                      key={i}
                      fill={ratio > 0.8 ? '#059669' : ratio > 0.5 ? '#34d399' : '#a7f3d0'}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
