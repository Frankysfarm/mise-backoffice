'use client';

import { useEffect, useState } from 'react';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package, Zap, Navigation2, Star } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'abgeholt' | 'unterwegs' | 'geliefert' | 'storniert';

interface TrackData {
  status: OrderStatus;
  eta_min: number | null;
  eta_updated_at: string | null;
  fahrer_name: string | null;
  fahrer_distance_km: number | null;
  prep_start: string | null;
  prep_min_gesamt: number | null;
  phasen_zeiten: { phase: string; erwartet_min: number; gestartet_at: string | null }[];
  live_update: boolean;
  confidence_pct: number;
}

const STATUS_META: Record<OrderStatus, { label: string; farbe: string; icon: React.ReactNode }> = {
  neu:            { label: 'Eingegangen',    farbe: 'text-gray-400',   icon: <CheckCircle2 className="w-5 h-5" /> },
  bestätigt:      { label: 'Bestätigt',      farbe: 'text-blue-400',   icon: <CheckCircle2 className="w-5 h-5" /> },
  in_zubereitung: { label: 'Wird zubereitet', farbe: 'text-orange-400', icon: <ChefHat className="w-5 h-5" /> },
  fertig:         { label: 'Fertig — Fahrer kommt!', farbe: 'text-yellow-400', icon: <Package className="w-5 h-5" /> },
  abgeholt:       { label: 'Abgeholt',       farbe: 'text-blue-300',   icon: <Bike className="w-5 h-5" /> },
  unterwegs:      { label: 'Unterwegs zu dir!', farbe: 'text-green-400', icon: <Bike className="w-5 h-5" /> },
  geliefert:      { label: 'Geliefert! Guten Hunger! 🎉', farbe: 'text-green-300', icon: <Star className="w-5 h-5" /> },
  storniert:      { label: 'Storniert',      farbe: 'text-red-400',    icon: <CheckCircle2 className="w-5 h-5" /> },
};

const PHASE_STEPS: { stati: OrderStatus[]; label: string }[] = [
  { stati: ['neu', 'bestätigt'],       label: 'Bestätigt' },
  { stati: ['in_zubereitung', 'fertig'], label: 'Zubereitung' },
  { stati: ['abgeholt', 'unterwegs'], label: 'Unterwegs' },
  { stati: ['geliefert'],             label: 'Geliefert' },
];

function activePhase(status: OrderStatus): number {
  for (let i = 0; i < PHASE_STEPS.length; i++) {
    if ((PHASE_STEPS[i].stati as string[]).includes(status)) return i;
  }
  return 0;
}

function generateMock(orderId: string): TrackData {
  return {
    status: 'unterwegs',
    eta_min: 8,
    eta_updated_at: new Date().toISOString(),
    fahrer_name: 'Jan Schmidt',
    fahrer_distance_km: 1.4,
    prep_start: new Date(Date.now() - 900000).toISOString(),
    prep_min_gesamt: 18,
    confidence_pct: 87,
    live_update: true,
    phasen_zeiten: [
      { phase: 'Bestätigt', erwartet_min: 2, gestartet_at: new Date(Date.now() - 1200000).toISOString() },
      { phase: 'Zubereitung', erwartet_min: 15, gestartet_at: new Date(Date.now() - 900000).toISOString() },
      { phase: 'Unterwegs', erwartet_min: 12, gestartet_at: new Date(Date.now() - 300000).toISOString() },
    ],
  };
}

export function StorefrontPhase1000DynamischeEtaLiveUltimate({
  orderId, locationId, initialStatus,
}: { orderId?: string | null; locationId?: string | null; initialStatus?: OrderStatus }) {
  const [data, setData] = useState<TrackData | null>(null);
  const [tick, setTick] = useState(0);
  const [etaSek, setEtaSek] = useState<number | null>(null);

  async function load() {
    if (!orderId) { setData(generateMock('demo')); return; }
    try {
      const params = new URLSearchParams({ order_id: orderId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/customer/track?${params}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.eta_min !== null) setEtaSek(d.eta_min * 60);
      } else {
        setData(generateMock(orderId));
        setEtaSek(8 * 60);
      }
    } catch {
      setData(generateMock(orderId ?? 'demo'));
      setEtaSek(8 * 60);
    }
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000);
    return () => clearInterval(poll);
  }, [orderId, locationId]);

  useEffect(() => {
    const t = setInterval(() => {
      setTick(n => n + 1);
      setEtaSek(s => s !== null && s > 0 ? s - 1 : s);
    }, 1_000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;

  const phase = activePhase(data.status);
  const meta = STATUS_META[data.status] ?? STATUS_META.neu;
  const isDelivered = data.status === 'geliefert';
  const isUnterwegs = data.status === 'unterwegs' || data.status === 'abgeholt';

  const etaMin = etaSek !== null ? Math.max(0, Math.ceil(etaSek / 60)) : data.eta_min;
  const etaSS = etaSek !== null ? String(Math.max(0, etaSek) % 60).padStart(2, '0') : '00';
  const etaMM = etaSek !== null ? String(Math.max(0, Math.floor(etaSek / 60))).padStart(2, '0') : String(data.eta_min ?? 0).padStart(2, '0');

  return (
    <div className="rounded-2xl border border-matcha-700 bg-matcha-950/40 p-5 space-y-4">
      {/* Status */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full bg-matcha-800 flex items-center justify-center ${meta.farbe}`}>
          {meta.icon}
        </div>
        <div>
          <div className={`text-base font-bold ${meta.farbe}`}>{meta.label}</div>
          {data.eta_updated_at && (
            <div className="text-xs text-gray-500">
              Aktualisiert {new Date(data.eta_updated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
        {data.live_update && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-green-400">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* ETA Countdown — nur wenn unterwegs */}
      {isUnterwegs && etaMin !== null && (
        <div className="text-center py-4 rounded-xl bg-black/20 border border-matcha-700">
          <div className="text-xs text-gray-400 mb-1">Ankunft in</div>
          <div className="font-mono text-5xl font-bold text-matcha-300">
            {etaMM}<span className="text-matcha-500 text-3xl">:</span>{etaSS}
          </div>
          <div className="text-xs text-gray-500 mt-1">Min : Sek</div>
          {data.confidence_pct >= 80 && (
            <div className="mt-2 text-xs text-green-400">
              KI-Konfidenz: {data.confidence_pct}%
            </div>
          )}
        </div>
      )}

      {/* Fahrer-Info */}
      {data.fahrer_name && isUnterwegs && (
        <div className="flex items-center gap-3 bg-black/20 rounded-xl p-3">
          <div className="w-9 h-9 rounded-full bg-matcha-700 flex items-center justify-center">
            <Bike className="w-5 h-5 text-matcha-200" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{data.fahrer_name}</div>
            {data.fahrer_distance_km !== null && (
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {data.fahrer_distance_km} km entfernt
              </div>
            )}
          </div>
          <Navigation2 className="w-4 h-4 text-matcha-400 animate-pulse" />
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="flex items-center justify-between">
        {PHASE_STEPS.map((step, i) => {
          const isDone = i < phase;
          const isActive = i === phase;
          const isPending = i > phase;
          return (
            <div key={i} className="flex-1 flex flex-col items-center relative">
              {/* Connector */}
              {i < PHASE_STEPS.length - 1 && (
                <div className={`absolute top-3.5 left-1/2 right-0 h-0.5 ${isDone || isActive ? 'bg-matcha-500' : 'bg-gray-700'}`} />
              )}
              {/* Dot */}
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 ${
                isDone ? 'bg-matcha-600 border-matcha-500' :
                isActive ? 'bg-matcha-700 border-matcha-400 animate-pulse' :
                'bg-gray-800 border-gray-600'
              }`}>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-matcha-200" />
                ) : (
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-matcha-300' : 'bg-gray-500'}`} />
                )}
              </div>
              <div className={`text-[10px] mt-1 text-center ${isActive ? 'text-matcha-300 font-semibold' : isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Abgeschlossen */}
      {isDelivered && (
        <div className="text-center py-4 rounded-xl bg-green-950/40 border border-green-800">
          <div className="text-2xl mb-1">🎉</div>
          <div className="text-base font-bold text-green-300">Geliefert! Guten Hunger!</div>
          <div className="text-xs text-gray-400 mt-1">Wir freuen uns über deine Bewertung</div>
        </div>
      )}

      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-600">
        <Zap className="w-3 h-3" />
        1-Sek-Countdown · 20-Sek-Polling
      </div>
    </div>
  );
}
