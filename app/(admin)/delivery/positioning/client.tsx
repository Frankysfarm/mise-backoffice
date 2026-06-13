'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, RefreshCw, Navigation, Clock, CheckCircle2, XCircle,
  TrendingUp, Users, Zap, BarChart2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PositioningSuggestion, PositioningStats, PositioningDayStats } from '@/lib/delivery/positioning';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

interface OverviewResponse {
  suggestions: PositioningSuggestion[];
  stats: PositioningStats;
  history: PositioningDayStats[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function responseColor(response: string): string {
  switch (response) {
    case 'accepted': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
    case 'expired':  return 'bg-zinc-100 text-zinc-500 border-zinc-200';
    default:         return 'bg-amber-100 text-amber-700 border-amber-200';
  }
}

function responseLabel(response: string): string {
  switch (response) {
    case 'accepted': return 'Angenommen';
    case 'rejected': return 'Abgelehnt';
    case 'expired':  return 'Abgelaufen';
    default:         return 'Ausstehend';
  }
}

function demandBar(score: number): string {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function vehicleIcon(vehicle: string | null | undefined): string {
  return vehicle === 'car' ? '🚗' : '🛵';
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI-Karte
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 flex gap-3 items-start">
      <div className={cn('p-2 rounded-lg', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xs text-zinc-500 font-medium">{label}</div>
        <div className="text-xl font-bold text-zinc-900 leading-tight">{value}</div>
        {sub && <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compliance-Chart (7-Tage-Balkendiagramm)
// ─────────────────────────────────────────────────────────────────────────────

function ComplianceChart({ history }: { history: PositioningDayStats[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center text-zinc-400 py-6 text-sm">
        Noch keine historischen Daten
      </div>
    );
  }

  const maxTotal = Math.max(...history.map((d) => d.total), 1);

  return (
    <div className="space-y-2">
      {history.map((day) => (
        <div key={day.date} className="flex items-center gap-3">
          <div className="text-xs text-zinc-500 w-14 shrink-0">{fmtDate(day.date)}</div>
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <div className="flex-1 bg-zinc-100 rounded-full h-4 overflow-hidden relative">
              <div
                className="h-full bg-zinc-300 rounded-full"
                style={{ width: `${(day.total / maxTotal) * 100}%` }}
              />
              <div
                className="h-full bg-emerald-500 rounded-full absolute top-0 left-0"
                style={{ width: `${(day.accepted / maxTotal) * 100}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500 w-10 text-right shrink-0">
              {day.acceptance_rate}%
            </div>
          </div>
          <div className="text-xs text-zinc-400 w-16 shrink-0 text-right">
            {day.accepted}/{day.total}
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Angenommen
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-zinc-300 inline-block" /> Gesamt
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion-Karte
// ─────────────────────────────────────────────────────────────────────────────

function SuggestionCard({ s }: { s: PositioningSuggestion }) {
  const minsLeft = minutesUntil(s.expires_at);
  const isPending = s.response === 'pending';

  return (
    <div className={cn(
      'border rounded-xl p-4 space-y-2 transition-all',
      isPending ? 'bg-white border-amber-200' : 'bg-zinc-50 border-zinc-200',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{vehicleIcon(s.driver_vehicle)}</span>
          <div className="min-w-0">
            <div className="font-semibold text-zinc-900 text-sm truncate">
              {s.driver_name ?? 'Fahrer'}
            </div>
            {s.driver_distance_km != null && (
              <div className="text-xs text-zinc-400">
                Aktuell {s.driver_distance_km} km vom Restaurant
              </div>
            )}
          </div>
        </div>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full border shrink-0',
          responseColor(s.response),
        )}>
          {responseLabel(s.response)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Navigation className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="font-medium text-zinc-700">{s.target_label}</span>
      </div>

      <div className="text-xs text-zinc-500">{s.reason}</div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="text-xs text-zinc-400">Nachfrage-Druck</div>
          <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', demandBar(s.demand_score))}
              style={{ width: `${s.demand_score}%` }}
            />
          </div>
          <div className="text-xs font-medium text-zinc-600">{s.demand_score}</div>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <Clock className="w-3 h-3" />
          {isPending ? (
            <span className={cn(minsLeft <= 5 ? 'text-red-500' : '')}>
              Läuft in {minsLeft} Min ab
            </span>
          ) : (
            <span>{fmtTime(s.responded_at ?? s.expires_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Haupt-Komponente
// ─────────────────────────────────────────────────────────────────────────────

export function PositioningClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/positioning');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/delivery/admin/positioning', { method: 'POST' });
      if (res.ok) await load();
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const stats = data?.stats;
  const allSuggestions = data?.suggestions ?? [];
  const pendingSuggestions = allSuggestions.filter((s) => s.response === 'pending');
  const history = data?.history ?? [];

  const displayed = tab === 'pending' ? pendingSuggestions : allSuggestions;

  return (
    <div className="space-y-6 p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-500">
          {stats?.last_generated_at
            ? `Zuletzt generiert: ${fmtTime(stats.last_generated_at)}`
            : 'Noch keine Vorschläge generiert'}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Zap className={cn('w-4 h-4', generating && 'animate-pulse')} />
          {generating ? 'Generiere…' : 'Vorschläge generieren'}
        </button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label="Offene Vorschläge"
          value={String(stats?.pending ?? 0)}
          sub="gerade aktiv"
          color="bg-amber-50 text-amber-600"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Akzeptanzrate"
          value={stats?.acceptance_rate_pct != null ? `${stats.acceptance_rate_pct}%` : '–'}
          sub="letzte 24h"
          color="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="Gesamt (24h)"
          value={String(stats?.total_suggestions ?? 0)}
          sub={`${stats?.accepted ?? 0} angenommen`}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          icon={Clock}
          label="Ø Reaktionszeit"
          value={stats?.avg_response_min != null ? `${stats.avg_response_min} Min` : '–'}
          sub="bis Annahme/Ablehnung"
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Hauptbereich: Vorschläge + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vorschlagsliste */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-500" />
              Positionierungs-Vorschläge
            </h2>
            <div className="flex border border-zinc-200 rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => setTab('pending')}
                className={cn(
                  'px-3 py-1.5 font-medium transition-colors',
                  tab === 'pending' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50',
                )}
              >
                Offen ({pendingSuggestions.length})
              </button>
              <button
                onClick={() => setTab('all')}
                className={cn(
                  'px-3 py-1.5 font-medium transition-colors',
                  tab === 'all' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50',
                )}
              >
                Alle ({allSuggestions.length})
              </button>
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-8 text-center">
              <MapPin className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <div className="text-sm font-medium text-zinc-500 mb-1">
                {tab === 'pending' ? 'Keine offenen Vorschläge' : 'Noch keine Vorschläge (24h)'}
              </div>
              <div className="text-xs text-zinc-400">
                Klicke auf &ldquo;Vorschläge generieren&rdquo; um proaktiv Fahrer zu positionieren
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((s) => (
                <SuggestionCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>

        {/* 7-Tage-Compliance-Chart */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-500" />
            7-Tage-Compliance
          </h2>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <ComplianceChart history={history} />
          </div>

          {/* Hinweis-Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
              <AlertTriangle className="w-4 h-4" />
              Wie es funktioniert
            </div>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• Idle Fahrer erhalten Empfehlungen in ihrer App</li>
              <li>• Bei hoher Nachfrage: nah am Restaurant bleiben</li>
              <li>• Bei mittlerer Nachfrage: Zonen-Abdeckung verbessern</li>
              <li>• Vorschläge laufen nach 20 Min automatisch ab</li>
              <li>• Cron generiert automatisch alle 10 Min</li>
            </ul>
          </div>

          {/* Rejected Stats */}
          {stats && (stats.rejected > 0 || stats.expired > 0) && (
            <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2">
              <div className="text-sm font-medium text-zinc-700">Nicht angenommen (24h)</div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  Abgelehnt
                </span>
                <span className="font-medium text-zinc-700">{stats.rejected}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Abgelaufen
                </span>
                <span className="font-medium text-zinc-700">{stats.expired}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
