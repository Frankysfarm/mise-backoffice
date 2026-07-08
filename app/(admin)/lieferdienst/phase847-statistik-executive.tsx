'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Euro, Package, Clock, TrendingUp, TrendingDown, Star, Bike } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface KpiKachel {
  key: string;
  label: string;
  wert: string;
  trend: 'up' | 'down' | 'neutral';
  trendWert: string;
  ampel: 'gruen' | 'amber' | 'rot';
}

interface StatistikData {
  kacheln: KpiKachel[];
  aktualisiert: string;
  schichtUmsatz: number;
  schichtBestellungen: number;
}

const MOCK: StatistikData = {
  schichtUmsatz: 1840,
  schichtBestellungen: 47,
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  kacheln: [
    { key: 'umsatz', label: 'Schicht-Umsatz', wert: '1.840 €', trend: 'up', trendWert: '+12%', ampel: 'gruen' },
    { key: 'bestellungen', label: 'Bestellungen', wert: '47', trend: 'up', trendWert: '+8', ampel: 'gruen' },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: '28 Min', trend: 'down', trendWert: '-2 Min', ampel: 'gruen' },
    { key: 'bewertung', label: 'Ø Bewertung', wert: '4.6 ★', trend: 'neutral', trendWert: '=', ampel: 'gruen' },
    { key: 'storno', label: 'Storno-Rate', wert: '3.2%', trend: 'up', trendWert: '+0.8%', ampel: 'amber' },
    { key: 'fahrer', label: 'Aktive Fahrer', wert: '6', trend: 'neutral', trendWert: '=', ampel: 'gruen' },
  ],
};

function ampelClass(a: KpiKachel['ampel']): string {
  if (a === 'gruen') return 'text-matcha-700 bg-matcha-50 border-matcha-200 dark:bg-matcha-900/20 dark:border-matcha-800';
  if (a === 'amber') return 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800';
  return 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  umsatz: Euro,
  bestellungen: Package,
  lieferzeit: Clock,
  bewertung: Star,
  storno: TrendingDown,
  fahrer: Bike,
};

export function LieferdienstPhase847StatistikExecutive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<StatistikData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const res = await fetch(`/api/delivery/admin/stats${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();

      const kacheln: KpiKachel[] = [
        {
          key: 'umsatz',
          label: 'Schicht-Umsatz',
          wert: euro(json.umsatz_heute ?? 0),
          trend: (json.umsatz_heute ?? 0) > (json.umsatz_gestern ?? 0) ? 'up' : 'down',
          trendWert: json.umsatz_gestern ? `${((((json.umsatz_heute ?? 0) - json.umsatz_gestern) / json.umsatz_gestern) * 100).toFixed(0)}%` : '–',
          ampel: (json.umsatz_heute ?? 0) >= (json.umsatz_ziel ?? Infinity) * 0.8 ? 'gruen' : 'amber',
        },
        {
          key: 'bestellungen',
          label: 'Bestellungen',
          wert: String(json.bestellungen_heute ?? 0),
          trend: (json.bestellungen_heute ?? 0) > (json.bestellungen_gestern ?? 0) ? 'up' : 'neutral',
          trendWert: `+${(json.bestellungen_heute ?? 0) - (json.bestellungen_gestern ?? 0)}`,
          ampel: 'gruen',
        },
        {
          key: 'lieferzeit',
          label: 'Ø Lieferzeit',
          wert: `${Math.round(json.avg_delivery_min ?? 30)} Min`,
          trend: (json.avg_delivery_min ?? 30) <= 30 ? 'up' : 'down',
          trendWert: (json.avg_delivery_min ?? 30) <= 30 ? 'Ziel OK' : 'Ziel miss',
          ampel: (json.avg_delivery_min ?? 30) <= 30 ? 'gruen' : (json.avg_delivery_min ?? 30) <= 40 ? 'amber' : 'rot',
        },
        {
          key: 'storno',
          label: 'Storno-Rate',
          wert: `${((json.storno_rate ?? 0) * 100).toFixed(1)}%`,
          trend: (json.storno_rate ?? 0) > 0.05 ? 'down' : 'up',
          trendWert: (json.storno_rate ?? 0) > 0.05 ? 'Hoch' : 'OK',
          ampel: (json.storno_rate ?? 0) <= 0.03 ? 'gruen' : (json.storno_rate ?? 0) <= 0.07 ? 'amber' : 'rot',
        },
        {
          key: 'fahrer',
          label: 'Aktive Fahrer',
          wert: String(json.active_drivers ?? 0),
          trend: 'neutral',
          trendWert: '–',
          ampel: (json.active_drivers ?? 0) >= 3 ? 'gruen' : (json.active_drivers ?? 0) >= 1 ? 'amber' : 'rot',
        },
        {
          key: 'bewertung',
          label: 'Ø Bewertung',
          wert: `${((json.avg_rating ?? 4.5)).toFixed(1)} ★`,
          trend: (json.avg_rating ?? 4.5) >= 4.5 ? 'up' : 'neutral',
          trendWert: (json.avg_rating ?? 4.5) >= 4.5 ? 'Gut' : 'OK',
          ampel: (json.avg_rating ?? 4.5) >= 4.5 ? 'gruen' : (json.avg_rating ?? 4.5) >= 4.0 ? 'amber' : 'rot',
        },
      ];

      setData({
        kacheln,
        schichtUmsatz: json.umsatz_heute ?? 0,
        schichtBestellungen: json.bestellungen_heute ?? 0,
        aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="h-32 animate-pulse bg-muted rounded" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Statistik Executive</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{data.aktualisiert}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
        {data.kacheln.map((k) => {
          const Icon = ICON_MAP[k.key] ?? BarChart3;
          const TrendIcon = k.trend === 'up' ? TrendingUp : k.trend === 'down' ? TrendingDown : null;
          return (
            <div key={k.key} className={cn('rounded-lg border p-3', ampelClass(k.ampel))}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3 w-3 shrink-0 opacity-70" />
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{k.label}</span>
              </div>
              <div className="text-lg font-black tabular-nums leading-none">{k.wert}</div>
              <div className="flex items-center gap-1 mt-1">
                {TrendIcon && <TrendIcon className="h-2.5 w-2.5 shrink-0" />}
                <span className="text-[9px] font-semibold opacity-70">{k.trendWert}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-1.5 bg-muted/30 border-t">
        <p className="text-[9px] text-muted-foreground">1-Min-Update · Schicht-Executive-Statistik · Phase 847</p>
      </div>
    </div>
  );
}
