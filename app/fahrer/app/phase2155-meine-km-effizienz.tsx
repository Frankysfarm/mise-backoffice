'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Minus, Route, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerKmEffizienz {
  driver_id: string;
  name: string;
  km_per_auftrag: number;
  auftraege: number;
  effizienz_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerKmEffizienz[];
  team_avg_km: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_km: 6.7,
  alert_count: 0,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   km_per_auftrag: 3.2,  auftraege: 12, effizienz_score: 92, trend: 'besser',     trend_delta: -0.4, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', km_per_auftrag: 5.8,  auftraege: 9,  effizienz_score: 71, trend: 'gleich',     trend_delta: 0,    alert: false },
    { driver_id: 'd3', name: 'Tom B.',   km_per_auftrag: 13.1, auftraege: 7,  effizienz_score: 31, trend: 'schlechter', trend_delta: 2.1,  alert: true  },
  ],
};

function tipp(km: number, trend: string): string {
  if (km <= 3) return 'Exzellente Route! Du fährst sehr effizient — minimale km je Lieferung.';
  if (km <= 5) return 'Gute Routenwahl! Kleine Umwege auf direkterem Weg können noch Kilometer sparen.';
  if (trend === 'schlechter') return 'Deine km/Auftrag steigen — prüfe, ob du Aufträge in gleicher Zone bündeln kannst.';
  if (km <= 10) return 'Solide Effizienz. Tipp: Navigiere mit Neben­straßen statt Hauptstraßen für kürzere Wege.';
  return 'Über 10 km/Auftrag — sprich mit dem Dispatcher über bessere Touren-Bündelung.';
}

function kmColor(km: number) {
  if (km <= 5)  return 'text-green-600';
  if (km <= 10) return 'text-amber-600';
  return 'text-red-600';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2155MeineKmEffizienz({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-km-effizienz?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const mein = data.fahrer.find(f => f.driver_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const vsTeam = Math.round((mein.km_per_auftrag - data.team_avg_km) * 10) / 10;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Route className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine km-Effizienz</span>
        <span className={cn('text-xs font-black tabular-nums', kmColor(mein.km_per_auftrag))}>
          {mein.km_per_auftrag.toFixed(1)} km/Auftr.
        </span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Ø km je Auftrag heute</p>
              <p className={cn('text-3xl font-black tabular-nums', kmColor(mein.km_per_auftrag))}>
                {mein.km_per_auftrag.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">km / Auftrag</p>
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Ziel: ≤ 5 km</p>
              <p className="text-[9px] text-muted-foreground">Team-Ø {data.team_avg_km.toFixed(1)} km</p>
              <p className={cn('text-[10px] font-semibold', vsTeam <= 0 ? 'text-green-600' : 'text-red-600')}>
                {vsTeam >= 0 ? '+' : ''}{vsTeam} km vs. Team
              </p>
              <div className="flex items-center justify-end gap-1">
                {mein.trend === 'besser'     && <TrendingDown className="h-3 w-3 text-green-500" />}
                {mein.trend === 'schlechter' && <TrendingUp   className="h-3 w-3 text-red-500" />}
                {mein.trend === 'gleich'     && <Minus        className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[9px] text-muted-foreground">
                  {mein.trend === 'besser' ? 'verbessert' : mein.trend === 'schlechter' ? 'gestiegen' : 'stabil'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/20 border px-3 py-2 text-center">
              <p className="text-[9px] text-muted-foreground">Aufträge heute</p>
              <p className="text-lg font-bold tabular-nums">{mein.auftraege}</p>
            </div>
            <div className="rounded-lg bg-muted/20 border px-3 py-2 text-center">
              <p className="text-[9px] text-muted-foreground">Effizienz-Score</p>
              <p className={cn('text-lg font-bold tabular-nums', mein.effizienz_score >= 70 ? 'text-green-600' : mein.effizienz_score >= 50 ? 'text-amber-600' : 'text-red-600')}>
                {mein.effizienz_score}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {tipp(mein.km_per_auftrag, mein.trend)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
