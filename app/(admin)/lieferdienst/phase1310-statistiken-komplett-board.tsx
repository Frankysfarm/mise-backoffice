'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, YAxis,
} from 'recharts';
import {
  Activity, AlertTriangle, Award, BarChart2, CheckCircle2,
  Clock, Euro, MapPin, Package, TrendingDown, TrendingUp, Truck, Users,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

/**
 * Phase 1310 — Statistiken Komplett-Board (Lieferdienst)
 *
 * Vollständiges Statistiken-Dashboard mit:
 *   • KPI-Kacheln: Bestellungen, Umsatz, Lieferzeit, SLA, Fahrer, Storno-Quote
 *   • Stundenverlauf (Bestellungen + Umsatz je Stunde)
 *   • Trend-Vergleich vs. Vortag + Vorwoche
 *   • Ampel-Alerts für kritische Metriken
 *   • 5-Min-Polling mit Supabase
 *
 * Nach Phase1305 in lieferdienst/client.tsx einbinden.
 */

interface Props {
  locationId: string | null;
}

interface KpiData {
  bestellungen: number;
  umsatz: number;
  lieferzeitMin: number;
  slaQuote: number;
  aktiveFahrer: number;
  stornoQuote: number;
  bestellungenGestern: number;
  umsatzGestern: number;
  lieferzeitGestern: number;
  stundenverlauf: Array<{ stunde: number; bestellungen: number; umsatz: number }>;
}

const EMPTY: KpiData = {
  bestellungen: 0,
  umsatz: 0,
  lieferzeitMin: 0,
  slaQuote: 100,
  aktiveFahrer: 0,
  stornoQuote: 0,
  bestellungenGestern: 0,
  umsatzGestern: 0,
  lieferzeitGestern: 0,
  stundenverlauf: [],
};

function trend(now: number, prev: number): { up: boolean; pct: number } {
  if (prev === 0) return { up: true, pct: 0 };
  const delta = ((now - prev) / prev) * 100;
  return { up: delta >= 0, pct: Math.abs(delta) };
}

type Ampel = 'gruen' | 'gelb' | 'rot';
function ampelFarbe(ok: boolean, warn: boolean): Ampel {
  if (ok) return 'gruen';
  if (warn) return 'gelb';
  return 'rot';
}

const AMPEL_STYLE: Record<Ampel, string> = {
  gruen: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
  gelb:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  rot:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700',
};

interface KpiTile {
  label: string;
  value: string;
  sub?: string;
  ampel: Ampel;
  trendUp?: boolean;
  trendPct?: number;
  icon: React.ReactNode;
}

export function LieferdienstPhase1310StatistikenKomplettBoard({ locationId }: Props) {
  const [data, setData] = useState<KpiData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    const sb = createClient();

    const load = async () => {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      try {
        const [todayRes, yesterdayRes, driversRes] = await Promise.all([
          sb
            .from('customer_orders')
            .select('id, status, gesamtbetrag, tatsaechliche_lieferzeit_min, erstellt_am, typ')
            .eq('location_id', locationId)
            .gte('erstellt_am', todayStart.toISOString())
            .eq('typ', 'lieferung'),
          sb
            .from('customer_orders')
            .select('id, status, gesamtbetrag, tatsaechliche_lieferzeit_min')
            .eq('location_id', locationId)
            .gte('erstellt_am', yesterdayStart.toISOString())
            .lt('erstellt_am', todayStart.toISOString())
            .eq('typ', 'lieferung'),
          sb
            .from('mise_drivers')
            .select('id')
            .eq('active', true)
            .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning']),
        ]);

        type OrderRow = { status: string | null; gesamtbetrag: number | null; tatsaechliche_lieferzeit_min: number | null; erstellt_am?: string | null };
        const today = (todayRes.data ?? []) as OrderRow[];
        const yesterday = (yesterdayRes.data ?? []) as OrderRow[];

        const delivered = today.filter((o) => o.status === 'geliefert');
        const storni = today.filter((o) => o.status === 'storniert');
        const total = today.length;

        const umsatz = delivered.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
        const umsatzGestern = yesterday
          .filter((o) => o.status === 'geliefert')
          .reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

        const lieferzeitWerte = delivered
          .map((o) => o.tatsaechliche_lieferzeit_min)
          .filter((v): v is number => v != null && v > 0);
        const avgLieferzeit = lieferzeitWerte.length > 0
          ? lieferzeitWerte.reduce((s, v) => s + v, 0) / lieferzeitWerte.length
          : 0;

        const lieferzeitGesternWerte = yesterday
          .filter((o) => o.status === 'geliefert')
          .map((o) => o.tatsaechliche_lieferzeit_min)
          .filter((v): v is number => v != null && v > 0);
        const avgLieferzeitGestern = lieferzeitGesternWerte.length > 0
          ? lieferzeitGesternWerte.reduce((s, v) => s + v, 0) / lieferzeitGesternWerte.length
          : 0;

        const slaOk = delivered.filter((o) => (o.tatsaechliche_lieferzeit_min ?? 999) <= 45).length;
        const slaQuote = delivered.length > 0 ? (slaOk / delivered.length) * 100 : 100;
        const stornoQuote = total > 0 ? (storni.length / total) * 100 : 0;

        // Stundenverlauf
        const stundenverlauf: Array<{ stunde: number; bestellungen: number; umsatz: number }> = [];
        for (let h = 0; h < 24; h++) {
          const ohOrders = today.filter((o) => {
            if (!o.erstellt_am) return false;
            return new Date(o.erstellt_am).getHours() === h;
          });
          stundenverlauf.push({
            stunde: h,
            bestellungen: ohOrders.length,
            umsatz: ohOrders.filter((o) => o.status === 'geliefert').reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0),
          });
        }

        setData({
          bestellungen: delivered.length,
          umsatz,
          lieferzeitMin: Math.round(avgLieferzeit),
          slaQuote: Math.round(slaQuote),
          aktiveFahrer: driversRes.data?.length ?? 0,
          stornoQuote: Math.round(stornoQuote * 10) / 10,
          bestellungenGestern: yesterday.filter((o) => o.status === 'geliefert').length,
          umsatzGestern,
          lieferzeitGestern: Math.round(avgLieferzeitGestern),
          stundenverlauf,
        });
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  const kpis: KpiTile[] = [
    {
      label: 'Bestellungen',
      value: String(data.bestellungen),
      ampel: ampelFarbe(data.bestellungen >= 10, data.bestellungen >= 5),
      trendUp: trend(data.bestellungen, data.bestellungenGestern).up,
      trendPct: trend(data.bestellungen, data.bestellungenGestern).pct,
      icon: <Package className="h-4 w-4" />,
    },
    {
      label: 'Umsatz',
      value: euro(data.umsatz),
      ampel: ampelFarbe(data.umsatz >= 300, data.umsatz >= 100),
      trendUp: trend(data.umsatz, data.umsatzGestern).up,
      trendPct: trend(data.umsatz, data.umsatzGestern).pct,
      icon: <Euro className="h-4 w-4" />,
    },
    {
      label: 'Ø Lieferzeit',
      value: data.lieferzeitMin > 0 ? `${data.lieferzeitMin} Min` : '—',
      ampel: ampelFarbe(data.lieferzeitMin <= 35, data.lieferzeitMin <= 45),
      trendUp: data.lieferzeitMin <= data.lieferzeitGestern,
      trendPct: trend(data.lieferzeitGestern, data.lieferzeitMin).pct,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: 'SLA-Quote',
      value: `${data.slaQuote}%`,
      sub: '≤45 Min',
      ampel: ampelFarbe(data.slaQuote >= 90, data.slaQuote >= 75),
      icon: <Award className="h-4 w-4" />,
    },
    {
      label: 'Aktive Fahrer',
      value: String(data.aktiveFahrer),
      ampel: ampelFarbe(data.aktiveFahrer >= 3, data.aktiveFahrer >= 1),
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Storno-Quote',
      value: `${data.stornoQuote}%`,
      ampel: ampelFarbe(data.stornoQuote <= 3, data.stornoQuote <= 8),
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  ];

  const stundenverlaufFiltered = data.stundenverlauf.filter((h) => h.bestellungen > 0 || h.umsatz > 0);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-50 dark:bg-matcha-950/30 border-b border-border">
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Statistiken Komplett-Board · Heute</span>
        <Activity className="ml-auto h-3.5 w-3.5 text-matcha-400 animate-pulse" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 rounded-full border-2 border-matcha-400 border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
            {kpis.map((k) => (
              <div key={k.label} className={cn('rounded-lg border p-3', AMPEL_STYLE[k.ampel])}>
                <div className="flex items-center gap-1.5 mb-1 opacity-70">{k.icon}
                  <span className="text-[10px] font-bold uppercase tracking-wider">{k.label}</span>
                </div>
                <div className="text-xl font-black tabular-nums">{k.value}</div>
                {k.sub && <div className="text-[9px] opacity-60 mt-0.5">{k.sub}</div>}
                {k.trendPct != null && k.trendPct > 0 && (
                  <div className={cn('flex items-center gap-0.5 text-[9px] font-bold mt-1', k.trendUp ? 'text-green-600' : 'text-red-600')}>
                    {k.trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {k.trendPct.toFixed(0)}% vs. gestern
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stundenverlauf */}
          {stundenverlaufFiltered.length > 0 && (
            <div className="px-4 pb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Bestellungen je Stunde (heute)
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={stundenverlaufFiltered} barSize={14}>
                  <XAxis
                    dataKey="stunde"
                    tick={{ fontSize: 9 }}
                    tickFormatter={(h) => `${h}h`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [String(v), 'Bestellungen']}
                    labelFormatter={(h) => `${h}:00 Uhr`}
                    contentStyle={{ fontSize: 10, border: 'none', borderRadius: 6 }}
                  />
                  <Bar dataKey="bestellungen" fill="#6d8f6d" radius={[3, 3, 0, 0]}>
                    {stundenverlaufFiltered.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.bestellungen >= 5 ? '#4a7c59' : entry.bestellungen >= 2 ? '#6d8f6d' : '#a8c5a8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Alerts */}
          <div className="px-4 pb-4 space-y-2">
            {data.slaQuote < 75 && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                <span className="text-xs text-red-800 dark:text-red-300 font-medium">
                  SLA-Quote kritisch ({data.slaQuote}%) — Lieferzeiten optimieren!
                </span>
              </div>
            )}
            {data.stornoQuote > 8 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  Storno-Quote erhöht ({data.stornoQuote}%) — Ursache prüfen.
                </span>
              </div>
            )}
            {data.aktiveFahrer === 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2">
                <Truck className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                <span className="text-xs text-red-800 dark:text-red-300 font-medium">
                  Kein aktiver Fahrer online!
                </span>
              </div>
            )}
            {data.slaQuote >= 90 && data.stornoQuote <= 3 && data.aktiveFahrer >= 2 && (
              <div className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                <span className="text-xs text-green-800 dark:text-green-300 font-medium">
                  ⭐ Alles grün — exzellente Schicht-Performance!
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
