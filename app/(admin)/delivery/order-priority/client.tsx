'use client';

/**
 * OrderPriorityClient — Phase 362
 *
 * KI-Auftrags-Priorisierungs-Dashboard.
 * Zeigt persistierte Backend-ML-Scores aller wartenden Bestellungen.
 * Tabs: Aktuelle Queue / Score-Verlauf / Score erneut berechnen
 */

import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { Zap, TrendingUp, AlertTriangle, Clock, RefreshCcw, Loader2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';

type OrderRow = {
  id: string;
  orderId: string;
  priorityScore: number;
  orderStatus: string | null;
  orderPriority: string | null;
  deliveryZone: string | null;
  waitMinutes: number | null;
  wasEscalated: boolean;
  label: string;
};

type Dashboard = {
  activeOrders: OrderRow[];
  criticalCount: number;
  highCount: number;
  avgScore: number | null;
  maxWaitMin: number | null;
  lastUpdated: string;
};

type HistoryPoint = {
  hour: string;
  avgScore: number;
  count: number;
  criticalCount: number;
};

const LABEL_COLOR: Record<string, string> = {
  KRITISCH: 'bg-red-100 text-red-700',
  HOCH:     'bg-orange-100 text-orange-700',
  MITTEL:   'bg-amber-100 text-amber-700',
  NIEDRIG:  'bg-stone-100 text-stone-600',
};

const SCORE_COLOR = (s: number) =>
  s >= 75 ? '#ef4444' : s >= 50 ? '#f97316' : s >= 25 ? '#f59e0b' : '#a3a3a3';

export function OrderPriorityClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [history, setHistory]     = useState<HistoryPoint[]>([]);
  const [tab, setTab]             = useState<'queue' | 'history'>('queue');
  const [loading, setLoading]     = useState(true);
  const [scoring, setScoring]     = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/order-priority', { cache: 'no-store' });
      if (!res.ok) throw new Error('non-ok');
      const json: Dashboard = await res.json();
      setDashboard(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/order-priority?action=history&hours=24', { cache: 'no-store' });
      if (!res.ok) throw new Error('non-ok');
      const json: { history: HistoryPoint[] } = await res.json();
      setHistory(json.history ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadHistory();
    const iv = setInterval(loadDashboard, 60_000);
    return () => clearInterval(iv);
  }, [loadDashboard, loadHistory]);

  async function triggerScoring() {
    setScoring(true);
    try {
      await fetch('/api/delivery/admin/order-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score' }),
      });
      await loadDashboard();
    } finally {
      setScoring(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-stone-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Lade Prioritäts-Dashboard…</span>
      </div>
    );
  }

  const d = dashboard;
  const orders = d?.activeOrders ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900">KI-Auftrags-Priorisierung</h1>
          <p className="text-sm text-stone-500 mt-0.5">Backend-ML-Score · persistiert · historisierbar</p>
        </div>
        <button
          onClick={triggerScoring}
          disabled={scoring}
          className="flex items-center gap-2 rounded-xl bg-matcha-600 px-4 py-2 text-sm font-bold text-white hover:bg-matcha-700 disabled:opacity-50 transition"
        >
          {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          {scoring ? 'Berechne…' : 'Score berechnen'}
        </button>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Aktive Aufträge', value: orders.length, icon: ChevronRight, color: 'text-stone-700' },
          { label: 'KRITISCH', value: d?.criticalCount ?? 0, icon: AlertTriangle, color: 'text-red-600' },
          { label: 'HOCH', value: d?.highCount ?? 0, icon: Zap, color: 'text-orange-600' },
          { label: 'Max. Wartezeit', value: d?.maxWaitMin != null ? `${d.maxWaitMin.toFixed(0)} Min` : '–', icon: Clock, color: 'text-amber-600' },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={cn('h-4 w-4', kpi.color)} />
              <span className="text-xs text-stone-500 font-semibold">{kpi.label}</span>
            </div>
            <div className={cn('text-2xl font-black tabular-nums', kpi.color)}>
              {kpi.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200 pb-0">
        {(['queue', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-bold rounded-t-lg transition',
              tab === t
                ? 'bg-white border-x border-t border-stone-200 text-matcha-700 -mb-px'
                : 'text-stone-500 hover:text-stone-700',
            )}
          >
            {t === 'queue' ? 'Prioritäts-Queue' : '24h Score-Verlauf'}
          </button>
        ))}
      </div>

      {/* Queue Tab */}
      {tab === 'queue' && (
        <div className="space-y-2">
          {orders.length === 0 && (
            <Card className="p-8 rounded-2xl text-center text-stone-400">
              Keine wartenden Bestellungen
            </Card>
          )}
          {orders.map((o) => (
            <Card key={o.id} className={cn(
              'p-4 rounded-2xl flex items-center gap-4',
              o.label === 'KRITISCH' && 'border-red-200 bg-red-50/30',
            )}>
              <div className="shrink-0 flex flex-col items-center gap-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-black"
                  style={{ backgroundColor: SCORE_COLOR(o.priorityScore) }}
                >
                  {Math.round(o.priorityScore)}
                </div>
                <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', LABEL_COLOR[o.label])}>
                  {o.label}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-stone-400 mb-0.5">{o.orderId.slice(0, 8)}…</div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {o.orderStatus && (
                    <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-semibold">
                      {o.orderStatus}
                    </span>
                  )}
                  {o.orderPriority && o.orderPriority !== 'normal' && (
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                      {o.orderPriority}
                    </span>
                  )}
                  {o.deliveryZone && (
                    <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">
                      Zone {o.deliveryZone}
                    </span>
                  )}
                  {o.wasEscalated && (
                    <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> Eskaliert
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-black text-stone-700 tabular-nums">
                  {o.waitMinutes != null ? `${o.waitMinutes.toFixed(0)} Min` : '–'}
                </div>
                <div className="text-[9px] text-stone-400">Wartezeit</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div>
          {history.length === 0 ? (
            <Card className="p-8 rounded-2xl text-center text-stone-400">
              Noch keine Verlaufsdaten — Score läuft alle 5 Minuten
            </Card>
          ) : (
            <Card className="p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-matcha-600" />
                <span className="text-sm font-bold text-stone-700">Score-Verlauf (24h)</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: unknown) => typeof v === 'string' ? v.slice(11, 16) : ''}
                    />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      formatter={(v: unknown) => {
                        const n = typeof v === 'number' ? v : null;
                        return n != null ? [n.toFixed(1), 'Ø Score'] : ['–', ''];
                      }}
                      contentStyle={{ fontSize: 10, borderRadius: 8 }}
                    />
                    <Bar dataKey="avgScore" radius={[3, 3, 0, 0]} maxBarSize={32}>
                      {history.map((entry, i) => (
                        <Cell key={i} fill={SCORE_COLOR(entry.avgScore)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {history.slice(-6).map((h) => (
                  <div key={h.hour} className="text-[10px] text-stone-500">
                    <span className="font-bold">{h.hour.slice(11, 16)}</span>
                    {' '}· Ø{h.avgScore.toFixed(0)} · {h.count} Aufträge
                    {h.criticalCount > 0 && (
                      <span className="ml-1 text-red-500 font-bold">({h.criticalCount} krit.)</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
