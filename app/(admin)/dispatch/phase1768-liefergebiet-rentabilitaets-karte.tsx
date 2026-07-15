'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

/**
 * Phase 1768 — Liefergebiet-Rentabilitäts-Karte (Dispatch)
 *
 * Phase1766-API: Zone A/B/C/D + ROI-Farbscala + Umsatz/Kosten-Bars.
 * 30-Min-Polling; in dispatch/client.tsx.
 */

interface ZoneRentabilitaet {
  zone: 'A' | 'B' | 'C' | 'D';
  umsatz_eur: number;
  lieferkosten_eur: number;
  roi_pct: number;
  bestellungen: number;
  avg_umsatz_pro_bestellung: number;
  avg_kosten_pro_bestellung: number;
}

interface LiefergebietRentabilitaetAntwort {
  zonen: ZoneRentabilitaet[];
  gesamt_umsatz: number;
  gesamt_kosten: number;
  gesamt_roi_pct: number;
  location_id: string;
  datum: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const ZONE_LABELS: Record<string, string> = { A: 'Kern (0–2 km)', B: 'Nah (2–4 km)', C: 'Mittel (4–7 km)', D: 'Fern (7+ km)' };

function roiColor(roi: number): string {
  if (roi >= 300) return 'bg-green-500';
  if (roi >= 150) return 'bg-emerald-400';
  if (roi >= 60)  return 'bg-amber-400';
  return 'bg-red-400';
}

function roiTextColor(roi: number): string {
  if (roi >= 300) return 'text-green-700 dark:text-green-300';
  if (roi >= 150) return 'text-emerald-700 dark:text-emerald-300';
  if (roi >= 60)  return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function roiBg(roi: number): string {
  if (roi >= 300) return 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900';
  if (roi >= 150) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900';
  if (roi >= 60)  return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900';
  return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900';
}

export function DispatchPhase1768LiefergebietRentabilitaetsKarte({ locationId, className }: Props) {
  const [data, setData] = useState<LiefergebietRentabilitaetAntwort | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/liefergebiet-rentabilitaet?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastFetch(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const maxUmsatz = data ? Math.max(...data.zonen.map(z => z.umsatz_eur), 1) : 1;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Liefergebiet-Rentabilität</span>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className={cn('text-xs font-bold', roiTextColor(data.gesamt_roi_pct))}>
              Gesamt ROI {data.gesamt_roi_pct}%
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded p-1 hover:bg-muted transition-colors"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {!data ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Lade Zonen-Daten…</span>
          </div>
        ) : (
          <>
            {/* Zone-Grid */}
            <div className="grid grid-cols-2 gap-2">
              {data.zonen.map(z => (
                <div key={z.zone} className={cn('rounded-lg border p-3', roiBg(z.roi_pct))}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-foreground">Zone {z.zone}</span>
                    <span className={cn('text-[11px] font-bold tabular-nums', roiTextColor(z.roi_pct))}>
                      ROI {z.roi_pct}%
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-2">{ZONE_LABELS[z.zone]}</div>

                  {/* Umsatz-Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-[9px] text-muted-foreground">Umsatz</span>
                      <div className="flex-1 h-2 rounded-full bg-white/60 dark:bg-black/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-saffron transition-all"
                          style={{ width: `${Math.min(100, z.umsatz_eur / maxUmsatz * 100)}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[9px] font-bold tabular-nums">{z.umsatz_eur.toFixed(0)} €</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-[9px] text-muted-foreground">Kosten</span>
                      <div className="flex-1 h-2 rounded-full bg-white/60 dark:bg-black/20 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', roiColor(z.roi_pct))}
                          style={{ width: `${Math.min(100, z.lieferkosten_eur / maxUmsatz * 100)}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[9px] font-bold tabular-nums">{z.lieferkosten_eur.toFixed(0)} €</span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">{z.bestellungen} Best.</span>
                    <span className="text-[9px] text-muted-foreground">·</span>
                    <span className="text-[9px] text-muted-foreground">Ø {z.avg_umsatz_pro_bestellung.toFixed(0)} € / Best.</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Gesamt-KPI-Zeile */}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-sm font-black text-foreground tabular-nums">{data.gesamt_umsatz.toFixed(0)} €</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Gesamtumsatz</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-sm font-black text-foreground tabular-nums">{data.gesamt_kosten.toFixed(0)} €</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Gesamtkosten</div>
              </div>
              <div className={cn('rounded-lg p-2 text-center', data.gesamt_roi_pct >= 150 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20')}>
                <div className={cn('text-sm font-black tabular-nums', roiTextColor(data.gesamt_roi_pct))}>{data.gesamt_roi_pct}%</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Gesamt-ROI</div>
              </div>
            </div>

            {lastFetch && (
              <p className="text-[10px] text-muted-foreground text-right">
                Stand {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 30 Min.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
