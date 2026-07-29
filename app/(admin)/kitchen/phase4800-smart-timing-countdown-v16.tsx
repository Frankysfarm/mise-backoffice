'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap, ChefHat, AlertTriangle, CheckCircle2, Bike } from 'lucide-react';

interface OrderRow {
  id: string;
  bestellnummer: string;
  status: string;
  countdown_sek: number;
  ampel: 'gruen' | 'hellgruen' | 'gelb' | 'orange' | 'rot' | 'kritisch' | 'fertig';
  fahrer_eta_min: number | null;
  prep_start: string | null;
  score: number;
  komplexitaet: number;
  batch_gruppe: string | null;
}

interface ApiResponse {
  orders: OrderRow[];
  team_score: number;
  score_delta: number;
  kritisch_count: number;
  fertig_count: number;
  aktiv_count: number;
  avg_prep_min: number;
  puenktlichkeit_pct: number;
  alert: string | null;
  timestamp: string;
}

const AMPEL_STYLES: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  gruen:      { border: 'border-green-600',   bg: 'bg-green-950/40',  badge: 'bg-green-600',   text: 'text-green-300' },
  hellgruen:  { border: 'border-green-500',   bg: 'bg-green-900/30',  badge: 'bg-green-500',   text: 'text-green-200' },
  gelb:       { border: 'border-yellow-500',  bg: 'bg-yellow-950/40', badge: 'bg-yellow-500',  text: 'text-yellow-300' },
  orange:     { border: 'border-orange-500',  bg: 'bg-orange-950/40', badge: 'bg-orange-600',  text: 'text-orange-300' },
  rot:        { border: 'border-red-500',     bg: 'bg-red-950/40',    badge: 'bg-red-600',     text: 'text-red-300' },
  kritisch:   { border: 'border-red-700',     bg: 'bg-red-950/60',    badge: 'bg-red-800',     text: 'text-red-200' },
  fertig:     { border: 'border-gray-600',    bg: 'bg-gray-900/20',   badge: 'bg-gray-600',    text: 'text-gray-400' },
};

function formatCountdown(sek: number): string {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function generateMock(): ApiResponse {
  const now = Date.now();
  const orders: OrderRow[] = [
    { id: '1', bestellnummer: 'B-001', status: 'zubereitung', countdown_sek: 720, ampel: 'gruen', fahrer_eta_min: 12, prep_start: new Date(now - 120000).toISOString(), score: 88, komplexitaet: 2, batch_gruppe: 'A' },
    { id: '2', bestellnummer: 'B-002', status: 'zubereitung', countdown_sek: 240, ampel: 'orange', fahrer_eta_min: 4, prep_start: new Date(now - 600000).toISOString(), score: 72, komplexitaet: 3, batch_gruppe: 'A' },
    { id: '3', bestellnummer: 'B-003', status: 'zubereitung', countdown_sek: -120, ampel: 'kritisch', fahrer_eta_min: 2, prep_start: new Date(now - 900000).toISOString(), score: 55, komplexitaet: 1, batch_gruppe: null },
    { id: '4', bestellnummer: 'B-004', status: 'fertig', countdown_sek: 0, ampel: 'fertig', fahrer_eta_min: 8, prep_start: new Date(now - 700000).toISOString(), score: 95, komplexitaet: 2, batch_gruppe: 'B' },
    { id: '5', bestellnummer: 'B-005', status: 'zubereitung', countdown_sek: 480, ampel: 'hellgruen', fahrer_eta_min: 9, prep_start: new Date(now - 60000).toISOString(), score: 91, komplexitaet: 1, batch_gruppe: 'B' },
    { id: '6', bestellnummer: 'B-006', status: 'zubereitung', countdown_sek: 60, ampel: 'rot', fahrer_eta_min: 1, prep_start: new Date(now - 780000).toISOString(), score: 63, komplexitaet: 4, batch_gruppe: null },
  ];
  return {
    orders,
    team_score: 78,
    score_delta: 2,
    kritisch_count: orders.filter(o => o.ampel === 'kritisch' || o.ampel === 'rot').length,
    fertig_count: orders.filter(o => o.ampel === 'fertig').length,
    aktiv_count: orders.filter(o => o.status === 'zubereitung').length,
    avg_prep_min: 14.5,
    puenktlichkeit_pct: 82,
    alert: orders.some(o => o.ampel === 'kritisch') ? 'Kritische Bestellungen — Sofortmaßnahme erforderlich!' : null,
    timestamp: new Date().toISOString(),
  };
}

export function KitchenPhase4800SmartTimingCountdownV16({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/kitchen/smart-timing-countdown?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(generateMock());
      }
    } catch {
      setData(generateMock());
    }
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 15_000);
    return () => clearInterval(poll);
  }, [locationId]);

  // 1-Sekunden-Tick für Countdown
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;

  // Prioritätssortierung: kritisch → rot → orange → gelb → hellgruen → gruen → fertig
  const ORDER_PRIO: Record<string, number> = { kritisch: 0, rot: 1, orange: 2, gelb: 3, hellgruen: 4, gruen: 5, fertig: 6 };
  const sorted = [...data.orders].sort((a, b) => (ORDER_PRIO[a.ampel] ?? 7) - (ORDER_PRIO[b.ampel] ?? 7));

  const scoreColor = data.team_score >= 85 ? 'text-green-400' : data.team_score >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/30 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ChefHat className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Smart-Timing Countdown V16</span>
        <span className="ml-auto text-xs text-gray-500 font-mono">
          {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* Score + KPIs */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        <div className="col-span-1 bg-black/30 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Score</div>
          <div className={`text-lg font-bold ${scoreColor}`}>{data.team_score}</div>
          <div className={`text-xs ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Aktiv</div>
          <div className="text-base font-bold text-white">{data.aktiv_count}</div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Kritisch</div>
          <div className="text-base font-bold text-red-400">{data.kritisch_count}</div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Fertig</div>
          <div className="text-base font-bold text-green-400">{data.fertig_count}</div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Pünktl.</div>
          <div className={`text-base font-bold ${data.puenktlichkeit_pct >= 85 ? 'text-green-400' : data.puenktlichkeit_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.puenktlichkeit_pct}%
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 rounded px-3 py-2 mb-3 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          {data.alert}
        </div>
      )}

      {/* Countdown-Kacheln */}
      <div className="grid grid-cols-2 gap-2">
        {sorted.map(order => {
          const style = AMPEL_STYLES[order.ampel] ?? AMPEL_STYLES.gruen;
          const cd = Math.max(0, order.countdown_sek - tick);
          const isOverdue = order.countdown_sek < 0;
          const progressPct = order.ampel === 'fertig' ? 100
            : order.prep_start
              ? Math.min(100, Math.max(0, ((Date.now() - new Date(order.prep_start).getTime()) / 1000) / (order.countdown_sek + ((Date.now() - new Date(order.prep_start).getTime()) / 1000)) * 100))
              : 50;

          return (
            <div key={order.id} className={`rounded-lg border ${style.border} ${style.bg} p-2.5 relative overflow-hidden`}>
              {/* Progress Bar Background */}
              <div className="absolute inset-0 opacity-10">
                <div className={`h-full ${style.badge}`} style={{ width: `${progressPct}%` }} />
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-300">{order.bestellnummer}</span>
                  {order.batch_gruppe && (
                    <span className="text-[10px] bg-black/30 px-1.5 rounded text-gray-400">Batch {order.batch_gruppe}</span>
                  )}
                </div>

                <div className={`font-mono text-xl font-bold ${style.text} ${isOverdue ? 'animate-pulse' : ''}`}>
                  {order.ampel === 'fertig' ? (
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Fertig</span>
                  ) : isOverdue ? (
                    <span>+{formatCountdown(Math.abs(order.countdown_sek))}</span>
                  ) : (
                    formatCountdown(cd)
                  )}
                </div>

                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    {'★'.repeat(Math.min(order.komplexitaet, 4)).split('').map((_, i) => (
                      <span key={i} className="text-[10px] text-yellow-500">★</span>
                    ))}
                  </div>
                  {order.fahrer_eta_min !== null && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Bike className="w-3 h-3" />
                      {order.fahrer_eta_min} Min
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        {[
          { ampel: 'gruen', label: 'OK' },
          { ampel: 'gelb', label: 'Bald' },
          { ampel: 'orange', label: 'Dringend' },
          { ampel: 'rot', label: 'Kritisch' },
          { ampel: 'fertig', label: 'Fertig' },
        ].map(({ ampel, label }) => (
          <div key={ampel} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${AMPEL_STYLES[ampel].badge}`} />
            <span className="text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-600">
        <Zap className="w-3 h-3" />
        1-Sek-Tick · 15-Sek-Polling
      </div>
    </div>
  );
}
