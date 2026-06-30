'use client';

/**
 * Phase 518 (Fahrer 503) — StoppDetailsKommando
 *
 * Ultra-fokussierte Karte für den aktuellen Stopp:
 * - Adresse mit One-Tap Navigation (Google/Apple/Waze)
 * - Kundenkontakt (Telefon, Notizen)
 * - Zahlungsart + Betrag
 * - Countdown bis ETA
 * - Checklisten-Buttons: Angekommen / Geliefert
 */

import { useEffect, useState } from 'react';
import {
  Navigation, Phone, MapPin, Clock, Euro,
  CheckCircle2, ChevronDown, ChevronUp, MessageSquare,
  CreditCard, Banknote, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_stadt: string | null;
    kunde_telefon: string | null;
    kunde_notiz: string | null;
    kunde_lieferhinweis: string | null;
    gesamtbetrag: number;
    zahlungsart: string;
    bezahlt: boolean;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
  distanz_zum_vorgaenger_m?: number | null;
}

interface Props {
  stops: Stop[];
  totalStops: number;
}

function fmtMin(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 0) return 'Jetzt';
  if (m === 0) return '<1 Min';
  return `${m} Min`;
}

function NavButton({ label, icon, href }: { label: string; icon: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-900 transition-colors"
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[9px] font-bold text-white uppercase tracking-wide">{label}</span>
    </a>
  );
}

export function FahrerPhase503StoppDetailsKommando({ stops, totalStops }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const [notizOpen, setNotizOpen] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const nextStop = stops.find(s => !s.geliefert_am);
  if (!nextStop || !nextStop.order) return null;

  const order = nextStop.order;
  const now = Date.now();

  // ETA countdown
  const etaMs = order.eta_earliest ? new Date(order.eta_earliest).getTime() : null;
  const etaMinsLeft = etaMs ? Math.floor((etaMs - now) / 60000) : null;
  const isLate = etaMinsLeft !== null && etaMinsLeft < 0;

  const completedStops = stops.filter(s => s.geliefert_am).length;
  const progress = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  // Build nav URLs
  const adressQuery = [order.kunde_adresse, order.kunde_plz, order.kunde_stadt]
    .filter(Boolean).join(', ');
  const googleUrl = `https://maps.google.com/?daddr=${encodeURIComponent(adressQuery)}`;
  const appleUrl = `http://maps.apple.com/?daddr=${encodeURIComponent(adressQuery)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(adressQuery)}&navigate=yes`;

  const isBarPayment = order.zahlungsart === 'bar' || order.zahlungsart === 'cash';
  const needsCashCollection = isBarPayment && !order.bezahlt;

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden shadow-sm',
      isLate ? 'border-2 border-red-400 bg-red-50' : 'border border-stone-200 bg-white',
    )}>
      {/* Header with progress */}
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between cursor-pointer',
          isLate ? 'bg-red-100' : 'bg-stone-800',
        )}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full font-black text-sm',
            isLate ? 'bg-red-200 text-red-700' : 'bg-white/10 text-white',
          )}>
            {nextStop.reihenfolge}
          </div>
          <div>
            <div className={cn('text-sm font-bold', isLate ? 'text-red-800' : 'text-white')}>
              Stopp {nextStop.reihenfolge} von {totalStops}
            </div>
            {etaMinsLeft !== null && (
              <div className={cn('text-xs font-semibold', isLate ? 'text-red-600' : 'text-white/70')}>
                {isLate ? `⚠️ ${Math.abs(etaMinsLeft)} Min überfällig` : `ETA in ${etaMinsLeft} Min`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className={cn('text-xs font-semibold', isLate ? 'text-red-700' : 'text-white/60')}>
              {completedStops}/{totalStops} erledigt
            </div>
          </div>
          {open ? <ChevronUp className={cn('h-4 w-4', isLate ? 'text-red-600' : 'text-white/60')} /> : <ChevronDown className={cn('h-4 w-4', isLate ? 'text-red-600' : 'text-white/60')} />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-stone-100">
        <div
          className={cn('h-full transition-all', isLate ? 'bg-red-400' : 'bg-matcha-500')}
          style={{ width: `${progress}%` }}
        />
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {/* Kundenname + Bestellnummer */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-stone-800">{order.kunde_name}</div>
              <div className="text-xs text-stone-400">Bestellung #{order.bestellnummer}</div>
            </div>
            <div className={cn(
              'text-lg font-black tabular-nums',
              needsCashCollection ? 'text-amber-600' : 'text-stone-700',
            )}>
              {euro(order.gesamtbetrag)}
            </div>
          </div>

          {/* Adresse */}
          {order.kunde_adresse && (
            <div className="flex items-start gap-2 rounded-xl bg-stone-50 p-3">
              <MapPin className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-stone-700">{order.kunde_adresse}</div>
                {(order.kunde_plz || order.kunde_stadt) && (
                  <div className="text-xs text-stone-500">
                    {[order.kunde_plz, order.kunde_stadt].filter(Boolean).join(' ')}
                  </div>
                )}
                {nextStop.distanz_zum_vorgaenger_m != null && nextStop.distanz_zum_vorgaenger_m > 0 && (
                  <div className="text-xs text-blue-500 mt-0.5">
                    ca. {nextStop.distanz_zum_vorgaenger_m < 1000
                      ? `${nextStop.distanz_zum_vorgaenger_m}m`
                      : `${(nextStop.distanz_zum_vorgaenger_m / 1000).toFixed(1)}km`} vom letzten Stopp
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-2">
            <NavButton label="Google" icon="🗺️" href={googleUrl} />
            <NavButton label="Apple" icon="🍎" href={appleUrl} />
            <NavButton label="Waze" icon="🚗" href={wazeUrl} />
          </div>

          {/* Zahlung */}
          <div className={cn(
            'flex items-center gap-2 rounded-xl p-3',
            needsCashCollection ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50',
          )}>
            {isBarPayment ? (
              <Banknote className={cn('h-4 w-4', needsCashCollection ? 'text-amber-600' : 'text-stone-400')} />
            ) : (
              <CreditCard className="h-4 w-4 text-stone-400" />
            )}
            <div>
              <div className={cn('text-sm font-semibold', needsCashCollection ? 'text-amber-700' : 'text-stone-600')}>
                {order.zahlungsart === 'bar' ? 'Barzahlung' :
                 order.zahlungsart === 'karte' ? 'Kartenzahlung' :
                 order.zahlungsart === 'online' ? 'Online bezahlt' :
                 order.zahlungsart ?? 'Zahlung'}
              </div>
              {needsCashCollection && (
                <div className="text-xs text-amber-600 font-medium">
                  ⚠️ {euro(order.gesamtbetrag)} in bar kassieren!
                </div>
              )}
              {order.bezahlt && (
                <div className="text-xs text-matcha-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Bereits bezahlt
                </div>
              )}
            </div>
          </div>

          {/* Telefon */}
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 hover:bg-blue-100 transition-colors"
            >
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">{order.kunde_telefon}</span>
            </a>
          )}

          {/* Notizen */}
          {(order.kunde_notiz || order.kunde_lieferhinweis) && (
            <div className="rounded-xl bg-amber-50 border border-amber-200">
              <button
                onClick={() => setNotizOpen(o => !o)}
                className="w-full flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700">Kundennotizen</span>
                </div>
                {notizOpen ? <ChevronUp className="h-3 w-3 text-amber-500" /> : <ChevronDown className="h-3 w-3 text-amber-500" />}
              </button>
              {notizOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {order.kunde_notiz && (
                    <div className="text-xs text-amber-700 bg-white/60 rounded-lg p-2">
                      <span className="font-semibold">Notiz: </span>{order.kunde_notiz}
                    </div>
                  )}
                  {order.kunde_lieferhinweis && (
                    <div className="text-xs text-amber-700 bg-white/60 rounded-lg p-2">
                      <span className="font-semibold">Lieferhinweis: </span>{order.kunde_lieferhinweis}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ETA Ring */}
          {etaMinsLeft !== null && (
            <div className={cn(
              'flex items-center gap-3 rounded-xl p-3',
              isLate ? 'bg-red-100' : 'bg-matcha-50',
            )}>
              <Clock className={cn('h-4 w-4', isLate ? 'text-red-600' : 'text-matcha-600')} />
              <div>
                <div className={cn('text-sm font-bold', isLate ? 'text-red-700' : 'text-matcha-700')}>
                  {isLate
                    ? `⚠️ ${Math.abs(etaMinsLeft)} Minuten überfällig`
                    : etaMinsLeft === 0 ? 'Jetzt ankommen'
                    : `In ${etaMinsLeft} Minuten ankommen`}
                </div>
                {order.eta_earliest && (
                  <div className="text-xs text-stone-400">
                    ETA: {new Date(order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lieferhinweis Banner */}
          {order.kunde_lieferhinweis && !notizOpen && (
            <div className="flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-200 p-3">
              <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700 font-medium">{order.kunde_lieferhinweis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
