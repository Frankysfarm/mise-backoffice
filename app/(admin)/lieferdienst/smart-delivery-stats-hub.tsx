'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Activity, ArrowDown, ArrowUp, Award, Bike, ChevronDown, ChevronUp, Clock,
  Euro, Package, Star, Target, TrendingDown, TrendingUp, Zap,
} from 'lucide-react';

interface StatsData {
  bestellungen: number;
  bestellungenGestern: number;
  umsatz: number;
  umsatzGestern: number;
  avgLieferzeitMin: number;
  avgLieferzeitGestern: number;
  puenktlichkeitPct: number;
  puenktlichkeitGestern: number;
  aktiveFahrer: number;
  stornoPct: number;
  avgBewertung: number;
  topArtikel: { name: string; count: number }[];
}

const MOCK: StatsData = {
  bestellungen: 47,
  bestellungenGestern: 41,
  umsatz: 1284.5,
  umsatzGestern: 1094.2,
  avgLieferzeitMin: 28.4,
  avgLieferzeitGestern: 31.2,
  puenktlichkeitPct: 87,
  puenktlichkeitGestern: 82,
  aktiveFahrer: 4,
  stornoPct: 2.1,
  avgBewertung: 4.6,
  topArtikel: [
    { name: 'Mise Bowl', count: 14 },
    { name: 'Burger Classic', count: 11 },
    { name: 'Pasta Primavera', count: 8 },
  ],
};

function DeltaBadge({ value, unit = '' }: { value: number; unit?: string }) {
  const pos = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
        pos ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
      )}
    >
      {pos ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(value).toFixed(unit === '%' ? 1 : 0)}
      {unit}
    </span>
  );
}

export function SmartDeliveryStatsHub({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        const [todayRes, yesterdayRes] = await Promise.all([
          supabase
            .from('customer_orders')
            .select('gesamtbetrag, status, lieferzeit_min, bestellt_am, bewertung')
            .eq('location_id', locationId)
            .gte('bestellt_am', todayStart.toISOString()),
          supabase
            .from('customer_orders')
            .select('gesamtbetrag, status, lieferzeit_min')
            .eq('location_id', locationId)
            .gte('bestellt_am', yesterdayStart.toISOString())
            .lt('bestellt_am', todayStart.toISOString()),
        ]);

        type OrderRow = { gesamtbetrag?: number | null; status?: string | null; lieferzeit_min?: number | null; bewertung?: number | null };
        const today = (todayRes.data ?? []) as OrderRow[];
        const yesterday = (yesterdayRes.data ?? []) as OrderRow[];

        const completed = today.filter((o) => o.status === 'delivered');
        const cancelledPct =
          today.length > 0
            ? (today.filter((o) => o.status === 'cancelled').length / today.length) * 100
            : 0;

        const avgLieferzeitMin =
          completed.length > 0
            ? completed.reduce((s, o) => s + (o.lieferzeit_min ?? 30), 0) / completed.length
            : 0;

        const yesterdayCompleted = yesterday.filter((o) => o.status === 'delivered');
        const avgGestern =
          yesterdayCompleted.length > 0
            ? yesterdayCompleted.reduce((s, o) => s + (o.lieferzeit_min ?? 30), 0) / yesterdayCompleted.length
            : 0;

        const onTime = completed.filter((o) => (o.lieferzeit_min ?? 30) <= 35).length;
        const puenktlichkeit = completed.length > 0 ? (onTime / completed.length) * 100 : 0;
        const onTimeGestern = yesterdayCompleted.filter((o) => (o.lieferzeit_min ?? 30) <= 35).length;
        const puenktlichkeitGestern =
          yesterdayCompleted.length > 0
            ? (onTimeGestern / yesterdayCompleted.length) * 100
            : 0;

        const ratings = completed.filter((o) => o.bewertung).map((o) => o.bewertung as number);
        const avgBewertung =
          ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 4.5;

        setData({
          bestellungen: today.length,
          bestellungenGestern: yesterday.length,
          umsatz: today.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0),
          umsatzGestern: yesterday.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0),
          avgLieferzeitMin,
          avgLieferzeitGestern: avgGestern,
          puenktlichkeitPct: puenktlichkeit,
          puenktlichkeitGestern,
          aktiveFahrer: 0,
          stornoPct: cancelledPct,
          avgBewertung,
          topArtikel: [],
        });
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const kpis = data
    ? [
        {
          icon: <Package className="h-4 w-4" />,
          label: 'Bestellungen',
          value: data.bestellungen.toString(),
          delta: data.bestellungen - data.bestellungenGestern,
          unit: '',
          color: 'text-matcha-700',
          bg: 'bg-matcha-50',
        },
        {
          icon: <Euro className="h-4 w-4" />,
          label: 'Umsatz',
          value:
            data.umsatz.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
          delta: data.umsatz - data.umsatzGestern,
          unit: ' €',
          color: 'text-emerald-700',
          bg: 'bg-emerald-50',
        },
        {
          icon: <Clock className="h-4 w-4" />,
          label: 'Ø Lieferzeit',
          value:
            data.avgLieferzeitMin > 0 ? `${Math.round(data.avgLieferzeitMin)} Min` : '— Min',
          delta: data.avgLieferzeitGestern - data.avgLieferzeitMin,
          unit: ' Min',
          color: 'text-blue-700',
          bg: 'bg-blue-50',
          invertDelta: true,
        },
        {
          icon: <Target className="h-4 w-4" />,
          label: 'Pünktlichkeit',
          value: `${Math.round(data.puenktlichkeitPct)}%`,
          delta: data.puenktlichkeitPct - data.puenktlichkeitGestern,
          unit: '%',
          color:
            data.puenktlichkeitPct >= 85
              ? 'text-matcha-700'
              : data.puenktlichkeitPct >= 70
              ? 'text-amber-700'
              : 'text-red-700',
          bg:
            data.puenktlichkeitPct >= 85
              ? 'bg-matcha-50'
              : data.puenktlichkeitPct >= 70
              ? 'bg-amber-50'
              : 'bg-red-50',
        },
        {
          icon: <Star className="h-4 w-4" />,
          label: 'Bewertung',
          value: data.avgBewertung.toFixed(1) + ' ★',
          delta: 0,
          unit: '',
          color: 'text-amber-700',
          bg: 'bg-amber-50',
        },
        {
          icon: <Activity className="h-4 w-4" />,
          label: 'Storno-Rate',
          value: `${data.stornoPct.toFixed(1)}%`,
          delta: 0,
          unit: '%',
          color:
            data.stornoPct < 3 ? 'text-matcha-700' : data.stornoPct < 7 ? 'text-amber-700' : 'text-red-700',
          bg:
            data.stornoPct < 3 ? 'bg-matcha-50' : data.stornoPct < 7 ? 'bg-amber-50' : 'bg-red-50',
        },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-saffron/15 text-saffron">
            <Zap className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Smart Delivery — Tages-KPIs</div>
            {data && (
              <div className="text-xs text-stone-400 mt-0.5">
                {data.bestellungen} Bestellungen · {data.aktiveFahrer > 0 ? `${data.aktiveFahrer} Fahrer aktiv · ` : ''}
                {data.avgLieferzeitMin > 0 ? `Ø ${Math.round(data.avgLieferzeitMin)} Min` : ''}
              </div>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-stone-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 py-4 space-y-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className={cn('rounded-xl p-3', kpi.bg)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('opacity-70', kpi.color)}>{kpi.icon}</span>
                      {kpi.delta !== 0 && (
                        <DeltaBadge
                          value={(kpi as any).invertDelta ? -kpi.delta : kpi.delta}
                          unit={kpi.unit}
                        />
                      )}
                    </div>
                    <div className={cn('text-xl font-black tabular-nums leading-none', kpi.color)}>
                      {kpi.value}
                    </div>
                    <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Pünktlichkeits-Balken */}
              <div>
                <div className="flex items-center justify-between mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  <span>Pünktlichkeits-SLA</span>
                  <span
                    className={cn(
                      'font-bold',
                      data.puenktlichkeitPct >= 85
                        ? 'text-matcha-600'
                        : data.puenktlichkeitPct >= 70
                        ? 'text-amber-600'
                        : 'text-red-600',
                    )}
                  >
                    {Math.round(data.puenktlichkeitPct)}% / Ziel 85%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      data.puenktlichkeitPct >= 85
                        ? 'bg-matcha-500'
                        : data.puenktlichkeitPct >= 70
                        ? 'bg-amber-400'
                        : 'bg-red-500',
                    )}
                    style={{ width: `${Math.min(100, data.puenktlichkeitPct)}%` }}
                  />
                </div>
              </div>

              {/* Top Artikel */}
              {data.topArtikel.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Meistbestellte Artikel heute
                  </div>
                  <div className="space-y-1.5">
                    {data.topArtikel.map((a, i) => (
                      <div key={a.name} className="flex items-center gap-2">
                        <span className="w-4 text-[10px] font-bold text-stone-400">{i + 1}.</span>
                        <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-saffron"
                            style={{
                              width: `${(a.count / (data.topArtikel[0]?.count ?? 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-char truncate max-w-[120px]">
                          {a.name}
                        </span>
                        <span className="text-xs font-bold text-stone-500 tabular-nums">
                          ×{a.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
