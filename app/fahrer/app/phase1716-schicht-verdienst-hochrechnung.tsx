'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, Euro, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

interface Stats {
  verdienst_bisher: number;
  schicht_start: string | null;
  schicht_ende: string | null;
  stopps_gesamt: number;
  stopps_erledigt: number;
}

const MOCK: Stats = {
  verdienst_bisher: 42.5,
  schicht_start: new Date(Date.now() - 3 * 3600_000).toISOString(),
  schicht_ende: new Date(Date.now() + 2 * 3600_000).toISOString(),
  stopps_gesamt: 10,
  stopps_erledigt: 6,
};

export function FahrerPhase1716SchichtVerdienstHochrechnung({ driverId, isOnline }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/schicht-stats?driverId=${driverId}`);
        if (!cancelled && res.ok) setStats(await res.json());
        else if (!cancelled) setStats(MOCK);
      } catch {
        if (!cancelled) setStats(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, isOnline]);

  if (!isOnline || (!stats && !loading)) return null;

  const now = Date.now();
  const schichtStart = stats?.schicht_start ? new Date(stats.schicht_start).getTime() : now - 3600_000;
  const schichtEnde = stats?.schicht_ende ? new Date(stats.schicht_ende).getTime() : now + 3600_000;
  const gesamtMs = schichtEnde - schichtStart;
  const vergangenMs = Math.max(0, now - schichtStart);
  const fortschrittPct = Math.min(100, Math.round((vergangenMs / Math.max(gesamtMs, 1)) * 100));

  const verdienstBisher = stats?.verdienst_bisher ?? 0;
  const hochrechnungEnd =
    vergangenMs > 0
      ? Math.round((verdienstBisher / vergangenMs) * gesamtMs * 100) / 100
      : verdienstBisher;
  const restVerdienst = Math.max(0, hochrechnungEnd - verdienstBisher);

  const verbleibendMin = Math.max(0, Math.round((schichtEnde - now) / 60_000));
  const h = Math.floor(verbleibendMin / 60);
  const m = verbleibendMin % 60;
  const restLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Verdienst-Prognose</span>
          {!loading && stats && (
            <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black tabular-nums">
              ~{hochrechnungEnd.toFixed(2)} €
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && stats && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Schicht-Fortschritt */}
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Schichtfortschritt</span>
              <span>{fortschrittPct}% · noch {restLabel}</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${fortschrittPct}%` }}
              />
            </div>
          </div>

          {/* KPI-Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground font-semibold mb-0.5">Bisher</div>
              <div className="text-sm font-black text-foreground tabular-nums">{verdienstBisher.toFixed(2)}€</div>
            </div>
            <div className="rounded-lg bg-matcha-50 border border-matcha-200 p-2 text-center">
              <div className="text-[9px] text-matcha-600 font-semibold mb-0.5">Prognose</div>
              <div className="text-sm font-black text-matcha-700 tabular-nums">{hochrechnungEnd.toFixed(2)}€</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground font-semibold mb-0.5">Noch möglich</div>
              <div className={cn('text-sm font-black tabular-nums', restVerdienst > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                +{restVerdienst.toFixed(2)}€
              </div>
            </div>
          </div>

          {/* Stopps-Fortschritt */}
          {stats.stopps_gesamt > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Euro className="h-3 w-3" />
              <span>{stats.stopps_erledigt} von {stats.stopps_gesamt} Stopps erledigt</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
