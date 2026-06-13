'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Zap, Users, Target, RefreshCw, Radio,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface SurgeSignals {
  orders_last_30min: number;
  historical_avg_30min: number;
  velocity_ratio: number;
  hour_of_day: number;
  day_of_week: number;
  active_drivers: number;
  idle_drivers: number;
  queue_depth: number;
  is_peak_hour: boolean;
}

interface SurgePrediction {
  id: string;
  locationId: string;
  predictedAt: string;
  surgeWindowStart: string;
  surgeWindowEnd: string;
  predictedIntensity: 'low' | 'medium' | 'high';
  confidencePct: number;
  signals: SurgeSignals;
  broadcastsSent: number;
  actualPeakOrders: number | null;
  wasAccurate: boolean | null;
  evaluatedAt: string | null;
  notifiedDrivers: number;
  respondedDrivers: number;
}

interface MobilizationStats {
  predictionsTotal: number;
  accurate: number;
  inaccurate: number;
  accuracyPct: number | null;
  notificationsSent: number;
  driversMobilized: number;
  mobilizationRatePct: number | null;
  avgResponseTimeMin: number | null;
}

interface Dashboard {
  stats: MobilizationStats;
  recentPredictions: SurgePrediction[];
  pendingEvaluation: number;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function intensityLabel(i: 'low' | 'medium' | 'high') {
  return i === 'high' ? '🔴 Hoch' : i === 'medium' ? '🟡 Mittel' : '🟢 Niedrig';
}

function intensityBadgeClass(i: 'low' | 'medium' | 'high') {
  return i === 'high'
    ? 'bg-red-900/40 text-red-300 border border-red-700'
    : i === 'medium'
    ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
    : 'bg-green-900/40 text-green-300 border border-green-700';
}

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

// ─── Subkomponenten ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

function PredictionRow({ pred }: { pred: SurgePrediction }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const windowEnd = new Date(pred.surgeWindowEnd);
  const isPast = windowEnd < now;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${intensityBadgeClass(pred.predictedIntensity)}`}>
          {intensityLabel(pred.predictedIntensity)}
        </span>
        <span className="text-sm text-white/80 flex-1 text-left">
          {fmt(pred.surgeWindowStart)} – {fmt(pred.surgeWindowEnd)} Uhr
        </span>
        <span className="text-xs text-white/40">{fmtDate(pred.predictedAt)}</span>

        {pred.wasAccurate === true && <CheckCircle2 size={14} className="text-green-400" />}
        {pred.wasAccurate === false && <AlertTriangle size={14} className="text-red-400" />}
        {pred.wasAccurate === null && isPast && <Clock size={14} className="text-amber-400" />}

        {open ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <div className="text-center">
              <div className="text-xs text-white/40">Konfidenz</div>
              <div className="text-sm font-semibold text-white">{pred.confidencePct}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/40">Benachrichtigt</div>
              <div className="text-sm font-semibold text-white">{pred.notifiedDrivers} Fahrer</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/40">Mobilisiert</div>
              <div className="text-sm font-semibold text-white">{pred.respondedDrivers} Fahrer</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/40">Tats. Bestellungen</div>
              <div className="text-sm font-semibold text-white">
                {pred.actualPeakOrders != null ? pred.actualPeakOrders : '–'}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded bg-white/5 p-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            <div className="text-white/40">Letzte 30 Min</div>
            <div className="text-white/70 col-span-1 sm:col-span-2">
              {pred.signals.orders_last_30min} Bestellungen
              {' '}(historisch Ø {pred.signals.historical_avg_30min})
            </div>
            <div className="text-white/40">Velocity-Ratio</div>
            <div className="text-white/70 col-span-1 sm:col-span-2">×{pred.signals.velocity_ratio}</div>
            <div className="text-white/40">Fahrer aktiv/idle</div>
            <div className="text-white/70 col-span-1 sm:col-span-2">
              {pred.signals.active_drivers} aktiv · {pred.signals.idle_drivers} bereit
            </div>
            <div className="text-white/40">Queue-Tiefe</div>
            <div className="text-white/70 col-span-1 sm:col-span-2">{pred.signals.queue_depth} Bestellungen</div>
            <div className="text-white/40">Peak-Stunde</div>
            <div className="text-white/70 col-span-1 sm:col-span-2">{pred.signals.is_peak_hour ? 'Ja' : 'Nein'}</div>
          </div>

          {pred.wasAccurate !== null && (
            <div className={`mt-2 text-xs px-2 py-1 rounded ${pred.wasAccurate ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
              {pred.wasAccurate ? '✓ Vorhersage war korrekt' : '✗ Vorhersage war ungenau'}
              {pred.evaluatedAt && ` · Evaluiert ${fmtDate(pred.evaluatedAt)}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function SurgePredictionClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/surge-prediction?location_id=${locationId}`);
      if (res.ok) setDashboard(await res.json() as Dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const triggerPredict = async () => {
    setTriggering(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/delivery/admin/surge-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'predict', location_id: locationId }),
      });
      const data = await res.json() as { intensity?: string | null; confidencePct?: number; skipped?: boolean; reason?: string; broadcastsSent?: number };
      if (data.skipped) {
        setLastResult(`Übersprungen: ${data.reason ?? 'kein Signal'}`);
      } else if (data.intensity) {
        setLastResult(`Vorhersage: ${data.intensity} · Konfidenz ${data.confidencePct}% · ${data.broadcastsSent} Broadcasts`);
      } else {
        setLastResult('Keine Surge-Vorhersage nötig');
      }
      await load();
    } finally {
      setTriggering(false);
    }
  };

  const triggerEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch('/api/delivery/admin/surge-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate' }),
      });
      const data = await res.json() as { evaluated?: number };
      setLastResult(`${data.evaluated ?? 0} Vorhersagen evaluiert`);
      await load();
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/40" />
      </div>
    );
  }

  const stats = dashboard?.stats;
  const predictions = dashboard?.recentPredictions ?? [];
  const pendingEval = dashboard?.pendingEvaluation ?? 0;

  // Aktuell aktive Vorhersagen (Fenster noch in Zukunft)
  const activePredictions = predictions.filter(
    (p) => new Date(p.surgeWindowEnd) > new Date(),
  );

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Aktualisieren
        </button>
        <button
          onClick={triggerPredict}
          disabled={triggering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-sm transition-colors disabled:opacity-50"
        >
          <Radio size={14} className={triggering ? 'animate-pulse' : ''} />
          {triggering ? 'Vorhersage läuft…' : 'Jetzt vorhersagen'}
        </button>
        {pendingEval > 0 && (
          <button
            onClick={triggerEvaluate}
            disabled={evaluating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-sm transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {evaluating ? 'Evaluiere…' : `${pendingEval} auswerten`}
          </button>
        )}
        <span className="text-xs text-white/30">Auto-Refresh 60s</span>
      </div>

      {lastResult && (
        <div className="text-sm text-white/60 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
          {lastResult}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Vorhersagen (14d)"
          value={stats?.predictionsTotal ?? 0}
          sub={`${stats?.accurate ?? 0} korrekt · ${stats?.inaccurate ?? 0} ungenau`}
          icon={TrendingUp}
          color="text-blue-400"
        />
        <StatCard
          label="Genauigkeit"
          value={stats?.accuracyPct != null ? `${stats.accuracyPct}%` : '–'}
          sub="Evaluierte Vorhersagen"
          icon={Target}
          color="text-green-400"
        />
        <StatCard
          label="Fahrer mobilisiert"
          value={stats?.driversMobilized ?? 0}
          sub={`${stats?.mobilizationRatePct != null ? `${stats.mobilizationRatePct}%` : '–'} Rücklaufrate`}
          icon={Users}
          color="text-violet-400"
        />
        <StatCard
          label="Ø Reaktionszeit"
          value={stats?.avgResponseTimeMin != null ? `${stats.avgResponseTimeMin} Min` : '–'}
          sub={`${stats?.notificationsSent ?? 0} Benachrichtigungen`}
          icon={Zap}
          color="text-amber-400"
        />
      </div>

      {/* Aktive Vorhersagen */}
      {activePredictions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
            <Radio size={14} className="text-blue-400 animate-pulse" />
            Aktive Vorhersagen ({activePredictions.length})
          </h3>
          <div className="space-y-2">
            {activePredictions.map((pred) => (
              <PredictionRow key={pred.id} pred={pred} />
            ))}
          </div>
        </div>
      )}

      {/* Info-Box wie System funktioniert */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          Wie funktioniert die Surge-Vorhersage?
        </h3>
        <ul className="text-xs text-white/50 space-y-1 list-disc list-inside">
          <li>Alle 10 Min analysiert das System die Bestellgeschwindigkeit der letzten 30 Min</li>
          <li>Verglichen mit dem historischen Durchschnitt (gleiche Stunde · gleicher Wochentag · letzte 4 Wochen)</li>
          <li>Velocity-Ratio ≥ 1.4× → Leichte Spitze · ≥ 1.8× → Mittel · ≥ 2.5× → Hoch</li>
          <li>Bei Mittel/Hoch: automatische Broadcast-Nachricht an offline Fahrer der letzten 7 Tage</li>
          <li>Nach Ablauf des Surge-Fensters: Vergleich mit tatsächlichen Bestellungen → Genauigkeits-Tracking</li>
        </ul>
      </div>

      {/* Alle Vorhersagen */}
      <div>
        <h3 className="text-sm font-semibold text-white/70 mb-3">
          Letzte 48 Stunden ({predictions.length} Vorhersagen)
        </h3>
        {predictions.length === 0 ? (
          <div className="text-center text-white/30 py-8 text-sm">
            Noch keine Vorhersagen für diese Location
          </div>
        ) : (
          <div className="space-y-2">
            {predictions.map((pred) => (
              <PredictionRow key={pred.id} pred={pred} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
