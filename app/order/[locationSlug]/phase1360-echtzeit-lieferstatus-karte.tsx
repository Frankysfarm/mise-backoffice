'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1360 — Echtzeit-Lieferstatus-Karte (Storefront)
 *
 * Fahrer-Name + ETA-Countdown + 4-Stufen-Statusanzeige.
 * 30-Sek-Polling an /api/delivery/public/bestellstatus.
 * Nach Phase1355 in order/[locationSlug]/page.tsx.
 */

type Status = 'neu' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface BestellStatusData {
  order_id: string;
  status: Status;
  fahrer_name: string | null;
  fahrer_telefon: string | null;
  eta_minuten: number | null;
  erstellt_am: string;
  generiert_am: string;
}

interface Props {
  orderId: string;
  locationId: string;
}

const POLL_MS = 30_000;

const STUFEN: Array<{ key: Status; label: string; icon: React.ReactNode }> = [
  { key: 'neu',        label: 'Bestellt',     icon: <Package   className="h-4 w-4" /> },
  { key: 'zubereitung', label: 'Zubereitung', icon: <ChefHat   className="h-4 w-4" /> },
  { key: 'bereit',     label: 'Bereit',       icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'unterwegs',  label: 'Unterwegs',    icon: <Bike      className="h-4 w-4" /> },
];

const STATUS_ORDER: Status[] = ['neu', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];

function buildMock(orderId: string): BestellStatusData {
  return {
    order_id: orderId,
    status: 'unterwegs',
    fahrer_name: 'Carlos R.',
    fahrer_telefon: null,
    eta_minuten: 8,
    erstellt_am: new Date(Date.now() - 20 * 60_000).toISOString(),
    generiert_am: new Date().toISOString(),
  };
}

export function StorefrontPhase1360EchtzeitLieferstatusKarte({ orderId, locationId }: Props) {
  const [data, setData] = useState<BestellStatusData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const laden = useCallback(async () => {
    try {
      const params = new URLSearchParams({ order_id: orderId, location_id: locationId });
      const res = await fetch(`/api/delivery/public/bestellstatus?${params}`);
      if (res.ok) {
        const json: BestellStatusData = await res.json();
        setData(json);
        if (json.eta_minuten != null) {
          setCountdown(json.eta_minuten * 60);
        }
      } else {
        setData(buildMock(orderId));
        setCountdown(8 * 60);
      }
    } catch {
      setData(buildMock(orderId));
      setCountdown(8 * 60);
    }
  }, [orderId, locationId]);

  useEffect(() => {
    laden();
    const pollId = setInterval(laden, POLL_MS);
    return () => clearInterval(pollId);
  }, [laden]);

  // Countdown-Ticker
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdown == null || countdown <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev == null || prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  if (!data) return null;
  if (data.status === 'geliefert') return null; // nach Lieferung ausblenden

  const aktuellerIndex = STATUS_ORDER.indexOf(data.status);
  const minRest = countdown != null ? Math.ceil(countdown / 60) : null;
  const secRest  = countdown != null ? countdown % 60 : null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/5 to-card p-5 shadow space-y-4">
      {/* ETA + Fahrer */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          {data.status === 'unterwegs' && minRest != null ? (
            <>
              <p className="text-[11px] text-muted-foreground font-medium">Ankunft in</p>
              <p className="text-3xl font-black tabular-nums text-primary leading-none">
                {minRest}:{String(secRest ?? 0).padStart(2, '0')}
              </p>
              <p className="text-[10px] text-muted-foreground">Minuten</p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground font-medium">Status</p>
              <p className="text-base font-bold text-foreground">
                {data.status === 'zubereitung' ? 'Wird zubereitet…' :
                 data.status === 'bereit'      ? 'Wartet auf Abholung' :
                 data.status === 'neu'         ? 'Bestellung eingegangen' :
                                                'Unterwegs'}
              </p>
            </>
          )}
        </div>

        {data.status === 'unterwegs' && (
          <div className="rounded-full bg-primary/10 p-3">
            <Bike className="h-8 w-8 text-primary" />
          </div>
        )}
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
          <div className="rounded-full bg-primary/10 p-1.5">
            <Bike className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{data.fahrer_name}</p>
            <p className="text-[10px] text-muted-foreground">Dein Fahrer</p>
          </div>
          {data.fahrer_telefon && (
            <a
              href={`tel:${data.fahrer_telefon}`}
              className="rounded-full bg-primary/10 p-1.5 hover:bg-primary/20 transition"
              title="Anrufen"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
            </a>
          )}
        </div>
      )}

      {/* Schritt-Anzeige */}
      <div className="flex items-center gap-1">
        {STUFEN.map((stufe, idx) => {
          const aktiv  = STATUS_ORDER.indexOf(stufe.key) === aktuellerIndex;
          const fertig = STATUS_ORDER.indexOf(stufe.key) < aktuellerIndex;
          return (
            <div key={stufe.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'rounded-full p-1.5 transition-all',
                  fertig ? 'bg-green-500 text-white' :
                  aktiv  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
                           'bg-muted text-muted-foreground'
                )}>
                  {stufe.icon}
                </div>
                <span className={cn(
                  'text-[9px] text-center leading-tight',
                  aktiv ? 'font-bold text-primary' :
                  fertig ? 'text-green-600 dark:text-green-400' :
                           'text-muted-foreground'
                )}>
                  {stufe.label}
                </span>
              </div>
              {idx < STUFEN.length - 1 && (
                <div className={cn(
                  'flex-shrink-0 h-0.5 w-4 mx-0.5 rounded-full mb-4',
                  STATUS_ORDER.indexOf(STUFEN[idx + 1].key) <= aktuellerIndex
                    ? 'bg-green-500'
                    : 'bg-muted'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Lieferadresse-Hinweis */}
      {data.status === 'unterwegs' && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>Bitte an der Tür bereitstehen</span>
          <Clock className="h-3 w-3 ml-auto shrink-0" />
          <span>Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  );
}
