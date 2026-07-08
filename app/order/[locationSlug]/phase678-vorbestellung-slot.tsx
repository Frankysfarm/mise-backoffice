'use client';

/**
 * Phase 678 — Storefront Vorbestellungs-Slotauswahl
 * Kunde kann Lieferzeit 30/60/90 Min im Voraus buchen.
 * Zeigt Slots mit Verfügbarkeit (grün/gelb/rot) basierend auf Kitchen-Auslastung.
 * Props: locationId: string, onSlotSelect?: (slotMin: number | null) => void
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

type Slot = {
  label: string;
  delayMin: number;
  etaLabel: string;
  status: 'frei' | 'knapp' | 'ausgelastet';
};

type KitchenSignal = {
  ok: boolean;
  signal: 'grün' | 'gelb' | 'rot';
  offeneBestellungen: number;
  prognoseWarteMin: number;
};

function buildSlots(signal: KitchenSignal | null): Slot[] {
  const now = new Date();
  const capacity = signal?.offeneBestellungen ?? 0;
  const waitMin  = signal?.prognoseWarteMin ?? 0;

  const slotConfigs = [30, 60, 90];
  return slotConfigs.map(delay => {
    const eta = new Date(now.getTime() + delay * 60_000);
    const etaLabel = eta.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    // Slot-Status: Küche mit vielen offenen Bestellungen → erste Slots belastet
    let status: Slot['status'];
    if (delay <= waitMin) {
      status = capacity >= 10 ? 'ausgelastet' : capacity >= 5 ? 'knapp' : 'frei';
    } else if (delay <= waitMin + 20) {
      status = capacity >= 5 ? 'knapp' : 'frei';
    } else {
      status = 'frei';
    }

    const labels: Record<number, string> = { 30: 'In 30 Min', 60: 'In 1 Stunde', 90: 'In 1,5 Std' };
    return { label: labels[delay], delayMin: delay, etaLabel, status };
  });
}

export function Phase678VorbestellungSlot({
  locationId,
  onSlotSelect,
}: {
  locationId: string;
  onSlotSelect?: (slotMin: number | null) => void;
}) {
  const [signal, setSignal] = useState<KitchenSignal | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.ok ? setSignal(d) : null)
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const slots = buildSlots(signal);

  const STATUS_STYLE = {
    frei:       { bg: 'bg-matcha-50 border-matcha-300', badge: 'bg-matcha-500 text-white',    label: 'Verfügbar'  },
    knapp:      { bg: 'bg-amber-50 border-amber-300',   badge: 'bg-amber-400 text-white',     label: 'Begrenzt'   },
    ausgelastet:{ bg: 'bg-red-50 border-red-300',       badge: 'bg-red-500 text-white',       label: 'Ausgelastet'},
  };

  const handleSelect = (delayMin: number) => {
    const next = selected === delayMin ? null : delayMin;
    setSelected(next);
    onSlotSelect?.(next);
  };

  return (
    <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-stone-50 transition"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-gray-900">Vorbestellung</div>
          <div className="text-xs text-stone-400">
            {selected != null ? `Slot: In ${selected} Min gewählt` : 'Lieferzeit im Voraus buchen'}
          </div>
        </div>
        {selected != null && (
          <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
        )}
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 py-4 space-y-3">
          <p className="text-xs text-stone-500">
            Wähle einen Lieferzeitslot. Die Küche beginnt rechtzeitig mit der Zubereitung.
          </p>

          <div className="space-y-2">
            {slots.map(slot => {
              const s = STATUS_STYLE[slot.status];
              const isSelected = selected === slot.delayMin;
              return (
                <button
                  key={slot.delayMin}
                  onClick={() => handleSelect(slot.delayMin)}
                  disabled={slot.status === 'ausgelastet'}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border px-4 py-3 transition text-left',
                    s.bg,
                    isSelected ? 'ring-2 ring-matcha-500 ring-offset-1' : '',
                    slot.status === 'ausgelastet' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-95',
                  )}
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">{slot.label}</div>
                    <div className="text-xs text-stone-500">Ankunft ca. {slot.etaLabel} Uhr</div>
                  </div>
                  <div className={cn('rounded-full px-2 py-0.5 text-[9px] font-black shrink-0', s.badge)}>
                    {s.label}
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {selected != null && (
            <div className="rounded-xl bg-matcha-50 border border-matcha-200 px-4 py-3 text-xs text-matcha-800">
              <strong>Slot bestätigt:</strong> Deine Bestellung wird in ca. {selected} Min geliefert.
            </div>
          )}

          <button
            onClick={() => {
              setSelected(null);
              onSlotSelect?.(null);
              setOpen(false);
            }}
            className="text-xs text-stone-400 underline hover:text-stone-600 transition"
          >
            Sofort liefern (kein Vorbestellungs-Slot)
          </button>
        </div>
      )}
    </div>
  );
}
