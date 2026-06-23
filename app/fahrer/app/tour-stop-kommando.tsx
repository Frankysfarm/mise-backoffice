'use client';

/**
 * TourStopKommando — Fahrer-App Stopp-Kommando-Zentrale
 *
 * Zeigt den aktuellen Stopp als kompakte Karte mit:
 *  - Kundenname + Adresse + Navigation-Button
 *  - Zahlungsinfo (Bar/EC Hinweis in Bernstein)
 *  - Kundennotiz wenn vorhanden
 *  - Checkliste: Adresse geprüft → Klingel → Übergabe → (Barzahlung) → Fertig
 *  - "Fertig" CTA-Button mit Haptic-Feedback Indikator
 *
 * Nutzt KEINE API-Calls — Props-basiert für maximale Offline-Robustheit.
 */

import { useState } from 'react';
import { Banknote, Bell, CheckCircle2, Circle, CreditCard, MapPin, MessageSquare, Navigation } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type StopInfo = {
  stopNr: number;
  totalStops: number;
  kundeName: string;
  adresse: string | null;
  plz: string | null;
  lat: number | null;
  lng: number | null;
  gesamtbetrag: number;
  zahlungsart: string | null;
  bezahlt: boolean | null;
  kundeNotiz: string | null;
  kundeHinweis: string | null;
  telefon?: string | null;
  etaLabel?: string | null;
};

type ChecklistItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  amber?: boolean;
};

function buildItems(stop: StopInfo): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'adresse', label: 'Adresse geprüft', icon: <MapPin size={14} /> },
    { id: 'klingel', label: 'Klingel / Klopfen', icon: <Bell size={14} /> },
    { id: 'uebergabe', label: 'Bestellung übergeben', icon: <CheckCircle2 size={14} /> },
  ];

  if (stop.zahlungsart === 'bar' && !stop.bezahlt) {
    items.push({
      id: 'barzahlung',
      label: `Bar kassieren — ${euro(stop.gesamtbetrag)}`,
      icon: <Banknote size={14} />,
      amber: true,
    });
  }
  if (stop.zahlungsart === 'ec' && !stop.bezahlt) {
    items.push({
      id: 'ec',
      label: `EC-Karte — ${euro(stop.gesamtbetrag)}`,
      icon: <CreditCard size={14} />,
      amber: true,
    });
  }
  if (stop.kundeNotiz || stop.kundeHinweis) {
    items.push({
      id: 'notiz',
      label: 'Kundennotiz beachtet',
      icon: <MessageSquare size={14} />,
    });
  }

  return items;
}

function openNavigation(lat: number | null, lng: number | null, adresse: string | null) {
  if (lat && lng) {
    window.open(`geo:${lat},${lng}?q=${lat},${lng}`, '_blank');
    return;
  }
  if (adresse) {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(adresse)}`, '_blank');
  }
}

export function TourStopKommando({
  stop,
  onComplete,
}: {
  stop: StopInfo;
  onComplete?: () => void;
}) {
  const items = buildItems(stop);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allDone = checkedCount === items.length;

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const cashItem = items.find((i) => i.amber);

  return (
    <div className="rounded-2xl overflow-hidden border border-matcha-700 bg-matcha-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-700">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white font-black text-sm">
            {stop.stopNr}
          </div>
          <span className="text-matcha-200 text-[11px] font-bold uppercase tracking-wider">
            Stop {stop.stopNr} von {stop.totalStops}
          </span>
        </div>
        {stop.etaLabel && (
          <span className="text-[10px] text-matcha-400 tabular-nums">{stop.etaLabel}</span>
        )}
      </div>

      {/* Kundeninfo */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-white text-base leading-tight truncate">{stop.kundeName}</div>
            {stop.adresse && (
              <div className="text-matcha-300 text-sm mt-0.5 leading-snug">{stop.adresse}</div>
            )}
          </div>
          <button
            onClick={() => openNavigation(stop.lat, stop.lng, stop.adresse)}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-white text-[11px] font-bold hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Navigation size={13} />
            Navi
          </button>
        </div>

        {/* Kassenhinweis */}
        {cashItem && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-2">
            <Banknote size={14} className="text-amber-400 shrink-0" />
            <span className="text-amber-300 text-sm font-bold">{cashItem.label}</span>
          </div>
        )}

        {/* Kundennotiz */}
        {(stop.kundeNotiz || stop.kundeHinweis) && (
          <div className="flex items-start gap-2 rounded-lg bg-matcha-800 border border-matcha-700 px-3 py-2">
            <MessageSquare size={13} className="text-matcha-400 shrink-0 mt-0.5" />
            <span className="text-matcha-200 text-xs leading-snug">
              {stop.kundeNotiz || stop.kundeHinweis}
            </span>
          </div>
        )}
      </div>

      {/* Checkliste */}
      <div className="border-t border-matcha-700 px-4 py-3 space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-matcha-400 mb-2">
          Checkliste · {checkedCount}/{items.length}
        </div>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border text-left transition-all active:scale-[0.98]',
              checked[item.id]
                ? 'border-matcha-600 bg-matcha-800 text-matcha-300'
                : item.amber
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-matcha-700 bg-matcha-800/50 text-matcha-200',
            )}
          >
            <span className={cn('shrink-0', item.amber && !checked[item.id] ? 'text-amber-400' : 'text-matcha-400')}>
              {item.icon}
            </span>
            <span className="flex-1 text-sm font-medium">
              {item.label}
            </span>
            <span className="shrink-0">
              {checked[item.id] ? (
                <CheckCircle2 size={18} className="text-matcha-400" />
              ) : (
                <Circle size={18} className="text-matcha-600" />
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Fertig-Button */}
      <div className="border-t border-matcha-700 px-4 pb-4 pt-3">
        <div className="h-1.5 rounded-full bg-matcha-800 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-300"
            style={{ width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%` }}
          />
        </div>
        <button
          onClick={() => allDone && onComplete?.()}
          disabled={!allDone}
          className={cn(
            'w-full rounded-2xl py-4 font-black text-base tracking-wide transition-all duration-200',
            allDone
              ? 'bg-matcha-500 text-white shadow-lg shadow-matcha-900/50 active:scale-[0.97] hover:bg-matcha-400'
              : 'bg-matcha-800 text-matcha-600 cursor-not-allowed',
          )}
        >
          {allDone ? '✅ Stopp abschließen' : `${items.length - checkedCount} verbleibend`}
        </button>
      </div>
    </div>
  );
}
