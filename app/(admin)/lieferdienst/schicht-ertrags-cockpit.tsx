'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  TrendingUp, Euro, Target, Clock, Bike, BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react';

interface ShiftMetrics {
  umsatz: number;
  bestellungen: number;
  fahrer: number;
  lieferungen: number;
  stornos: number;
  schichtStart: string | null;
  ziel?: number;
}

interface Props {
  locationId: string;
}

const MOCK: ShiftMetrics = {
  umsatz: 0,
  bestellungen: 0,
  fahrer: 0,
  lieferungen: 0,
  stornos: 0,
  schichtStart: null,
  ziel: 800,
};

function useShiftMetrics(locationId: string) {
  const [data, setData] = useState<ShiftMetrics>(MOCK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/lieferdienst/data?location_id=${encodeURIComponent(locationId)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setData({
          umsatz: json.schicht_umsatz ?? 0,
          bestellungen: json.schicht_bestellungen ?? 0,
          fahrer: json.aktive_fahrer ?? 0,
          lieferungen: json.schicht_lieferungen ?? 0,
          stornos: json.schicht_stornos ?? 0,
          schichtStart: json.schicht_start ?? null,
          ziel: json.schicht_ziel ?? 800,
        });
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [locationId]);

  return { data, loading };
}

function ElapsedBadge({ start }: { start: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!start) return null;
  const elapsedMin = Math.floor((now - new Date(start).getTime()) / 60_000);
  const h = Math.floor(elapsedMin / 60);
  const m = elapsedMin % 60;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
      <Clock className="h-3 w-3" />
      {h > 0 ? `${h}h ${m}m` : `${m}m`} laufend
    </span>
  );
}

export function SchichtErtragsCockpit({ locationId }: Props) {
  const { data, loading } = useShiftMetrics(locationId);
  const [open, setOpen] = useState(true);

  const zielPct = data.ziel && data.ziel > 0 ? Math.min(100, (data.umsatz / data.ziel) * 100) : 0;
  const stornoPct =
    data.bestellungen > 0 ? ((data.stornos / data.bestellungen) * 100).toFixed(1) : '0.0';
  const umsatzProFahrer =
    data.fahrer > 0 ? data.umsatz / data.fahrer : 0;

  const zielColor =
    zielPct >= 90 ? 'bg-matcha-500' :
    zielPct >= 60 ? 'bg-blue-500' :
    zielPct >= 30 ? 'bg-amber-400' : 'bg-gray-300';

  return (
    <Card className="p-3 border rounded-xl shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold">Schicht-Ertrags-Cockpit</span>
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
        </div>
        <div className="flex items-center gap-2">
          <ElapsedBadge start={data.schichtStart} />
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-bold text-matcha-600 uppercase tracking-wide">
                <Euro className="h-3 w-3" />
                Umsatz
              </div>
              <div className="text-2xl font-black text-matcha-700 mt-0.5 tabular-nums">
                {euro(data.umsatz)}
              </div>
              {data.ziel != null && (
                <div className="text-[9px] text-matcha-600 mt-0.5">Ziel: {euro(data.ziel)}</div>
              )}
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                <Target className="h-3 w-3" />
                Bestellungen
              </div>
              <div className="text-2xl font-black text-blue-700 mt-0.5 tabular-nums">
                {data.bestellungen}
              </div>
              <div className="text-[9px] text-blue-600 mt-0.5">{data.lieferungen} geliefert</div>
            </div>
          </div>

          {/* Ziel progress */}
          {data.ziel != null && data.ziel > 0 && (
            <div>
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-muted-foreground">Tagesziel</span>
                <span className={zielPct >= 90 ? 'text-matcha-600' : zielPct >= 60 ? 'text-blue-600' : 'text-amber-600'}>
                  {zielPct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', zielColor)}
                  style={{ width: `${zielPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Secondary KPIs */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-gray-50 border px-2 py-1.5 text-center">
              <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground">
                <Bike className="h-2.5 w-2.5" />
                Fahrer
              </div>
              <div className="text-lg font-black text-foreground tabular-nums">{data.fahrer}</div>
            </div>
            <div className="rounded-lg bg-gray-50 border px-2 py-1.5 text-center">
              <div className="text-[9px] text-muted-foreground">€/Fahrer</div>
              <div className="text-lg font-black text-foreground tabular-nums">
                {euro(umsatzProFahrer)}
              </div>
            </div>
            <div className={cn(
              'rounded-lg border px-2 py-1.5 text-center',
              parseFloat(stornoPct) > 5 ? 'bg-red-50 border-red-200' : 'bg-gray-50',
            )}>
              <div className="text-[9px] text-muted-foreground">Storno</div>
              <div className={cn(
                'text-lg font-black tabular-nums',
                parseFloat(stornoPct) > 5 ? 'text-red-600' : 'text-foreground',
              )}>
                {stornoPct}%
              </div>
            </div>
          </div>

          {/* Trend chip */}
          {data.bestellungen > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-matcha-500" />
              Ø {euro(data.bestellungen > 0 ? data.umsatz / data.bestellungen : 0)} pro Bestellung
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
