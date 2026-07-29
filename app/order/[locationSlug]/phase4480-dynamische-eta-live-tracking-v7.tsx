'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Package, Bike, ChefHat, AlertTriangle, Zap, Navigation } from 'lucide-react';

interface EtaData {
  status: 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  eta_min_low: number | null;
  eta_min_high: number | null;
  kueche_pct: number;
  fahrer_name: string | null;
  fahrer_eta_min: number | null;
  bestellnummer: string;
  live_tracking: boolean;
  alert: string | null;
}

const STATUS_STEPS: { key: string; label: string; Icon: typeof Clock }[] = [
  { key: 'bestellt',        label: 'Bestellt',      Icon: Package },
  { key: 'in_zubereitung',  label: 'In Zubereitung', Icon: ChefHat },
  { key: 'fertig',          label: 'Fertig',         Icon: CheckCircle2 },
  { key: 'unterwegs',       label: 'Unterwegs',      Icon: Bike },
  { key: 'geliefert',       label: 'Geliefert',      Icon: MapPin },
];

const STATUS_ORDER = ['bestellt', 'bestaetigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

const MOCK: EtaData = {
  status: 'in_zubereitung',
  eta_min: 22,
  eta_min_low: 18,
  eta_min_high: 26,
  kueche_pct: 55,
  fahrer_name: null,
  fahrer_eta_min: null,
  bestellnummer: '#1108',
  live_tracking: true,
  alert: null,
};

function statusIndex(s: string) {
  const idx = STATUS_ORDER.indexOf(s);
  return idx === -1 ? 0 : idx;
}

export function Phase4480DynamischeEtaLiveTrackingV7({
  orderId,
  token,
}: {
  orderId?: string;
  token?: string;
}) {
  const [data, setData] = useState<EtaData>(MOCK);

  useEffect(() => {
    if (!orderId && !token) return;
    const load = async () => {
      try {
        const param = orderId ? `order_id=${orderId}` : `token=${token}`;
        const r = await fetch(`/api/delivery/tracking/eta?${param}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock fallback */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [orderId, token]);

  const currentStep = statusIndex(data.status);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Live-Tracking</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{data.bestellnummer}</div>
          </div>
        </div>
        {data.live_tracking && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Live</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-800/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300">{data.alert}</span>
        </div>
      )}

      {/* ETA Hero */}
      {data.status !== 'geliefert' && data.eta_min !== null && (
        <div className="px-4 py-4 text-center border-b border-slate-100 dark:border-slate-700/50">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Geschätzte Lieferzeit
          </div>
          <div className="text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {data.eta_min}
            <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">min</span>
          </div>
          {data.eta_min_low !== null && data.eta_min_high !== null && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {data.eta_min_low}–{data.eta_min_high} Minuten
            </div>
          )}
        </div>
      )}

      {data.status === 'geliefert' && (
        <div className="px-4 py-4 text-center border-b border-slate-100 dark:border-slate-700/50">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-sm font-bold text-green-700 dark:text-green-300">Erfolgreich geliefert!</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Guten Appetit!</div>
        </div>
      )}

      {/* Status-Timeline */}
      <div className="px-4 py-4">
        <div className="relative flex items-start">
          {/* Connector line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 dark:bg-slate-700" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-orange-500 transition-all duration-500"
            style={{ width: `${Math.min(100, (currentStep / (STATUS_STEPS.length - 1)) * 100)}%` }}
          />
          {STATUS_STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isDone
                    ? 'bg-orange-500 border-orange-500'
                    : isActive
                    ? 'bg-white dark:bg-slate-900 border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'
                }`}>
                  <step.Icon className={`w-3.5 h-3.5 ${isDone ? 'text-white' : isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                </div>
                <div className={`mt-1.5 text-[10px] text-center font-medium ${
                  isDone ? 'text-orange-600 dark:text-orange-400' : isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                }`}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Küchen-Fortschritt */}
      {data.status === 'in_zubereitung' && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Küche</span>
            </div>
            <span className="text-xs text-slate-500">{data.kueche_pct}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
              style={{ width: `${data.kueche_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Fahrer-Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">{data.fahrer_name}</div>
            <div className="text-[10px] text-slate-500">Fahrer unterwegs</div>
          </div>
          {data.fahrer_eta_min !== null && (
            <div className="flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{data.fahrer_eta_min} min</span>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/30 flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] text-slate-400">30-Sek-Polling · ETA-Fenster · Live-Status · Mock-Fallback</span>
      </div>
    </div>
  );
}
