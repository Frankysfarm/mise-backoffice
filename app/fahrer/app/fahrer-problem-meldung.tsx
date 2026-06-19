'use client';

/**
 * FahrerProblemMeldung — Phase 300
 *
 * Schnelles Problem-Reporting für Fahrer bei Lieferproblemen:
 * - Kunde nicht zu Hause
 * - Falsche Adresse / nicht auffindbar
 * - Klingel defekt
 * - Hund / Zugang gesperrt
 * - Kunde verweigert Annahme
 *
 * Zeigt Alternativ-Aktionen und speichert die Meldung für Dispatch.
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Phone, MessageSquare, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROBLEMS = [
  { id: 'nicht_zuhause',     label: 'Kunde nicht zu Hause',       icon: '🚪', action: 'Klingel mehrfach gedrückt, kein Öffnen.' },
  { id: 'falsche_adresse',   label: 'Adresse nicht auffindbar',    icon: '📍', action: 'GPS-Adresse stimmt nicht mit Realität überein.' },
  { id: 'zugang_gesperrt',   label: 'Zugang gesperrt / Tor zu',    icon: '🔒', action: 'Eingang nicht zugänglich, Hilfe nötig.' },
  { id: 'klingel_defekt',    label: 'Klingel defekt',              icon: '🔔', action: 'Klingel reagiert nicht, Alternativkontakt nötig.' },
  { id: 'verweigerung',      label: 'Annahme verweigert',          icon: '✋', action: 'Kunde weigert sich, Bestellung entgegenzunehmen.' },
  { id: 'sonstiges',         label: 'Sonstiges Problem',           icon: '⚠️', action: 'Sonstiger Grund, Dispatch informieren.' },
] as const;

type ProblemId = typeof PROBLEMS[number]['id'];

interface Props {
  orderId: string;
  stopId: string;
  kundeVorname: string;
  kundeTelefon: string | null;
  onResolved?: () => void;
}

export function FahrerProblemMeldung({ orderId, stopId, kundeVorname, kundeTelefon, onResolved }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProblemId | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-xl border border-matcha-300 bg-matcha-50 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-matcha-600 shrink-0" />
        <div>
          <div className="font-semibold text-sm text-matcha-800">Meldung übermittelt</div>
          <div className="text-xs text-matcha-700">Dispatch wurde informiert.</div>
        </div>
      </div>
    );
  }

  async function handleSend() {
    if (!selected) return;
    setSending(true);
    const problem = PROBLEMS.find(p => p.id === selected)!;
    try {
      await fetch('/api/driver/v1/problem-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, stopId, problemId: selected, note: problem.action }),
      });
    } catch {}
    setSending(false);
    setDone(true);
    onResolved?.();
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 space-y-0 overflow-hidden">
      {/* Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-900">Problem bei diesem Stopp?</span>
        {open ? <ChevronUp size={14} className="ml-auto text-amber-600" /> : <ChevronDown size={14} className="ml-auto text-amber-600" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Problem-Auswahl */}
          <div className="space-y-1.5">
            {PROBLEMS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  selected === p.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100',
                )}
              >
                <span className="text-base">{p.icon}</span>
                <span className="font-medium">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Kontakt-Aktionen */}
          {kundeTelefon && (
            <div className="flex gap-2">
              <a
                href={`tel:${kundeTelefon}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 py-2 text-sm font-medium text-blue-700"
              >
                <Phone size={14} />
                Anrufen
              </a>
              <a
                href={`sms:${kundeTelefon}?body=${encodeURIComponent(`Hallo ${kundeVorname}, wir versuchen Ihre Bestellung zuzustellen. Bitte öffnen Sie die Tür.`)}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 py-2 text-sm font-medium text-green-700"
              >
                <MessageSquare size={14} />
                SMS
              </a>
            </div>
          )}

          {/* Senden */}
          <button
            onClick={handleSend}
            disabled={!selected || sending}
            className={cn(
              'w-full rounded-xl py-3 text-sm font-bold transition-colors',
              selected && !sending
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-amber-200 text-amber-400 cursor-not-allowed',
            )}
          >
            {sending ? 'Wird gemeldet…' : 'Problem an Dispatch melden'}
          </button>
        </div>
      )}
    </div>
  );
}
