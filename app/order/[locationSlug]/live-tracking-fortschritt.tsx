'use client';

/**
 * LiveTrackingFortschritt
 * Kompakter Echtzeit-Lieferfortschritt für Kunden.
 * Zeigt Bestellstatus, Fahrerbewegung und ETA als interaktive Timeline.
 */

import { useEffect, useState, useCallback } from 'react';
import { ChefHat, Package, Bike, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'bestaetigt' | 'zubereitung' | 'fertig' | 'abgeholt' | 'unterwegs' | 'zugestellt';

interface TrackingData {
  phase: Phase;
  etaMin: number | null;
  fortschrittPct: number;
  fahrerName?: string;
  fahrerDistanzKm?: number;
  kuechen_pct?: number;
}

const PHASEN: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: 'bestaetigt', label: 'Bestätigt', icon: CheckCircle2 },
  { key: 'zubereitung', label: 'Küche', icon: ChefHat },
  { key: 'fertig', label: 'Bereit', icon: Package },
  { key: 'abgeholt', label: 'Abgeholt', icon: Bike },
  { key: 'unterwegs', label: 'Unterwegs', icon: MapPin },
  { key: 'zugestellt', label: 'Geliefert', icon: CheckCircle2 },
];

const PHASE_INDEX: Record<Phase, number> = {
  bestaetigt: 0, zubereitung: 1, fertig: 2, abgeholt: 3, unterwegs: 4, zugestellt: 5,
};

function useTrackingDaten(orderId: string | null) {
  const [data, setData] = useState<TrackingData>({
    phase: 'zubereitung',
    etaMin: 22,
    fortschrittPct: 30,
    fahrerName: 'Ahmed K.',
    kuechen_pct: 60,
  });

  const laden = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const json = await res.json();
      setData({
        phase: json.phase ?? 'zubereitung',
        etaMin: json.eta_min ?? null,
        fortschrittPct: json.fortschritt_pct ?? 0,
        fahrerName: json.fahrer_name,
        fahrerDistanzKm: json.fahrer_distanz_km,
        kuechen_pct: json.kuechen_pct,
      });
    } catch {
      // keep current
    }
  }, [orderId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 20000);
    return () => clearInterval(id);
  }, [laden]);

  return data;
}

export function LiveTrackingFortschritt({ orderId }: { orderId: string | null }) {
  const tracking = useTrackingDaten(orderId);
  const currentIndex = PHASE_INDEX[tracking.phase];

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* ETA Banner */}
      <div className={cn(
        'px-4 py-3 text-white',
        tracking.phase === 'zugestellt'
          ? 'bg-emerald-600'
          : tracking.etaMin != null && tracking.etaMin <= 5
          ? 'bg-orange-500'
          : 'bg-stone-800',
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/70">
              {tracking.phase === 'zugestellt' ? 'Zugestellt!' :
               tracking.phase === 'unterwegs' ? 'Fahrer unterwegs' :
               tracking.phase === 'zubereitung' ? 'Wird zubereitet' :
               'Bestellung läuft'}
            </p>
            {tracking.etaMin != null && tracking.phase !== 'zugestellt' && (
              <p className="text-2xl font-black mt-0.5">
                {tracking.etaMin < 1 ? 'Jeden Moment' : `~${tracking.etaMin} Min`}
              </p>
            )}
            {tracking.phase === 'zugestellt' && (
              <p className="text-lg font-bold mt-0.5">Guten Appetit! 🎉</p>
            )}
          </div>
          <div className="text-right">
            <Clock className="w-4 h-4 text-white/50 ml-auto mb-0.5" />
            <p className="text-[10px] text-white/50">{now.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        {/* Fortschrittsbalken */}
        {tracking.phase !== 'zugestellt' && (
          <div className="mt-2 bg-white/20 rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${tracking.fortschrittPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Status-Timeline */}
      <div className="px-4 py-4">
        <div className="relative flex justify-between">
          {/* Verbindungslinie */}
          <div className="absolute top-3 left-3 right-3 h-0.5 bg-stone-100" />
          <div
            className="absolute top-3 left-3 h-0.5 bg-emerald-400 transition-all duration-700"
            style={{ width: `${(currentIndex / (PHASEN.length - 1)) * 100}%` }}
          />

          {PHASEN.map((p, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            const Icon = p.icon;
            return (
              <div key={p.key} className="flex flex-col items-center gap-1 relative z-10">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                  done ? 'bg-emerald-400 border-emerald-400' :
                  active ? 'bg-stone-800 border-stone-800 scale-110' :
                  'bg-white border-stone-200',
                )}>
                  <Icon className={cn('w-3 h-3', done || active ? 'text-white' : 'text-stone-300')} />
                </div>
                <span className={cn(
                  'text-[9px] font-medium text-center leading-tight',
                  active ? 'text-stone-800' : done ? 'text-emerald-600' : 'text-stone-300',
                )}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {tracking.fahrerName && tracking.phase !== 'zugestellt' && (
        <div className="mx-4 mb-4 bg-stone-50 rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center shrink-0">
            <Bike className="w-4 h-4 text-stone-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-800">{tracking.fahrerName}</p>
            <p className="text-[10px] text-stone-500">
              {tracking.fahrerDistanzKm != null
                ? `${tracking.fahrerDistanzKm.toFixed(1)} km entfernt`
                : 'Fahrer zugewiesen'}
            </p>
          </div>
        </div>
      )}

      {/* Küchen-Fortschritt */}
      {tracking.phase === 'zubereitung' && tracking.kuechen_pct != null && (
        <div className="mx-4 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-stone-600 flex items-center gap-1">
              <ChefHat className="w-3 h-3" /> Zubereitung
            </span>
            <span className="text-xs font-bold text-stone-800">{tracking.kuechen_pct}%</span>
          </div>
          <div className="bg-stone-100 rounded-full h-2">
            <div
              className="bg-amber-400 h-2 rounded-full transition-all duration-700"
              style={{ width: `${tracking.kuechen_pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
