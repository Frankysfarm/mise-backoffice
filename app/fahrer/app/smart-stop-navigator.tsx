'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Navigation, Phone, Clock, CreditCard, Banknote, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    kunde_notiz?: string | null;
    kunde_telefon?: string | null;
  };
};

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
  totalEtaMin: number | null;
}

function openMaps(lat: number | null, lng: number | null, address: string | null) {
  if (lat && lng) {
    const isIos = /iP(hone|od|ad)/.test(navigator.userAgent);
    const url = isIos
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  } else if (address) {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }
}

function etaLabel(batchStartedAt: string | null, totalEtaMin: number | null, stopIdx: number, totalStops: number): string {
  if (!batchStartedAt || !totalEtaMin) return '–';
  const perStop = totalEtaMin / Math.max(totalStops, 1);
  const remaining = perStop * (stopIdx + 1);
  const arrivalMs = new Date(batchStartedAt).getTime() + remaining * 60_000;
  const arr = new Date(arrivalMs);
  return arr.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function SmartStopNavigator({ stops, batchStartedAt, totalEtaMin }: Props) {
  const [showPrev, setShowPrev] = useState(false);

  if (!stops.length) return null;

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextStop = sorted.find((s) => s.geliefert_am === null);
  const doneStops = sorted.filter((s) => s.geliefert_am !== null);

  if (!nextStop) return null;

  const { order } = nextStop;
  const isCash = order.zahlungsart === 'bar' || order.zahlungsart === 'cash';
  const isPaid = order.bezahlt === true;

  return (
    <div className="space-y-3 px-4">
      {/* Next stop card */}
      <div className="rounded-2xl bg-matcha-800 border border-matcha-600/40 overflow-hidden">
        {/* Header */}
        <div className="bg-accent/15 border-b border-accent/20 px-4 py-2.5 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent shrink-0" />
          <span className="text-xs font-black uppercase tracking-widest text-accent">
            Nächster Stop — #{nextStop.reihenfolge}
          </span>
        </div>

        {/* Main info */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <div className="font-display font-black text-xl text-white leading-tight">
              {order.kunde_name}
            </div>
            <div className="text-sm text-matcha-200 mt-0.5 leading-snug">
              {order.kunde_adresse ?? '–'}
              {order.kunde_plz && `, ${order.kunde_plz}`}
            </div>
          </div>

          {/* ETA */}
          <div className="flex items-center gap-1.5 text-matcha-300 text-sm">
            <Clock className="h-3.5 w-3.5" />
            <span>Ankunft ca. {etaLabel(batchStartedAt, totalEtaMin, sorted.indexOf(nextStop), sorted.length)} Uhr</span>
          </div>

          {/* Payment */}
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
              isCash && !isPaid ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
            )}>
              {isCash && !isPaid ? <Banknote className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
              {isCash && !isPaid
                ? `Bar — ${order.gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} kassieren`
                : `Bezahlt — ${order.gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
            </div>
          </div>

          {/* Customer note */}
          {order.kunde_notiz && (
            <div className="flex items-start gap-2 rounded-xl bg-matcha-700/50 border border-matcha-600/30 px-3 py-2.5">
              <MessageSquare className="h-3.5 w-3.5 text-matcha-300 shrink-0 mt-0.5" />
              <span className="text-xs text-matcha-200 leading-relaxed">{order.kunde_notiz}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => openMaps(order.kunde_lat ?? null, order.kunde_lng ?? null, order.kunde_adresse ?? null)}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-accent text-matcha-900 font-display font-black py-3.5 text-base active:scale-[0.98] transition-transform"
            >
              <Navigation className="h-5 w-5" />
              Navigation starten
            </button>
            {order.kunde_telefon && (
              <a
                href={`tel:${order.kunde_telefon}`}
                className="flex items-center justify-center rounded-2xl bg-matcha-700 border border-matcha-600/40 px-4 active:scale-[0.98] transition-transform"
              >
                <Phone className="h-5 w-5 text-matcha-200" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Previous stops collapsed list */}
      {doneStops.length > 0 && (
        <div className="rounded-2xl bg-matcha-800/60 border border-matcha-600/30 overflow-hidden">
          <button
            onClick={() => setShowPrev((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
          >
            <span className="text-xs font-bold text-matcha-300 flex-1">
              {doneStops.length} Stop{doneStops.length !== 1 ? 's'  : ''} abgeschlossen
            </span>
            {showPrev ? (
              <ChevronUp className="h-4 w-4 text-matcha-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-matcha-400" />
            )}
          </button>
          {showPrev && (
            <div className="px-4 pb-3 space-y-1.5 border-t border-matcha-700/50 pt-2">
              {doneStops.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-emerald-400">{s.reihenfolge}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-matcha-300 truncate">{s.order.kunde_name}</span>
                    {s.order.kunde_adresse && (
                      <span className="text-[10px] text-matcha-500 block truncate">{s.order.kunde_adresse}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold shrink-0">Geliefert</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
