'use client';

import { useMemo } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation, Package, Phone, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1172 — Tour-Stopp-Navi-Hub (Fahrer-App)
// Kompakter Hub: aktueller + nächste Stopps + Schnell-Navi (Google/Waze) + ETA

interface Stop {
  id: string;
  reihenfolge?: number;
  geliefert_am?: string | null;
  order?: {
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_telefon?: string | null;
    eta_latest?: string | null;
    gesamtbetrag?: number;
    bezahlt?: boolean;
  } | null;
}

interface Props {
  activeBatch: { id: string; stops: Stop[] } | null;
}

function eta(stop: Stop): { min: number; label: string } | null {
  if (!stop.order?.eta_latest) return null;
  const diff = Math.round((new Date(stop.order.eta_latest).getTime() - Date.now()) / 60_000);
  return { min: diff, label: new Date(stop.order.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) };
}

function addr(stop: Stop): string {
  return [stop.order?.kunde_adresse, stop.order?.kunde_plz].filter(Boolean).join(', ');
}

export function FahrerPhase1172TourStoppNaviHub({ activeBatch }: Props) {
  const { pending, erledigt, gesamt } = useMemo(() => {
    const stops = activeBatch?.stops ?? [];
    const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
    const erledigt = sorted.filter(s => !!s.geliefert_am).length;
    return { pending: sorted.filter(s => !s.geliefert_am).slice(0, 3), erledigt, gesamt: sorted.length };
  }, [activeBatch]);

  if (!activeBatch || pending.length === 0) return null;

  const aktuell = pending[0];
  const naechste = pending.slice(1);
  const etaAktuell = eta(aktuell);
  const urgent = etaAktuell && etaAktuell.min < 5;
  const overdue = etaAktuell && etaAktuell.min < 0;
  const addrAktuell = addr(aktuell);

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden">
      {/* Aktueller Stopp */}
      <div className={cn('p-4 space-y-2', overdue ? 'bg-red-50' : urgent ? 'bg-amber-50' : 'bg-matcha-50')}>
        <div className="flex items-center gap-2">
          <Package size={14} className={overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-matcha-600'} />
          <span className={cn('text-[10px] font-black uppercase tracking-widest', overdue ? 'text-red-700' : urgent ? 'text-amber-700' : 'text-matcha-700')}>
            Jetzt liefern — Stopp {erledigt + 1}/{gesamt}
          </span>
          {etaAktuell && (
            <span className={cn('ml-auto rounded-full text-white text-[10px] font-black px-2 py-0.5', overdue ? 'bg-red-600 animate-pulse' : urgent ? 'bg-amber-500' : 'bg-matcha-600')}>
              {overdue ? `+${Math.abs(etaAktuell.min)} Min` : `${etaAktuell.min} Min`}
            </span>
          )}
        </div>

        <div className="font-bold text-base">{aktuell.order?.kunde_name ?? 'Kunde'}</div>

        {addrAktuell && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{addrAktuell}</span>
          </div>
        )}

        {/* Zahlungsinfo */}
        {aktuell.order?.gesamtbetrag != null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold">{aktuell.order.gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            <span className={cn('rounded-full text-[10px] font-bold px-1.5 py-0.5', aktuell.order.bezahlt ? 'bg-matcha-100 text-matcha-700' : 'bg-amber-100 text-amber-700')}>
              {aktuell.order.bezahlt ? 'Bezahlt' : 'Barzahlung'}
            </span>
          </div>
        )}

        {/* CTA-Buttons */}
        <div className="flex gap-2 pt-1">
          {addrAktuell && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(addrAktuell)}`} target="_blank" rel="noopener noreferrer"
              className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-sm text-white', overdue ? 'bg-red-600' : 'bg-matcha-600')}>
              <Navigation size={15} /> Google Maps
            </a>
          )}
          {addrAktuell && (
            <a href={`waze://?q=${encodeURIComponent(addrAktuell)}&navigate=yes`}
              className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 font-bold text-sm bg-blue-600 text-white">
              <Star size={13} /> Waze
            </a>
          )}
          {aktuell.order?.kunde_telefon && (
            <a href={`tel:${aktuell.order.kunde_telefon}`}
              className="flex items-center justify-center rounded-xl px-3 py-2.5 bg-white border border-muted">
              <Phone size={15} className="text-muted-foreground" />
            </a>
          )}
        </div>
      </div>

      {/* Nächste Stopps */}
      {naechste.length > 0 && (
        <div className="divide-y divide-muted border-t">
          {naechste.map((stop, i) => {
            const e = eta(stop);
            const a = addr(stop);
            return (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0">
                  {erledigt + i + 2}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{stop.order?.kunde_name ?? 'Kunde'}</div>
                  {a && <div className="text-[10px] text-muted-foreground truncate">{a}</div>}
                </div>
                {e && <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5"><Clock size={9} /> {e.label}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Fertig-Banner */}
      {pending.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-matcha-50">
          <CheckCircle2 size={16} className="text-matcha-600" />
          <span className="font-bold text-sm text-matcha-700">Alle Stopps erledigt!</span>
        </div>
      )}
    </div>
  );
}
