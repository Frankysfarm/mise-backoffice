'use client';

/**
 * Phase 2336 — Statistiken Echtzeit Pro
 * 10 KPIs mit Ampel-Farbkodierung, Stunden-Chart (Umsatz/Bestellungen),
 * Zonen-Ranking, Alert-Strip. 2-Min-Polling.
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  TrendingUp, Euro, Clock, Package, Truck, Star, AlertTriangle,
  CheckCircle2, XCircle, Target, ChevronUp, ChevronDown, Minus,
} from 'lucide-react';

interface KpiDatum {
  label: string;
  value: string;
  sub?: string;
  trend: 'up' | 'down' | 'flat';
  status: 'green' | 'yellow' | 'red';
  icon: React.ReactNode;
}

interface StundenPunkt {
  h: string;
  umsatz: number;
  bestellungen: number;
}

interface ZoneRank {
  zone: string;
  bestellungen: number;
  avg_lieferzeit: number;
}

interface StatsData {
  umsatz_heute: number;
  bestellungen_heute: number;
  storno_quote: number;
  avg_lieferzeit_min: number;
  avg_bewertung: number;
  aktive_fahrer: number;
  on_time_quote: number;
  umsatz_pro_stunde: number;
  offene_bestellungen: number;
  fertige_bestellungen: number;
  stunden: StundenPunkt[];
  zonen: ZoneRank[];
}

const EMPTY: StatsData = {
  umsatz_heute: 0, bestellungen_heute: 0, storno_quote: 0, avg_lieferzeit_min: 0,
  avg_bewertung: 0, aktive_fahrer: 0, on_time_quote: 0, umsatz_pro_stunde: 0,
  offene_bestellungen: 0, fertige_bestellungen: 0, stunden: [], zonen: [],
};

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <ChevronUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <ChevronDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

function statusBg(s: 'green' | 'yellow' | 'red') {
  return s === 'green' ? 'bg-emerald-50 border-emerald-200' : s === 'yellow' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
}
function statusText(s: 'green' | 'yellow' | 'red') {
  return s === 'green' ? 'text-emerald-700' : s === 'yellow' ? 'text-amber-700' : 'text-red-700';
}

export function LieferdienstPhase2336StatistikEchtzeitPro({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<StatsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'umsatz' | 'bestellungen'>('umsatz');

  const load = useCallback(async () => {
    const sb = createClient();
    const today = new Date().toISOString().slice(0, 10);

    let q = sb
      .from('bestellungen')
      .select('id, status, gesamtbetrag, bestellt_am, fertig_am, delivery_zone, bewertung_note')
      .gte('bestellt_am', today);
    if (locationId) q = q.eq('location_id', locationId);
    const { data: orders } = await q;

    if (!orders) { setLoading(false); return; }

    const done = orders.filter((o: any) => o.status === 'zugestellt' || o.status === 'geliefert' || o.status === 'fertig');
    const storno = orders.filter((o: any) => o.status === 'storniert');
    const aktiv = orders.filter((o: any) => ['neu', 'angenommen', 'in_zubereitung', 'bereit', 'unterwegs'].includes(o.status));

    const totalUmsatz = done.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);
    const stornoQuote = orders.length > 0 ? (storno.length / orders.length) * 100 : 0;

    const lieferzeiten = done
      .filter((o: any) => o.bestellt_am && o.fertig_am)
      .map((o: any) => (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000);
    const avgLieferzeit = lieferzeiten.length > 0
      ? lieferzeiten.reduce((a: number, b: number) => a + b, 0) / lieferzeiten.length : 0;

    const bewertungen = orders.filter((o: any) => o.bewertung_note).map((o: any) => o.bewertung_note as number);
    const avgBewertung = bewertungen.length > 0
      ? bewertungen.reduce((a: number, b: number) => a + b, 0) / bewertungen.length : 0;

    const onTime = done.filter((o: any) => {
      if (!o.bestellt_am || !o.fertig_am) return false;
      return (new Date(o.fertig_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000 <= 45;
    });
    const onTimeQuote = done.length > 0 ? (onTime.length / done.length) * 100 : 0;

    const nowH = new Date().getHours();
    const hoursSinceStart = Math.max(1, nowH - 10);
    const umsatzProStunde = hoursSinceStart > 0 ? totalUmsatz / hoursSinceStart : 0;

    // Stunden-Chart
    const stundenMap: Record<number, StundenPunkt> = {};
    for (let h = 10; h <= Math.min(22, nowH); h++) {
      stundenMap[h] = { h: `${h}:00`, umsatz: 0, bestellungen: 0 };
    }
    orders.forEach((o: any) => {
      if (!o.bestellt_am) return;
      const h = new Date(o.bestellt_am).getHours();
      if (stundenMap[h]) {
        stundenMap[h].umsatz += o.gesamtbetrag ?? 0;
        stundenMap[h].bestellungen += 1;
      }
    });
    const stunden = Object.values(stundenMap);

    // Zonen-Ranking
    const zonenMap: Record<string, { bestellungen: number; zeiten: number[] }> = {};
    orders.forEach((o: any) => {
      const z = o.delivery_zone ?? 'Unbekannt';
      if (!zonenMap[z]) zonenMap[z] = { bestellungen: 0, zeiten: [] };
      zonenMap[z].bestellungen++;
      if (o.bestellt_am && o.fertig_am) {
        zonenMap[z].zeiten.push((new Date(o.fertig_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000);
      }
    });
    const zonen: ZoneRank[] = Object.entries(zonenMap)
      .map(([zone, d]) => ({
        zone,
        bestellungen: d.bestellungen,
        avg_lieferzeit: d.zeiten.length > 0 ? d.zeiten.reduce((a, b) => a + b, 0) / d.zeiten.length : 0,
      }))
      .sort((a, b) => b.bestellungen - a.bestellungen)
      .slice(0, 5);

    // Fahrer aktiv
    const { count: aktiveFahrer } = await sb
      .from('fahrer_status')
      .select('*', { count: 'exact', head: true })
      .eq('ist_online', true);

    setData({
      umsatz_heute: totalUmsatz,
      bestellungen_heute: orders.length,
      storno_quote: stornoQuote,
      avg_lieferzeit_min: avgLieferzeit,
      avg_bewertung: avgBewertung,
      aktive_fahrer: aktiveFahrer ?? 0,
      on_time_quote: onTimeQuote,
      umsatz_pro_stunde: umsatzProStunde,
      offene_bestellungen: aktiv.length,
      fertige_bestellungen: done.length,
      stunden,
      zonen,
    });
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [load]);

  const kpis: KpiDatum[] = [
    {
      label: 'Umsatz heute',
      value: euro(data.umsatz_heute),
      trend: 'up',
      status: data.umsatz_heute > 500 ? 'green' : data.umsatz_heute > 200 ? 'yellow' : 'red',
      icon: <Euro className="h-3.5 w-3.5" />,
    },
    {
      label: 'Bestellungen',
      value: String(data.bestellungen_heute),
      sub: `${data.offene_bestellungen} offen`,
      trend: 'up',
      status: data.bestellungen_heute > 20 ? 'green' : data.bestellungen_heute > 8 ? 'yellow' : 'red',
      icon: <Package className="h-3.5 w-3.5" />,
    },
    {
      label: 'Ø Lieferzeit',
      value: data.avg_lieferzeit_min > 0 ? `${Math.round(data.avg_lieferzeit_min)} Min` : '—',
      trend: data.avg_lieferzeit_min > 45 ? 'down' : 'up',
      status: data.avg_lieferzeit_min < 35 ? 'green' : data.avg_lieferzeit_min < 50 ? 'yellow' : 'red',
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    {
      label: 'On-Time-Quote',
      value: data.avg_lieferzeit_min > 0 ? `${Math.round(data.on_time_quote)}%` : '—',
      trend: data.on_time_quote >= 90 ? 'up' : 'down',
      status: data.on_time_quote >= 90 ? 'green' : data.on_time_quote >= 75 ? 'yellow' : 'red',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    {
      label: 'Storno-Quote',
      value: `${data.storno_quote.toFixed(1)}%`,
      trend: data.storno_quote < 5 ? 'up' : 'down',
      status: data.storno_quote < 5 ? 'green' : data.storno_quote < 10 ? 'yellow' : 'red',
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
    {
      label: 'Ø Bewertung',
      value: data.avg_bewertung > 0 ? `${data.avg_bewertung.toFixed(1)}★` : '—',
      trend: data.avg_bewertung >= 4.5 ? 'up' : data.avg_bewertung >= 4 ? 'flat' : 'down',
      status: data.avg_bewertung >= 4.5 ? 'green' : data.avg_bewertung >= 4 ? 'yellow' : 'red',
      icon: <Star className="h-3.5 w-3.5" />,
    },
    {
      label: 'Aktive Fahrer',
      value: String(data.aktive_fahrer),
      trend: data.aktive_fahrer >= 3 ? 'up' : 'flat',
      status: data.aktive_fahrer >= 3 ? 'green' : data.aktive_fahrer >= 1 ? 'yellow' : 'red',
      icon: <Truck className="h-3.5 w-3.5" />,
    },
    {
      label: 'Umsatz/h',
      value: euro(data.umsatz_pro_stunde),
      trend: data.umsatz_pro_stunde >= 80 ? 'up' : 'flat',
      status: data.umsatz_pro_stunde >= 80 ? 'green' : data.umsatz_pro_stunde >= 40 ? 'yellow' : 'red',
      icon: <TrendingUp className="h-3.5 w-3.5" />,
    },
  ];

  const alerts: string[] = [];
  if (data.storno_quote > 10) alerts.push(`Storno-Quote ${data.storno_quote.toFixed(1)}% — kritisch!`);
  if (data.avg_lieferzeit_min > 50) alerts.push(`Ø Lieferzeit ${Math.round(data.avg_lieferzeit_min)} Min — zu lang!`);
  if (data.on_time_quote < 75 && data.fertige_bestellungen > 0) alerts.push(`On-Time nur ${Math.round(data.on_time_quote)}% — Maßnahmen nötig!`);
  if (data.avg_bewertung > 0 && data.avg_bewertung < 3.5) alerts.push(`Bewertung ${data.avg_bewertung.toFixed(1)}★ — sofortige Maßnahmen!`);

  return (
    <div className="rounded-xl border bg-card overflow-hidden space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Statistiken Echtzeit Pro</span>
        </div>
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse">Lädt…</span>}
      </div>

      {/* Alert Strip */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 flex-wrap">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          {alerts.map((a, i) => (
            <span key={i} className="text-[10px] font-bold text-red-700 bg-white px-2 py-0.5 rounded-full border border-red-200">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {kpis.map(k => (
          <div key={k.label} className={cn('p-3 bg-card', statusBg(k.status))}>
            <div className="flex items-center justify-between mb-1">
              <span className={cn('text-[10px] font-bold', statusText(k.status))}>{k.label}</span>
              <TrendIcon trend={k.trend} />
            </div>
            <div className={cn('text-lg font-black tabular-nums', statusText(k.status))}>{k.value}</div>
            {k.sub && <div className="text-[9px] text-muted-foreground mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Chart */}
      {data.stunden.length > 1 && (
        <div className="p-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stundenverlauf</span>
            <div className="flex gap-1">
              {(['umsatz', 'bestellungen'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={cn(
                    'text-[9px] font-bold px-2 py-0.5 rounded-full border transition',
                    chartMode === m ? 'bg-matcha-600 text-white border-matcha-600' : 'text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {m === 'umsatz' ? 'Umsatz €' : 'Bestellungen'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="h" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                formatter={((v: number) => chartMode === 'umsatz' ? euro(v) : `${v} Bestellungen`) as any}
              />
              <Bar dataKey={chartMode} radius={[3, 3, 0, 0]} maxBarSize={24}>
                {data.stunden.map((_, i) => (
                  <Cell key={i} fill={i === data.stunden.length - 1 ? '#5b8c5a' : '#a7c4a5'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Zonen-Ranking */}
      {data.zonen.length > 0 && (
        <div className="p-4 border-t">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Zonen-Ranking</div>
          <div className="space-y-1.5">
            {data.zonen.map((z, i) => (
              <div key={z.zone} className="flex items-center gap-2 text-[11px]">
                <span className="w-4 text-muted-foreground font-bold tabular-nums">{i + 1}.</span>
                <span className="flex-1 font-semibold truncate">{z.zone}</span>
                <span className="tabular-nums font-bold">{z.bestellungen} Best.</span>
                <span className={cn('tabular-nums text-[10px]', z.avg_lieferzeit > 45 ? 'text-red-500' : z.avg_lieferzeit > 35 ? 'text-amber-500' : 'text-emerald-600')}>
                  {z.avg_lieferzeit > 0 ? `Ø ${Math.round(z.avg_lieferzeit)}m` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
