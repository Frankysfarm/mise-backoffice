'use client';

/**
 * Phase 500 — Nächster Stopp Navigator
 *
 * Zeigt alle Informationen zum nächsten Liefer-Stopp in einer
 * übersichtlichen Karte:
 * - Kundenname & vollständige Adresse
 * - ETA (Ankunftszeit)
 * - Bestellpositionen (Kurzliste)
 * - One-Tap Navigation zu Google Maps / Apple Maps / Waze
 * - Countdown-Uhr bis zur geplanten Ankunft
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, MapPin, Clock, Package, ChevronRight,
  Phone, CheckCircle2, AlertTriangle,
} from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string | null;
    kunde_adresse: string | null;
    kunde_telefon?: string | null;
    eta_latest: string | null;
    items?: { name: string; menge: number }[];
  } | null;
}

interface Props {
  stops: Stop[];
  className?: string;
}

function useCountdown(targetIso: string | null) {
  const [secLeft, setSecLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) { setSecLeft(null); return; }
    const update = () => setSecLeft(Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetIso]);
  return secLeft;
}

function NavButton({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition active:scale-95',
        color,
      )}
    >
      <Navigation className="w-3.5 h-3.5" />
      {label}
    </a>
  );
}

function buildNavLinks(address: string) {
  const q = encodeURIComponent(address);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`,
    apple:  `https://maps.apple.com/?daddr=${q}&dirflg=d`,
    waze:   `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

export function FahrerPhase500NaechsterStoppNav({ stops, className }: Props) {
  const secLeft = useCountdown(
    stops.find(s => !s.geliefert_am)?.order?.eta_latest ?? null,
  );

  const pending = stops.filter(s => !s.geliefert_am);
  const done    = stops.filter(s => !!s.geliefert_am);

  if (pending.length === 0) {
    return (
      <div className={cn('rounded-xl border border-matcha-200 bg-matcha-50 p-4 flex items-center gap-3', className)}>
        <CheckCircle2 className="w-8 h-8 text-matcha-600 shrink-0" />
        <div>
          <div className="font-black text-matcha-800 text-sm">Alle Stopps erledigt!</div>
          <div className="text-xs text-matcha-600">Tour abgeschlossen · {done.length} Lieferungen</div>
        </div>
      </div>
    );
  }

  const nextStop = pending[0];
  const order = nextStop.order;
  if (!order) return null;

  const address = order.kunde_adresse ?? '';
  const navLinks = address ? buildNavLinks(address) : null;

  const absLeft = secLeft !== null ? Math.abs(secLeft) : null;
  const mLeft   = absLeft !== null ? Math.floor(absLeft / 60) : null;
  const sLeft   = absLeft !== null ? absLeft % 60 : null;
  const isLate  = secLeft !== null && secLeft < 0;
  const isClose = secLeft !== null && secLeft >= 0 && secLeft < 300;

  return (
    <div className={cn('rounded-xl border overflow-hidden shadow-sm', isLate ? 'border-red-300' : isClose ? 'border-amber-300' : 'border-stone-200', className)}>
      {/* Header strip */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 text-white',
        isLate ? 'bg-red-500' : isClose ? 'bg-amber-400' : 'bg-matcha-600',
      )}>
        <div className="flex items-center gap-1.5">
          <Navigation className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-wide">
            Nächster Stopp · {nextStop.reihenfolge} / {stops.length}
          </span>
        </div>
        {secLeft !== null && mLeft !== null && sLeft !== null && (
          <div className="flex items-center gap-1 text-xs font-mono font-black">
            {isLate ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {isLate ? '-' : ''}{mLeft}:{String(sLeft).padStart(2, '0')}
          </div>
        )}
      </div>

      <div className="p-3 space-y-2.5 bg-white">
        {/* Customer info */}
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-black text-sm text-stone-800 leading-tight">
              {order.kunde_name ?? 'Kunde'}
            </div>
            {address && (
              <div className="text-xs text-stone-500 mt-0.5 leading-snug">{address}</div>
            )}
          </div>
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Bestellnummer */}
        <div className="flex items-center gap-1.5 text-xs text-stone-500">
          <Package className="w-3.5 h-3.5" />
          <span className="font-bold">#{order.bestellnummer}</span>
          {order.items && order.items.length > 0 && (
            <span className="text-stone-400">·</span>
          )}
          {order.items && order.items.slice(0, 3).map((item, i) => (
            <span key={i} className="truncate">{item.menge}× {item.name}</span>
          ))}
          {order.items && order.items.length > 3 && (
            <span className="text-stone-400">+{order.items.length - 3}</span>
          )}
        </div>

        {/* Navigation buttons */}
        {navLinks && (
          <div className="grid grid-cols-3 gap-1.5">
            <NavButton href={navLinks.google} label="Google" color="bg-blue-600 hover:bg-blue-700" />
            <NavButton href={navLinks.apple}  label="Apple"  color="bg-stone-700 hover:bg-stone-800" />
            <NavButton href={navLinks.waze}   label="Waze"   color="bg-sky-500 hover:bg-sky-600" />
          </div>
        )}

        {/* Upcoming stops preview */}
        {pending.length > 1 && (
          <div className="border-t border-stone-100 pt-2">
            <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1.5">
              Noch {pending.length - 1} Stopp{pending.length - 1 !== 1 ? 's' : ''} danach
            </div>
            <div className="space-y-1">
              {pending.slice(1, 3).map(s => (
                <div key={s.id} className="flex items-center gap-1.5 text-[10px] text-stone-500">
                  <ChevronRight className="w-3 h-3 shrink-0 text-stone-300" />
                  <span className="font-bold text-stone-600">#{s.order?.bestellnummer}</span>
                  <span className="truncate">{s.order?.kunde_adresse?.split(',')[0]}</span>
                </div>
              ))}
              {pending.length > 3 && (
                <div className="text-[9px] text-stone-400 pl-4">… und {pending.length - 3} weitere</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-stone-100">
        <div
          className="h-full bg-matcha-400 transition-all duration-1000"
          style={{ width: `${Math.round((done.length / stops.length) * 100)}%` }}
        />
      </div>
    </div>
  );
}
