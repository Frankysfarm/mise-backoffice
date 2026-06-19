'use client';

import { cn } from '@/lib/utils';
import {
  MessageSquare, Bell, DoorClosed, Package, Phone,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

interface Props {
  stops: Stop[];
  currentStopId?: string | null;
}

type HinweisTyp = 'klingeln' | 'codeschloss' | 'abstellort' | 'kontaktlos' | 'sonstiges';

const HINWEIS_PATTERNS: { typ: HinweisTyp; words: string[]; icon: React.ElementType; label: string }[] = [
  { typ: 'klingeln', words: ['klingeln', 'klingel', 'schellen', 'türklingel'], icon: Bell, label: 'Klingeln' },
  { typ: 'codeschloss', words: ['code', 'schloss', 'pin', 'zahlencode', 'codeschl'], icon: DoorClosed, label: 'Codeschloss' },
  { typ: 'abstellort', words: ['abstell', 'tür stell', 'vor der tür', 'eingang', 'briefkasten', 'beim nachbarn'], icon: Package, label: 'Abstellort' },
  { typ: 'kontaktlos', words: ['kontaktlos', 'ohne kontakt', 'nicht klingeln', 'einfach hinstell', 'schlaf', 'baby'], icon: DoorClosed, label: 'Kontaktlos' },
];

function detectHinweisTyp(text: string): { typ: HinweisTyp; icon: React.ElementType; label: string } | null {
  const lower = text.toLowerCase();
  for (const h of HINWEIS_PATTERNS) {
    if (h.words.some((w) => lower.includes(w))) {
      return { typ: h.typ, icon: h.icon, label: h.label };
    }
  }
  return null;
}

function StopNotizCard({ stop, isActive }: { stop: Stop; isActive: boolean }) {
  const [expanded, setExpanded] = useState(isActive);
  const { order } = stop;
  const isDone = stop.geliefert_am != null;

  const notizen = [order.kunde_notiz, order.kunde_lieferhinweis].filter(Boolean) as string[];
  if (notizen.length === 0 && !order.kunde_telefon) return null;

  const detectedHinweis = notizen.length > 0 ? detectHinweisTyp(notizen.join(' ')) : null;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      isActive
        ? 'border-blue-500/50 bg-blue-900/30'
        : isDone
        ? 'border-matcha-700/30 bg-matcha-900/20 opacity-60'
        : 'border-border/40 bg-card/40',
    )}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5"
      >
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border-2',
          isDone
            ? 'bg-matcha-600 border-matcha-500 text-white'
            : isActive
            ? 'bg-blue-500 border-blue-400 text-white animate-pulse'
            : 'bg-muted border-border text-muted-foreground',
        )}>
          {stop.reihenfolge}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-xs font-bold text-white truncate">{order.kunde_name}</div>
          <div className="text-[10px] text-muted-foreground">
            #{order.bestellnummer}
            {detectedHinweis && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-400">
                <detectedHinweis.icon size={9} /> {detectedHinweis.label}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3 space-y-2 border-t border-white/5">
          {notizen.map((note, i) => (
            <div key={i} className="flex items-start gap-2 mt-2">
              <MessageSquare size={12} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-100 leading-relaxed">{note}</p>
            </div>
          ))}
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center gap-2 mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-accent font-medium active:bg-white/10 transition"
            >
              <Phone size={13} className="text-accent shrink-0" />
              {order.kunde_telefon}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function FahrerKundenNotizKarte({ stops, currentStopId }: Props) {
  const stopsWithNotes = stops.filter((s) => {
    const { order } = s;
    return order.kunde_notiz || order.kunde_lieferhinweis || order.kunde_telefon;
  });

  if (stopsWithNotes.length === 0) return null;

  const pendingWithNotes = stopsWithNotes.filter((s) => s.geliefert_am == null);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <AlertCircle size={13} className="text-blue-400 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Kundenhinweise · {pendingWithNotes.length} ausstehend
        </span>
      </div>
      <div className="space-y-2">
        {stopsWithNotes.map((stop) => (
          <StopNotizCard
            key={stop.id}
            stop={stop}
            isActive={stop.id === currentStopId}
          />
        ))}
      </div>
    </section>
  );
}
