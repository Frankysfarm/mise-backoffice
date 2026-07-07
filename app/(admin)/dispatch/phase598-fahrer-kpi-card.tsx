'use client';

/**
 * Phase 598 — Dispatch: Echtzeit-Fahrer-KPI-Card
 *
 * Zeigt je aktivem Fahrer heute: Score (0–100) + Touren-Anzahl + Ø Lieferzeit.
 * Holt Daten von /api/delivery/admin/fahrer-schicht-auslastung.
 * Ticker: 30s
 */

import { useEffect, useState } from 'react';
import { User, Truck, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverKpi {
  shiftId: string;
  driverId: string;
  driverName: string;
  vehicle: string | null;
  state: string;
  remainingMin: number;
  auslastungPct: number;
  deliveriesToday: number;
  activeTours: number;
  ratePerHour: number;
  projectedTotal: number;
}

interface ApiResponse {
  ok: boolean;
  totalActiveDrivers: number;
  freiKapazitaet: number;
  avgAuslastungPct: number;
  drivers: DriverKpi[];
}

interface Props {
  locationId: string | null;
}

function stateColor(state: string): string {
  if (state === 'on_tour') return 'bg-blue-500';
  if (state === 'available') return 'bg-green-500';
  if (state === 'break') return 'bg-amber-400';
  return 'bg-muted';
}

function AuslastungBar({ pct }: { pct: number }) {
  const color = pct < 60 ? 'bg-green-500' : pct < 85 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DispatchPhase598FahrerKpiCard({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-auslastung?location_id=${locationId}`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <User className="h-4 w-4 text-matcha-600" />
          Fahrer-KPI Heute
          {data && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[11px] font-bold text-matcha-700">
              {data.totalActiveDrivers} aktiv · {data.freiKapazitaet} frei
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {loading && !data && (
            <div className="text-xs text-muted-foreground">Lade Fahrer-Daten…</div>
          )}
          {data && data.drivers.length === 0 && (
            <div className="text-xs text-muted-foreground">Keine aktiven Schichten gerade.</div>
          )}
          {data && data.drivers.map((d) => (
            <div key={d.shiftId} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', stateColor(d.state))} />
                  <span className="font-semibold text-sm truncate">{d.driverName}</span>
                  {d.vehicle && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                      <Truck className="h-3 w-3" /> {d.vehicle}
                    </span>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {d.remainingMin} Min
                </div>
              </div>
              <AuslastungBar pct={d.auslastungPct} />
              <div className="mt-1.5 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {d.deliveriesToday} Lieferungen
                </span>
                <span>{d.activeTours > 0 ? `${d.activeTours} Tour aktiv` : 'Keine Tour'}</span>
                <span>Prognose: {d.projectedTotal} heute</span>
              </div>
            </div>
          ))}
          {data && (
            <div className="flex items-center gap-4 pt-1 text-[11px] text-muted-foreground border-t border-border">
              <span>Ø Auslastung: <strong className="text-foreground">{data.avgAuslastungPct}%</strong></span>
              <span>Freie Kapazität: <strong className="text-foreground">{data.freiKapazitaet}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
