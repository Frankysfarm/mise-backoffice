'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, RefreshCw, ChevronDown, ChevronUp, TrendingUp, Minus } from 'lucide-react';

/**
 * Phase 1700 — Tages-Umsatz-Beitrag-Karte (Fahrer-App)
 *
 * Zeigt den EUR-Umsatz, den der Fahrer heute durch Lieferungen ermöglicht hat.
 * Nutzt /api/delivery/admin/tages-umsatz-vergleich für den Gesamt-Umsatz heute
 * und /api/delivery/fahrer/schicht-statistik für den Fahrer-Anteil (Stopps-Quote).
 * isOnline-Guard; 30-Min-Polling.
 */

interface UmsatzData {
  heute_eur: number;
  gestern_eur: number;
  delta_gestern_pct: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

interface SchichtData {
  stopps_heute: number;
  location_stopps_heute: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const POLL_MS = 30 * 60 * 1000;

function fmtEur(eur: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eur);
}

export function FahrerPhase1700TagesUmsatzBeitragKarte({ driverId, locationId, isOnline }: Props) {
  const [umsatz, setUmsatz] = useState<UmsatzData | null>(null);
  const [schicht, setSchicht] = useState<SchichtData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        fetch(`/api/delivery/admin/tages-umsatz-vergleich?location_id=${encodeURIComponent(locationId)}`),
        fetch(`/api/delivery/fahrer/schicht-statistik?driver_id=${encodeURIComponent(driverId)}&location_id=${encodeURIComponent(locationId)}`),
      ]);
      if (uRes.ok) setUmsatz(await uRes.json());
      if (sRes.ok) setSchicht(await sRes.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  if (!isOnline || !driverId) return null;

  // Fahrer-Anteil: wenn keine Schicht-API → annehmen Fahrer hat seinen Anteil proportional zu Stopps
  const anteilPct: number = (() => {
    if (!schicht) return 0;
    const { stopps_heute, location_stopps_heute } = schicht;
    if (!location_stopps_heute || !stopps_heute) return 0;
    return Math.min(100, Math.round((stopps_heute / location_stopps_heute) * 100));
  })();

  const umsatzGesamtHeuteEur = umsatz?.heute_eur ?? 0;
  const fahrerBeitragEur = Math.round(umsatzGesamtHeuteEur * (anteilPct / 100));
  const trend = umsatz?.trend ?? 'stabil';
  const deltaPct = umsatz?.delta_gestern_pct ?? 0;

  // Mock fallback when no data yet
  const hasDaten = umsatz !== null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Euro className="h-4 w-4 shrink-0 text-matcha-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Mein Umsatz-Beitrag</span>
        {hasDaten && anteilPct > 0 && (
          <span className="text-[10px] font-bold text-matcha-600 dark:text-matcha-400">{anteilPct}% Anteil</span>
        )}
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasDaten ? (
            <>
              {/* Main value */}
              <div className="flex items-end gap-3">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Dein Beitrag heute</div>
                  <div className="text-2xl font-black text-matcha-600 dark:text-matcha-400 tabular-nums">
                    {anteilPct > 0 ? fmtEur(fahrerBeitragEur) : '–'}
                  </div>
                  {anteilPct > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">von {fmtEur(umsatzGesamtHeuteEur)} Gesamt-Umsatz</div>
                  )}
                </div>

                {/* Trend badge */}
                <div className={cn(
                  'ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold',
                  trend === 'steigend' ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900 dark:text-matcha-300' :
                  trend === 'fallend'  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                         'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
                )}>
                  {trend === 'steigend' ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {deltaPct > 0 ? '+' : ''}{deltaPct}%
                </div>
              </div>

              {/* Anteil-Fortschrittsbalken */}
              {anteilPct > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Dein Anteil</span>
                    <span className="font-bold">{anteilPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-500 transition-all"
                      style={{ width: `${anteilPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Gestern Vergleich */}
              <div className="flex items-center justify-between text-[11px] border-t border-border pt-2">
                <span className="text-muted-foreground">Gesamt gestern</span>
                <span className="font-bold tabular-nums text-foreground">{fmtEur(umsatz?.gestern_eur ?? 0)}</span>
              </div>

              {anteilPct === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-1">
                  Dein Anteil wird nach der ersten Tour berechnet.
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-3">
              {loading ? 'Lade Umsatzdaten…' : 'Keine Daten verfügbar.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
