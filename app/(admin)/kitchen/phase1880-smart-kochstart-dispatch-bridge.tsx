'use client';

/**
 * Phase 1880 — Smart Kochstart-Dispatch-Bridge
 *
 * Verbindet Küche mit Dispatch: Zeigt für jede aktive Bestellung
 * wann der Fahrer ankommt (Pickup-ETA), wie lange die Zubereitung
 * noch dauert und ob JETZT der Kochstart-Zeitpunkt ist.
 *
 * Farbkodierung:
 *   grün   → Fahrer kommt rechtzeitig (>5 Min Puffer)
 *   gelb   → Knapp (1–5 Min Puffer)
 *   rot    → Fahrer kommt vor Fertigstellung (Kochstart zu spät!)
 *   blau   → Bestellung fertig, wartet auf Fahrer
 */

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, Clock, AlertTriangle, CheckCircle2, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  bestellt_am?: string | null;
  fertig_am?: string | null;
  zubereitung_start?: string | null;
  started_at?: string | null;
  estimated_prep_min?: number | null;
  fahrer_pickup_eta?: string | null;
  pickup_eta_min?: number | null;
  delivery_zone?: string | null;
}

interface Props {
  orders: Order[];
  defaultPrepMin?: number;
  className?: string;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'fertig' | 'unbekannt';

interface Row {
  id: string;
  nr: string;
  zone: string | null;
  status: string;
  restPrepMin: number | null;
  pickupIn: number | null;
  puffer: number | null;
  ampel: Ampel;
}

const AMPEL_STYLE: Record<Ampel, { ring: string; badge: string; text: string; bg: string; label: string }> = {
  gruen:    { ring: 'ring-matcha-400',  badge: 'bg-matcha-500 text-white',    text: 'text-matcha-700',  bg: 'bg-matcha-50 dark:bg-matcha-950/20',  label: 'Pünktlich' },
  gelb:     { ring: 'ring-amber-400',   badge: 'bg-amber-400 text-white',     text: 'text-amber-700',   bg: 'bg-amber-50 dark:bg-amber-950/20',    label: 'Knapp' },
  rot:      { ring: 'ring-red-400',     badge: 'bg-red-500 text-white',       text: 'text-red-700',     bg: 'bg-red-50 dark:bg-red-950/20',        label: 'Zu spät!' },
  fertig:   { ring: 'ring-blue-400',    badge: 'bg-blue-500 text-white',      text: 'text-blue-700',    bg: 'bg-blue-50 dark:bg-blue-950/20',      label: 'Wartet' },
  unbekannt:{ ring: 'ring-border',      badge: 'bg-muted text-muted-foreground', text: 'text-muted-foreground', bg: 'bg-muted/20', label: '—' },
};

const ACTIVE_STATUS = ['pending', 'confirmed', 'preparing'];

export function KitchenPhase1880SmartKochstartDispatchBridge({ orders, defaultPrepMin = 15, className }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const active = orders.filter((o) => ACTIVE_STATUS.includes(o.status ?? '') || o.status === 'ready');

    return active.map((o): Row => {
      const nr = o.bestellnummer ? `#${o.bestellnummer}` : `…${o.id.slice(-4)}`;
      const zone = o.delivery_zone ?? null;
      const status = o.status ?? '';

      // Wie lange bleibt die Zubereitung noch?
      let restPrepMin: number | null = null;
      if (status === 'ready') {
        restPrepMin = 0;
      } else if (status === 'preparing' || status === 'confirmed') {
        const startMs = o.zubereitung_start ?? o.started_at
          ? new Date((o.zubereitung_start ?? o.started_at)!).getTime()
          : null;
        const prepMin = o.estimated_prep_min ?? defaultPrepMin;
        if (startMs) {
          const vergangen = (now - startMs) / 60_000;
          restPrepMin = Math.max(0, prepMin - vergangen);
        } else {
          restPrepMin = prepMin;
        }
      } else if (status === 'pending') {
        restPrepMin = (o.estimated_prep_min ?? defaultPrepMin) + 2; // +2 Min für Bestätigung
      }

      // Wann kommt Fahrer?
      let pickupIn: number | null = null;
      if (o.fahrer_pickup_eta) {
        pickupIn = Math.max(0, (new Date(o.fahrer_pickup_eta).getTime() - now) / 60_000);
      } else if (o.pickup_eta_min != null) {
        pickupIn = o.pickup_eta_min;
      }

      // Puffer (positiv = Fahrer kommt nach Fertigstellung)
      const puffer = pickupIn != null && restPrepMin != null ? pickupIn - restPrepMin : null;

      // Ampel bestimmen
      let ampel: Ampel = 'unbekannt';
      if (status === 'ready') {
        ampel = 'fertig';
      } else if (puffer === null) {
        ampel = 'unbekannt';
      } else if (puffer < 0) {
        ampel = 'rot';
      } else if (puffer < 5) {
        ampel = 'gelb';
      } else {
        ampel = 'gruen';
      }

      return { id: o.id, nr, zone, status, restPrepMin, pickupIn, puffer, ampel };
    }).sort((a, b) => {
      const order: Ampel[] = ['rot', 'gelb', 'fertig', 'gruen', 'unbekannt'];
      return order.indexOf(a.ampel) - order.indexOf(b.ampel);
    });
  }, [orders, now, defaultPrepMin]);

  const kritisch = rows.filter((r) => r.ampel === 'rot').length;
  const knapp = rows.filter((r) => r.ampel === 'gelb').length;

  if (rows.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Kochstart · Dispatch-Bridge</span>
        <span className="ml-1 text-[10px] text-muted-foreground">{rows.length} aktiv</span>
        {kritisch > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {kritisch} zu spät!
          </span>
        )}
        {knapp > 0 && kritisch === 0 && (
          <span className="ml-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            {knapp} knapp
          </span>
        )}
        {open
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {rows.map((row) => {
            const s = AMPEL_STYLE[row.ampel];
            return (
              <div key={row.id} className={cn('px-4 py-3 flex items-center gap-3', s.bg)}>
                {/* Ampel-Ring */}
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2', s.ring)}>
                  {row.status === 'ready'
                    ? <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    : row.ampel === 'rot'
                      ? <AlertTriangle className="h-4 w-4 text-red-500" />
                      : <ChefHat className="h-4 w-4 text-matcha-600" />}
                </div>

                {/* Bestellnummer + Zone */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold tabular-nums">{row.nr}</span>
                    {row.zone && (
                      <span className="text-[9px] rounded-full border bg-background px-1.5 py-0.5 font-bold">
                        Zone {row.zone}
                      </span>
                    )}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', s.badge)}>
                      {s.label}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-[10px]">
                    {/* Prep-Rest */}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ChefHat className="h-3 w-3" />
                      {row.restPrepMin !== null
                        ? row.restPrepMin === 0
                          ? <span className="font-bold text-blue-600">Fertig</span>
                          : <span className={cn('font-bold tabular-nums', s.text)}>{Math.ceil(row.restPrepMin)} Min</span>
                        : '—'}
                    </span>

                    {/* Fahrer ETA */}
                    {row.pickupIn !== null && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Bike className="h-3 w-3" />
                        <span className="font-bold tabular-nums text-foreground">{Math.ceil(row.pickupIn)} Min</span>
                      </span>
                    )}

                    {/* Puffer */}
                    {row.puffer !== null && row.status !== 'ready' && (
                      <span className={cn('flex items-center gap-1 font-bold tabular-nums', s.text)}>
                        <Clock className="h-3 w-3" />
                        {row.puffer >= 0 ? `+${Math.round(row.puffer)} Min Puffer` : `${Math.abs(Math.round(row.puffer))} Min zu früh`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-4 py-2 bg-muted/20">
            <p className="text-[9px] text-muted-foreground">
              grün = pünktlich · gelb = knapp · rot = Fahrer vor Fertigstellung · blau = fertig, wartet · aktualisiert alle 15s
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
