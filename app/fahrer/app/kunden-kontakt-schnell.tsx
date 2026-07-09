'use client';

import { Phone, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  id: string;
  reihenfolge: number | null;
  geliefert_am: string | null;
  order?: {
    kunde_name?: string;
    kunde_telefon?: string | null;
    kunde_adresse?: string | null;
  } | null;
}

interface Props {
  stops: TourStop[];
}

const SMS_VORLAGEN = [
  { id: 'komme', text: 'Ich bin gleich bei Ihnen! 🚴', label: 'Gleich da' },
  { id: 'warte', text: 'Ich warte vor der Tür!', label: 'Vor der Tür' },
  { id: 'parkplatz', text: 'Kein Parkplatz gefunden, bin in der Nähe.', label: 'Parkproblem' },
  { id: 'verpasst', text: 'Ich war da, war aber niemand zu Hause. Bitte melden!', label: 'Nicht da' },
];

export function KundenKontaktSchnell({ stops }: Props) {
  const nextStop = stops.find((s) => s.geliefert_am == null);
  if (!nextStop?.order) return null;

  const { kunde_name, kunde_telefon, kunde_adresse } = nextStop.order;
  const telefon = kunde_telefon?.replace(/\s+/g, '') ?? null;
  const vorname = kunde_name?.split(' ')[0] ?? 'Kunde';

  function handleSms(vorlage: string) {
    const msg = encodeURIComponent(vorlage.replace('Ihnen', vorname));
    window.open(telefon ? `sms:${telefon}?body=${msg}` : `sms:?body=${msg}`);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-stone-50 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
          <Phone className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-stone-800">{vorname} kontaktieren</div>
          {kunde_adresse && (
            <div className="text-[10px] text-stone-400 truncate">{kunde_adresse}</div>
          )}
        </div>
        <div className="text-[9px] text-stone-400">
          Stopp {nextStop.reihenfolge ?? '?'}/{stops.length}
        </div>
      </div>

      {/* Call + SMS primary buttons */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <a
          href={telefon ? `tel:${telefon}` : undefined}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-transform active:scale-95',
            telefon
              ? 'bg-blue-600 text-white'
              : 'bg-stone-100 text-stone-400 pointer-events-none',
          )}
        >
          <Phone className="h-4 w-4" />
          Anrufen
        </a>
        <a
          href={telefon ? `sms:${telefon}` : undefined}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-transform active:scale-95',
            telefon
              ? 'bg-stone-700 text-white'
              : 'bg-stone-100 text-stone-400 pointer-events-none',
          )}
        >
          <MessageSquare className="h-4 w-4" />
          SMS
        </a>
      </div>

      {/* Quick SMS templates */}
      <div className="border-t border-stone-100 px-3 pb-3">
        <div className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-2 mt-2">
          Schnell-Nachricht senden
        </div>
        <div className="space-y-1.5">
          {SMS_VORLAGEN.map((v) => (
            <button
              key={v.id}
              onClick={() => handleSms(v.text)}
              className="flex w-full items-center gap-2.5 rounded-lg bg-stone-50 px-3 py-2 text-left transition-colors hover:bg-stone-100 active:scale-[0.98]"
            >
              <MessageSquare className="h-3.5 w-3.5 text-stone-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-stone-700">{v.label}</div>
                <div className="text-[9px] text-stone-400 truncate">{v.text}</div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-stone-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {!telefon && (
        <div className="px-4 pb-3 flex items-center gap-1.5 text-[10px] text-amber-600">
          <Clock className="h-3 w-3" />
          Keine Telefonnummer hinterlegt
        </div>
      )}
    </div>
  );
}
