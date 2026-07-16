'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  AlertTriangle, Banknote, CheckCircle2, Clock, MapPin, MessageSquare,
  Navigation, Phone, Route, Timer, Zap,
} from 'lucide-react';

type TourStop = {
  id: string;
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

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function navUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    const isIos = /iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
    if (isIos) return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    return `https://maps.google.com/maps?daddr=${lat},${lng}&travelmode=bicycling`;
  }
  if (address) return `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
  return '#';
}

function EtaRing({ iso, size = 'sm' }: { iso: string; size?: 'sm' | 'lg' }) {
  useTick();
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  const isOverdue = secs < -60;
  const isUrgent = secs >= 0 && secs < 300;
  const isClose = secs >= 300 && secs < 600;

  const mm = Math.floor(Math.abs(secs) / 60);
  const ss = Math.abs(secs) % 60;
  const label = isOverdue
    ? `${mm}m überfällig`
    : secs < 0 ? 'Jetzt!' : `${mm}:${String(ss).padStart(2, '0')}`;

  const className = cn(
    'font-mono font-black tabular-nums',
    size === 'lg' ? 'text-2xl' : 'text-sm',
    isOverdue ? 'text-red-400 animate-pulse' : isUrgent ? 'text-orange-400 animate-pulse' : isClose ? 'text-amber-400' : 'text-accent',
  );

  return <span className={className}>{label}</span>;
}

function StopChip({ stop, index, isPending }: { stop: TourStop; index: number; isPending: boolean }) {
  const o = stop.order;
  const done = !!stop.geliefert_am;
  const needsPay = !o.bezahlt && (o.zahlungsart === 'bar' || o.zahlungsart === 'ec');

  return (
    <div className={cn(
      'flex items-center gap-3 py-2.5 px-3 rounded-xl border transition-all',
      done ? 'opacity-50 bg-matcha-900/10 border-white/5' : isPending ? 'bg-accent/8 border-accent/30' : 'bg-white/5 border-white/10',
    )}>
      <div className={cn(
        'h-8 w-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0',
        done ? 'bg-matcha-700 text-matcha-300' : isPending ? 'bg-accent text-matcha-900' : 'bg-white/10 text-matcha-300',
      )}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold truncate', done ? 'text-matcha-500 line-through' : 'text-matcha-100')}>
          {o.kunde_name}
        </div>
        <div className="text-[9px] text-matcha-500 truncate">
          {o.kunde_adresse}{o.kunde_plz ? `, ${o.kunde_plz}` : ''}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {needsPay && !done && (
          <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
            <Banknote className="h-2.5 w-2.5" />{euro(o.gesamtbetrag)}
          </span>
        )}
        {o.eta_earliest && !done && <EtaRing iso={o.eta_earliest} size="sm" />}
        {done && stop.geliefert_am && (
          <span className="text-[9px] text-matcha-500">
            {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {!done && (
          <a
            href={navUrl(o.kunde_lat, o.kunde_lng, [o.kunde_adresse, o.kunde_plz].filter(Boolean).join(', '))}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="h-7 w-7 rounded-lg bg-accent/20 text-accent flex items-center justify-center active:scale-95 transition"
            aria-label="Navigation"
          >
            <Navigation className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function FahrerPhase1820SmartTourStopHub({
  stops,
  batchStartedAt,
}: {
  stops: TourStop[];
  batchStartedAt?: string | null;
}) {
  useTick();
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const done = sorted.filter(s => !!s.geliefert_am).length;
  const total = sorted.length;
  const nextIdx = sorted.findIndex(s => !s.geliefert_am);
  const allDone = done === total;
  const elapsed = batchStartedAt
    ? Math.floor((Date.now() - new Date(batchStartedAt).getTime()) / 60_000)
    : null;

  if (total === 0) return null;

  const next = nextIdx >= 0 ? sorted[nextIdx] : null;

  return (
    <div className="space-y-3">
      {/* Header + progress */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-1.5">
          <Route className="h-4 w-4 text-accent" />
          <span className="text-xs font-black uppercase tracking-wider text-accent">
            Tour · {total} {total === 1 ? 'Stopp' : 'Stopps'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-matcha-500">
          {elapsed !== null && elapsed >= 0 && (
            <span className="flex items-center gap-0.5">
              <Timer className="h-2.5 w-2.5" />{elapsed} min
            </span>
          )}
          <span className="font-bold text-accent">{done}/{total}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
        />
      </div>

      {/* Next stop focus card */}
      {next && !allDone && (() => {
        const o = next.order;
        const needsPay = !o.bezahlt && (o.zahlungsart === 'bar' || o.zahlungsart === 'ec');
        const url = navUrl(o.kunde_lat, o.kunde_lng, [o.kunde_adresse, o.kunde_plz].filter(Boolean).join(', '));
        return (
          <div className="rounded-2xl border-2 border-accent/50 bg-accent/6 p-4 space-y-3">
            {/* Label */}
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-accent">
              <Zap className="h-3 w-3" /> Nächster Stopp
            </div>

            {/* Main info */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-matcha-900 font-black text-sm shrink-0">
                {nextIdx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-matcha-50 text-sm truncate">{o.kunde_name}</div>
                <div className="flex items-center gap-1 text-[10px] text-matcha-400 mt-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{o.kunde_adresse}{o.kunde_plz ? `, ${o.kunde_plz}` : ''}</span>
                </div>
              </div>
              {o.eta_earliest && (
                <div className="shrink-0 text-right">
                  <EtaRing iso={o.eta_earliest} size="lg" />
                  <div className="text-[8px] text-matcha-500 mt-0.5 text-right">ETA</div>
                </div>
              )}
            </div>

            {/* Notes */}
            {(o.kunde_notiz || o.kunde_lieferhinweis) && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-400/20 px-3 py-2">
                <div className="flex items-start gap-1.5">
                  <MessageSquare className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-amber-200 space-y-0.5">
                    {o.kunde_notiz && <div>{o.kunde_notiz}</div>}
                    {o.kunde_lieferhinweis && <div className="opacity-70">{o.kunde_lieferhinweis}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Payment */}
            {needsPay && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-400/30 px-3 py-2">
                <Banknote className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold text-amber-300">
                  {o.zahlungsart === 'bar'
                    ? `${euro(o.gesamtbetrag)} Barzahlung kassieren`
                    : 'EC-Karte kassieren'}
                </span>
              </div>
            )}

            {/* CTA row */}
            <div className="flex gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-accent text-matcha-900 font-black text-sm active:scale-[0.98] transition"
              >
                <Navigation className="h-4 w-4" />
                Navigieren
              </a>
              {o.kunde_telefon && (
                <a
                  href={`tel:${o.kunde_telefon}`}
                  className="flex items-center justify-center h-10 w-12 rounded-xl bg-white/10 border border-white/10 text-matcha-200 active:scale-[0.97] transition"
                  aria-label="Anrufen"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        );
      })()}

      {/* All stops list (compact) */}
      <div className="space-y-1.5">
        {sorted.map((stop, i) => (
          <StopChip
            key={stop.id}
            stop={stop}
            index={i}
            isPending={i === nextIdx}
          />
        ))}
      </div>

      {/* Done banner */}
      {allDone && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-accent shrink-0" />
          <div>
            <div className="font-bold text-accent text-sm">Alle {total} Stopps abgeschlossen!</div>
            {elapsed !== null && <div className="text-[10px] text-matcha-500">in {elapsed} Minuten</div>}
          </div>
        </div>
      )}
    </div>
  );
}
