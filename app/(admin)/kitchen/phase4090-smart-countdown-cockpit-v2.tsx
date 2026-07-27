'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Flame, Clock, CheckCircle2, AlertTriangle, ChefHat, Zap } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  order_number: string;
  item_count: number;
  prep_started_at: string | null;
  expected_ready_at: string | null;
  driver_eta_min: number | null;
  complexity: 'niedrig' | 'mittel' | 'hoch';
  status: 'wartend' | 'kochend' | 'fertig' | 'verzoegert';
}

interface ApiData {
  orders: OrderCountdown[];
  kochstart_score: number;
  on_time_pct: number;
  avg_prep_min: number;
  ueberfaellig_count: number;
  aktiv_count: number;
  ziel_kochstart_score: number;
}

const MOCK: ApiData = {
  orders: [
    { order_id: 'o1', order_number: '#1042', item_count: 3, prep_started_at: new Date(Date.now() - 8 * 60_000).toISOString(), expected_ready_at: new Date(Date.now() + 4 * 60_000).toISOString(), driver_eta_min: 5, complexity: 'mittel', status: 'kochend' },
    { order_id: 'o2', order_number: '#1043', item_count: 5, prep_started_at: new Date(Date.now() - 12 * 60_000).toISOString(), expected_ready_at: new Date(Date.now() + 1.5 * 60_000).toISOString(), driver_eta_min: 2, complexity: 'hoch', status: 'kochend' },
    { order_id: 'o3', order_number: '#1044', item_count: 2, prep_started_at: null, expected_ready_at: new Date(Date.now() + 10 * 60_000).toISOString(), driver_eta_min: 12, complexity: 'niedrig', status: 'wartend' },
    { order_id: 'o4', order_number: '#1045', item_count: 4, prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), expected_ready_at: new Date(Date.now() - 2 * 60_000).toISOString(), driver_eta_min: null, complexity: 'hoch', status: 'verzoegert' },
    { order_id: 'o5', order_number: '#1041', item_count: 2, prep_started_at: new Date(Date.now() - 15 * 60_000).toISOString(), expected_ready_at: new Date(Date.now() - 0.5 * 60_000).toISOString(), driver_eta_min: 0, complexity: 'niedrig', status: 'fertig' },
  ],
  kochstart_score: 78,
  on_time_pct: 82,
  avg_prep_min: 14,
  ueberfaellig_count: 1,
  aktiv_count: 3,
  ziel_kochstart_score: 85,
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getColorLevel(msRemaining: number, status: OrderCountdown['status']): { bg: string; text: string; border: string; label: string } {
  if (status === 'fertig') return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Fertig' };
  if (status === 'verzoegert' || msRemaining < 0) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', label: 'Überfällig' };
  if (msRemaining < 2 * 60_000) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', label: 'Dringend' };
  if (msRemaining < 5 * 60_000) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Bald' };
  return { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-200', label: 'OK' };
}

interface Props { locationId: string | null; }

export function KitchenPhase4090SmartCountdownCockpitV2({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const now = useNow(1000);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-countdown?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const scoreColor = data.kochstart_score >= 85 ? 'text-emerald-600' : data.kochstart_score >= 70 ? 'text-yellow-500' : 'text-red-500';
  const scoreBarColor = data.kochstart_score >= 85 ? 'bg-emerald-500' : data.kochstart_score >= 70 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Smart-Countdown Cockpit</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.ueberfaellig_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" /> {data.ueberfaellig_count} überfällig
            </span>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Kochstart-Score', value: `${data.kochstart_score}`, suffix: '/100', color: scoreColor, icon: <Zap className="w-3 h-3" /> },
          { label: 'Pünktlich', value: `${data.on_time_pct}`, suffix: '%', color: data.on_time_pct >= 85 ? 'text-emerald-600' : 'text-yellow-500', icon: <Clock className="w-3 h-3" /> },
          { label: 'Ø Prep', value: `${data.avg_prep_min}`, suffix: 'min', color: 'text-blue-600', icon: <ChefHat className="w-3 h-3" /> },
          { label: 'Aktiv', value: `${data.aktiv_count}`, suffix: '', color: 'text-indigo-600', icon: <Flame className="w-3 h-3" /> },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-50 rounded-lg p-1.5 text-center">
            <div className={`flex items-center justify-center gap-0.5 ${kpi.color} mb-0.5`}>
              {kpi.icon}
            </div>
            <div className={`text-sm font-bold ${kpi.color}`}>{kpi.value}<span className="text-[10px] font-normal">{kpi.suffix}</span></div>
            <div className="text-[9px] text-gray-400 leading-tight">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Score Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Kochstart-Score</span>
          <span className={scoreColor + ' font-semibold'}>{data.kochstart_score} / Ziel {data.ziel_kochstart_score}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${scoreBarColor} rounded-full transition-all`} style={{ width: `${data.kochstart_score}%` }} />
        </div>
      </div>

      {/* Countdown Kacheln */}
      <div className="space-y-1.5">
        {data.orders.slice(0, 5).map((order) => {
          const msRemaining = order.expected_ready_at ? new Date(order.expected_ready_at).getTime() - now : 0;
          const colors = getColorLevel(msRemaining, order.status);
          const complexityIcon = order.complexity === 'hoch' ? '🔴' : order.complexity === 'mittel' ? '🟡' : '🟢';

          return (
            <div key={order.order_id} className={`flex items-center gap-2 p-2 rounded-lg border ${colors.bg} ${colors.border}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-gray-800">{order.order_number}</span>
                  <span className="text-[9px]">{complexityIcon}</span>
                  <span className="text-[9px] text-gray-400">{order.item_count} Art.</span>
                  {order.driver_eta_min !== null && (
                    <span className="text-[9px] text-blue-500 ml-auto">🚴 {order.driver_eta_min} min</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {colors.label}
                  </span>
                  <span className="text-[9px] text-gray-400">
                    {order.status === 'fertig' ? <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" /> : order.status === 'wartend' ? 'Wartend' : 'Koch'}
                  </span>
                </div>
              </div>
              <div className={`text-base font-mono font-bold ${colors.text} min-w-[52px] text-right`}>
                {order.status === 'fertig' ? '✓' : formatCountdown(msRemaining)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-gray-400 text-center pt-0.5 border-t border-gray-100">
        1-Sek-Tick · 15-Sek-Polling · 4-stufige Farbkodierung
      </div>
    </div>
  );
}
