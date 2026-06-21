'use client';

import { cn, euro } from '@/lib/utils';
import { MapPin, Phone, MessageSquare, CheckCircle2, Navigation } from 'lucide-react';

interface StopOrder {
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_telefon: string | null;
  gesamtbetrag: number;
  bezahlt: boolean;
  zahlungsart: string;
  kunde_notiz: string | null;
}

interface Stop {
  reihenfolge: number;
  order: StopOrder | null;
}

interface Props {
  stop: Stop;
  totalStops: number;
  onNavigate?: (address: string) => void;
  onComplete?: () => void;
}

function buildAddress(order: StopOrder): string {
  const parts = [order.kunde_adresse, order.kunde_plz].filter(Boolean);
  return parts.join(', ');
}

export function FahrerAktuellerStoppCard({ stop, totalStops, onNavigate, onComplete }: Props) {
  const order = stop.order;
  const address = order ? buildAddress(order) : null;

  const handleNavigate = () => {
    if (!address) return;
    if (onNavigate) {
      onNavigate(address);
    } else {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 bg-[#5c7a4e] text-white">
        <p className="text-xs font-medium uppercase tracking-widest opacity-80">Aktueller Stopp</p>
        <h2 className="text-3xl font-bold mt-1">
          Stop {stop.reihenfolge} <span className="text-xl opacity-70">von {totalStops}</span>
        </h2>
      </div>

      {!order ? (
        <div className="p-5 text-center text-stone-400 text-sm">Keine Bestelldaten verfügbar</div>
      ) : (
        <div className="p-5 space-y-4">
          {/* Customer info */}
          <div>
            <p className="text-lg font-semibold text-stone-800">{order.kunde_name}</p>
            <p className="text-xs text-stone-400 mt-0.5">#{order.bestellnummer}</p>
            {address && (
              <div className="flex items-start gap-2 mt-2">
                <MapPin className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-stone-600">{address}</p>
              </div>
            )}
          </div>

          {/* Payment status */}
          {order.bezahlt ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-700">Bereits bezahlt</span>
              <span className="ml-auto text-xs text-emerald-500">{order.zahlungsart}</span>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-300">
              <p className="text-sm font-bold text-red-700 uppercase tracking-wide">
                KASSIERPFLICHTIG: {euro(order.gesamtbetrag)}
              </p>
              <p className="text-xs text-red-500 mt-0.5">Zahlungsart: {order.zahlungsart}</p>
            </div>
          )}

          {/* Customer note */}
          {order.kunde_notiz && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <MessageSquare className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">{order.kunde_notiz}</p>
            </div>
          )}

          {/* Phone */}
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 hover:bg-stone-100 transition-colors"
            >
              <Phone className="w-4 h-4 text-stone-500" />
              <span className="text-sm text-stone-700">{order.kunde_telefon}</span>
            </a>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {address && (
              <button
                onClick={handleNavigate}
                className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600 active:scale-95 transition-all"
              >
                <Navigation className="w-4 h-4" />
                Navigieren
              </button>
            )}
            <button
              onClick={onComplete}
              className={cn(
                'flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-sm',
                'bg-[#5c7a4e] text-white hover:bg-[#4a6640] active:scale-95 transition-all',
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              Lieferung bestätigen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
