'use client';

/**
 * StopNavCard — Prominente Next-Stop Navigationskarte für die Fahrer-App.
 *
 * Zeigt den nächsten ausstehenden Stop groß und klar:
 * - Adresse + Kundenname
 * - ETA-Countdown (mit Farbkodierung)
 * - Betrag + Zahlungsart
 * - Ein-Klick Navigation (Google / Apple Maps)
 * - Abgeliefert-Button
 *
 * Wird gerendert wenn Fahrer "unterwegs" ist und noch offene Stops hat.
 */

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  AlertTriangle, Banknote, CheckCircle2, ChevronDown, ChevronUp,
  Clock, CreditCard, MapPin, Navigation, Phone,
} from 'lucide-react';
import { StopCheckliste } from './stop-checkliste';

type Order = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  zahlungsart?: string | null;
  bezahlt?: boolean | null;
  eta_earliest?: string | null;
  eta_latest?: string | null;
  kunde_notiz?: string | null;
  kunde_lieferhinweis?: string | null;
  kunde_telefon?: string | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: Order;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function mapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    return `https://maps.google.com/maps?daddr=${lat},${lng}`;
  }
  if (address) return `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
  return '#';
}

function EtaCountdown({ earliest, latest }: { earliest?: string | null; latest?: string | null }) {
  useTick();

  const now = Date.now();
  const latestMs = latest ? new Date(latest).getTime() : null;
  const earliestMs = earliest ? new Date(earliest).getTime() : null;

  if (!latestMs && !earliestMs) return null;

  const targetMs = latestMs ?? earliestMs!;
  const secToLatest = Math.floor((targetMs - now) / 1000);

  if (secToLatest < -600) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl bg-red-900/30 border border-red-500/50 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
        <div>
          <div className="text-xs font-black text-red-300 animate-pulse">ÜBERFÄLLIG</div>
          <div className="text-[10px] text-red-400 font-bold">
            {Math.abs(Math.ceil(secToLatest / 60))} Min verspätet
          </div>
        </div>
      </div>
    );
  }

  if (secToLatest < 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl bg-orange-900/30 border border-orange-500/50 px-3 py-2 animate-pulse">
        <Clock className="h-4 w-4 text-orange-400 shrink-0" />
        <div>
          <div className="text-xs font-black text-orange-300">SOFORT LIEFERN</div>
          <div className="text-[10px] text-orange-400">Lieferfenster überschritten</div>
        </div>
      </div>
    );
  }

  const mm = Math.floor(secToLatest / 60);
  const ss = secToLatest % 60;
  const isUrgent = secToLatest < 300;
  const isTight = secToLatest < 600;

  // Progress through window
  const windowSec = earliestMs && latestMs ? (latestMs - earliestMs) / 1000 : null;
  const progressSec = earliestMs ? Math.max(0, (now - earliestMs) / 1000) : null;
  const progressPct = windowSec && progressSec != null
    ? Math.min(100, (progressSec / windowSec) * 100)
    : null;

  return (
    <div className={cn(
      'rounded-xl border px-3 py-2 space-y-1.5',
      isUrgent ? 'bg-orange-900/30 border-orange-500/50' :
      isTight ? 'bg-amber-900/20 border-amber-500/40' :
      'bg-matcha-900/20 border-matcha-500/40',
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className={cn('h-4 w-4 shrink-0', isUrgent ? 'text-orange-400 animate-pulse' : isTight ? 'text-amber-400' : 'text-matcha-400')} />
          <div>
            <div className={cn(
              'font-mono text-xl font-black tabular-nums leading-none',
              isUrgent ? 'text-orange-300' : isTight ? 'text-amber-300' : 'text-matcha-300',
            )}>
              {mm}:{String(ss).padStart(2, '0')}
            </div>
            <div className="text-[9px] text-white/50 font-bold uppercase tracking-wide">
              {isUrgent ? 'Dringend!' : 'bis Lieferfenster'}
            </div>
          </div>
        </div>
        {earliestMs && latestMs && (
          <div className="text-right">
            <div className="text-[10px] text-white/60 font-bold">
              {new Date(earliestMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              –
              {new Date(latestMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-[9px] text-white/40">Lieferfenster</div>
          </div>
        )}
      </div>
      {progressPct != null && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000',
              progressPct > 80 ? 'bg-orange-400' : progressPct > 60 ? 'bg-amber-400' : 'bg-matcha-400',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function StopNavCard({
  stops,
  onDelivered,
}: {
  stops: Stop[];
  onDelivered?: (stopId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const pending = stops
    .filter(s => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  const nextStop = pending[0];
  if (!nextStop) return null;

  const { order } = nextStop;
  const navUrl = mapsUrl(order.kunde_lat, order.kunde_lng, [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', '));
  const needsCash = order.zahlungsart === 'bar' && !order.bezahlt;
  const needsCard = order.zahlungsart === 'karte' && !order.bezahlt;

  const completed = stops.filter(s => s.geliefert_am).length;
  const total = stops.length;

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-700 overflow-hidden shadow-strong">
      {/* Progress bar */}
      <div className="h-1 bg-zinc-800">
        <div
          className="h-full bg-matcha-500 transition-all duration-500"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-matcha-400 shrink-0" />
            <span className="text-xs font-black text-white/60 uppercase tracking-wider">
              Stop {completed + 1} von {total}
            </span>
          </div>
          <span className="text-[10px] font-bold text-white/40 bg-zinc-800 rounded-full px-2 py-0.5">
            {order.bestellnummer}
          </span>
        </div>

        {/* Kundenname */}
        <div>
          <div className="text-xl font-black text-white leading-tight">{order.kunde_name}</div>
          <div className="text-sm text-white/70 font-medium mt-0.5">
            {order.kunde_adresse}
            {order.kunde_plz && <span className="text-white/50">, {order.kunde_plz}</span>}
          </div>
        </div>

        {/* ETA */}
        <EtaCountdown earliest={order.eta_earliest} latest={order.eta_latest} />

        {/* Betrag */}
        <div className="flex items-center justify-between gap-3">
          <div className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 flex-1',
            needsCash ? 'bg-amber-900/40 border border-amber-500/50' :
            needsCard ? 'bg-blue-900/30 border border-blue-500/40' :
            'bg-matcha-900/20 border border-matcha-500/30',
          )}>
            {needsCash
              ? <Banknote className="h-5 w-5 text-amber-400 shrink-0" />
              : needsCard
              ? <CreditCard className="h-5 w-5 text-blue-400 shrink-0" />
              : <CheckCircle2 className="h-5 w-5 text-matcha-400 shrink-0" />}
            <div>
              <div className={cn(
                'text-xl font-black tabular-nums',
                needsCash ? 'text-amber-300' : needsCard ? 'text-blue-300' : 'text-matcha-300',
              )}>
                {euro(order.gesamtbetrag)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-white/40">
                {needsCash ? 'Bar kassieren' : needsCard ? 'Karte' : 'Bereits bezahlt'}
              </div>
            </div>
          </div>

          {/* Telefon */}
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center justify-center h-12 w-12 rounded-xl bg-zinc-800 border border-zinc-700 text-white/60 hover:bg-zinc-700 hover:text-white transition shrink-0"
              aria-label="Kunden anrufen"
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
        </div>

        {/* Navigation Button */}
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-matcha-600 hover:bg-matcha-500 active:bg-matcha-700 text-white py-3.5 font-black text-base transition touch-manipulation"
        >
          <Navigation className="h-5 w-5 shrink-0" />
          Navigieren
        </a>

        {/* Liefer-Checkliste: Pflichtschritte vor der Abgabe */}
        <StopCheckliste
          stop={{
            kunde_name: order.kunde_name,
            zahlungsart: order.zahlungsart ?? null,
            bezahlt: order.bezahlt ?? null,
            gesamtbetrag: order.gesamtbetrag,
            kunde_notiz: order.kunde_notiz,
            kunde_lieferhinweis: order.kunde_lieferhinweis,
          }}
        />

        {/* Abgeliefert Button */}
        {onDelivered && (
          <button
            onClick={() => onDelivered(nextStop.id)}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white/80 py-2.5 font-bold text-sm transition touch-manipulation"
          >
            <CheckCircle2 className="h-4 w-4 text-matcha-400 shrink-0" />
            Abgeliefert
          </button>
        )}

        {/* Notizen (aufklappbar) */}
        {(order.kunde_notiz || order.kunde_lieferhinweis) && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-[10px] text-white/50 hover:text-white/70 transition w-full"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Notizen ausblenden' : 'Notizen anzeigen'}
          </button>
        )}
        {expanded && (
          <div className="rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 space-y-1.5">
            {order.kunde_notiz && (
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-white/40 mb-0.5">Kundennotiz</div>
                <p className="text-sm text-white/80">{order.kunde_notiz}</p>
              </div>
            )}
            {order.kunde_lieferhinweis && (
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-white/40 mb-0.5">Lieferhinweis</div>
                <p className="text-sm text-white/80">{order.kunde_lieferhinweis}</p>
              </div>
            )}
          </div>
        )}

        {/* Weitere Stops Vorschau */}
        {pending.length > 1 && (
          <div className="border-t border-zinc-800 pt-2 space-y-1.5">
            <div className="text-[9px] font-black uppercase tracking-wider text-white/30">
              Nächste Stops
            </div>
            {pending.slice(1, 3).map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-[10px] text-white/50">
                <span className="h-4 w-4 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px] font-black text-white/60 shrink-0">
                  {completed + 1 + i + 1}
                </span>
                <span className="truncate font-semibold">{s.order.kunde_name}</span>
                <span className="text-white/30 truncate">{s.order.kunde_adresse}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
