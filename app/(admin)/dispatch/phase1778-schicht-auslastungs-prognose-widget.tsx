'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * Phase 1778 — Schicht-Auslastungs-Prognose-Widget (Dispatch)
 *
 * Phase1776-API: Liniendiagramm nächste 3h + Fahrerbedarf-Empfehlung; 15-Min-Polling.
 */

interface PrognoseSlot {
  stunde: string;
  bestellungen_prognose: number;
  fahrer_bedarf: number;
  fahrer_verfuegbar: number;
  auslastung: 'niedrig' | 'normal' | 'hoch' | 'kritisch';
}

interface Antwort {
  slots: PrognoseSlot[];
  location_id: string;
  generiert_am: string;
  aktuelle_stunde_bestellungen: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface Props {
  locationId: string | null;
  className?: string;
}

const auslastungStyle: Record<PrognoseSlot['auslastung'], { bar: string; badge: string; label: string }> = {
  niedrig:  { bar: 'bg-matcha-300', badge: 'bg-matcha-100 text-matcha-700', label: 'Niedrig' },
  normal:   { bar: 'bg-matcha-500', badge: 'bg-matcha-100 text-matcha-700', label: 'Normal' },
  hoch:     { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   label: 'Hoch' },
  kritisch: { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Kritisch' },
};

function TrendBadge({ trend }: { trend: Antwort['trend'] }) {
  if (trend === 'steigend') return (
    <span className="flex items-center gap-0.5 text-amber-600 text-[10px] font-bold">
      <TrendingUp className="h-3 w-3" /> Steigend
    </span>
  );
  if (trend === 'fallend') return (
    <span className="flex items-center gap-0.5 text-matcha-600 text-[10px] font-bold">
      <TrendingDown className="h-3 w-3" /> Fallend
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
      <Minus className="h-3 w-3" /> Stabil
    </span>
  );
}

export function DispatchPhase1778SchichtAuslastungsPrognoseWidget({ locationId, className }: Props) {
  const [data, setData] = useState<Antwort | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-auslastungs-prognose?location_id=${locationId}`);
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const maxBestellungen = Math.max(...(data?.slots.map((s) => s.bestellungen_prognose) ?? [1]), 1);

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground flex-1 text-left">
          Schicht-Auslastungs-Prognose · Nächste 3h
        </span>
        {data && <TrendBadge trend={data.trend} />}
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && !loading && (
            <p className="text-sm text-muted-foreground">Prognose nicht verfügbar.</p>
          )}

          {data && (
            <>
              {/* Balken-Diagramm */}
              <div className="space-y-2">
                {data.slots.map((slot) => {
                  const s = auslastungStyle[slot.auslastung];
                  const widthPct = Math.round((slot.bestellungen_prognose / maxBestellungen) * 100);
                  const fehlendeFahrer = Math.max(0, slot.fahrer_bedarf - slot.fahrer_verfuegbar);
                  return (
                    <div key={slot.stunde} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold w-10 tabular-nums">{slot.stunde}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
                          {s.label}
                        </span>
                        <span className="text-muted-foreground flex-1 text-right">
                          ~{slot.bestellungen_prognose} Bestellungen
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', s.bar)}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold tabular-nums shrink-0 w-16 text-right text-muted-foreground">
                          {slot.fahrer_verfuegbar}/{slot.fahrer_bedarf} Fahrer
                        </span>
                      </div>
                      {fehlendeFahrer > 0 && (
                        <div className="text-[9px] text-red-500 font-bold pl-10">
                          ⚠ {fehlendeFahrer} Fahrer fehlen
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Fahrerbedarf-Empfehlung */}
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px]">
                <span className="font-bold text-foreground">Empfehlung: </span>
                <span className="text-muted-foreground">
                  {data.slots.some((s) => s.fahrer_bedarf > s.fahrer_verfuegbar)
                    ? `Mehr Fahrer einteilen — Engpass ab ${data.slots.find((s) => s.fahrer_bedarf > s.fahrer_verfuegbar)?.stunde ?? '?'} Uhr erwartet.`
                    : 'Fahrer-Kapazität ausreichend für die nächsten Stunden.'}
                </span>
              </div>

              {lastFetch && (
                <div className="text-[9px] text-muted-foreground text-right">
                  Aktualisiert {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 15-Min-Takt
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
