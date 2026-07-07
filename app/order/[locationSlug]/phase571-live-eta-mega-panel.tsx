'use client';

/**
 * Phase 571 — Storefront: Live-ETA-Mega-Panel
 *
 * Dynamisches ETA-Display für Kunden-Storefront.
 * Zeigt aktuelle Lieferzeit mit visueller Phasen-Anzeige:
 *   1. Bestellung aufgegeben
 *   2. In Zubereitung (Küchenphase)
 *   3. Fahrer unterwegs
 *   4. Zugestellt
 *
 * Holt Live-ETA via /api/delivery/eta/live (GET mit location_id).
 * Fallback auf statische Schätzung bei API-Fehler.
 * Auto-Refresh alle 60s.
 *
 * Keine Props erforderlich — locationId via locationSlug aus URL.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';

interface EtaData {
  eta_min: number;
  load: string;
  active_orders: number;
  drivers_online: number;
}

const PHASES = [
  { key: 'ordered',   icon: Package,      label: 'Bestellt',        desc: 'Bestellung eingegangen' },
  { key: 'kitchen',   icon: ChefHat,      label: 'Wird zubereitet', desc: 'Küche arbeitet' },
  { key: 'delivery',  icon: Truck,        label: 'Fahrer unterwegs',desc: 'Wird ausgeliefert' },
  { key: 'delivered', icon: CheckCircle2, label: 'Zugestellt',       desc: 'Genießen Sie Ihr Essen!' },
] as const;

type PhaseKey = typeof PHASES[number]['key'];

function getLoadColor(load: string): string {
  if (load === 'high' || load === 'sehr_hoch') return 'text-red-600';
  if (load === 'medium' || load === 'hoch') return 'text-amber-600';
  return 'text-matcha-600';
}

function getLoadLabel(load: string): string {
  if (load === 'high' || load === 'sehr_hoch') return 'Viel los';
  if (load === 'medium' || load === 'hoch') return 'Mittel';
  return 'Entspannt';
}

interface Props {
  locationId?: string | null;
  orderStatus?: string | null;
  orderedAt?: string | null;
}

export function Storefront571LiveEtaMegaPanel({ locationId, orderStatus, orderedAt }: Props) {
  const [eta, setEta] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!res.ok) throw new Error('ETA API error');
        const data = await res.json();
        if (data?.eta_min != null) {
          setEta({
            eta_min: data.eta_min,
            load: data.load ?? 'quiet',
            active_orders: data.active_orders ?? 0,
            drivers_online: data.drivers_online ?? 0,
          });
          setLastUpdated(new Date());
        }
      } catch {
        // Fallback: standard 30 min
        setEta({ eta_min: 30, load: 'quiet', active_orders: 0, drivers_online: 0 });
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  // Determine current phase
  const currentPhase = (() => {
    if (!orderStatus) return null;
    if (orderStatus === 'geliefert' || orderStatus === 'abgeholt' || orderStatus === 'abgeschlossen') return 'delivered';
    if (orderStatus === 'unterwegs') return 'delivery';
    if (orderStatus === 'in_zubereitung' || orderStatus === 'fertig') return 'kitchen';
    if (orderStatus === 'bestätigt' || orderStatus === 'neu') return 'ordered';
    return 'ordered';
  })() as PhaseKey | null;

  const etaMin = eta?.eta_min ?? 30;
  const loadColor = eta ? getLoadColor(eta.load) : 'text-matcha-600';
  const loadLabel = eta ? getLoadLabel(eta.load) : '';

  // Calc ETA window if we have orderedAt
  const etaEarliest = orderedAt
    ? new Date(new Date(orderedAt).getTime() + (etaMin - 5) * 60_000)
    : null;
  const etaLatest = orderedAt
    ? new Date(new Date(orderedAt).getTime() + (etaMin + 5) * 60_000)
    : null;

  const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-8 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* ETA header */}
      <div className="px-4 py-4 bg-gradient-to-r from-matcha-600 to-matcha-500 text-white">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 shrink-0 opacity-90" />
          <div className="flex-1">
            <div className="text-xs font-semibold opacity-80">Geschätzte Lieferzeit</div>
            <div className="text-2xl font-black tabular-nums">
              {etaMin} Min
            </div>
          </div>
          {etaEarliest && etaLatest && (
            <div className="text-right">
              <div className="text-xs opacity-80">Zeitfenster</div>
              <div className="text-sm font-bold tabular-nums">
                {fmt(etaEarliest)} – {fmt(etaLatest)}
              </div>
            </div>
          )}
        </div>
        {eta && (
          <div className="mt-2 flex items-center gap-3 text-xs opacity-90">
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" /> {eta.drivers_online} Fahrer aktiv
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" /> {eta.active_orders} Bestellungen
            </span>
            {loadLabel && (
              <span className="ml-auto font-semibold">{loadLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Phase tracker */}
      {currentPhase && (
        <div className="px-4 py-4">
          <div className="relative flex items-start gap-0">
            {PHASES.map((phase, idx) => {
              const phaseOrder: PhaseKey[] = ['ordered', 'kitchen', 'delivery', 'delivered'];
              const currentIdx = phaseOrder.indexOf(currentPhase);
              const phaseIdx = phaseOrder.indexOf(phase.key as PhaseKey);
              const isDone = phaseIdx < currentIdx;
              const isCurrent = phaseIdx === currentIdx;
              const Icon = phase.icon;

              return (
                <div key={phase.key} className="flex-1 flex flex-col items-center relative">
                  {/* connector line */}
                  {idx < PHASES.length - 1 && (
                    <div className={cn(
                      'absolute left-1/2 top-4 w-full h-0.5',
                      isDone || isCurrent ? 'bg-matcha-400' : 'bg-muted',
                    )} style={{ left: '50%' }} />
                  )}
                  {/* icon */}
                  <div className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                    isDone    ? 'bg-matcha-500 border-matcha-600 text-white'
                    : isCurrent ? 'bg-white border-matcha-500 text-matcha-600 shadow-md'
                    : 'bg-muted/30 border-muted text-muted-foreground',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {/* label */}
                  <div className={cn(
                    'mt-2 text-center text-[9px] font-bold leading-tight px-0.5',
                    isCurrent ? 'text-matcha-700' : isDone ? 'text-matcha-500' : 'text-muted-foreground',
                  )}>
                    {phase.label}
                  </div>
                  {isCurrent && (
                    <div className="text-[8px] text-matcha-600 font-semibold text-center px-0.5 mt-0.5">
                      {phase.desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      {lastUpdated && (
        <div className="px-4 pb-3 text-[10px] text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>Live ETA · zuletzt aktualisiert {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  );
}
