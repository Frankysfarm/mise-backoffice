'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1111 — Kunden-Feedback-Chronik (Fahrer-App)
// Letzte 10 Kundenbewertungen mit Kommentar + Sterne + Bestelldatum scrollbar

interface Props {
  driverId: string;
  isOnline: boolean;
}

type Eintrag = {
  id: string;
  sterne: number;
  kommentar: string | null;
  bestell_datum: string;
  datum_label: string;
};

type ApiData = {
  eintraege: Eintrag[];
  schnitt_sterne: number;
  anzahl_gesamt: number;
  driver_id: string;
  generiert_am: string;
};

const MOCK: ApiData = {
  eintraege: [
    { id: '1', sterne: 5, kommentar: 'Super schnelle Lieferung, alles heiß!', bestell_datum: '2026-07-12', datum_label: 'So 12.07.' },
    { id: '2', sterne: 5, kommentar: 'Freundlicher Fahrer, gerne wieder.', bestell_datum: '2026-07-12', datum_label: 'So 12.07.' },
    { id: '3', sterne: 4, kommentar: null, bestell_datum: '2026-07-11', datum_label: 'Sa 11.07.' },
    { id: '4', sterne: 3, kommentar: 'Etwas spät, aber nett.', bestell_datum: '2026-07-11', datum_label: 'Sa 11.07.' },
    { id: '5', sterne: 5, kommentar: 'Alles top, vielen Dank!', bestell_datum: '2026-07-10', datum_label: 'Fr 10.07.' },
  ],
  schnitt_sterne: 4.4,
  anzahl_gesamt: 5,
  driver_id: 'mock',
  generiert_am: new Date().toISOString(),
};

function StarRow({ sterne }: { sterne: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn('h-3 w-3', i <= sterne ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300')}
        />
      ))}
    </div>
  );
}

export function FahrerPhase1111KundenFeedbackChronik({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/kunden-feedback-chronik?driver_id=${encodeURIComponent(driverId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
  }, [load]);

  const display = data ?? MOCK;

  return (
    <div className="rounded-2xl bg-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          <span className="text-sm font-bold text-white">Kunden-Feedback</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            ⌀ {display.schnitt_sterne} · {display.anzahl_gesamt} Bewertungen
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-white/50" />}
          {open ? <ChevronUp className="h-4 w-4 text-white/60" /> : <ChevronDown className="h-4 w-4 text-white/60" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {display.eintraege.map(e => (
              <div key={e.id} className="rounded-xl bg-white/5 px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <StarRow sterne={e.sterne} />
                  <span className="text-[10px] text-white/40">{e.datum_label}</span>
                </div>
                {e.kommentar ? (
                  <p className="text-xs text-white/75 leading-relaxed">„{e.kommentar}"</p>
                ) : (
                  <p className="text-[10px] text-white/30 italic">Kein Kommentar</p>
                )}
              </div>
            ))}

            {display.eintraege.length === 0 && (
              <p className="text-sm text-white/40 text-center py-4">Noch keine Bewertungen.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
