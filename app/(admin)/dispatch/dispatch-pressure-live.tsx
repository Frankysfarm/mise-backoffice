'use client';

/**
 * DispatchPressureLive — Phase 410
 * Live Dispatch-Druck-Indikator: Warteschlange vs. freie Fahrer vs. Küchenstatus.
 * Farbkodierte Ampel-Leiste mit kurzer Handlungsempfehlung.
 * API: /api/delivery/admin/emergency-capacity + /api/delivery/admin/stats
 */

import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PressureLevel = 'low' | 'medium' | 'high' | 'critical';

interface PressureData {
  pendingOrders: number;
  availableDrivers: number;
  activeDrivers: number;
  kitchenCircuitOpen: boolean;
  level: PressureLevel;
  recommendation: string;
}

const LEVEL_STYLE: Record<PressureLevel, { bg: string; border: string; text: string; badge: string; label: string }> = {
  low:      { bg: 'bg-matcha-50',  border: 'border-matcha-200', text: 'text-matcha-700',  badge: 'bg-matcha-600 text-white',   label: 'Normal'    },
  medium:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   badge: 'bg-amber-400 text-white',    label: 'Erhöht'    },
  high:     { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700',  badge: 'bg-orange-500 text-white',   label: 'Hoch'      },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',     badge: 'bg-red-600 text-white',      label: 'Kritisch'  },
};

function computePressure(
  pending: number,
  available: number,
  circuitOpen: boolean,
): { level: PressureLevel; recommendation: string } {
  if (circuitOpen) {
    return { level: 'critical', recommendation: 'Küchen-Circuit offen — keine neuen Touren freigeben!' };
  }
  const ratio = available > 0 ? pending / available : pending > 0 ? 999 : 0;
  if (ratio >= 4 || pending >= 12) {
    return { level: 'critical', recommendation: `${pending} Bestellungen auf ${available} Fahrer — Standby aktivieren.` };
  }
  if (ratio >= 2.5 || pending >= 8) {
    return { level: 'high', recommendation: `Hoher Druck: ${ratio.toFixed(1)}× Bestellungen/Fahrer.` };
  }
  if (ratio >= 1.5 || pending >= 4) {
    return { level: 'medium', recommendation: `Erhöhte Last — nächste freiwerdende Fahrer priorisieren.` };
  }
  return { level: 'low', recommendation: 'Normalbetrieb — kein Handlungsbedarf.' };
}

export function DispatchPressureLive({ locationId }: { locationId: string | null }) {
  const [pressure, setPressure] = useState<PressureData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      const [statsRes, emergencyRes, kitchenRes] = await Promise.allSettled([
        fetch(`/api/delivery/admin/stats?location_id=${locationId}&period=today`, { cache: 'no-store' }),
        fetch(`/api/delivery/admin/emergency-capacity?location_id=${locationId}`, { cache: 'no-store' }),
        fetch(`/api/delivery/admin/kitchen-capacity?action=dashboard&location_id=${locationId}`, { cache: 'no-store' }),
      ]);

      let pending = 0;
      let available = 0;
      let active = 0;
      let circuitOpen = false;

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const s = await statsRes.value.json();
        pending   = (s.offene_bestellungen as number | undefined) ?? (s.pending_orders as number | undefined) ?? 0;
        available = (s.fahrer_verfuegbar as number | undefined) ?? (s.drivers_available as number | undefined) ?? 0;
        active    = (s.fahrer_aktiv as number | undefined) ?? (s.drivers_active as number | undefined) ?? 0;
      }

      if (emergencyRes.status === 'fulfilled' && emergencyRes.value.ok) {
        const e = await emergencyRes.value.json();
        if (available === 0) available = (e.currentCapacity?.activeDrivers as number | undefined) ?? 0;
        if (active === 0)    active    = available;
      }

      if (kitchenRes.status === 'fulfilled' && kitchenRes.value.ok) {
        const k = await kitchenRes.value.json();
        circuitOpen = (k.circuitBreaker?.isActive as boolean | undefined) ?? false;
        if (k.currentSnapshot?.status === 'circuit_open') circuitOpen = true;
      }

      const { level, recommendation } = computePressure(pending, available, circuitOpen);
      setPressure({ pendingOrders: pending, availableDrivers: available, activeDrivers: active, kitchenCircuitOpen: circuitOpen, level, recommendation });
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 20_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!pressure) return null;

  const style = LEVEL_STYLE[pressure.level];
  const Icon = pressure.level === 'low'
    ? CheckCircle2
    : pressure.level === 'critical'
    ? AlertTriangle
    : Activity;

  return (
    <Card className={cn('overflow-hidden border', style.border)}>
      <div className={cn('px-4 py-3 flex items-start gap-3', style.bg)}>
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.text)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Dispatch-Druck
            </span>
            <Badge className={cn('text-[10px]', style.badge)}>
              {style.label}
            </Badge>
            {pressure.kitchenCircuitOpen && (
              <Badge className="bg-purple-600 text-white text-[10px]">Küche: Circuit offen</Badge>
            )}
          </div>
          <p className={cn('text-xs', style.text)}>{pressure.recommendation}</p>
        </div>
        <div className="flex gap-3 shrink-0 text-center">
          <div>
            <div className="text-sm font-bold tabular-nums text-foreground">{pressure.pendingOrders}</div>
            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" /> offen
            </div>
          </div>
          <div>
            <div className="text-sm font-bold tabular-nums text-foreground">{pressure.availableDrivers}</div>
            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <Truck className="h-2.5 w-2.5" /> frei
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
