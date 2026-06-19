'use client';

import { useEffect, useState } from 'react';
import {
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  Banknote,
  CreditCard,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Props {
  stop: {
    id: string;
    reihenfolge: number;
    order: {
      bestellnummer: string;
      kunde_name: string;
      kunde_adresse: string | null;
      kunde_plz: string | null;
      kunde_telefon: string | null;
      gesamtbetrag: number;
      zahlungsart: string | null;
      bezahlt: boolean | null;
      kunde_notiz: string | null;
      kunde_lieferhinweis: string | null;
    };
    geliefert_am: string | null;
    angekommen_am: string | null;
  } | null;
  onMarkDelivered?: (stopId: string) => void;
  onMarkArrived?: (stopId: string) => void;
  pending?: boolean;
}

function useSecTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  return t;
}

function Stopwatch({ since }: { since: string }) {
  useSecTick();
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="tabular-nums">
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function mapsUrl(adresse: string | null, plz: string | null): string {
  const query = [adresse, plz].filter(Boolean).join(', ');
  if (!query) return '#';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=bicycling`;
}

function timeDE(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function TourStoppAktionen({ stop, onMarkDelivered, onMarkArrived, pending }: Props) {
  if (!stop) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-white/40 text-sm">
        Kein aktiver Stopp
      </div>
    );
  }

  const { order } = stop;
  const isDelivered = stop.geliefert_am != null;
  const hasArrived = stop.angekommen_am != null;
  const needsCash = order.zahlungsart === 'bar' && !order.bezahlt;
  const isPaid = order.bezahlt === true;
  const navHref = mapsUrl(order.kunde_adresse, order.kunde_plz);
  const fullAddress = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ') || 'Keine Adresse';

  /* ── Delivered state ─────────────────────────────────────────────── */
  if (isDelivered) {
    return (
      <div className="rounded-2xl border border-matcha-600/40 bg-matcha-900/60 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={36} className="text-matcha-400 shrink-0" />
          <div>
            <div className="text-matcha-300 font-black text-lg leading-tight">Geliefert</div>
            <div className="text-white/50 text-sm">{timeDE(stop.geliefert_am!)}</div>
          </div>
        </div>
        <div className="text-white/70 text-sm font-semibold">{order.kunde_name}</div>
        <div className="text-white/40 text-xs flex items-center gap-1">
          <MapPin size={11} />
          {fullAddress}
        </div>
      </div>
    );
  }

  /* ── Active stop ─────────────────────────────────────────────────── */
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">

      {/* Header strip: stop number + name */}
      <div className="bg-matcha-900/80 px-5 pt-5 pb-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-matcha-600 text-white text-xs font-black shrink-0">
            {stop.reihenfolge}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-matcha-400">
            #{order.bestellnummer}
          </span>
        </div>
        <div className="text-white font-black text-2xl leading-tight">{order.kunde_name}</div>
        <div className="flex items-center gap-1.5 text-white/50 text-sm">
          <MapPin size={13} className="shrink-0 text-matcha-400" />
          <span className="leading-snug">{fullAddress}</span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Amount + payment */}
        <div className="flex items-center justify-between">
          <div className="text-white/50 text-sm">Betrag</div>
          <div className="flex items-center gap-2">
            {needsCash && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 text-red-300 px-3 py-1 text-sm font-black">
                <Banknote size={14} />
                BAR {euro(order.gesamtbetrag)}
              </span>
            )}
            {isPaid && (
              <span className="inline-flex items-center gap-1 rounded-full bg-matcha-600/30 text-matcha-300 px-3 py-1 text-sm font-black">
                <CreditCard size={14} />
                BEZAHLT
              </span>
            )}
            {!needsCash && !isPaid && (
              <span className="text-white font-black text-lg">{euro(order.gesamtbetrag)}</span>
            )}
          </div>
        </div>

        {/* Stopwatch (time since arrival) */}
        {hasArrived && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-900/30 border border-blue-500/20 px-4 py-2.5">
            <Clock size={16} className="text-blue-300 shrink-0" />
            <span className="text-blue-200 text-sm font-semibold">Vor Ort seit</span>
            <span className="ml-auto text-blue-100 font-black text-base">
              <Stopwatch since={stop.angekommen_am!} />
            </span>
          </div>
        )}

        {/* Customer note */}
        {order.kunde_notiz && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-400/20 px-4 py-3">
            <MessageSquare size={15} className="text-amber-300 mt-0.5 shrink-0" />
            <div>
              <div className="text-amber-200 text-[10px] font-black uppercase tracking-wider mb-0.5">Kundennotiz</div>
              <div className="text-amber-100 text-sm leading-snug">{order.kunde_notiz}</div>
            </div>
          </div>
        )}

        {/* Delivery hint */}
        {order.kunde_lieferhinweis && (
          <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-400/20 px-4 py-3">
            <AlertTriangle size={15} className="text-blue-300 mt-0.5 shrink-0" />
            <div>
              <div className="text-blue-200 text-[10px] font-black uppercase tracking-wider mb-0.5">Lieferhinweis</div>
              <div className="text-blue-100 text-sm leading-snug">{order.kunde_lieferhinweis}</div>
            </div>
          </div>
        )}

        {/* Nav + Phone row */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={navHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/10 text-white font-bold text-sm py-4 active:opacity-70 transition"
          >
            <Navigation size={18} />
            Navigation
          </a>
          {order.kunde_telefon ? (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/10 text-white font-bold text-sm py-4 active:opacity-70 transition"
            >
              <Phone size={18} />
              Anrufen
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] text-white/20 font-bold text-sm py-4">
              <Phone size={18} />
              Kein Tel.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-1">
          {/* ANGEKOMMEN button — only if not yet arrived */}
          {!hasArrived && (
            <button
              disabled={pending}
              onClick={() => onMarkArrived?.(stop.id)}
              className={cn(
                'w-full flex items-center justify-center gap-3 rounded-2xl py-5 font-black text-xl tracking-wide transition active:scale-95',
                pending
                  ? 'bg-blue-700/50 text-blue-200/50 cursor-not-allowed'
                  : 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 active:opacity-80',
              )}
            >
              <MapPin size={24} />
              ANGEKOMMEN
            </button>
          )}

          {/* GELIEFERT button */}
          <button
            disabled={pending}
            onClick={() => onMarkDelivered?.(stop.id)}
            className={cn(
              'w-full flex items-center justify-center gap-3 rounded-2xl py-5 font-black text-xl tracking-wide transition active:scale-95',
              pending
                ? 'bg-matcha-700/50 text-matcha-200/50 cursor-not-allowed'
                : 'bg-matcha-600 text-white shadow-lg shadow-matcha-900/40 active:opacity-80',
            )}
          >
            <CheckCircle2 size={24} />
            GELIEFERT
          </button>
        </div>

      </div>
    </div>
  );
}
