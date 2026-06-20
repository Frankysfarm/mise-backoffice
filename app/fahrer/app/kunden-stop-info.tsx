'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, MapPin, MessageSquare, Phone, ShoppingBag, Euro, Key, Navigation2 } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order?: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_notiz: string | null;
    kunde_lieferhinweis: string | null;
    kunde_telefon: string | null;
    gesamtbetrag: number;
    bezahlt: boolean;
    zahlungsart: string;
    kunde_lat: number | null;
    kunde_lng: number | null;
  } | null;
}

interface Props {
  stops: Stop[];
  currentStopId?: string | null;
}

function navUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `https://maps.google.com/?daddr=${lat},${lng}`;
  }
  if (address) return `https://maps.google.com/?daddr=${encodeURIComponent(address)}`;
  return 'https://maps.google.com/';
}

function StopCard({ stop, isCurrent }: { stop: Stop; isCurrent: boolean }) {
  const [open, setOpen] = useState(isCurrent);
  const order = stop.order;
  if (!order) return null;

  const isDone = Boolean(stop.geliefert_am);
  const hasCash = !order.bezahlt && order.zahlungsart === 'bar';
  const hasCard = !order.bezahlt && order.zahlungsart === 'karte';
  const hasNote = Boolean(order.kunde_notiz?.trim() || order.kunde_lieferhinweis?.trim());

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      isCurrent && !isDone ? 'border-matcha-500/60 bg-matcha-950/30' : 'border-white/10 bg-white/5',
      isDone && 'opacity-50',
    )}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
          isDone ? 'bg-matcha-700 text-matcha-100' : isCurrent ? 'bg-matcha-500 text-white' : 'bg-white/10 text-white/60',
        )}>
          {isDone ? '✓' : stop.reihenfolge}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white/90 truncate">{order.kunde_name}</div>
          <div className="text-[10px] text-white/50 truncate">
            {order.kunde_adresse} {order.kunde_plz && `· ${order.kunde_plz}`}
          </div>
        </div>
        {hasCash && (
          <span className="shrink-0 rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
            CASH {Number(order.gesamtbetrag).toFixed(2)}€
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-white/30 shrink-0" /> : <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />}
      </button>

      {open && !isDone && (
        <div className="border-t border-white/8 px-3 py-3 space-y-3">
          {/* Adresse + Navigation */}
          <a
            href={navUrl(order.kunde_lat, order.kunde_lng, order.kunde_adresse)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-matcha-600 hover:bg-matcha-500 transition px-3 py-2.5"
          >
            <Navigation2 className="h-4 w-4 text-white" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{order.kunde_adresse}</div>
              {order.kunde_plz && <div className="text-[10px] text-matcha-100/70">{order.kunde_plz}</div>}
            </div>
          </a>

          {/* Kundennotiz */}
          {order.kunde_notiz && (
            <div className="flex gap-2 rounded-lg bg-blue-950/30 border border-blue-800/30 px-3 py-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-blue-400/70 mb-0.5">Kundennotiz</div>
                <div className="text-xs text-white/80">{order.kunde_notiz}</div>
              </div>
            </div>
          )}

          {/* Lieferhinweis (Zugang, Klingel etc.) */}
          {order.kunde_lieferhinweis && (
            <div className="flex gap-2 rounded-lg bg-purple-950/30 border border-purple-800/30 px-3 py-2">
              <Key className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-purple-400/70 mb-0.5">Zugang / Hinweis</div>
                <div className="text-xs text-white/80 font-medium">{order.kunde_lieferhinweis}</div>
              </div>
            </div>
          )}

          {/* Zahlung */}
          {(hasCash || hasCard) && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2',
              hasCash ? 'bg-amber-950/30 border-amber-700/40' : 'bg-slate-900/50 border-slate-700/40',
            )}>
              <Euro className={cn('h-3.5 w-3.5 shrink-0', hasCash ? 'text-amber-400' : 'text-slate-400')} />
              <div className="flex-1">
                <div className={cn('text-[9px] font-bold uppercase tracking-wider mb-0.5', hasCash ? 'text-amber-400/70' : 'text-slate-400/70')}>
                  {hasCash ? 'Bar kassieren' : 'Kartenleser'}
                </div>
                <div className="text-sm font-black text-white">{Number(order.gesamtbetrag).toFixed(2)} €</div>
              </div>
            </div>
          )}
          {order.bezahlt && (
            <div className="flex items-center gap-2 text-[10px] text-matcha-400">
              <span className="font-bold">✓ Bereits bezahlt</span>
              <span className="text-white/30">({order.zahlungsart})</span>
            </div>
          )}

          {/* Telefon */}
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition"
            >
              <Phone className="h-3.5 w-3.5 text-white/50" />
              <span className="text-xs text-white/70">{order.kunde_telefon}</span>
            </a>
          )}

          {/* Bestellnummer */}
          <div className="flex items-center gap-1.5 text-[9px] text-white/25">
            <ShoppingBag className="h-3 w-3" />
            <span>{order.bestellnummer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function KundenStopInfo({ stops, currentStopId }: Props) {
  const activeStops = stops.filter((s) => s.order != null).sort((a, b) => a.reihenfolge - b.reihenfolge);

  if (activeStops.length === 0) return null;

  const currentIdx = currentStopId ? activeStops.findIndex((s) => s.id === currentStopId) : activeStops.findIndex((s) => !s.geliefert_am);
  const nextStop = activeStops.find((s) => !s.geliefert_am);
  const deliveredCount = activeStops.filter((s) => s.geliefert_am).length;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-400" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-white/90">Tour-Stops</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40">{deliveredCount}/{activeStops.length} geliefert</span>
          {activeStops.length > 0 && (
            <div className="flex gap-0.5">
              {activeStops.map((s, i) => (
                <div key={s.id} className={cn(
                  'h-1.5 rounded-full transition-all',
                  i < deliveredCount ? 'bg-matcha-500 w-4' :
                  i === currentIdx ? 'bg-white w-4' :
                  'bg-white/20 w-2',
                )} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {activeStops.map((stop, i) => (
          <StopCard
            key={stop.id}
            stop={stop}
            isCurrent={!stop.geliefert_am && i === currentIdx}
          />
        ))}
      </div>
    </div>
  );
}
