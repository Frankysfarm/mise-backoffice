'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { euro } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Euro, Clock, CheckCircle2, XCircle, Truck, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ── Typen ─────────────────────────────────────────────────────────────── */
interface KpiCard {
  label: string;
  value: string;
  sub: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

interface HourBucket {
  hour: string;
  bestellungen: number;
  umsatz: number;
  stornos: number;
}

interface StatsState {
  bestellungenHeute: number;
  umsatzHeute: number;
  stornoquote: number;
  avgLieferzeit: number | null;
  aktiveFahrer: number;
  puenktlichkeit: number;
  stunden: HourBucket[];
  lastUpdated: Date;
}

/* ── Kpi-Chip ───────────────────────────────────────────────────────────── */
function KpiChip({ card }: { card: KpiCard }) {
  return (
    <div className={cn('rounded-xl border bg-card p-3 space-y-1', card.color)}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{card.icon}</span>
        {card.trend !== 'neutral' && (
          card.trend === 'up'
            ? <TrendingUp className="h-3 w-3 text-matcha-500" />
            : <TrendingDown className="h-3 w-3 text-red-400" />
        )}
      </div>
      <p className="text-lg font-black tabular-nums leading-tight">{card.value}</p>
      <p className="text-[10px] font-semibold">{card.label}</p>
      <p className="text-[9px] text-muted-foreground">{card.sub}</p>
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function LieferdienstPhase2240StatistikHubPro({ locationId }: { locationId?: string | null }) {
  const [stats, setStats] = useState<StatsState | null>(null);
  const [loading, setLoading] = useState(false);
  const supaRef = useRef(createClient());

  useEffect(() => {
    if (!locationId) return;
    const supa = supaRef.current;

    async function load() {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [ordersRes, driversRes] = await Promise.all([
        supa
          .from('customer_orders')
          .select('id,status,gesamtbetrag,bestellt_am,fertig_am,zahlungsart')
          .eq('location_id', locationId)
          .gte('bestellt_am', startOfDay),
        supa
          .from('driver_status')
          .select('id,ist_online')
          .eq('location_id', locationId)
          .eq('ist_online', true),
      ]);

      const orders = ordersRes.data ?? [];
      const drivers = driversRes.data ?? [];

      const delivered = orders.filter((o: Record<string, unknown>) => o.status === 'geliefert');
      const storniert = orders.filter((o: Record<string, unknown>) => o.status === 'storniert');
      const umsatz = delivered.reduce((s: number, o: Record<string, unknown>) => s + ((o.gesamtbetrag as number) ?? 0), 0);
      const stornoquote = orders.length > 0 ? (storniert.length / orders.length) * 100 : 0;

      // Durchschnittliche Lieferzeit
      const lieferzeiten = delivered
        .filter((o: Record<string, unknown>) => o.bestellt_am && o.fertig_am)
        .map((o: Record<string, unknown>) => {
          const diff = new Date(o.fertig_am as string).getTime() - new Date(o.bestellt_am as string).getTime();
          return diff / 60_000;
        });
      const avgLieferzeit = lieferzeiten.length > 0
        ? Math.round(lieferzeiten.reduce((a: number, b: number) => a + b, 0) / lieferzeiten.length)
        : null;

      // Pünktlichkeit (< 45 min = pünktlich)
      const puenktlich = lieferzeiten.filter((t: number) => t <= 45).length;
      const puenktlichkeit = lieferzeiten.length > 0 ? Math.round((puenktlich / lieferzeiten.length) * 100) : 0;

      // Stunden-Buckets
      const stundenMap: Record<string, HourBucket> = {};
      for (let h = 0; h < 24; h++) {
        const key = `${h.toString().padStart(2, '0')}:00`;
        stundenMap[key] = { hour: key, bestellungen: 0, umsatz: 0, stornos: 0 };
      }
      orders.forEach((o: Record<string, unknown>) => {
        if (!o.bestellt_am) return;
        const h = new Date(o.bestellt_am as string).getHours();
        const key = `${h.toString().padStart(2, '0')}:00`;
        if (!stundenMap[key]) return;
        stundenMap[key].bestellungen++;
        if (o.status === 'geliefert') stundenMap[key].umsatz += (o.gesamtbetrag as number) ?? 0;
        if (o.status === 'storniert') stundenMap[key].stornos++;
      });

      const currentHour = now.getHours();
      const stunden = Object.values(stundenMap)
        .filter(b => {
          const h = parseInt(b.hour);
          return h >= Math.max(0, currentHour - 8) && h <= currentHour;
        });

      setStats({
        bestellungenHeute: orders.length,
        umsatzHeute: umsatz,
        stornoquote,
        avgLieferzeit,
        aktiveFahrer: drivers.length,
        puenktlichkeit,
        stunden,
        lastUpdated: new Date(),
      });
      setLoading(false);
    }

    load();
    const sub = supa
      .channel(`phase2240-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders', filter: `location_id=eq.${locationId}` }, load)
      .subscribe();
    return () => { supa.removeChannel(sub); };
  }, [locationId]);

  if (!locationId) return null;

  const kpis: KpiCard[] = stats ? [
    {
      label: 'Bestellungen heute',
      value: stats.bestellungenHeute.toString(),
      sub: 'Alle Kanäle',
      trend: 'neutral',
      icon: <BarChart3 className="h-4 w-4" />,
      color: 'border-matcha-200 dark:border-matcha-800',
    },
    {
      label: 'Umsatz heute',
      value: euro(stats.umsatzHeute),
      sub: 'Nur Lieferungen',
      trend: 'up',
      icon: <Euro className="h-4 w-4" />,
      color: 'border-green-200 dark:border-green-800',
    },
    {
      label: 'Ø Lieferzeit',
      value: stats.avgLieferzeit !== null ? `${stats.avgLieferzeit} Min` : '—',
      sub: 'Bestellung → Zustellung',
      trend: stats.avgLieferzeit !== null && stats.avgLieferzeit <= 40 ? 'up' : 'down',
      icon: <Clock className="h-4 w-4" />,
      color: stats.avgLieferzeit !== null && stats.avgLieferzeit <= 40 ? 'border-green-200' : 'border-amber-200',
    },
    {
      label: 'Pünktlichkeit',
      value: `${stats.puenktlichkeit}%`,
      sub: '≤ 45 Min Ziel',
      trend: stats.puenktlichkeit >= 80 ? 'up' : 'down',
      icon: <Target className="h-4 w-4" />,
      color: stats.puenktlichkeit >= 80 ? 'border-matcha-200' : 'border-red-200',
    },
    {
      label: 'Stornoquote',
      value: `${stats.stornoquote.toFixed(1)}%`,
      sub: 'Heute',
      trend: stats.stornoquote <= 5 ? 'up' : 'down',
      icon: <XCircle className="h-4 w-4" />,
      color: stats.stornoquote <= 5 ? 'border-green-200' : 'border-red-200',
    },
    {
      label: 'Aktive Fahrer',
      value: stats.aktiveFahrer.toString(),
      sub: 'Gerade online',
      trend: 'neutral',
      icon: <Truck className="h-4 w-4" />,
      color: 'border-blue-200 dark:border-blue-800',
    },
  ] : [];

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-matcha-100 dark:bg-matcha-900/40">
            <BarChart3 className="h-4 w-4 text-matcha-600" />
          </span>
          <div>
            <p className="text-sm font-bold">Statistik Hub Pro</p>
            <p className="text-[10px] text-muted-foreground">
              {stats ? `Aktualisiert ${stats.lastUpdated.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}` : 'Lädt…'}
            </p>
          </div>
        </div>
        {loading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-matcha-500 border-t-transparent" />}
      </div>

      {/* KPI-Grid */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kpis.map(c => <KpiChip key={c.label} card={c} />)}
        </div>
      )}

      {/* Stunden-Chart */}
      {stats && stats.stunden.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bestellungen letzte 8h</p>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={stats.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8 }}
                formatter={(v: number, n: string) => [n === 'umsatz' ? euro(v) : v, n === 'umsatz' ? 'Umsatz' : 'Bestellungen']}
              />
              <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]}>
                {stats.stunden.map((b, i) => (
                  <Cell key={i} fill={b.stornos > 0 ? '#f87171' : '#4ade80'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!stats && !loading && (
        <div className="py-4 text-center text-xs text-muted-foreground">Keine Daten verfügbar</div>
      )}
    </section>
  );
}
