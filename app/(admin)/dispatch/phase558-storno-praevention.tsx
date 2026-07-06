'use client';

/**
 * Phase 558 — Dispatch: Echtzeit-Storno-Präventions-Panel
 *
 * Zeigt aktive Bestellungen nahe ihrer SLA-Grenze mit Risiko-Ampel
 * und priorisierten Handlungsempfehlungen. Collapsible Card mit
 * Alarm-Icon (rot wenn sofortiger Handlungsbedarf).
 *
 * Farbkodierung:
 *   kritisch → rot (SLA überschritten)
 *   hoch     → orange
 *   mittel   → amber
 *   niedrig  → blau
 *
 * Polling: 30s
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, ShieldAlert, Truck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

type RisikoLevel = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';

interface StornoRisikoBestellung {
  orderId: string;
  bestellnummer: string;
  kundeName: string | null;
  status: string;
  zone: string | null;
  wartezeitMin: number;
  slaGrenzeMin: number;
  verbleibendMin: number;
  risikoLevel: RisikoLevel;
  risikoScore: number;
  aktionEmpfehlung: string;
  hatAktivenFahrer: boolean;
}

interface Summary {
  gesamtAtRisk: number;
  kritischCount: number;
  hochCount: number;
  mittelCount: number;
  niedrigCount: number;
  avgWartezeitMin: number;
  sofortHandlungsbedarf: boolean;
}

interface ApiResponse {
  ok: boolean;
  bestellungen: StornoRisikoBestellung[];
  summary: Summary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const LEVEL_CONFIG: Record<RisikoLevel, {
  bg: string; border: string; text: string; badge: string; badgeText: string; label: string;
}> = {
  kritisch: {
    bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700',
    badge: 'bg-red-600 text-white', badgeText: 'SLA überschritten', label: 'Kritisch',
  },
  hoch: {
    bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700',
    badge: 'bg-orange-500 text-white', badgeText: '≤ 5 Min', label: 'Hoch',
  },
  mittel: {
    bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
    badge: 'bg-amber-400 text-white', badgeText: '≤ 12 Min', label: 'Mittel',
  },
  niedrig: {
    bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
    badge: 'bg-blue-400 text-white', badgeText: '≤ 20 Min', label: 'Niedrig',
  },
};

function SlaProgressBar({ wartezeitMin, slaGrenzeMin }: { wartezeitMin: number; slaGrenzeMin: number }) {
  const pct = Math.min(100, Math.max(0, (wartezeitMin / slaGrenzeMin) * 100));
  const color = pct >= 100 ? 'bg-red-600' : pct >= 85 ? 'bg-orange-500' : pct >= 60 ? 'bg-amber-400' : 'bg-blue-400';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
        {Math.round(wartezeitMin)}/{slaGrenzeMin} Min
      </span>
    </div>
  );
}

export function DispatchPhase558StornoProaktivPanel({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/echtzeit-storno-praevention?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json() as ApiResponse;
        setData(json);
        if (json.summary.sofortHandlungsbedarf && !open) setOpen(true);
      }
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const urgent = data?.summary.sofortHandlungsbedarf ?? false;
  const count  = data?.summary.gesamtAtRisk ?? 0;

  return (
    <Card className={cn(
      'overflow-hidden transition-colors',
      urgent ? 'border-red-300 shadow-red-100 shadow-md' : 'border-border',
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          urgent ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-muted/50',
        )}
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          urgent ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-100 text-amber-700',
        )}>
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold', urgent ? 'text-red-800' : 'text-foreground')}>
            Storno-Prävention
            {count > 0 && (
              <span className={cn(
                'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black',
                urgent ? 'bg-red-600 text-white' : 'bg-amber-400 text-white',
              )}>
                {count} At-Risk
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {urgent ? 'Sofortiger Handlungsbedarf!' : count === 0 ? 'Alle Bestellungen im grünen Bereich' : `${data?.summary.kritischCount ?? 0} kritisch · ${data?.summary.hochCount ?? 0} hoch`}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Body */}
      {open && (
        <div className="p-4 space-y-3">
          {loading && (
            <div className="text-sm text-muted-foreground text-center py-3 animate-pulse">
              Lade Storno-Risiko-Analyse…
            </div>
          )}

          {!loading && !locationId && (
            <div className="text-sm text-muted-foreground">Bitte Filiale auswählen.</div>
          )}

          {!loading && data && data.bestellungen.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="text-sm text-green-700 font-medium">
                Alle aktiven Bestellungen sind im sicheren Zeitfenster.
              </div>
            </div>
          )}

          {!loading && data && data.bestellungen.length > 0 && (
            <>
              {/* Summary Chips */}
              <div className="flex flex-wrap gap-2">
                {data.summary.kritischCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 text-white px-2.5 py-0.5 text-[11px] font-bold">
                    <AlertTriangle className="h-3 w-3" />
                    {data.summary.kritischCount} Kritisch
                  </span>
                )}
                {data.summary.hochCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 text-white px-2.5 py-0.5 text-[11px] font-bold">
                    {data.summary.hochCount} Hoch
                  </span>
                )}
                {data.summary.mittelCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-white px-2.5 py-0.5 text-[11px] font-bold">
                    {data.summary.mittelCount} Mittel
                  </span>
                )}
                {data.summary.niedrigCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-400 text-white px-2.5 py-0.5 text-[11px] font-bold">
                    {data.summary.niedrigCount} Niedrig
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px]">
                  <Clock className="h-3 w-3" />
                  Ø {data.summary.avgWartezeitMin.toFixed(1)} Min
                </span>
              </div>

              {/* Order Cards */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {data.bestellungen.map(b => {
                  const cfg = LEVEL_CONFIG[b.risikoLevel];
                  return (
                    <div key={b.orderId} className={cn('rounded-xl border p-3 space-y-1.5', cfg.bg, cfg.border)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-foreground font-mono">
                              #{b.bestellnummer}
                            </span>
                            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', cfg.badge)}>
                              {cfg.badgeText}
                            </span>
                            {!b.hatAktivenFahrer && (
                              <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-bold">
                                Kein Fahrer
                              </span>
                            )}
                          </div>
                          {b.kundeName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <User className={cn('h-2.5 w-2.5 shrink-0', cfg.text)} />
                              <span className={cn('text-[11px] truncate', cfg.text)}>{b.kundeName}</span>
                            </div>
                          )}
                          {b.zone && (
                            <div className="flex items-center gap-1">
                              <Truck className={cn('h-2.5 w-2.5 shrink-0', cfg.text)} />
                              <span className={cn('text-[11px]', cfg.text)}>Zone {b.zone}</span>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={cn('text-lg font-black tabular-nums leading-none', cfg.text)}>
                            {b.verbleibendMin <= 0
                              ? `+${Math.abs(Math.round(b.verbleibendMin))}m`
                              : `${Math.round(b.verbleibendMin)}m`}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {b.verbleibendMin <= 0 ? 'überfällig' : 'verbleibend'}
                          </div>
                        </div>
                      </div>

                      <SlaProgressBar wartezeitMin={b.wartezeitMin} slaGrenzeMin={b.slaGrenzeMin} />

                      <div className={cn('text-[10px] font-medium rounded-lg px-2 py-1.5', cfg.bg, cfg.text)}>
                        {b.aktionEmpfehlung}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[10px] text-muted-foreground text-right">
                Aktualisiert: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · 30s-Intervall
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
