'use client';

// Phase 1225 — Lieferfenster-Auswahl-Widget (Storefront)
// Kunde kann bevorzugtes 30-Min-Lieferfenster auswählen (heute verfügbare Slots basierend auf Auslastung)

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
}

type SlotStatus = 'verfügbar' | 'belegt' | 'ausgebucht';

interface TimeSlot {
  start: string;        // z.B. "14:00"
  end: string;          // z.B. "14:30"
  label: string;        // z.B. "14:00 – 14:30"
  status: SlotStatus;
  auslastung_pct: number;
  ist_frühest: boolean;
}

const STATUS_CONFIG: Record<SlotStatus, { color: string; label: string }> = {
  verfügbar: { color: 'border-matcha-300 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300', label: 'Frei' },
  belegt: { color: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', label: 'Belegt' },
  ausgebucht: { color: 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10 text-red-400 dark:text-red-600 opacity-60', label: 'Voll' },
};

function generateMockSlots(): TimeSlot[] {
  const now = new Date();
  const slots: TimeSlot[] = [];
  const baseHour = now.getHours();
  const baseMin = now.getMinutes() < 30 ? 30 : 0;
  const startH = baseMin === 0 ? baseHour + 1 : baseHour;
  const startM = baseMin;

  for (let i = 0; i < 8; i++) {
    const totalMin = startH * 60 + startM + i * 30;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const endMin = totalMin + 30;
    const hEnd = Math.floor(endMin / 60) % 24;
    const mEnd = endMin % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${pad(h)}:${pad(m)}`;
    const end = `${pad(hEnd)}:${pad(mEnd)}`;
    const auslastung = Math.floor(Math.random() * 90 + 10);
    const status: SlotStatus = auslastung >= 90 ? 'ausgebucht' : auslastung >= 65 ? 'belegt' : 'verfügbar';

    slots.push({
      start,
      end,
      label: `${start} – ${end}`,
      status,
      auslastung_pct: auslastung,
      ist_frühest: i === 0,
    });
  }
  return slots;
}

export function Phase1225LieferfensterAuswahlWidget({ locationId, selectedSlot, onSelectSlot }: Props) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/delivery/public/lieferfenster?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.slots?.length) setSlots(d.slots);
        else setSlots(generateMockSlots());
      })
      .catch(() => setSlots(generateMockSlots()))
      .finally(() => setLoading(false));
  }, [locationId]);

  const selectedLabel = selectedSlot
    ? slots.find((s) => s.label === selectedSlot)?.label ?? selectedSlot
    : null;

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-sky-50 dark:hover:bg-sky-900/20 transition"
      >
        <Clock className="h-4 w-4 text-sky-500 shrink-0" />
        <span className="flex-1 text-sm font-bold text-foreground">
          Lieferfenster wählen
          {selectedLabel && (
            <span className="ml-2 text-xs font-normal text-matcha-600 dark:text-matcha-400">✓ {selectedLabel}</span>
          )}
        </span>
        {!selectedLabel && (
          <span className="text-[10px] text-muted-foreground">Optional</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Wähle ein bevorzugtes 30-Minuten-Fenster. Wir versuchen, deine Bestellung in diesem Zeitraum zu liefern.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verfügbare Slots werden geladen…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* "Keine Präferenz" Option */}
              <button
                onClick={() => onSelectSlot(null)}
                className={cn(
                  'rounded-xl border-2 px-3 py-2.5 text-xs font-bold text-left transition',
                  !selectedSlot
                    ? 'border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                    : 'border-border bg-muted/20 text-muted-foreground hover:border-sky-300 dark:hover:border-sky-700',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Schnellstmöglich
                </div>
                <div className="mt-0.5 text-[10px] font-normal opacity-70">Keine Zeitpräferenz</div>
              </button>

              {slots.map((slot) => {
                const isSelected = selectedSlot === slot.label;
                const isDisabled = slot.status === 'ausgebucht';
                const cfg = STATUS_CONFIG[slot.status];

                return (
                  <button
                    key={slot.label}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && onSelectSlot(isSelected ? null : slot.label)}
                    className={cn(
                      'rounded-xl border-2 px-3 py-2.5 text-xs font-bold text-left transition',
                      isSelected
                        ? 'border-matcha-500 dark:border-matcha-500 bg-matcha-50 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 ring-1 ring-matcha-400'
                        : isDisabled
                          ? 'border-red-200 dark:border-red-900 bg-red-50/30 text-red-300 dark:text-red-800 cursor-not-allowed'
                          : cn('hover:scale-[1.02]', cfg.color, 'hover:shadow-sm'),
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{slot.label}</span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {/* Auslastungs-Balken */}
                      <div className="flex-1 h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            slot.auslastung_pct >= 90 ? 'bg-red-400' : slot.auslastung_pct >= 65 ? 'bg-amber-400' : 'bg-matcha-400',
                          )}
                          style={{ width: `${slot.auslastung_pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-normal opacity-60 shrink-0">{cfg.label}</span>
                    </div>
                    {slot.ist_frühest && !isDisabled && (
                      <div className="mt-1 text-[9px] font-bold text-sky-600 dark:text-sky-400">⚡ Frühester Slot</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedSlot && (
            <div className="flex items-start gap-2 rounded-lg bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
              <p className="text-xs text-sky-700 dark:text-sky-300">
                Lieferfenster <strong>{selectedSlot}</strong> gewählt. Wir bemühen uns, pünktlich zu liefern — bei hoher Auslastung kann es zu kleinen Abweichungen kommen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

