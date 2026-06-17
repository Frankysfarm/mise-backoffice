'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  MapPin, Phone, Navigation, Clock, Banknote, CreditCard,
  CheckCircle2, AlertTriangle, MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react';

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
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
};

interface Props {
  stops: Stop[];
  driverLat?: number | null;
  driverLng?: number | null;
}

function secsLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function navUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
    return isIos
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return '#';
}

function EtaPill({ iso, overdue = false }: { iso: string; overdue?: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  const isOver = s < 0;
  const m = Math.floor(Math.abs(s) / 60);
  const ss = Math.abs(s) % 60;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black tabular-nums',
      isOver ? 'bg-red-500/20 text-red-400 animate-pulse' : s < 300 ? 'bg-orange-500/20 text-orange-300' : 'bg-accent/20 text-accent',
    )}>
      <Clock size={10} />
      {isOver ? `−${m}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`}
    </span>
  );
}

export function StopSchnellPanel({ stops, driverLat, driverLng }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextStop = sorted.find((s) => s.geliefert_am == null);
  const doneStops = sorted.filter((s) => s.geliefert_am != null);
  const pendingStops = sorted.filter((s) => s.geliefert_am == null);

  if (sorted.length === 0) return null;

  function renderStop(stop: Stop, isNext: boolean) {
    const { order } = stop;
    const done = stop.geliefert_am != null;
    const isOpen = expanded === stop.id;
    const etaSecs = secsLeft(order.eta_latest);
    const isOverdue = etaSecs != null && etaSecs < 0;
    const needsCash = order.zahlungsart === 'bar' && !order.bezahlt;

    return (
      <div
        key={stop.id}
        className={cn(
          'rounded-xl border transition-all',
          done ? 'border-matcha-700/30 bg-matcha-950/20 opacity-60' :
          isNext ? 'border-accent/50 bg-accent/5' :
          'border-white/10 bg-white/5',
        )}
      >
        {/* Main row */}
        <button
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
          onClick={() => setExpanded(isOpen ? null : stop.id)}
        >
          {/* Stop indicator */}
          <div className={cn(
            'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black',
            done ? 'bg-matcha-600 text-white' :
            isNext ? 'bg-accent text-black' :
            'bg-white/10 text-white/60',
          )}>
            {done ? <CheckCircle2 size={16} /> : stop.reihenfolge}
          </div>

          {/* Name + address */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('font-bold text-sm', done ? 'text-white/50 line-through' : 'text-white')}>
                {order.kunde_name}
              </span>
              {needsCash && !done && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[9px] font-black">
                  <Banknote size={8} />
                  Bar
                </span>
              )}
              {isNext && !done && (
                <span className="rounded-full bg-accent text-black px-1.5 py-0.5 text-[9px] font-black">
                  Nächster
                </span>
              )}
            </div>
            <div className="text-[11px] text-white/50 truncate mt-0.5">
              {order.kunde_adresse ?? 'Keine Adresse'}{order.kunde_plz ? `, ${order.kunde_plz}` : ''}
            </div>
          </div>

          {/* ETA / done */}
          <div className="shrink-0 flex items-center gap-1.5">
            {!done && order.eta_latest && <EtaPill iso={order.eta_latest} />}
            {done && <CheckCircle2 size={16} className="text-matcha-400" />}
            {isOpen ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
          </div>
        </button>

        {/* Expanded: contact + nav buttons */}
        {isOpen && !done && (
          <div className="border-t border-white/10 px-4 py-3 space-y-3">
            {/* Betrag */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Betrag</span>
              <span className="font-bold text-white">{euro(order.gesamtbetrag)}</span>
            </div>

            {/* Notizen */}
            {(order.kunde_notiz || order.kunde_lieferhinweis) && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-300 space-y-0.5">
                {order.kunde_notiz && <div>Notiz: {order.kunde_notiz}</div>}
                {order.kunde_lieferhinweis && <div>Hinweis: {order.kunde_lieferhinweis}</div>}
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={navUrl(order.kunde_lat, order.kunde_lng, order.kunde_adresse)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-accent text-black font-bold text-sm py-3 active:opacity-80 transition"
              >
                <Navigation size={16} />
                Navigation
              </a>
              {order.kunde_telefon ? (
                <a
                  href={`tel:${order.kunde_telefon}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-white font-bold text-sm py-3 active:opacity-80 transition"
                >
                  <Phone size={16} />
                  Anrufen
                </a>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-white/30 font-bold text-sm py-3">
                  <Phone size={16} />
                  Kein Tel.
                </div>
              )}
            </div>

            {/* Distance hint */}
            {stop.distanz_zum_vorgaenger_m != null && (
              <div className="text-[10px] text-white/40 flex items-center gap-1">
                <MapPin size={9} />
                {stop.distanz_zum_vorgaenger_m < 1000
                  ? `${stop.distanz_zum_vorgaenger_m}m zum letzten Stopp`
                  : `${(stop.distanz_zum_vorgaenger_m / 1000).toFixed(1)} km zum letzten Stopp`}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <MapPin size={13} className="text-accent shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
          Tour-Stopps
        </span>
        <span className="ml-auto text-[10px] text-white/40 tabular-nums">
          {doneStops.length}/{sorted.length} geliefert
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${sorted.length > 0 ? (doneStops.length / sorted.length) * 100 : 0}%` }}
        />
      </div>

      {/* Stops */}
      <div className="space-y-2">
        {sorted.map((stop) => renderStop(stop, stop.id === nextStop?.id))}
      </div>
    </div>
  );
}
