'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, Copy, Loader2, Moon, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DayHours = {
  day: number;        // 0 = Mo, 6 = So
  open: boolean;
  slots: { from: string; to: string }[];
};

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function defaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, d) => ({
    day: d,
    open: d < 6, // So standardmäßig zu
    slots: [{ from: '11:00', to: '22:00' }],
  }));
}

export function HoursForm({ tenantId, initial }: { tenantId: string; initial: DayHours[] | null }) {
  const supabase = createClient();
  const [hours, setHours] = useState<DayHours[]>(
    Array.isArray(initial) && initial.length === 7 ? initial : defaultHours(),
  );
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  function updateDay(day: number, patch: Partial<DayHours>) {
    setHours((prev) => prev.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  }

  function addSlot(day: number) {
    setHours((prev) => prev.map((h) =>
      h.day === day ? { ...h, slots: [...h.slots, { from: '14:00', to: '18:00' }] } : h,
    ));
  }

  function removeSlot(day: number, idx: number) {
    setHours((prev) => prev.map((h) =>
      h.day === day ? { ...h, slots: h.slots.filter((_, i) => i !== idx) } : h,
    ));
  }

  function updateSlot(day: number, idx: number, patch: Partial<{ from: string; to: string }>) {
    setHours((prev) => prev.map((h) =>
      h.day === day
        ? { ...h, slots: h.slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }
        : h,
    ));
  }

  function copyToAll(fromDay: number) {
    const source = hours.find((h) => h.day === fromDay);
    if (!source) return;
    if (!confirm(`${DAYS[fromDay]} auf alle anderen Tage übernehmen?`)) return;
    setHours((prev) => prev.map((h) =>
      h.day === fromDay ? h : { ...h, open: source.open, slots: source.slots.map((s) => ({ ...s })) },
    ));
  }

  function copyToWeekdays(fromDay: number) {
    const source = hours.find((h) => h.day === fromDay);
    if (!source) return;
    setHours((prev) => prev.map((h) =>
      h.day <= 4 ? (h.day === fromDay ? h : { ...h, open: source.open, slots: source.slots.map((s) => ({ ...s })) }) : h,
    ));
  }

  function save() {
    startSaving(async () => {
      await supabase.from('tenants').update({ oeffnungszeiten_json: hours }).eq('id', tenantId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const openDaysCount = hours.filter((h) => h.open).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Summary */}
      <Card className="p-4 bg-matcha-50/50 border-matcha-200">
        <div className="text-sm text-matcha-900">
          <strong>{openDaysCount} von 7 Tagen geöffnet.</strong> Außerhalb dieser Zeiten zeigt dein Shop „Geschlossen – Vorbestellung möglich".
        </div>
      </Card>

      {/* Tage */}
      <div className="space-y-3">
        {hours.map((h) => (
          <DayCard
            key={h.day}
            hours={h}
            onToggle={() => updateDay(h.day, { open: !h.open, slots: !h.open && h.slots.length === 0 ? [{ from: '11:00', to: '22:00' }] : h.slots })}
            onAddSlot={() => addSlot(h.day)}
            onRemoveSlot={(idx) => removeSlot(h.day, idx)}
            onUpdateSlot={(idx, patch) => updateSlot(h.day, idx, patch)}
            onCopyAll={() => copyToAll(h.day)}
            onCopyWeekdays={() => copyToWeekdays(h.day)}
          />
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 sticky bottom-4 bg-background/95 backdrop-blur p-3 rounded-xl border shadow-lg">
        <button
          onClick={save}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Öffnungszeiten speichern
        </button>
        {saved && <span className="text-sm text-matcha-700 font-semibold">Gespeichert ✓</span>}
      </div>
    </div>
  );
}

function DayCard({
  hours, onToggle, onAddSlot, onRemoveSlot, onUpdateSlot, onCopyAll, onCopyWeekdays,
}: {
  hours: DayHours;
  onToggle: () => void;
  onAddSlot: () => void;
  onRemoveSlot: (idx: number) => void;
  onUpdateSlot: (idx: number, patch: Partial<{ from: string; to: string }>) => void;
  onCopyAll: () => void;
  onCopyWeekdays: () => void;
}) {
  return (
    <Card className={cn('p-4 transition', !hours.open && 'bg-muted/20')}>
      <div className="flex items-center gap-4">
        {/* Tag */}
        <div className="w-28">
          <div className="font-display text-base font-bold">{DAYS[hours.day]}</div>
          <div className="text-xs text-muted-foreground">{DAYS_SHORT[hours.day]}</div>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'h-9 px-4 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition',
            hours.open
              ? 'bg-matcha-700 text-matcha-50 hover:bg-matcha-800'
              : 'bg-muted text-muted-foreground hover:bg-muted/70',
          )}
        >
          {hours.open ? <><Check size={12} /> Geöffnet</> : <><Moon size={12} /> Geschlossen</>}
        </button>

        {/* Slots */}
        <div className="flex-1 flex flex-wrap items-center gap-2">
          {hours.open ? (
            <>
              {hours.slots.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-card border rounded-lg px-2 py-1">
                  <input
                    type="time"
                    value={slot.from}
                    onChange={(e) => onUpdateSlot(idx, { from: e.target.value })}
                    className="bg-transparent text-sm w-20 focus:outline-none"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={slot.to}
                    onChange={(e) => onUpdateSlot(idx, { to: e.target.value })}
                    className="bg-transparent text-sm w-20 focus:outline-none"
                  />
                  {hours.slots.length > 1 && (
                    <button
                      onClick={() => onRemoveSlot(idx)}
                      className="ml-1 text-muted-foreground hover:text-red-600"
                      title="Zeitfenster entfernen"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={onAddSlot}
                className="h-8 px-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted inline-flex items-center gap-1"
                title="Weiteres Zeitfenster (z.B. für Mittagspause)"
              >
                <Plus size={12} /> Zeitfenster
              </button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Ruhetag</span>
          )}
        </div>

        {/* Copy actions */}
        {hours.open && (
          <div className="flex items-center gap-1">
            <button
              onClick={onCopyWeekdays}
              className="h-8 px-2 rounded-lg text-[10px] text-muted-foreground hover:bg-muted inline-flex items-center gap-1"
              title="Auf Mo–Fr übertragen"
            >
              <Copy size={10} /> Mo–Fr
            </button>
            <button
              onClick={onCopyAll}
              className="h-8 px-2 rounded-lg text-[10px] text-muted-foreground hover:bg-muted inline-flex items-center gap-1"
              title="Auf alle Tage übertragen"
            >
              <Copy size={10} /> Alle
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
