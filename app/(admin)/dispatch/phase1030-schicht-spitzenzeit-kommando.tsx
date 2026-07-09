'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Calendar, Users, TrendingUp } from 'lucide-react';

/**
 * Phase 1030 — Schicht-Spitzenzeit-Kommando (Dispatch)
 *
 * Visualisierung der Phase1023-API: Welcher Wochentag braucht wann wie viele Fahrer.
 * 5-Minuten-Polling.
 */

interface Props {
  locationId: string | null;
}

interface StundenSlot {
  stunde: number;
  bestellungen_avg: number;
  mindesbesetzung: number;
  ist_peak: boolean;
}

interface WochentagAnalyse {
  tag: string;
  tag_index: number;
  peak_stunde: number;
  peak_bestellungen: number;
  mindestbesetzung_peak: number;
  slots: StundenSlot[];
  intensitaet: 'niedrig' | 'mittel' | 'hoch' | 'sehr_hoch';
}

interface ApiResponse {
  wochentage: WochentagAnalyse[];
  spitzenzeit_global: { tag: string; stunde: number; bestellungen: number };
  generiert_am: string;
}

const INTENSITAET_STYLE: Record<string, { badge: string; label: string }> = {
  sehr_hoch: { badge: 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300', label: 'Sehr hoch' },
  hoch: { badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 dark:text-amber-300', label: 'Hoch' },
  mittel: { badge: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-700 dark:text-blue-300', label: 'Mittel' },
  niedrig: { badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 text-matcha-700 dark:text-matcha-300', label: 'Niedrig' },
};

const HEUTE_INDEX = (new Date().getDay() + 6) % 7; // 0=Mo … 6=So

export function DispatchPhase1030SchichtSpitzenzeitKommando({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selectedTag, setSelectedTag] = useState<number>(HEUTE_INDEX);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/schicht-spitzenzeit-analyse?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.wochentage) setData(d); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const selected = data.wochentage.find(w => w.tag_index === selectedTag) ?? data.wochentage[0];
  const peakSlots = selected?.slots.filter(s => s.ist_peak) ?? [];
  const intensStyle = INTENSITAET_STYLE[selected?.intensitaet ?? 'niedrig'];

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Schicht-Spitzenzeit-Kommando</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', intensStyle.badge)}>
            {data.spitzenzeit_global.tag} {data.spitzenzeit_global.stunde}:00
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Wochentag-Auswahl */}
          <div className="flex gap-1 flex-wrap">
            {data.wochentage.map(w => (
              <button
                key={w.tag_index}
                onClick={() => setSelectedTag(w.tag_index)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold border transition',
                  selectedTag === w.tag_index
                    ? 'bg-matcha-600 text-white border-matcha-600'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-matcha-400',
                  w.tag_index === HEUTE_INDEX && selectedTag !== w.tag_index && 'border-matcha-400',
                )}
              >
                {w.tag}
                {w.tag_index === HEUTE_INDEX && <span className="ml-1 text-[9px] opacity-70">Heute</span>}
              </button>
            ))}
          </div>

          {selected && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-matcha-600" />
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selected.tag}</span>
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', intensStyle.badge)}>
                    {intensStyle.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  Min. {selected.mindestbesetzung_peak} Fahrer um {selected.peak_stunde}:00
                </div>
              </div>

              {/* Stunden-Balken */}
              <div className="space-y-1.5">
                {selected.slots.map(slot => {
                  const maxVal = selected.peak_bestellungen || 1;
                  const pct = Math.round((slot.bestellungen_avg / maxVal) * 100);
                  const barColor = slot.ist_peak ? 'bg-red-500' : pct >= 60 ? 'bg-amber-400' : 'bg-matcha-400';
                  return (
                    <div key={slot.stunde} className="flex items-center gap-2 text-xs">
                      <span className={cn('w-10 text-right font-mono shrink-0', slot.ist_peak ? 'font-bold text-red-600 dark:text-red-400' : 'text-zinc-500')}>
                        {slot.stunde}:00
                      </span>
                      <div className="flex-1 h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={cn('h-full rounded transition-all', barColor)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-muted-foreground shrink-0">
                        Ø {slot.bestellungen_avg} Best.
                      </span>
                      <span className={cn(
                        'w-16 text-right shrink-0 font-semibold',
                        slot.ist_peak ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400',
                      )}>
                        {slot.mindesbesetzung} Fahrer
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Peak-Zusammenfassung */}
              {peakSlots.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <strong>Stoßzeiten:</strong>{' '}
                  {peakSlots.map(s => `${s.stunde}:00 (${s.mindesbesetzung} Fahrer)`).join(' · ')}
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-muted-foreground/60 text-right">
            Basierend auf 4-Wochen-Aggregat · alle 5 Min aktualisiert
          </p>
        </div>
      )}
    </div>
  );
}
