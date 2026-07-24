'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Bike, ChefHat, Package, CheckCircle2, AlertCircle, Navigation } from 'lucide-react';

type BestellStatus = 'angenommen' | 'zubereitung' | 'abholbereit' | 'unterwegs' | 'fast_da' | 'geliefert';

interface LiveTrackingData {
  status: BestellStatus;
  eta_min: number | null;
  eta_original_min: number | null;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  verzoegerung_min: number;
  kuechen_start_vor_min: number | null;
  stopp_nr_aktiv: number | null;
  stopp_gesamt: number | null;
  live_tracking_url: string | null;
  confidence_pct: number;
}

const MOCK: LiveTrackingData = {
  status: 'unterwegs',
  eta_min: 12,
  eta_original_min: 30,
  fahrer_name: 'Max M.',
  fahrer_distanz_km: 1.8,
  verzoegerung_min: 0,
  kuechen_start_vor_min: 18,
  stopp_nr_aktiv: 1,
  stopp_gesamt: 2,
  live_tracking_url: null,
  confidence_pct: 87,
};

const PHASEN: { status: BestellStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'angenommen', label: 'Bestätigt', icon: <CheckCircle2 className="w-4 h-4" /> },
  { status: 'zubereitung', label: 'Küche', icon: <ChefHat className="w-4 h-4" /> },
  { status: 'abholbereit', label: 'Bereit', icon: <Package className="w-4 h-4" /> },
  { status: 'unterwegs', label: 'Unterwegs', icon: <Bike className="w-4 h-4" /> },
  { status: 'geliefert', label: 'Geliefert', icon: <CheckCircle2 className="w-4 h-4" /> },
];

const STATUS_ORDER: BestellStatus[] = ['angenommen', 'zubereitung', 'abholbereit', 'unterwegs', 'fast_da', 'geliefert'];

function phaseIndex(status: BestellStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  if (status === 'fast_da') return STATUS_ORDER.indexOf('unterwegs');
  return idx;
}

const STATUS_BANNER: Record<BestellStatus, { text: string; emoji: string; cls: string }> = {
  angenommen: { text: 'Deine Bestellung wurde angenommen!', emoji: '✅', cls: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300' },
  zubereitung: { text: 'Deine Bestellung wird zubereitet.', emoji: '🍳', cls: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300' },
  abholbereit: { text: 'Fahrer holt deine Bestellung ab!', emoji: '📦', cls: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300' },
  unterwegs: { text: 'Dein Fahrer ist unterwegs!', emoji: '🛵', cls: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300' },
  fast_da: { text: 'Dein Fahrer ist fast da!', emoji: '🎉', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300' },
  geliefert: { text: 'Bestellung geliefert. Guten Appetit!', emoji: '🎊', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300' },
};

export function LiveTrackingEtaPro({
  orderId,
  locationSlug,
}: {
  orderId: string | null;
  locationSlug: string;
}) {
  const [data, setData] = useState<LiveTrackingData>(MOCK);
  const [elapsed, setElapsed] = useState(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.status) setData(d); }
    } catch {}
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 60_000); return () => clearInterval(id); }, []);

  const banner = STATUS_BANNER[data.status];
  const activePhaseIdx = phaseIndex(data.status);
  const displayEta = data.eta_min !== null ? Math.max(0, data.eta_min - elapsed) : null;
  const verzoegert = data.verzoegerung_min > 0;

  return (
    <div className="space-y-3 max-w-md mx-auto">
      {/* Status-Banner */}
      <div className={`border rounded-2xl px-4 py-3 flex items-center gap-3 ${banner.cls}`}>
        <span className="text-2xl">{banner.emoji}</span>
        <span className="font-semibold text-base">{banner.text}</span>
      </div>

      {/* ETA-Hero */}
      {displayEta !== null && data.status !== 'geliefert' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Voraussichtliche Lieferzeit</div>
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-5xl font-black text-gray-900 dark:text-gray-100">{displayEta}</span>
            <span className="text-xl font-bold text-gray-500">min</span>
          </div>
          {verzoegert && (
            <div className="flex items-center justify-center gap-1 text-xs text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {data.verzoegerung_min} min Verzögerung · wir entschuldigen uns!
            </div>
          )}
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mt-1">
            <span>Konfidenz {data.confidence_pct}%</span>
          </div>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between relative">
          {/* Verbindungslinie */}
          <div className="absolute top-5 left-6 right-6 h-0.5 bg-gray-200 dark:bg-gray-700" />
          <div
            className="absolute top-5 left-6 h-0.5 bg-emerald-500 transition-all duration-700"
            style={{ width: `${activePhaseIdx / (PHASEN.length - 1) * 87}%` }}
          />

          {PHASEN.map((p, i) => {
            const done = i < activePhaseIdx;
            const aktiv = i === activePhaseIdx;
            return (
              <div key={p.status} className="flex flex-col items-center gap-1.5 z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  done ? 'bg-emerald-500 text-white' :
                  aktiv ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-900' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>
                  {p.icon}
                </div>
                <span className={`text-xs font-medium ${aktiv ? 'text-blue-600 dark:text-blue-400' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && (data.status === 'unterwegs' || data.status === 'fast_da') && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {data.fahrer_name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100">{data.fahrer_name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Bike className="w-3.5 h-3.5" />
                {data.fahrer_distanz_km !== null && `${data.fahrer_distanz_km.toFixed(1)} km entfernt`}
                {data.stopp_nr_aktiv !== null && data.stopp_gesamt !== null && (
                  <span>· Stopp {data.stopp_nr_aktiv}/{data.stopp_gesamt}</span>
                )}
              </div>
            </div>
            {data.live_tracking_url && (
              <a
                href={data.live_tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <Navigation className="w-3.5 h-3.5" />
                Live
              </a>
            )}
          </div>
        </div>
      )}

      {/* Kochzeit-Info */}
      {data.kuechen_start_vor_min !== null && data.status === 'zubereitung' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 px-1">
          <ChefHat className="w-3.5 h-3.5 text-amber-500" />
          Küche begann vor {data.kuechen_start_vor_min} min — fast fertig!
        </div>
      )}

      {/* Geliefert */}
      {data.status === 'geliefert' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="font-bold text-emerald-700 dark:text-emerald-400">Guten Appetit!</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Deine Bestellung wurde geliefert.</div>
        </div>
      )}
    </div>
  );
}
