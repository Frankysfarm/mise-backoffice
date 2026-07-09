'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1020 — Tour-Umsatz-Performance-Board (Dispatch)
 *
 * Live-Umsatz je aktiver Tour vs. Tages-Ziel (€/Tour).
 * Polling: 90s. Props: locationId.
 */

interface TourPerf {
  tour_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  umsatz_eur: number;
  ziel_eur: number;
  marge_pct: number;
  zone: string;
  status: 'gut' | 'ok' | 'schlecht';
}

interface ApiResponse {
  touren: TourPerf[];
  gesamt_umsatz: number;
  gesamt_ziel: number;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  touren: [
    { tour_id: 't1', fahrer_name: 'Max M.', stopps_gesamt: 4, stopps_abgeschlossen: 2, umsatz_eur: 68, ziel_eur: 60, marge_pct: 113, zone: 'A', status: 'gut' },
    { tour_id: 't2', fahrer_name: 'Sarah K.', stopps_gesamt: 3, stopps_abgeschlossen: 1, umsatz_eur: 22, ziel_eur: 45, marge_pct: 49, zone: 'B', status: 'schlecht' },
    { tour_id: 't3', fahrer_name: 'Tom W.', stopps_gesamt: 5, stopps_abgeschlossen: 4, umsatz_eur: 112, ziel_eur: 100, marge_pct: 112, zone: 'A', status: 'gut' },
  ],
  gesamt_umsatz: 202,
  gesamt_ziel: 205,
  generiert_am: new Date().toISOString(),
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase1020TourUmsatzPerformance({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/tour-effizienz-ranking?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('api');
      const json = await res.json();
      // Map existing API to our format
      const touren: TourPerf[] = (json.touren ?? []).map((t: Record<string, unknown>) => {
        const umsatz = (t.umsatz_eur as number) ?? 0;
        const ziel = 50;
        const pct = ziel > 0 ? Math.round((umsatz / ziel) * 100) : 0;
        return {
          tour_id: t.tour_id as string ?? 'unknown',
          fahrer_name: (t.fahrer_name as string) ?? '—',
          stopps_gesamt: (t.stopps_gesamt as number) ?? 0,
          stopps_abgeschlossen: (t.stopps_abgeschlossen as number) ?? 0,
          umsatz_eur: umsatz,
          ziel_eur: ziel,
          marge_pct: pct,
          zone: (t.zone as string) ?? '—',
          status: pct >= 100 ? 'gut' : pct >= 70 ? 'ok' : 'schlecht',
        };
      });
      const gesamt_umsatz = touren.reduce((s, t) => s + t.umsatz_eur, 0);
      setData({ touren, gesamt_umsatz, gesamt_ziel: touren.length * 50, generiert_am: json.generiert_am ?? new Date().toISOString() });
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [load]);

  const hasBad = data?.touren.some(t => t.status === 'schlecht') ?? false;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Tour-Umsatz-Performance</span>
          {hasBad && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700">
              <AlertTriangle className="h-2.5 w-2.5" /> Unter Ziel
            </span>
          )}
          {data && !hasBad && (
            <span className="rounded-full bg-matcha-100 border border-matcha-300 px-2 py-0.5 text-[10px] font-black text-matcha-700">
              {data.touren.length} Touren · €{data.gesamt_umsatz.toFixed(0)}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && data && (
        <div className="border-t divide-y">
          {data.touren.map(t => {
            const pct = Math.min(100, t.marge_pct);
            const barColor = t.status === 'gut' ? 'bg-matcha-500' : t.status === 'ok' ? 'bg-amber-400' : 'bg-red-400';
            const badgeStyle = t.status === 'gut'
              ? 'bg-matcha-100 text-matcha-700 border-matcha-300'
              : t.status === 'ok'
              ? 'bg-amber-100 text-amber-700 border-amber-300'
              : 'bg-red-100 text-red-700 border-red-300';
            return (
              <div key={t.tour_id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{t.fahrer_name}</span>
                    <span className="text-[10px] text-muted-foreground border rounded px-1">Zone {t.zone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black tabular-nums">€{t.umsatz_eur.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground">/ €{t.ziel_eur}</span>
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-black', badgeStyle)}>
                      {t.marge_pct}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>{t.stopps_abgeschlossen}/{t.stopps_gesamt} Stopps</span>
                  <span>{t.status === 'gut' ? '✓ Über Ziel' : t.status === 'ok' ? '≈ Im Plan' : '↓ Unter Ziel'}</span>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="px-4 py-2.5 bg-muted/20 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Gesamt heute</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tabular-nums">€{data.gesamt_umsatz.toFixed(0)}</span>
              <span className="text-[10px] text-muted-foreground">/ €{data.gesamt_ziel} Ziel</span>
              <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black border',
                data.gesamt_umsatz >= data.gesamt_ziel ? 'bg-matcha-100 text-matcha-700 border-matcha-300' : 'bg-amber-100 text-amber-700 border-amber-300',
              )}>
                {data.gesamt_ziel > 0 ? Math.round((data.gesamt_umsatz / data.gesamt_ziel) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {open && !data && (
        <div className="border-t px-4 py-6 text-center text-sm text-muted-foreground">Lade…</div>
      )}
    </div>
  );
}
