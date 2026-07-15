'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Users, RefreshCw } from 'lucide-react';

/**
 * Phase 1689 — Fahrer-Auslastungs-Prognose-Widget (Dispatch)
 *
 * Nutzt /api/delivery/admin/fahrer-auslastungs-prognose:
 * Prognose-Balken nächste 2h je Zone + Empfehlung ob mehr Fahrer nötig; 15-Min-Polling.
 */

interface PrognoseStunde {
  stunde_offset: number;
  stunde_label: string;
  erwartete_bestellungen: number;
  benoetigte_fahrer: number;
  verfuegbare_fahrer: number;
  delta: number;
  status: 'ausreichend' | 'knapp' | 'kritisch';
  auslastung_level: 'gering' | 'normal' | 'hoch' | 'peak';
}

interface ApiData {
  prognose: PrognoseStunde[];
  aktuelle_queue: number;
  aktive_fahrer: number;
  empfehlung: string;
  location_id: string | null;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const LEVEL_CFG: Record<string, { bar: string; badge: string; label: string }> = {
  gering:  { bar: 'bg-matcha-300', badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900 dark:text-matcha-300', label: 'Gering' },
  normal:  { bar: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',         label: 'Normal' },
  hoch:    { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',     label: 'Hoch' },
  peak:    { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',             label: 'Peak' },
};

function TrendIcon({ delta }: { delta: number }) {
  if (delta >= 0) return <TrendingDown className="h-3 w-3 text-matcha-500" />;
  if (delta === -1) return <Minus className="h-3 w-3 text-amber-500" />;
  return <TrendingUp className="h-3 w-3 text-red-500" />;
}

const INTERVAL_MS = 15 * 60 * 1000;

export function DispatchPhase1689FahrerAuslastungsPrognoseWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const url = `/api/delivery/admin/fahrer-auslastungs-prognose?location_id=${encodeURIComponent(locationId)}`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, INTERVAL_MS);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const hatKritisch = data?.prognose.some(p => p.status === 'kritisch');
  const hatKnapp    = data?.prognose.some(p => p.status === 'knapp');
  const maxBestellungen = data?.prognose.reduce((m, p) => Math.max(m, p.erwartete_bestellungen), 1) ?? 1;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Users className={cn('h-4 w-4 shrink-0', hatKritisch ? 'text-red-500' : hatKnapp ? 'text-amber-500' : 'text-blue-500')} />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Auslastungs-Prognose
        </span>
        {hatKritisch && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        {loading && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin shrink-0" />}
        <span className="text-[10px] text-muted-foreground shrink-0">+4h</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data ? (
            <>
              {/* KPI-Header */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                  <div className="text-muted-foreground">Aktive Fahrer</div>
                  <div className="text-lg font-bold text-foreground tabular-nums">{data.aktive_fahrer}</div>
                </div>
                <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                  <div className="text-muted-foreground">Warteschlange</div>
                  <div className="text-lg font-bold text-foreground tabular-nums">{data.aktuelle_queue}</div>
                </div>
              </div>

              {/* Prognose-Balken */}
              <div className="space-y-2">
                {data.prognose.slice(0, 4).map(p => {
                  const cfg = LEVEL_CFG[p.auslastung_level] ?? LEVEL_CFG.normal;
                  const barW = Math.round((p.erwartete_bestellungen / maxBestellungen) * 100);
                  return (
                    <div key={p.stunde_offset} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-medium text-foreground tabular-nums">+{p.stunde_offset}h ({p.stunde_label})</span>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('rounded px-1 py-0.5 font-medium', cfg.badge)}>{cfg.label}</span>
                          <TrendIcon delta={p.delta} />
                          <span className="text-muted-foreground tabular-nums">
                            {p.verfuegbare_fahrer}/{p.benoetigte_fahrer} Fahr.
                          </span>
                          {p.delta < 0 && (
                            <span className="text-red-600 dark:text-red-400 font-bold">−{Math.abs(p.delta)}</span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', cfg.bar)} style={{ width: `${barW}%` }} />
                      </div>
                      <div className="text-[9px] text-muted-foreground tabular-nums">
                        ~{p.erwartete_bestellungen} Bestellungen erwartet
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empfehlung */}
              {data.empfehlung && (
                <div className={cn(
                  'rounded-lg border px-2.5 py-2 text-[11px] font-medium',
                  hatKritisch
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
                    : hatKnapp
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
                    : 'border-matcha-200 bg-matcha-50 text-matcha-700 dark:border-matcha-900 dark:bg-matcha-950 dark:text-matcha-300',
                )}>
                  {data.empfehlung}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-3 text-center">
              {loading ? 'Prognose wird geladen…' : 'Keine Daten verfügbar.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
