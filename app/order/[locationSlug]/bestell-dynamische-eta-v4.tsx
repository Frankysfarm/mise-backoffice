'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Home, AlertTriangle, Zap, TrendingUp, Bell, BellOff } from 'lucide-react';

type OrderPhase = 'bestaetigt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';

interface TrackingData {
  order_id: string;
  order_number: string;
  phase: OrderPhase;
  eta_min: number | null;
  eta_sek: number | null;
  eta_confidence: 'hoch' | 'mittel' | 'gering';
  eta_updated_ago_sek: number;
  zubereitung_start: string | null;
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  fahrer_distanz_km: number | null;
  ziel_adresse: string;
  updated_at: string;
  verzoegerung_min: number | null;
  surge_aktiv: boolean;
  kuechen_auslastung: 'normal' | 'hoch' | 'kritisch';
}

const MOCK: TrackingData = {
  order_id: 'demo',
  order_number: '#1090',
  phase: 'unterwegs',
  eta_min: 8,
  eta_sek: 490,
  eta_confidence: 'hoch',
  eta_updated_ago_sek: 22,
  zubereitung_start: new Date(Date.now() - 15 * 60_000).toISOString(),
  fahrer_name: 'Maria S.',
  fahrer_bewertung: 4.9,
  fahrer_distanz_km: 1.4,
  ziel_adresse: 'Pontstraße 42, 52062 Aachen',
  updated_at: new Date().toISOString(),
  verzoegerung_min: null,
  surge_aktiv: false,
  kuechen_auslastung: 'normal',
};

const PHASES: { id: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { id: 'bestaetigt', label: 'Bestätigt', icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: 'zubereitung', label: 'Zubereitung', icon: <ChefHat className="w-4 h-4" /> },
  { id: 'abholung', label: 'Abholung', icon: <Bike className="w-4 h-4" /> },
  { id: 'unterwegs', label: 'Unterwegs', icon: <MapPin className="w-4 h-4" /> },
  { id: 'geliefert', label: 'Geliefert', icon: <Home className="w-4 h-4" /> },
];

function phaseIndex(phase: OrderPhase): number {
  return PHASES.findIndex(p => p.id === phase);
}

function confidenceColor(c: string) {
  if (c === 'hoch') return 'text-green-500';
  if (c === 'mittel') return 'text-yellow-500';
  return 'text-red-500';
}

function confidenceLabel(c: string) {
  if (c === 'hoch') return 'Präzise ETA';
  if (c === 'mittel') return 'Ungefähre ETA';
  return 'Grobe Schätzung';
}

function formatCountdown(sek: number): string {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function auslastungColor(a: string) {
  if (a === 'normal') return 'text-green-500';
  if (a === 'hoch') return 'text-yellow-500';
  return 'text-red-500';
}

export function BestDynamischeEtaV4({ orderId, locationSlug }: { orderId?: string; locationSlug?: string }) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [countdown, setCountdown] = useState<number>(MOCK.eta_sek ?? 0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushRequested, setPushRequested] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/tracking/${orderId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) { setData(j); setCountdown(j.eta_sek ?? 0); } }
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [orderId]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  async function requestPush() {
    setPushRequested(true);
    try {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        setPushEnabled(perm === 'granted');
      }
    } catch { /* ignore */ }
  }

  const curPhaseIdx = phaseIndex(data.phase);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white/80 text-xs">Bestellung {data.order_number}</div>
            <div className="text-white font-semibold text-sm mt-0.5">{data.ziel_adresse}</div>
          </div>
          <button
            onClick={requestPush}
            disabled={pushRequested}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title="Push-Benachrichtigung aktivieren"
          >
            {pushEnabled ? <Bell className="w-4 h-4 text-white" /> : <BellOff className="w-4 h-4 text-white/70" />}
          </button>
        </div>
      </div>

      {/* Countdown */}
      {data.phase !== 'geliefert' && data.eta_sek !== null && (
        <div className="px-5 py-5 text-center border-b border-slate-100 dark:border-slate-800">
          <div className="text-6xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCountdown(countdown)}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-xs">
            <span className={`font-medium ${confidenceColor(data.eta_confidence)}`}>
              {confidenceLabel(data.eta_confidence)}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">aktualisiert vor {data.eta_updated_ago_sek}s</span>
          </div>
          {data.eta_min && (
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              ca. <strong className="text-slate-700 dark:text-slate-200">{data.eta_min} Minuten</strong>
            </div>
          )}
        </div>
      )}

      {data.phase === 'geliefert' && (
        <div className="px-5 py-5 text-center border-b border-slate-100 dark:border-slate-800">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <div className="mt-2 text-lg font-bold text-green-600 dark:text-green-400">Geliefert! 🎉</div>
        </div>
      )}

      {/* Phase Progress */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center">
          {PHASES.map((p, i) => (
            <div key={p.id} className="flex items-center flex-1 last:flex-none">
              <div className={`flex flex-col items-center gap-1 ${i <= curPhaseIdx ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  i < curPhaseIdx ? 'bg-green-500 text-white' :
                  i === curPhaseIdx ? 'bg-blue-600 text-white ring-2 ring-blue-400/60 ring-offset-1 ring-offset-transparent' :
                  'bg-slate-200 dark:bg-slate-700 text-slate-400'
                }`}>
                  {p.icon}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">{p.label}</span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i < curPhaseIdx ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {data.verzoegerung_min && (
        <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">Verzögerung von ca. {data.verzoegerung_min} Min — wir entschuldigen uns!</span>
        </div>
      )}
      {data.surge_aktiv && (
        <div className="px-5 py-2 bg-orange-50 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-800/30 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-xs text-orange-700 dark:text-orange-400">Hohe Nachfrage — ETA kann variieren</span>
        </div>
      )}

      {/* Fahrer & Küche Info */}
      <div className="px-5 py-3 space-y-2">
        {data.fahrer_name && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{data.fahrer_name}</span>
              {data.fahrer_bewertung && (
                <span className="text-xs text-amber-500">★ {data.fahrer_bewertung.toFixed(1)}</span>
              )}
            </div>
            {data.fahrer_distanz_km !== null && (
              <span className="text-xs text-slate-400">{data.fahrer_distanz_km.toFixed(1)} km entfernt</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">Küche: </span>
          <span className={`text-xs font-medium ${auslastungColor(data.kuechen_auslastung)}`}>
            {data.kuechen_auslastung === 'normal' ? 'Normale Auslastung' : data.kuechen_auslastung === 'hoch' ? 'Hohe Auslastung' : 'Sehr hohe Auslastung'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <TrendingUp className="w-3 h-3" />
          <span>Live-ETA V4</span>
        </div>
        {!pushRequested && (
          <button onClick={requestPush} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
            <Bell className="w-3 h-3" /> Benachrichtigen wenn da
          </button>
        )}
        {pushEnabled && <span className="text-xs text-green-500">Push aktiv ✓</span>}
        {pushRequested && !pushEnabled && <span className="text-xs text-slate-400">Push nicht verfügbar</span>}
      </div>
    </div>
  );
}
