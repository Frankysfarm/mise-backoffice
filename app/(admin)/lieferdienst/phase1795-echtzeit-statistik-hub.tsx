'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Package, Bike, Euro, Clock, Star, Zap, RefreshCw,
} from 'lucide-react';

/**
 * Phase 1795 — Echtzeit-Statistik-Hub (Lieferdienst)
 *
 * Zentrales Statistik-Dashboard: Umsatz, Bestellungen, Fahrer-Performance,
 * Storno-Quote, Ø Lieferzeit — alles auf einen Blick.
 * Supabase-Realtime + 5-Min-Polling. Matcha-Theme.
 */

interface StundeStats {
  stunde: number;
  label: string;
  bestellungen: number;
  umsatz: number;
}

interface KpiData {
  umsatzHeute: number;
  bestellungenHeute: number;
  aktiveFahrer: number;
  avgLieferzeitMin: number | null;
  stornoQuote: number;
  avgBewertung: number | null;
  stunden: StundeStats[];
}

function formatEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

interface Props {
  locationId?: string | null;
  className?: string;
}

export function LieferdienstPhase1795EchtzeitStatistikHub({ locationId, className }: Props) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const heute = new Date();
      heute.setHours(0, 0, 0, 0);
      const heuteISO = heute.toISOString();

      const qBase = supabase
        .from('customer_orders')
        .select('gesamtbetrag, status, bestellt_am, lieferzeit_min, bewertung_sterne')
        .gte('bestellt_am', heuteISO);

      const qFiltered = locationId
        ? qBase.eq('location_id', locationId)
        : qBase;

      const [{ data: orders }, { data: drivers }] = await Promise.all([
        qFiltered,
        supabase
          .from('driver_status')
          .select('id, status')
          .in('status', ['online', 'auf_tour', 'aktiv']),
      ]);

      type OrderRow = { gesamtbetrag: number | null; status: string | null; bestellt_am: string | null; lieferzeit_min: number | null; bewertung_sterne: number | null };
      const alle: OrderRow[] = (orders ?? []) as OrderRow[];
      const abg = alle.filter((o) => ['geliefert', 'abgeholt', 'fertig', 'abgeschlossen'].includes(o.status ?? ''));
      const storno = alle.filter((o) => ['storniert', 'abgebrochen', 'cancelled'].includes(o.status ?? ''));

      const umsatzHeute = abg.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
      const bestellungenHeute = alle.length;
      const aktiveFahrer = (drivers ?? []).length;
      const stornoQuote = alle.length > 0 ? Math.round((storno.length / alle.length) * 100) : 0;

      const lieferzeiten = abg.filter((o) => o.lieferzeit_min != null).map((o) => o.lieferzeit_min as number);
      const avgLieferzeitMin = lieferzeiten.length > 0
        ? Math.round(lieferzeiten.reduce((s, v) => s + v, 0) / lieferzeiten.length)
        : null;

      const bewertungen = abg.filter((o) => o.bewertung_sterne != null).map((o) => o.bewertung_sterne as number);
      const avgBewertung = bewertungen.length > 0
        ? Math.round((bewertungen.reduce((s, v) => s + v, 0) / bewertungen.length) * 10) / 10
        : null;

      // Stunden-Aufteilung
      const stundenMap: Record<number, { bestellungen: number; umsatz: number }> = {};
      for (const o of alle) {
        const h = o.bestellt_am ? new Date(o.bestellt_am).getHours() : -1;
        if (h < 0) continue;
        stundenMap[h] = stundenMap[h] ?? { bestellungen: 0, umsatz: 0 };
        stundenMap[h].bestellungen++;
        if (abg.includes(o)) stundenMap[h].umsatz += o.gesamtbetrag ?? 0;
      }
      const nowH = new Date().getHours();
      const stunden: StundeStats[] = [];
      for (let h = 10; h <= Math.max(nowH, 22); h++) {
        stunden.push({
          stunde: h,
          label: `${h}h`,
          bestellungen: stundenMap[h]?.bestellungen ?? 0,
          umsatz: stundenMap[h]?.umsatz ?? 0,
        });
      }

      setData({ umsatzHeute, bestellungenHeute, aktiveFahrer, avgLieferzeitMin, stornoQuote, avgBewertung, stunden });
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[Phase1795]', err);
    } finally {
      setLoading(false);
    }
  }, [locationId, supabase]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('phase1795-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, supabase]);

  const nowH = new Date().getHours();
  const maxBestell = data ? Math.max(...data.stunden.map(s => s.bestellungen), 1) : 1;

  const kpis = data ? [
    {
      icon: <Euro className="h-4 w-4" />,
      label: 'Umsatz heute',
      value: formatEur(data.umsatzHeute),
      sub: `${data.bestellungenHeute} Bestellungen`,
      color: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    {
      icon: <Bike className="h-4 w-4" />,
      label: 'Aktive Fahrer',
      value: String(data.aktiveFahrer),
      sub: data.aktiveFahrer > 0 ? 'Im Einsatz' : 'Kein Fahrer online',
      color: data.aktiveFahrer > 0 ? 'text-matcha-700 dark:text-matcha-300' : 'text-muted-foreground',
      bg: 'bg-matcha-50 dark:bg-matcha-950/30',
      border: 'border-matcha-200 dark:border-matcha-800',
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Ø Lieferzeit',
      value: data.avgLieferzeitMin !== null ? `${data.avgLieferzeitMin} Min` : '–',
      sub: data.avgLieferzeitMin !== null
        ? data.avgLieferzeitMin <= 30 ? 'Im Ziel' : 'Über Ziel'
        : 'Noch keine Daten',
      color: data.avgLieferzeitMin !== null && data.avgLieferzeitMin <= 30
        ? 'text-matcha-700 dark:text-matcha-300'
        : 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
    },
    {
      icon: <Star className="h-4 w-4" />,
      label: 'Ø Bewertung',
      value: data.avgBewertung !== null ? `${data.avgBewertung.toFixed(1)} ★` : '–',
      sub: `Storno: ${data.stornoQuote}%`,
      color: data.avgBewertung !== null && data.avgBewertung >= 4.5
        ? 'text-amber-600 dark:text-amber-300'
        : 'text-muted-foreground',
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
  ] : [];

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Echtzeit-Statistiken</span>
          {data && !loading && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" /> Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* KPI Grid */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={cn('rounded-xl border p-3', kpi.bg, kpi.border)}>
              <div className={cn('flex items-center gap-1.5 mb-1', kpi.color)}>
                {kpi.icon}
                <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{kpi.label}</span>
              </div>
              <div className={cn('text-lg font-black tabular-nums', kpi.color)}>{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Stunden-Chart */}
      {data && data.stunden.length > 0 && (
        <div className="px-5 pb-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Bestellungen je Stunde (heute)
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stunden} barCategoryGap="20%">
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [`${val} Bestellungen`, '']}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(l: any) => `${l} Uhr`}
                />
                <Bar dataKey="bestellungen" radius={[4,4,0,0]}>
                  {data.stunden.map((s) => (
                    <Cell
                      key={s.stunde}
                      fill={s.stunde === nowH ? '#5a7a52' : s.bestellungen === maxBestell && s.bestellungen > 0 ? '#7a9e6e' : '#c4d9b8'}
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
