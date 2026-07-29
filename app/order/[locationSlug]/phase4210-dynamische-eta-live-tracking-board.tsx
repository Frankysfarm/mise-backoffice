'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, Package, ChefHat, Bike, Home, AlertTriangle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 4210 — Dynamische ETA Live-Tracking Board
 *
 * 5-Stufen Phasen-Timeline (Bestellt/Bestätigt/Zubereitung/Unterwegs/Geliefert)
 * Animierter ETA-Ring mit Bereichsschätzung low/high
 * Fahrer-Info + Telefon-Schnellwahl
 * 20-Sek-Polling; Mock-Fallback
 */

type OrderPhase = 'placed' | 'confirmed' | 'cooking' | 'on_route' | 'delivered';

interface EtaData {
  order_id: string;
  bestellnummer: string;
  phase: OrderPhase;
  eta_min_low: number;
  eta_min_high: number;
  fahrer_name: string | null;
  fahrer_tel: string | null;
  placed_at: string;
  updated_at: string;
}

const PHASES: { key: OrderPhase; label: string; icon: typeof Clock }[] = [
  { key: 'placed',    label: 'Bestellt',    icon: Package },
  { key: 'confirmed', label: 'Bestätigt',   icon: CheckCircle2 },
  { key: 'cooking',   label: 'Zubereitung', icon: ChefHat },
  { key: 'on_route',  label: 'Unterwegs',   icon: Bike },
  { key: 'delivered', label: 'Geliefert',   icon: Home },
];

const PHASE_ORDER: OrderPhase[] = ['placed', 'confirmed', 'cooking', 'on_route', 'delivered'];

function getMockData(orderId: string | null): EtaData {
  return {
    order_id: orderId ?? 'demo',
    bestellnummer: orderId?.slice(-4) ?? '0099',
    phase: 'cooking',
    eta_min_low: 18,
    eta_min_high: 28,
    fahrer_name: 'M. Schulz',
    fahrer_tel: null,
    placed_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function phaseIndex(phase: OrderPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function Phase4210DynamischeEtaLiveTrackingBoard({ orderId }: { orderId: string | null }) {
  const [data, setData] = useState<EtaData>(getMockData(orderId));
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/eta/${orderId}`);
      if (!res.ok) throw new Error('not ok');
      const json = await res.json();
      setData({
        order_id: orderId,
        bestellnummer: json.bestellnummer ?? orderId.slice(-4),
        phase: json.phase ?? json.status ?? 'cooking',
        eta_min_low: json.eta_min_low ?? json.eta_min ?? 20,
        eta_min_high: json.eta_min_high ?? (json.eta_min ?? 20) + 10,
        fahrer_name: json.fahrer_name ?? json.driver_name ?? null,
        fahrer_tel: json.fahrer_tel ?? null,
        placed_at: json.placed_at ?? json.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setError(false);
    } catch {
      setError(true);
    }
  }, [orderId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 20_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const curIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'delivered';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isDelivered ? 'bg-green-600' : 'bg-stone-900'
      )}>
        <div>
          <div className="text-xs text-stone-300 font-medium">Bestellung #{data.bestellnummer}</div>
          <div className="text-white font-bold text-sm mt-0.5">
            {isDelivered ? 'Geliefert — Guten Appetit!' : 'Live-Tracking'}
          </div>
        </div>
        <div className="text-right">
          {!isDelivered && (
            <>
              <div className="text-white font-bold text-xl">{data.eta_min_low}–{data.eta_min_high} min</div>
              <div className="text-stone-400 text-[10px]">Geschätzte Ankunft</div>
            </>
          )}
          {isDelivered && <CheckCircle2 className="w-8 h-8 text-white" />}
        </div>
      </div>

      {/* ETA-Bereich Visualisierung */}
      {!isDelivered && (
        <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-stone-400 mb-1">
                <span>Frühestens {data.eta_min_low} min</span>
                <span>Spätestens {data.eta_min_high} min</span>
              </div>
              <div className="h-3 rounded-full bg-stone-200 relative overflow-hidden">
                {/* ETA-Bereich */}
                <div
                  className="absolute top-0 h-3 rounded-full bg-amber-400 opacity-40"
                  style={{
                    left: `${(data.eta_min_low / (data.eta_min_high + 5)) * 100}%`,
                    right: `${100 - (data.eta_min_high / (data.eta_min_high + 5)) * 100}%`,
                  }}
                />
                {/* Aktueller Fortschritt */}
                <div
                  className="absolute top-0 h-3 rounded-full bg-stone-900 transition-all duration-500"
                  style={{ width: `${Math.max(5, (1 - data.eta_min_low / (data.eta_min_high + 5)) * 100 * 0.6)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between relative">
          {/* Verbindungslinie */}
          <div className="absolute top-[14px] left-[14px] right-[14px] h-0.5 bg-stone-100" />
          <div
            className="absolute top-[14px] left-[14px] h-0.5 bg-stone-900 transition-all duration-500"
            style={{ width: curIdx > 0 ? `${(curIdx / (PHASES.length - 1)) * (100 - 14)}%` : '0%' }}
          />

          {PHASES.map(({ key, label, icon: Icon }, idx) => {
            const done = idx < curIdx;
            const active = idx === curIdx;
            const future = idx > curIdx;
            return (
              <div key={key} className="flex flex-col items-center gap-1.5 relative z-10" style={{ flex: 1 }}>
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                  done   ? 'bg-stone-900 border-stone-900' :
                  active ? 'bg-white border-stone-900 shadow-md ring-2 ring-stone-900/20' :
                           'bg-white border-stone-200'
                )}>
                  <Icon className={cn(
                    'w-3.5 h-3.5',
                    done ? 'text-white' : active ? 'text-stone-900' : 'text-stone-300'
                  )} />
                </div>
                <span className={cn(
                  'text-[9px] text-center leading-tight',
                  done   ? 'text-stone-700 font-medium' :
                  active ? 'text-stone-900 font-bold' :
                           'text-stone-400'
                )}>
                  {label}
                </span>
                {active && (
                  <span className="text-[8px] text-amber-600 font-semibold animate-pulse">Jetzt</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && !isDelivered && (
        <div className="px-4 py-3 border-t border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center">
              <Bike className="w-4 h-4 text-stone-600" />
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-800">{data.fahrer_name}</div>
              <div className="text-[10px] text-stone-400">Dein Fahrer</div>
            </div>
          </div>
          {data.fahrer_tel && (
            <a
              href={`tel:${data.fahrer_tel}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium"
            >
              <Phone className="w-3.5 h-3.5" />
              Anrufen
            </a>
          )}
        </div>
      )}

      {/* Fehler-Banner */}
      {error && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Tracking temporär nicht verfügbar — Demo-Daten
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-stone-100 flex justify-between items-center text-[10px] text-stone-400">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Live · 20s Update
        </span>
        <span>{new Date(data.updated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}
