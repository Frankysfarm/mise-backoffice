'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChefHat, Bike, CheckCircle2, Clock, MapPin, Package, Zap } from 'lucide-react';

type Phase = 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface StatusData {
  phase: Phase;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_entfernung_m: number | null;
  fortschritt_pct: number;
  prep_remaining_min: number | null;
  naechste_lieferung: number | null;
}

const MOCK: StatusData = {
  phase: 'unterwegs',
  eta_min: 12,
  fahrer_name: 'Max K.',
  fahrer_entfernung_m: 1200,
  fortschritt_pct: 72,
  prep_remaining_min: null,
  naechste_lieferung: 12,
};

const PHASES: { key: Phase; label: string; icon: React.ElementType; done_label: string }[] = [
  { key: 'bestaetigt',    label: 'Bestätigt',    icon: Package,       done_label: 'Bestätigt' },
  { key: 'in_zubereitung', label: 'Zubereitung',  icon: ChefHat,       done_label: 'Zubereitet' },
  { key: 'fertig',        label: 'Bereit',        icon: CheckCircle2,  done_label: 'Bereit' },
  { key: 'unterwegs',     label: 'Unterwegs',     icon: Bike,          done_label: 'Unterwegs' },
  { key: 'geliefert',     label: 'Geliefert',     icon: MapPin,        done_label: 'Geliefert' },
];

const PHASE_ORDER: Phase[] = ['bestaetigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIdx(p: Phase): number { return PHASE_ORDER.indexOf(p); }

interface Props { orderId?: string | null; locationSlug?: string; className?: string; }

export function Phase4206EchtzeitLieferstatusCockpit({ orderId, locationSlug, className = '' }: Props) {
  const [data, setData] = useState<StatusData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const param = orderId ? `order_id=${orderId}` : locationSlug ? `location_slug=${locationSlug}` : null;
    if (!param) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/storefront/echtzeit-status?${param}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [orderId, locationSlug]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const currentIdx = phaseIdx(data.phase);

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Echtzeit-Lieferstatus</span>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.eta_min !== null && (
            <span className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />~{data.eta_min} Min
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${data.fortschritt_pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-gray-400">Start</span>
          <span className="text-[9px] text-gray-500 font-medium">{data.fortschritt_pct}%</span>
          <span className="text-[9px] text-gray-400">Geliefert</span>
        </div>
      </div>

      {/* Phase Steps */}
      <div className="flex items-start justify-between">
        {PHASES.map((p, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const pending = i > currentIdx;
          const Icon = p.icon;
          return (
            <div key={p.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                done    ? 'bg-emerald-500 border-emerald-500' :
                active  ? 'bg-white border-emerald-500 shadow-md animate-pulse' :
                          'bg-gray-50 border-gray-200'
              }`}>
                <Icon className={`w-4 h-4 ${done ? 'text-white' : active ? 'text-emerald-600' : 'text-gray-300'}`} />
              </div>
              <span className={`text-[8px] text-center leading-tight font-medium ${active ? 'text-emerald-600' : done ? 'text-emerald-400' : 'text-gray-300'}`}>
                {done ? p.done_label : p.label}
              </span>
              {/* Connector */}
              {i < PHASES.length - 1 && (
                <div className="absolute" />
              )}
            </div>
          );
        })}
      </div>

      {/* Driver Info */}
      {data.phase === 'unterwegs' && data.fahrer_name && (
        <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
            <Bike className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-900">{data.fahrer_name} ist unterwegs</p>
            {data.fahrer_entfernung_m !== null && (
              <p className="text-xs text-emerald-600">
                {data.fahrer_entfernung_m >= 1000
                  ? `${(data.fahrer_entfernung_m / 1000).toFixed(1)} km entfernt`
                  : `${data.fahrer_entfernung_m} m entfernt`}
              </p>
            )}
          </div>
          {data.fahrer_entfernung_m !== null && data.fahrer_entfernung_m < 500 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
              <Zap className="w-3 h-3" />Fast da!
            </span>
          )}
        </div>
      )}

      {/* Prep Remaining */}
      {data.prep_remaining_min !== null && data.phase === 'in_zubereitung' && (
        <div className="bg-orange-50 rounded-xl p-3 flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-orange-500" />
          <span className="text-xs text-orange-700">Noch ca. <strong>{data.prep_remaining_min} Min</strong> in der Küche</span>
        </div>
      )}

      <p className="text-[9px] text-gray-300 text-right">Live · 15s · Mock-Fallback</p>
    </div>
  );
}
