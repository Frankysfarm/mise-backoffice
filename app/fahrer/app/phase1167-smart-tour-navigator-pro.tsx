'use client';

import { useMemo } from 'react';
import { CheckCircle2, ChevronRight, Clock, MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1167 — Smart-Tour-Navigator-Pro (Fahrer-App)
// Alle Stopp-Schritte in Sequenz + Routeneffizienz + aktueller Fokus-Stopp

interface Stop {
  id: string;
  reihenfolge?: number;
  geliefert_am?: string | null;
  order?: {
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  } | null;
}

interface Props {
  activeBatch: { id: string; stops: Stop[] } | null;
}

function fmtEta(stop: Stop) {
  const s = stop.order?.eta_latest ?? stop.order?.eta_earliest;
  if (!s) return null;
  return new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrerPhase1167SmartTourNavigatorPro({ activeBatch }: Props) {
  const { sorted, erledigt, gesamt } = useMemo(() => {
    const stops = activeBatch?.stops ?? [];
    const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
    return { sorted, erledigt: stops.filter(s => !!s.geliefert_am).length, gesamt: stops.length };
  }, [activeBatch]);

  if (!activeBatch || gesamt === 0) return null;

  const pct = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-50 border-b border-matcha-200">
        <Navigation size={15} className="text-matcha-600" />
        <span className="font-bold text-sm text-matcha-800 uppercase tracking-wider">Tour-Navigator</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-2 w-24 rounded-full bg-matcha-200 overflow-hidden">
            <div className="h-full rounded-full bg-matcha-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-bold text-matcha-700">{erledigt}/{gesamt}</span>
        </div>
      </div>

      {/* Stopp-Liste */}
      <div className="divide-y divide-muted">
        {sorted.map((stop, i) => {
          const done = !!stop.geliefert_am;
          const isCurrent = !done && i === erledigt;
          const eta = fmtEta(stop);
          const adresse = [stop.order?.kunde_adresse, stop.order?.kunde_plz].filter(Boolean).join(', ');

          return (
            <div key={stop.id} className={cn('flex items-start gap-3 px-4 py-3', isCurrent ? 'bg-matcha-50' : done ? 'bg-muted/30 opacity-60' : 'bg-white')}>
              {/* Step-Nummer */}
              <div className={cn('shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-black mt-0.5', done ? 'bg-matcha-500 text-white' : isCurrent ? 'bg-matcha-600 text-white' : 'bg-muted text-muted-foreground')}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('font-bold text-sm truncate', isCurrent ? 'text-matcha-800' : 'text-foreground')}>
                    {stop.order?.kunde_name ?? 'Kunde'}
                  </span>
                  {isCurrent && <span className="rounded-full bg-matcha-600 text-white text-[9px] font-bold px-1.5 py-0.5">JETZT</span>}
                </div>
                {adresse && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                    <MapPin size={10} className="shrink-0" />
                    <span className="truncate">{adresse}</span>
                  </div>
                )}
                {done && stop.geliefert_am && (
                  <div className="flex items-center gap-1 text-[10px] text-matcha-600 mt-0.5">
                    <CheckCircle2 size={10} />
                    Geliefert {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* ETA / Navi */}
              <div className="shrink-0 flex flex-col items-end gap-1">
                {eta && !done && (
                  <span className={cn('text-[10px] font-bold flex items-center gap-0.5', isCurrent ? 'text-matcha-700' : 'text-muted-foreground')}>
                    <Clock size={9} /> {eta}
                  </span>
                )}
                {isCurrent && adresse && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(adresse)}`} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-matcha-600 text-white text-[10px] font-bold px-2 py-1 flex items-center gap-0.5">
                    <Navigation size={10} />
                    Navi
                  </a>
                )}
                {!isCurrent && !done && <ChevronRight size={14} className="text-muted-foreground" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-matcha-50 border-t border-matcha-200">
        <div className="text-[10px] text-matcha-700 font-bold">
          {pct}% der Tour abgeschlossen · {gesamt - erledigt} Stopp{gesamt - erledigt !== 1 ? 's' : ''} ausstehend
        </div>
      </div>
    </div>
  );
}
