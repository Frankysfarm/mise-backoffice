'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { TrendingUp, TrendingDown, Package, Bike, Euro, Star, Clock, Target, BarChart3, Zap } from 'lucide-react';

interface DayStats {
  bestellungen_gesamt: number;
  umsatz_gesamt: number;
  durchschnittliche_lieferzeit_min: number;
  pünktlichkeitsquote: number;
  kundenzufriedenheit: number;
  stornoquote: number;
  aktive_fahrer: number;
  abgeschlossene_touren: number;
}

interface KpiTile {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MOCK_STATS: DayStats = {
  bestellungen_gesamt: 142,
  umsatz_gesamt: 4382.5,
  durchschnittliche_lieferzeit_min: 28,
  pünktlichkeitsquote: 87,
  kundenzufriedenheit: 4.3,
  stornoquote: 4.2,
  aktive_fahrer: 7,
  abgeschlossene_touren: 34,
};

function pctColor(v: number, good: number, bad: number): string {
  if (v >= good) return 'text-matcha-600';
  if (v >= bad) return 'text-amber-500';
  return 'text-red-500';
}

export function LieferdienstTagesPerformanceExecutiveCockpit() {
  const [stats, setStats] = useState<DayStats>(MOCK_STATS);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      const sb = createClient();
      const today = new Date().toISOString().split('T')[0];
      const { data } = await sb.rpc('get_tages_statistiken', { datum: today }).single();
      if (data) {
        setStats(data as DayStats);
        setLastUpdate(new Date());
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const tiles: KpiTile[] = [
    {
      label: 'Bestellungen',
      value: stats.bestellungen_gesamt.toString(),
      sub: 'heute gesamt',
      icon: Package,
      color: 'bg-blue-50 border-blue-100',
      trend: 'up',
    },
    {
      label: 'Umsatz',
      value: euro(stats.umsatz_gesamt),
      sub: 'heute',
      icon: Euro,
      color: 'bg-matcha-50 border-matcha-100',
      trend: 'up',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${stats.durchschnittliche_lieferzeit_min} Min`,
      sub: 'Ziel: ≤ 30 Min',
      icon: Clock,
      color: stats.durchschnittliche_lieferzeit_min <= 30 ? 'bg-matcha-50 border-matcha-100' : 'bg-amber-50 border-amber-100',
      trend: stats.durchschnittliche_lieferzeit_min <= 30 ? 'up' : 'down',
    },
    {
      label: 'Pünktlichkeit',
      value: `${stats.pünktlichkeitsquote}%`,
      sub: 'Ziel: ≥ 85%',
      icon: Target,
      color: stats.pünktlichkeitsquote >= 85 ? 'bg-matcha-50 border-matcha-100' : 'bg-red-50 border-red-100',
      trend: stats.pünktlichkeitsquote >= 85 ? 'up' : 'down',
    },
    {
      label: 'Bewertung',
      value: stats.kundenzufriedenheit.toFixed(1),
      sub: '/ 5.0 Sterne',
      icon: Star,
      color: stats.kundenzufriedenheit >= 4.0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100',
      trend: stats.kundenzufriedenheit >= 4.0 ? 'up' : 'down',
    },
    {
      label: 'Stornoquote',
      value: `${stats.stornoquote.toFixed(1)}%`,
      sub: 'Ziel: ≤ 5%',
      icon: BarChart3,
      color: stats.stornoquote <= 5 ? 'bg-matcha-50 border-matcha-100' : 'bg-red-50 border-red-100',
      trend: stats.stornoquote <= 5 ? 'up' : 'down',
    },
    {
      label: 'Aktive Fahrer',
      value: stats.aktive_fahrer.toString(),
      sub: 'im Einsatz',
      icon: Bike,
      color: 'bg-blue-50 border-blue-100',
      trend: 'neutral',
    },
    {
      label: 'Touren',
      value: stats.abgeschlossene_touren.toString(),
      sub: 'abgeschlossen',
      icon: Zap,
      color: 'bg-purple-50 border-purple-100',
      trend: 'up',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-bold text-stone-700">Tages-Performance</span>
        </div>
        <span className="text-[10px] text-stone-400">
          Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className={cn('rounded-xl border p-3 space-y-1', tile.color)}>
              <div className="flex items-center justify-between">
                <Icon className="w-3.5 h-3.5 text-stone-500" />
                {tile.trend === 'up' && <TrendingUp className="w-3 h-3 text-matcha-500" />}
                {tile.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
              </div>
              <div className="text-lg font-bold text-stone-800 leading-none">{tile.value}</div>
              <div className="text-[10px] text-stone-500 font-medium">{tile.label}</div>
              {tile.sub && <div className="text-[9px] text-stone-400">{tile.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
