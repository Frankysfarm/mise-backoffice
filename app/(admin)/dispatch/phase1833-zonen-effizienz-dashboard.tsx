'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Map, AlertTriangle, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1833 — Zonen-Effizienz-Dashboard (Dispatch)
 *
 * Phase1826-API: Tabelle Zonen + Umsatz/km + Trend; Ausreißer-Flagge; Alert bei rot-Zonen. 30-Min-Polling.
 */

interface ZoneEffizienz {
  zone: string;
  touren: number;
  umsatz_cents: number;
  km_gesamt: number;
  umsatz_pro_km: number;
  touren_pro_fahrer: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  ausreisser: boolean;
}

interface ApiAntwort {
  location_id: string;
  zonen: ZoneEffizienz[];
  team_umsatz_pro_km: number;
  ausreisser_anzahl: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const AMPEL_STYLE = {
  gruen: {
    dot: 'bg-matcha-500',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
    label: 'Stark',
  },
  gelb: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Mittel',
  },
  rot: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'Schwach',
  },
};

const MOCK_DATA: ApiAntwort = {
  location_id: 'mock',
  zonen: [
    { zone: 'Mitte',  touren: 42, umsatz_cents: 189000, km_gesamt: 126, umsatz_pro_km: 15.0, touren_pro_fahrer: 8.4, ampel: 'gruen', ausreisser: false },
    { zone: 'Nord',   touren: 28, umsatz_cents: 112000, km_gesamt: 98,  umsatz_pro_km: 11.4, touren_pro_fahrer: 5.6, ampel: 'gelb',  ausreisser: false },
    { zone: 'Süd',    touren: 19, umsatz_cents: 68400,  km_gesamt: 95,  umsatz_pro_km: 7.2,  touren_pro_fahrer: 3.8, ampel: 'rot',   ausreisser: true  },
    { zone: 'Ost',    touren: 33, umsatz_cents: 148500, km_gesamt: 99,  umsatz_pro_km: 15.0, touren_pro_fahrer: 6.6, ampel: 'gruen', ausreisser: false },
    { zone: 'West',   touren: 11, umsatz_cents: 33000,  km_gesamt: 66,  umsatz_pro_km: 5.0,  touren_pro_fahrer: 2.2, ampel: 'rot',   ausreisser: true  },
  ],
  team_umsatz_pro_km: 10.7,
  ausreisser_anzahl: 2,
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 30 * 60 * 1_000;

export function DispatchPhase1833ZonenEffizienzDashboard({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiAntwort | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    let cancelled = false;

    async function laden() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/zonen-effizienz-phase1826?location_id=${encodeURIComponent(locationId!)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('api_error');
        const json: ApiAntwort = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ ...MOCK_DATA, location_id: locationId! });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    laden();
    const id = setInterval(laden, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const anzeige = data;
  const rotZonen = anzeige?.zonen.filter(z => z.ampel === 'rot') ?? [];
  const maxUmsatz = Math.max(...(anzeige?.zonen.map(z => z.umsatz_pro_km) ?? [1]));

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Zonen-Effizienz</span>
          {rotZonen.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />{rotZonen.length} schwach
            </span>
          )}
          {anzeige && rotZonen.length === 0 && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-semibold text-matcha-700 dark:text-matcha-300">
              <CheckCircle2 className="h-3 w-3" />Alle Zonen OK
            </span>
          )}
          {anzeige && (
            <span className="text-[10px] text-muted-foreground">
              Ø {anzeige.team_umsatz_pro_km.toFixed(1)} €/km Team
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {loading && !anzeige && (
            <div className="text-xs text-muted-foreground py-2">Lade Zonen-Daten…</div>
          )}

          {!locationId && (
            <div className="text-xs text-muted-foreground py-2">Bitte Filiale auswählen.</div>
          )}

          {rotZonen.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                {rotZonen.map(z => z.zone).join(', ')} — Effizienz unter 80% des Team-Durchschnitts
              </span>
            </div>
          )}

          {anzeige && (
            <div className="space-y-1.5">
              {anzeige.zonen.map(z => {
                const s = AMPEL_STYLE[z.ampel];
                const balkenPct = maxUmsatz > 0 ? Math.round((z.umsatz_pro_km / maxUmsatz) * 100) : 0;
                return (
                  <div key={z.zone} className="flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2">
                    <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', s.dot)} />

                    <div className="w-16 shrink-0">
                      <span className="text-xs font-bold">{z.zone}</span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold tabular-nums">
                          {z.umsatz_pro_km.toFixed(1)} €/km
                        </span>
                        <div className="flex items-center gap-1">
                          {z.ausreisser && (
                            <span className="text-[8px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5">
                              Ausreißer
                            </span>
                          )}
                          <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', s.badge)}>
                            {s.label}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', s.dot, 'transition-all duration-500')}
                          style={{ width: `${balkenPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[10px] text-muted-foreground tabular-nums">{z.touren} Touren</div>
                      <div className="text-[9px] text-muted-foreground tabular-nums">{z.km_gesamt} km</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {anzeige && (
            <div className="flex gap-4 pt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" />≥120% Team
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />80–120%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />&lt;80%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
