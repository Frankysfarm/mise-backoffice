'use client';

/**
 * SchichtVergleich — Vergleicht die aktuelle Schicht mit derselben
 * Schicht vor einer Woche (Wochentag + Zeitfenster).
 *
 * Zeigt:
 * - Bestellungen: heute vs. letzte Woche
 * - Gelieferte Bestellungen (%)
 * - Ø Lieferzeit
 * - Bewertungs-Trend
 *
 * Daten kommen direkt aus Supabase (customer_orders + dispatch_scores).
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Minus,
  Package,
  Route,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface ShiftWindow {
  start: Date;
  end: Date;
  label: string;
}

interface PeriodData {
  totalOrders: number;
  deliveredOrders: number;
  avgDeliveryMin: number | null;
  avgScore: number | null;
}

interface Props {
  locationId: string;
}

function getThisShiftWindow(): ShiftWindow {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return {
    start,
    end,
    label: `${days[now.getDay()]}, heute`,
  };
}

function getLastWeekWindow(thisWindow: ShiftWindow): ShiftWindow {
  const start = new Date(thisWindow.start.getTime() - 7 * 24 * 60 * 60 * 1000);
  const end = new Date(thisWindow.end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return {
    start,
    end,
    label: `${days[start.getDay()]}, letzte Woche`,
  };
}

async function fetchPeriodData(
  supabase: ReturnType<typeof createClient>,
  locationId: string,
  start: Date,
  end: Date,
): Promise<PeriodData> {
  const [{ data: orders }, { data: scores }] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('id, status, geliefert_am, fertig_am')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('bestellt_am', start.toISOString())
      .lt('bestellt_am', end.toISOString()),
    supabase
      .from('dispatch_scores')
      .select('total_score')
      .eq('location_id', locationId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString()),
  ]);

  const allOrders = orders ?? [];
  const delivered = allOrders.filter(
    (o: { status: string }) => o.status === 'geliefert' || o.status === 'abgeschlossen',
  );

  // Ø Lieferzeit: von fertig_am bis geliefert_am
  const deliveryMins = delivered
    .map((o: { fertig_am: string | null; geliefert_am: string | null }) => {
      if (!o.fertig_am || !o.geliefert_am) return null;
      return Math.round((new Date(o.geliefert_am).getTime() - new Date(o.fertig_am).getTime()) / 60_000);
    })
    .filter((v: number | null): v is number => v !== null && v >= 0 && v < 180);

  const avgDeliveryMin = deliveryMins.length > 0
    ? Math.round(deliveryMins.reduce((s: number, v: number) => s + v, 0) / deliveryMins.length)
    : null;

  const scoreVals = (scores ?? []).map((s: { total_score: number }) => s.total_score).filter(Boolean);
  const avgScore = scoreVals.length > 0
    ? Math.round(scoreVals.reduce((s: number, v: number) => s + v, 0) / scoreVals.length)
    : null;

  return {
    totalOrders: allOrders.length,
    deliveredOrders: delivered.length,
    avgDeliveryMin,
    avgScore,
  };
}

function DeltaBadge({ now, prev, higherIsBetter = true }: { now: number | null; prev: number | null; higherIsBetter?: boolean }) {
  if (now === null || prev === null || prev === 0) return null;
  const delta = now - prev;
  const pct = Math.round((delta / prev) * 100);
  const isPositive = higherIsBetter ? delta > 0 : delta < 0;
  const isNeutral = delta === 0;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[9px] font-bold rounded-full px-1.5 py-0.5',
      isNeutral ? 'bg-stone-100 text-stone-500' :
      isPositive ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
    )}>
      {isNeutral ? <Minus className="h-2.5 w-2.5" /> : isPositive ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

function CompareRow({
  icon: Icon,
  label,
  thisValue,
  lastValue,
  unit = '',
  higherIsBetter = true,
}: {
  icon: React.ElementType;
  label: string;
  thisValue: number | null;
  lastValue: number | null;
  unit?: string;
  higherIsBetter?: boolean;
}) {
  const fmtVal = (v: number | null) => v !== null ? `${v}${unit}` : '—';

  return (
    <div className="flex items-center gap-2 py-2 border-b border-stone-100 last:border-0">
      <Icon className="h-3.5 w-3.5 text-stone-400 shrink-0" />
      <span className="text-[11px] text-stone-600 flex-1">{label}</span>
      {/* Heute */}
      <span className="text-[12px] font-black text-stone-800 tabular-nums w-14 text-right">
        {fmtVal(thisValue)}
      </span>
      {/* Letzte Woche */}
      <span className="text-[11px] text-stone-400 tabular-nums w-14 text-right">
        {fmtVal(lastValue)}
      </span>
      <div className="w-12 flex justify-end">
        <DeltaBadge now={thisValue} prev={lastValue} higherIsBetter={higherIsBetter} />
      </div>
    </div>
  );
}

export function SchichtVergleich({ locationId }: Props) {
  const supabase = createClient();
  const [thisData, setThisData] = useState<PeriodData | null>(null);
  const [lastData, setLastData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const thisWindow = getThisShiftWindow();
  const lastWindow = getLastWeekWindow(thisWindow);

  const load = async () => {
    try {
      const [t, l] = await Promise.all([
        fetchPeriodData(supabase, locationId, thisWindow.start, thisWindow.end),
        fetchPeriodData(supabase, locationId, lastWindow.start, lastWindow.end),
      ]);
      setThisData(t);
      setLastData(l);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-3 animate-pulse">
        <div className="h-3 w-40 bg-stone-100 rounded mb-2" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-stone-50 rounded" />)}
        </div>
      </div>
    );
  }

  if (!thisData || !lastData) return null;

  const overallTrend = thisData.totalOrders > lastData.totalOrders ? 'up' : thisData.totalOrders < lastData.totalOrders ? 'down' : 'same';

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-stone-50 hover:bg-stone-100 transition text-left"
      >
        <BarChart3 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-600">
            Vergleich: Heute vs. Letzte Woche
          </span>
        </div>
        {overallTrend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-matcha-500 shrink-0" />}
        {overallTrend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        {overallTrend === 'same' && <Minus className="h-3.5 w-3.5 text-stone-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="px-3">
          {/* Spalten-Header */}
          <div className="flex items-center gap-2 py-1.5 border-b-2 border-stone-200">
            <div className="flex-1 text-[9px] text-stone-400 font-bold uppercase tracking-wider pl-5">Kennzahl</div>
            <div className="w-14 text-[9px] text-stone-700 font-black uppercase tracking-wider text-right">Heute</div>
            <div className="w-14 text-[9px] text-stone-400 font-bold uppercase tracking-wider text-right">−7 Tage</div>
            <div className="w-12 text-[9px] text-stone-400 font-bold uppercase tracking-wider text-right">Δ</div>
          </div>

          <CompareRow
            icon={Package}
            label="Bestellungen"
            thisValue={thisData.totalOrders}
            lastValue={lastData.totalOrders}
            higherIsBetter={true}
          />
          <CompareRow
            icon={CheckCircle2}
            label="Geliefert"
            thisValue={thisData.deliveredOrders}
            lastValue={lastData.deliveredOrders}
            higherIsBetter={true}
          />
          <CompareRow
            icon={Clock}
            label="Ø Lieferzeit"
            thisValue={thisData.avgDeliveryMin}
            lastValue={lastData.avgDeliveryMin}
            unit=" Min"
            higherIsBetter={false}
          />
          <CompareRow
            icon={Award}
            label="Ø Score"
            thisValue={thisData.avgScore}
            lastValue={lastData.avgScore}
            higherIsBetter={true}
          />

          {/* Footer */}
          <div className="flex items-center justify-between py-2 text-[9px] text-stone-400">
            <span>{thisWindow.label}</span>
            <span className="text-stone-300">vs.</span>
            <span>{lastWindow.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
