'use client';

import { useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

interface Props {
  deliveryTimeMin?: number;
  onSelect?: (zeitfenster: string | null) => void;
}

interface Zeitfenster {
  id: string;
  label: string;
  sub: string;
  available: boolean;
}

function buildZeitfenster(deliveryTimeMin: number): Zeitfenster[] {
  const now = new Date();
  const slots: Zeitfenster[] = [];

  const startMin = now.getHours() * 60 + now.getMinutes() + deliveryTimeMin + 10;

  const slotDefs = [
    { start: 11 * 60, end: 12 * 60, label: '11:00–12:00', id: '11-12' },
    { start: 12 * 60, end: 13 * 60, label: '12:00–13:00', id: '12-13' },
    { start: 13 * 60, end: 14 * 60, label: '13:00–14:00', id: '13-14' },
    { start: 17 * 60, end: 18 * 60, label: '17:00–18:00', id: '17-18' },
    { start: 18 * 60, end: 19 * 60, label: '18:00–19:00', id: '18-19' },
    { start: 19 * 60, end: 20 * 60, label: '19:00–20:00', id: '19-20' },
    { start: 20 * 60, end: 21 * 60, label: '20:00–21:00', id: '20-21' },
  ];

  const heute = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  for (const s of slotDefs) {
    const available = s.start >= startMin;
    slots.push({
      id: s.id,
      label: s.label,
      sub: heute,
      available,
    });
  }

  return slots;
}

export function Phase690LieferzeitfensterWaehler({
  deliveryTimeMin = 35,
  onSelect,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedZeitfenster, setSelectedZeitfenster] = useState<string | null>(null);

  function handleSelect(id: string | null) {
    setSelectedZeitfenster(id);
    onSelect?.(id);
  }
  const slots = buildZeitfenster(deliveryTimeMin);
  const available = slots.filter((s) => s.available);

  if (available.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-muted bg-muted/30 px-4 py-3">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">Keine Vorbestellungs-Zeitfenster mehr heute verfügbar.</span>
      </div>
    );
  }

  const selected = slots.find((s) => s.id === selectedZeitfenster);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-semibold">Lieferzeitfenster wählen</span>
        <span className="text-[10px] text-muted-foreground">(optional)</span>
      </div>

      {selected && !expanded ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{selected.label}</p>
              <p className="text-[10px] text-muted-foreground">{selected.sub}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-indigo-600 dark:text-indigo-400 underline"
            >
              ändern
            </button>
            <button
              onClick={() => { handleSelect(null); }}
              className="text-xs text-muted-foreground underline"
            >
              entfernen
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {available.map((slot) => (
              <button
                key={slot.id}
                onClick={() => { handleSelect(slot.id); setExpanded(false); }}
                className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition ${
                  selectedZeitfenster === slot.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-border hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <span className="text-sm font-semibold">{slot.label}</span>
                <span className="text-[10px] text-muted-foreground">{slot.sub}</span>
              </button>
            ))}
          </div>
          {selected && (
            <button
              onClick={() => setExpanded(false)}
              className="mt-2 text-xs text-muted-foreground underline"
            >
              Abbrechen
            </button>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Wir liefern zum gewählten Zeitfenster · frühestmögliche Lieferung in ca. {deliveryTimeMin} Min.
          </p>
        </>
      )}
    </div>
  );
}
