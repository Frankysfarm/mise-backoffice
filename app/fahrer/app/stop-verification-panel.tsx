'use client';

import { useState, useTransition } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  CheckCircle2, XCircle, Phone, MapPin, Navigation, Package,
  MessageSquare, Loader2, AlertTriangle, ChevronRight,
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
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

interface Props {
  stop: Stop;
  stopIndex: number;
  totalStops: number;
  onDelivered: (stopId: string) => Promise<void>;
  onFailedAttempt: (stopId: string, reason: string) => Promise<void>;
}

const FAIL_REASONS = [
  { id: 'not_home', label: 'Nicht zuhause' },
  { id: 'wrong_address', label: 'Falsche Adresse' },
  { id: 'refused', label: 'Abgelehnt' },
  { id: 'other', label: 'Sonstiges' },
];

export function FahrerStopVerificationPanel({ stop, stopIndex, totalStops, onDelivered, onFailedAttempt }: Props) {
  const [pending, startTransition] = useTransition();
  const [showFail, setShowFail] = useState(false);
  const [failReason, setFailReason] = useState('not_home');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const o = stop.order;
  const hasGps = o.kunde_lat != null && o.kunde_lng != null;

  const navUrl = hasGps
    ? `https://maps.google.com/?q=${o.kunde_lat},${o.kunde_lng}`
    : o.kunde_adresse
    ? `https://maps.google.com/?q=${encodeURIComponent(`${o.kunde_adresse}, ${o.kunde_plz ?? ''}`)}` : null;

  function handleDelivered() {
    startTransition(async () => {
      setError(null);
      try {
        await onDelivered(stop.id);
        setDone(true);
      } catch (e) {
        setError('Fehler beim Speichern. Bitte erneut versuchen.');
      }
    });
  }

  function handleFailed() {
    startTransition(async () => {
      setError(null);
      try {
        await onFailedAttempt(stop.id, failReason);
        setDone(true);
      } catch (e) {
        setError('Fehler beim Speichern. Bitte erneut versuchen.');
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-matcha-500/40 bg-matcha-800/60 px-4 py-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-matcha-300 shrink-0" />
        <div>
          <div className="font-bold text-white text-sm">Stopp {stopIndex + 1} abgeschlossen</div>
          <div className="text-[11px] text-matcha-400 mt-0.5">Weiter zum nächsten Stopp</div>
        </div>
        <ChevronRight className="h-5 w-5 text-matcha-400 ml-auto" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-matcha-600/50 bg-matcha-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-700/50 bg-matcha-800/60">
        <Package className="h-4 w-4 text-accent shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest text-matcha-300">
          Stopp {stopIndex + 1}/{totalStops} · Lieferung bestätigen
        </span>
        <span className="ml-auto font-mono text-[10px] text-matcha-400 font-bold">
          #{o.bestellnummer.slice(-4)}
        </span>
      </div>

      {/* Customer info */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-matcha-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm">{o.kunde_name}</div>
            {o.kunde_adresse && (
              <div className="text-[11px] text-matcha-300 mt-0.5">
                {o.kunde_adresse}{o.kunde_plz ? `, ${o.kunde_plz}` : ''}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-black text-accent">{euro(o.gesamtbetrag)}</div>
          </div>
        </div>

        {o.kunde_lieferhinweis && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-300">{o.kunde_lieferhinweis}</span>
          </div>
        )}

        {o.kunde_notiz && (
          <div className="flex items-start gap-2 rounded-xl bg-matcha-800/60 border border-matcha-700/40 px-3 py-2">
            <MessageSquare className="h-3.5 w-3.5 text-matcha-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-matcha-300">{o.kunde_notiz}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {!showFail ? (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Quick nav row */}
          <div className="flex gap-2 mb-1">
            {navUrl && (
              <a
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-matcha-600/50 bg-matcha-800/60 py-2.5 text-[11px] font-bold text-matcha-200 active:scale-95 transition-transform"
              >
                <Navigation className="h-3.5 w-3.5" />
                Navigation
              </a>
            )}
            {o.kunde_telefon && (
              <a
                href={`tel:${o.kunde_telefon}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-matcha-600/50 bg-matcha-800/60 py-2.5 text-[11px] font-bold text-matcha-200 active:scale-95 transition-transform"
              >
                <Phone className="h-3.5 w-3.5" />
                Anrufen
              </a>
            )}
          </div>

          {/* Delivered */}
          <button
            onClick={handleDelivered}
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-matcha-500 py-3.5 text-sm font-black text-matcha-900 active:scale-95 transition-transform disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Zugestellt ✓
          </button>

          {/* Failed */}
          <button
            onClick={() => setShowFail(true)}
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-2.5 text-[12px] font-bold text-red-300 active:scale-95 transition-transform disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Zustellung fehlgeschlagen
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-400 mb-1">Grund auswählen:</div>
          <div className="grid grid-cols-2 gap-2">
            {FAIL_REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setFailReason(r.id)}
                className={cn(
                  'rounded-xl border py-2.5 text-[11px] font-bold transition-all active:scale-95',
                  failReason === r.id
                    ? 'border-red-500/60 bg-red-500/20 text-red-200'
                    : 'border-matcha-700/40 bg-matcha-800/50 text-matcha-300',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setShowFail(false)}
              className="flex-1 rounded-2xl border border-matcha-600/40 bg-matcha-800/50 py-2.5 text-[11px] font-bold text-matcha-300 active:scale-95 transition-transform"
            >
              Zurück
            </button>
            <button
              onClick={handleFailed}
              disabled={pending}
              className="flex-1 rounded-2xl bg-red-600 py-2.5 text-[11px] font-black text-white active:scale-95 transition-transform disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Bestätigen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
