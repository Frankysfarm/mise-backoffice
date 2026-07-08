'use client';

import { useEffect, useState } from 'react';
import { Euro, TrendingUp, Target } from 'lucide-react';

interface Props {
  driverId: string;
  locationId?: string | null;
}

interface VerdienstrData {
  verdienstHeute: number;
  prognose: number;
  schichtDauerH: number;
  schichtRestH: number;
  øProStunde: number;
  touren: number;
  aktualisiert: string;
}

const MOCK: VerdienstrData = {
  verdienstHeute: 48.5,
  prognose: 87.3,
  schichtDauerH: 4.5,
  schichtRestH: 3.5,
  øProStunde: 10.78,
  touren: 6,
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

export function FahrerPhase812TagesVerdienstHochrechnung({ driverId, locationId }: Props) {
  const [data, setData] = useState<VerdienstrData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!driverId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/driver/schicht-bilanz?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();

      const touren = json.touren ?? json.batch_count ?? 0;
      const kmEarnings = (json.km_total ?? 0) * 0.3;
      const trinkgeld = json.trinkgeld ?? json.tip_total ?? 0;
      const grundVerdienst = touren * 3.5;
      const verdienstHeute = Math.round((grundVerdienst + kmEarnings + trinkgeld) * 100) / 100;

      const startedAt = json.started_at ? new Date(json.started_at) : new Date(Date.now() - 4 * 60 * 60 * 1000);
      const schichtDauerH = (Date.now() - startedAt.getTime()) / (1000 * 3600);
      const geplantH = 8;
      const schichtRestH = Math.max(0, geplantH - schichtDauerH);
      const øProStunde = schichtDauerH > 0.1 ? verdienstHeute / schichtDauerH : 0;
      const prognose = Math.round((verdienstHeute + øProStunde * schichtRestH) * 100) / 100;

      setData({
        verdienstHeute,
        prognose,
        schichtDauerH: Math.round(schichtDauerH * 10) / 10,
        schichtRestH: Math.round(schichtRestH * 10) / 10,
        øProStunde: Math.round(øProStunde * 100) / 100,
        touren,
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
  }, [driverId, locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-20 animate-pulse bg-muted rounded" />
      </div>
    );
  }
  if (!data) return null;

  const fortschrittPct = data.prognose > 0
    ? Math.min(100, Math.round((data.verdienstHeute / data.prognose) * 100))
    : 0;

  const tagesziel = 80;
  const zielPct = Math.min(100, Math.round((data.verdienstHeute / tagesziel) * 100));
  const zielErreicht = data.verdienstHeute >= tagesziel;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Tages-Verdienst-Hochrechnung</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{data.aktualisiert}</span>
      </div>

      {/* Haupt-KPI */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">Bisher</div>
          <div className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
            {data.verdienstHeute.toFixed(2)} <span className="text-sm font-medium">€</span>
          </div>
          <div className="text-[9px] text-blue-500 dark:text-blue-400">{data.touren} Touren · {data.schichtDauerH}h</div>
        </div>
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">
            <TrendingUp className="h-2.5 w-2.5" /> Prognose
          </div>
          <div className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
            {data.prognose.toFixed(2)} <span className="text-sm font-medium">€</span>
          </div>
          <div className="text-[9px] text-emerald-500 dark:text-emerald-400">+{data.schichtRestH}h verbleibend</div>
        </div>
      </div>

      {/* Prognose-Fortschrittsbalken */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Prognose-Fortschritt</span>
          <span className="text-[10px] font-bold tabular-nums">{fortschrittPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${fortschrittPct}%` }}
          />
        </div>
      </div>

      {/* Tagesziel */}
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
        zielErreicht
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-border bg-muted/40'
      }`}>
        <Target className={`h-3.5 w-3.5 shrink-0 ${zielErreicht ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Tagesziel {tagesziel} €</span>
            <span className={`text-[10px] font-bold tabular-nums ${zielErreicht ? 'text-emerald-600' : 'text-foreground'}`}>
              {zielPct}%
            </span>
          </div>
          <div className="mt-0.5 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${zielErreicht ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${zielPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">Ø {data.øProStunde.toFixed(2)} €/h</span>
        <span className="text-[9px] text-muted-foreground">60s-Update</span>
      </div>
    </div>
  );
}
