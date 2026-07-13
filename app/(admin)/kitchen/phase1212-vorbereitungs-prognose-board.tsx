'use client';

// Phase 1212 — Vorbereitungs-Prognose-Board (Kitchen)
// Prognose: Wie viele Bestellungen kommen in den nächsten 3h? + Vorab-Empfehlung für Küche

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Clock, Zap, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type Intensitaet = 'ruhig' | 'normal' | 'hoch' | 'peak';

interface Slot {
  slot_start: string;
  slot_label: string;
  prognose: number;
  intensitaet: Intensitaet;
  konfidenz: number;
}

interface ApiData {
  slots: Slot[];
  gesamt_prognose: number;
  peak_slot: string | null;
  location_id: string | null;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const INTENSITAET_STYLE: Record<Intensitaet, { bar: string; badge: string; label: string }> = {
  ruhig:  { bar: 'bg-slate-300 dark:bg-slate-600',   badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',   label: 'Ruhig' },
  normal: { bar: 'bg-emerald-400 dark:bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300', label: 'Normal' },
  hoch:   { bar: 'bg-amber-400 dark:bg-amber-500',   badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',   label: 'Hoch' },
  peak:   { bar: 'bg-rose-500 dark:bg-rose-400',     badge: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300',     label: 'Peak' },
};

function buildEmpfehlung(slots: Slot[], gesamt: number): string {
  const peakSlots = slots.filter(s => s.intensitaet === 'peak' || s.intensitaet === 'hoch');
  if (peakSlots.length >= 3) return 'Vollauslastung erwartet — alle Stationen jetzt vorbereiten, Zutaten auffüllen.';
  if (peakSlots.length >= 1) return `Erhöhtes Volumen ab ${peakSlots[0].slot_label.split('–')[0]} — Vorbereitungen jetzt starten.`;
  if (gesamt >= 10) return 'Moderate Last erwartet — Küche im Normalbetrieb, Zutaten checken.';
  return 'Ruhige Phase — gute Zeit für Mise en Place und Reinigung.';
}

export function KitchenPhase1212VorbereitungsPrognoseBoard({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await window.fetch(`/api/delivery/admin/bestellungsvolumen-prognose?location_id=${locationId}`);
      const json: ApiData = await res.json();
      setData(json);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (!locationId || (!loading && !data)) return null;

  const maxPrognose = data ? Math.max(...data.slots.map(s => s.prognose), 1) : 1;
  const empfehlung = data ? buildEmpfehlung(data.slots, data.gesamt_prognose) : '';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Vorbereitungs-Prognose</span>
          {data && (
            <span className="text-[10px] rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 px-2 py-0.5 font-semibold">
              ~{data.gesamt_prognose} Bestellungen / 3h
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          {loading && !data && (
            <div className="text-xs text-muted-foreground text-center py-2">Lade Prognose…</div>
          )}

          {data && (
            <>
              {/* Empfehlung */}
              <div className="flex items-start gap-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-3 py-2">
                <Zap className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                <span className="text-xs font-medium text-violet-800 dark:text-violet-300">{empfehlung}</span>
              </div>

              {/* Balkendiagramm */}
              <div className="space-y-2">
                {data.slots.map((slot) => {
                  const pct = Math.round((slot.prognose / maxPrognose) * 100);
                  const s = INTENSITAET_STYLE[slot.intensitaet];
                  return (
                    <div key={slot.slot_start} className="flex items-center gap-2">
                      <div className="flex items-center gap-1 w-28 shrink-0">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-mono">{slot.slot_label.split('–')[0]}</span>
                      </div>
                      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', s.bar)}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 w-20 shrink-0 justify-end">
                        <span className="text-xs font-bold tabular-nums">{slot.prognose}</span>
                        <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', s.badge)}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Footer */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>Gesamt: <strong className="text-foreground">{data.gesamt_prognose}</strong> Bestellungen</span>
                </div>
                {data.peak_slot && (
                  <span>Peak: <strong className="text-foreground">{data.peak_slot}</strong></span>
                )}
                <span>Konfidenz: <strong className="text-foreground">{data.slots[0]?.konfidenz ?? '?'}%</strong></span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
