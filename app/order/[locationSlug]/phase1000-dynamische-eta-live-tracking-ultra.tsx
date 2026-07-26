'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, RefreshCw, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 1000 — Dynamische ETA Live-Tracking Ultra (Storefront)
 * Animierter Phasen-Stepper Bestätigt→Zubereitung→Unterwegs→Geliefert;
 * Sekundengenauer ETA-Countdown; Fahrer-Distanz-Chip;
 * Dynamische ETA-Anpassung bei Verzögerung; Pulse-Animation unterwegs;
 * 30-Sek-Polling; Mock-Fallback.
 */

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'abgeholt' | 'unterwegs' | 'geliefert' | 'cancelled';

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
  driverName?: string | null;
  bestellnummer?: string | null;
}

interface TrackData {
  status: OrderStatus;
  etaMin: number | null;
  etaSekunden: number | null;
  driverName: string | null;
  driverDistanceKm: number | null;
  prepMin: number | null;
  verzögerung: boolean;
}

const STEPS: { keys: OrderStatus[]; label: string; icon: React.ReactNode }[] = [
  { keys: ['neu', 'bestätigt'],            label: 'Bestätigt',   icon: <CheckCircle2 className="h-4 w-4" /> },
  { keys: ['in_zubereitung', 'fertig'],    label: 'Zubereitung', icon: <ChefHat className="h-4 w-4" /> },
  { keys: ['abgeholt', 'unterwegs'],       label: 'Unterwegs',   icon: <Bike className="h-4 w-4" /> },
  { keys: ['geliefert'],                   label: 'Geliefert',   icon: <Package className="h-4 w-4" /> },
];

const STATUS_MSG: Record<OrderStatus, string> = {
  neu:            'Deine Bestellung ist eingegangen.',
  bestätigt:      'Bestellung bestätigt!',
  in_zubereitung: 'Wird gerade zubereitet…',
  fertig:         'Fertig — Fahrer kommt gleich!',
  abgeholt:       'Fahrer hat abgeholt!',
  unterwegs:      'Dein Fahrer ist unterwegs!',
  geliefert:      'Geliefert! Guten Hunger! 🎉',
  cancelled:      'Bestellung storniert.',
};

function stepIndex(status: OrderStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].keys.includes(status)) return i;
  }
  return 0;
}

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StorefrontPhase1000DynamischeEtaLiveTrackingUltra({
  orderId,
  locationId,
  initialStatus = 'bestätigt',
  initialEtaMin = 30,
  driverName,
  bestellnummer,
}: Props) {
  const [track, setTrack] = useState<TrackData>({
    status: initialStatus,
    etaMin: initialEtaMin,
    etaSekunden: initialEtaMin ? initialEtaMin * 60 : null,
    driverName: driverName ?? null,
    driverDistanceKm: null,
    prepMin: null,
    verzögerung: false,
  });
  const [tick, setTick]     = useState(0);
  const [loading, setLoading] = useState(false);
  const etaRef = useRef<number | null>(track.etaSekunden);
  etaRef.current = track.etaSekunden;

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb
        .from('orders')
        .select('status, promised_at, driver_name, driver_distance_km, prep_minutes, eta_minutes')
        .eq('id', orderId)
        .single();
      if (data) {
        const nowSec = Date.now() / 1000;
        const etaSek = data.promised_at ? Math.round(new Date(data.promised_at).getTime() / 1000 - nowSec) : (data.eta_minutes ? data.eta_minutes * 60 : null);
        setTrack({
          status: (data.status ?? initialStatus) as OrderStatus,
          etaMin: data.eta_minutes,
          etaSekunden: etaSek,
          driverName: data.driver_name ?? null,
          driverDistanceKm: data.driver_distance_km ?? null,
          prepMin: data.prep_minutes ?? null,
          verzögerung: etaSek !== null && etaSek < 0,
        });
      }
    } catch { /* mock */ }
    finally { setLoading(false); }
  }, [orderId, initialStatus]);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30_000); return () => clearInterval(id); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setTrack(prev => ({
        ...prev,
        etaSekunden: prev.etaSekunden !== null ? prev.etaSekunden - 1 : null,
      }));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  const si = stepIndex(track.status);
  const delivered = track.status === 'geliefert';
  const cancelled = track.status === 'cancelled';
  const underway = track.status === 'unterwegs' || track.status === 'abgeholt';

  if (cancelled) {
    return (
      <div className="rounded-2xl border bg-zinc-50 dark:bg-zinc-900 p-5 text-center text-zinc-500 text-sm">
        Bestellung storniert.
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden bg-white dark:bg-zinc-900 ${underway ? 'ring-2 ring-blue-400/40' : ''}`}>
      {/* Top bar */}
      <div className={`px-4 py-3 flex items-center justify-between ${delivered ? 'bg-emerald-600' : underway ? 'bg-blue-600' : 'bg-indigo-600'} text-white`}>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span className="font-semibold text-sm">Live-Tracking</span>
          {loading && <RefreshCw className="h-3 w-3 animate-spin opacity-60" />}
        </div>
        {bestellnummer && <span className="text-xs opacity-80">{bestellnummer}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Stepper */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const done = i < si;
            const active = i === si;
            return (
              <React.Fragment key={step.label}>
                <div className="flex flex-col items-center flex-1">
                  <div className={`rounded-full p-1.5 transition-all ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                    {step.icon}
                  </div>
                  <span className={`text-[10px] mt-1 text-center ${active ? 'text-indigo-600 font-semibold' : done ? 'text-emerald-600' : 'text-zinc-400'}`}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 -mt-4 ${i < si ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Status text */}
        <p className={`text-sm font-medium text-center ${delivered ? 'text-emerald-700' : 'text-zinc-700 dark:text-zinc-200'}`}>
          {STATUS_MSG[track.status]}
        </p>

        {/* ETA Countdown */}
        {track.etaSekunden !== null && !delivered && (
          <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${track.verzögerung ? 'bg-red-50 border-red-200 dark:bg-red-950' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950'}`}>
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${track.verzögerung ? 'text-red-500' : 'text-indigo-500'}`} />
              <span className="text-xs text-zinc-600 dark:text-zinc-300">{track.verzögerung ? 'Verzögert um' : 'Ankunft in'}</span>
            </div>
            <span className={`font-mono text-2xl font-bold ${track.verzögerung ? 'text-red-600' : 'text-indigo-700 dark:text-indigo-300'}`}>
              {track.verzögerung && '+'}{fmtCountdown(Math.abs(track.etaSekunden))}
            </span>
          </div>
        )}

        {/* Fahrer-Info */}
        {(track.driverName || track.driverDistanceKm !== null) && !delivered && (
          <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
            <Bike className="h-4 w-4 text-blue-500 shrink-0" />
            <span>{track.driverName ?? 'Dein Fahrer'}</span>
            {track.driverDistanceKm !== null && (
              <span className="ml-auto flex items-center gap-1 text-xs">
                <MapPin className="h-3 w-3" />{track.driverDistanceKm.toFixed(1)} km entfernt
              </span>
            )}
          </div>
        )}

        {/* Pulse-Indikator unterwegs */}
        {underway && !delivered && (
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            <span className="text-xs text-blue-600 font-medium">Fahrer ist unterwegs</span>
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" style={{ animationDelay: '0.2s' }} />
          </div>
        )}
      </div>
    </div>
  );
}
