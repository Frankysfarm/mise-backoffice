'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock,
  Euro, Package, Star, Target, TrendingDown, TrendingUp,
} from 'lucide-react';

/* ── Typen ──────────────────────────────────────────────────────────────── */
interface LiveStats {
  umsatzHeute:        number;
  bestellungenHeute:  number;
  aktiveFahrer:       number;
  aktiveTouren:       number;
  onTimePct:          number;
  avgDeliveryMin:     number;
  stornoquote:        number;
  avgBewertung:       number;
  offeneBestellungen: number;
  verzoegerungen:     number;
}

type Trend = 'up' | 'down' | 'neutral';

interface KPICard {
  label:   string;
  value:   string;
  sub?:    string;
  trend?:  Trend;
  icon:    React.ElementType;
  accent:  string;
  textColor: string;
  alert?:  boolean;
}

/* ── Mini-Trend-Pfeil ───────────────────────────────────────────────────── */
function TrendIcon({ trend }: { trend?: Trend }) {
  if (!trend || trend === 'neutral') return <TrendingUp className="h-3 w-3 text-muted-foreground/40" />;
  return trend === 'up'
    ? <TrendingUp className="h-3 w-3 text-green-500" />
    : <TrendingDown className="h-3 w-3 text-red-500" />;
}

/* ── KPI-Kachel ─────────────────────────────────────────────────────────── */
function KpiTile({ card }: { card: KPICard }) {
  const Icon = card.icon;
  return (
    <div className={cn(
      'rounded-xl border p-3 flex items-start gap-2.5 shadow-sm transition-all',
      card.alert ? 'bg-red-50 border-red-300 shadow-red-100' : 'bg-white border-border',
    )}>
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', card.accent)}>
        <Icon className={cn('h-4 w-4', card.textColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-lg font-black tabular-nums leading-none', card.textColor)}>{card.value}</span>
          <TrendIcon trend={card.trend} />
        </div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">{card.label}</div>
        {card.sub && <div className="text-[9px] text-muted-foreground">{card.sub}</div>}
      </div>
    </div>
  );
}

/* ── Stunden-Bar ────────────────────────────────────────────────────────── */
interface HourBar { hour: number; orders: number; revenue: number }

function StundenChart({ data }: { data: HourBar[] }) {
  if (data.length === 0) return null;
  const maxOrders = Math.max(...data.map(d => d.orders), 1);
  const now = new Date().getHours();

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Bestellverlauf (heute)
      </div>
      <div className="flex items-end gap-0.5 h-12">
        {data.map(d => (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={cn(
                'w-full rounded-t transition-all duration-500',
                d.hour === now ? 'bg-matcha-600' : d.orders > 0 ? 'bg-matcha-300' : 'bg-muted/30',
              )}
              style={{ height: `${Math.max(2, (d.orders / maxOrders) * 100)}%` }}
            />
            {d.hour % 3 === 0 && (
              <span className="text-[8px] text-muted-foreground tabular-nums">{d.hour}h</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function LieferdienstPhase2015ExecutiveLiveStats({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [stundenData, setStundenData] = useState<HourBar[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const supaRef = useRef(createClient());

  useEffect(() => {
    if (!locationId) return;
    const supa = supaRef.current;

    async function load() {
      const now    = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

      /* Heutige Bestellungen */
      const { data: orders } = await supa
        .from('orders')
        .select('id,status,total_price,created_at,type,rating')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString())
        .limit(500);

      if (!orders) return;

      const delivered  = orders.filter((o: { status: string }) => ['geliefert', 'abgeschlossen'].includes(o.status));
      const cancelled  = orders.filter((o: { status: string }) => ['storniert', 'abgebrochen'].includes(o.status));
      const pending    = orders.filter((o: { status: string }) => !['geliefert', 'abgeschlossen', 'storniert', 'abgebrochen'].includes(o.status));

      const umsatz = delivered.reduce((s: number, o: { total_price: number }) => s + (o.total_price ?? 0), 0);
      const ratings = delivered.map((o: { rating: number | null }) => o.rating).filter((r: number | null): r is number => r !== null);
      const avgBewertung = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
      const stornoquote  = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;

      /* Aktive Fahrer */
      const { count: aktiveFahrer } = await supa
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('status', 'online');

      /* Aktive Touren */
      const { count: aktiveTouren } = await supa
        .from('delivery_batches')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .in('status', ['unterwegs', 'abgeholt']);

      /* Lieferzeiten */
      const { data: deliveryTimes } = await supa
        .from('delivery_batches')
        .select('actual_duration_min,was_on_time')
        .eq('location_id', locationId)
        .gte('completed_at', todayStart.toISOString())
        .eq('status', 'abgeschlossen')
        .limit(200);

      const durations   = (deliveryTimes ?? []).map((d: { actual_duration_min: number | null }) => d.actual_duration_min).filter((d: number | null): d is number => d !== null);
      const avgDelivery = durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;
      const onTimeCount = (deliveryTimes ?? []).filter((d: { was_on_time: boolean }) => d.was_on_time).length;
      const onTimePct   = deliveryTimes && deliveryTimes.length > 0 ? Math.round((onTimeCount / deliveryTimes.length) * 100) : 0;

      /* Verspätete Bestellungen */
      const { count: verzoegerungen } = await supa
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .in('status', ['eingegangen', 'in_bearbeitung', 'bereit'])
        .lt('estimated_delivery_at', now.toISOString());

      setStats({
        umsatzHeute:        umsatz,
        bestellungenHeute:  orders.length,
        aktiveFahrer:       aktiveFahrer ?? 0,
        aktiveTouren:       aktiveTouren ?? 0,
        onTimePct,
        avgDeliveryMin:     avgDelivery,
        stornoquote:        Math.round(stornoquote * 10) / 10,
        avgBewertung:       Math.round(avgBewertung * 10) / 10,
        offeneBestellungen: pending.length,
        verzoegerungen:     verzoegerungen ?? 0,
      });

      /* Stundendaten */
      const hourMap = new Map<number, { orders: number; revenue: number }>();
      orders.forEach((o: { created_at: string; total_price: number | null }) => {
        const h = new Date(o.created_at).getHours();
        const cur = hourMap.get(h) ?? { orders: 0, revenue: 0 };
        cur.orders++;
        cur.revenue += o.total_price ?? 0;
        hourMap.set(h, cur);
      });

      const nowH = now.getHours();
      const bars: HourBar[] = [];
      for (let h = Math.max(0, nowH - 11); h <= nowH; h++) {
        const d = hourMap.get(h) ?? { orders: 0, revenue: 0 };
        bars.push({ hour: h, ...d });
      }
      setStundenData(bars);
      setLastUpdate(new Date());
    }

    load();
    const iv = setInterval(load, 60_000);
    const ch = supa
      .channel(`exec-stats-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `location_id=eq.${locationId}` }, load)
      .subscribe();

    return () => { clearInterval(iv); supa.removeChannel(ch); };
  }, [locationId]);

  if (!locationId) return null;

  if (!stats) {
    return (
      <div className="rounded-2xl border p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Activity className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Lade Live-Statistiken…</span>
      </div>
    );
  }

  const kpis: KPICard[] = [
    {
      label: 'Umsatz Heute',
      value: `€${stats.umsatzHeute.toFixed(0)}`,
      sub: `${stats.bestellungenHeute} Bestellungen`,
      trend: stats.umsatzHeute > 500 ? 'up' : 'neutral',
      icon: Euro,
      accent: 'bg-green-100',
      textColor: 'text-green-700',
    },
    {
      label: 'Aktive Fahrer',
      value: String(stats.aktiveFahrer),
      sub: `${stats.aktiveTouren} Touren aktiv`,
      icon: Bike,
      accent: 'bg-matcha-100',
      textColor: 'text-matcha-700',
    },
    {
      label: 'Pünktlichkeit',
      value: `${stats.onTimePct}%`,
      sub: `Ø ${stats.avgDeliveryMin} Min`,
      trend: stats.onTimePct >= 80 ? 'up' : stats.onTimePct >= 60 ? 'neutral' : 'down',
      icon: Target,
      accent: stats.onTimePct >= 80 ? 'bg-green-100' : stats.onTimePct >= 60 ? 'bg-amber-100' : 'bg-red-100',
      textColor: stats.onTimePct >= 80 ? 'text-green-700' : stats.onTimePct >= 60 ? 'text-amber-700' : 'text-red-700',
    },
    {
      label: 'Offen',
      value: String(stats.offeneBestellungen),
      sub: stats.verzoegerungen > 0 ? `${stats.verzoegerungen} verspätet` : 'Alles im Plan',
      trend: stats.verzoegerungen > 0 ? 'down' : 'up',
      icon: Package,
      accent: stats.verzoegerungen > 0 ? 'bg-red-100' : 'bg-blue-100',
      textColor: stats.verzoegerungen > 0 ? 'text-red-700' : 'text-blue-700',
      alert: stats.verzoegerungen > 3,
    },
    {
      label: 'Bewertung',
      value: stats.avgBewertung > 0 ? `${stats.avgBewertung.toFixed(1)} ★` : '—',
      trend: stats.avgBewertung >= 4.5 ? 'up' : stats.avgBewertung >= 3.5 ? 'neutral' : 'down',
      icon: Star,
      accent: 'bg-yellow-100',
      textColor: 'text-yellow-700',
    },
    {
      label: 'Stornoquote',
      value: `${stats.stornoquote}%`,
      trend: stats.stornoquote <= 3 ? 'up' : stats.stornoquote <= 8 ? 'neutral' : 'down',
      icon: stats.stornoquote > 8 ? AlertTriangle : CheckCircle2,
      accent: stats.stornoquote > 8 ? 'bg-red-100' : 'bg-green-100',
      textColor: stats.stornoquote > 8 ? 'text-red-700' : 'text-green-700',
      alert: stats.stornoquote > 10,
    },
  ];

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-matcha-50 to-white">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">Executive Live-Statistiken</span>
        {lastUpdate && (
          <div className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kpis.map(card => <KpiTile key={card.label} card={card} />)}
        </div>

        {/* Stunden-Chart */}
        {stundenData.length > 0 && <StundenChart data={stundenData} />}

        {/* Alerts */}
        {(stats.verzoegerungen > 0 || stats.stornoquote > 8) && (
          <div className="space-y-1.5">
            {stats.verzoegerungen > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-bold text-red-700">
                  {stats.verzoegerungen} Bestellung{stats.verzoegerungen !== 1 ? 'en' : ''} überfällig
                </span>
              </div>
            )}
            {stats.stornoquote > 8 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-700">
                  Stornoquote erhöht ({stats.stornoquote}%) — bitte prüfen
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
