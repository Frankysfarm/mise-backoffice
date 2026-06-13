'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, AlertTriangle, TrendingUp, Users, Clock,
  ChefHat, RefreshCw, Plus, Trash2, CheckCircle2, Star,
  Zap, Info, Calendar, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Typen ────────────────────────────────────────────────────────────────────

type RiskLevel = 'elevated' | 'high' | 'extreme';
type EventType =
  | 'public_holiday' | 'school_holiday' | 'sports_game'
  | 'concert_festival' | 'local_market' | 'weather_event'
  | 'promotion' | 'other';

interface PeakAlert {
  id: string;
  alertDate: string;
  peakScore: number;
  riskLevel: RiskLevel;
  predictedOrders: number | null;
  predictedRevenue: number | null;
  extraDriversRec: number;
  kitchenEarlierMin: number;
  triggerReasons: string[];
  weekday: number;
  weekdayName: string;
  daysUntil: number;
  eventTitle: string | null;
  eventType: EventType | null;
}

interface WeekdayPattern {
  weekday: number;
  sampleDays: number;
  avgOrders: number;
  avgRevenueEur: number;
  peakDayPct: number;
  avgPeakScore: number;
  maxPeakScore: number;
  recordOrders: number;
}

interface DeliveryEvent {
  id: string;
  eventDate: string;
  eventType: EventType;
  title: string;
  description: string | null;
  expectedDemandMult: number;
  extraDriversNeeded: number;
  kitchenOpenEarlierMin: number;
  notesForTeam: string | null;
}

interface Dashboard {
  summary: {
    openAlerts: number;
    nextPeakDate: string | null;
    nextPeakScore: number | null;
    nextPeakDaysUntil: number | null;
    peakDaysPast30: number;
    eventsNext14Days: number;
    topPeakWeekday: number | null;
    topPeakWeekdayName: string | null;
  };
  upcomingAlerts: PeakAlert[];
  weekdayPatterns: WeekdayPattern[];
  upcomingEvents: DeliveryEvent[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  elevated: { label: 'Erhöht',  color: 'text-amber-700', bg: 'bg-amber-50',   border: 'border-amber-200' },
  high:     { label: 'Hoch',    color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  extreme:  { label: 'Extrem',  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200' },
};

const EVENT_LABELS: Record<EventType, string> = {
  public_holiday: 'Feiertag',
  school_holiday: 'Schulferien',
  sports_game:    'Sportspiel',
  concert_festival: 'Konzert/Festival',
  local_market:   'Markt/Fest',
  weather_event:  'Wetter-Event',
  promotion:      'Aktion/Promo',
  other:          'Sonstiges',
};

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });
  } catch { return iso; }
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function scoreBar(score: number): JSX.Element {
  const pct = Math.min(100, score);
  const color =
    score >= 80 ? 'bg-red-500' :
    score >= 60 ? 'bg-orange-500' :
    score >= 30 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

export function PeakIntelligenceClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState<'alerts' | 'patterns' | 'events'>('alerts');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/peak-intelligence');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDashboard(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetch('/api/delivery/admin/peak-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      await load();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDismiss = async (alertId: string) => {
    await fetch('/api/delivery/admin/peak-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss_alert', alertId }),
    });
    await load();
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Event löschen?')) return;
    await fetch('/api/delivery/admin/peak-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_event', id }),
    });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="animate-spin h-6 w-6 mr-2" />
        Spitzentag-Radar lädt…
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
        {error ?? 'Keine Daten verfügbar'}
        <button onClick={load} className="ml-3 underline text-sm">Erneut versuchen</button>
      </div>
    );
  }

  const { summary } = dashboard;

  return (
    <div className="space-y-4">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Offene Alerts"
          value={summary.openAlerts.toString()}
          accent={summary.openAlerts > 0 ? 'orange' : 'green'}
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Nächster Spitzentag"
          value={summary.nextPeakDate ? formatDate(summary.nextPeakDate) : '—'}
          sub={summary.nextPeakDaysUntil !== null ? `in ${summary.nextPeakDaysUntil} Tag(en)` : undefined}
          accent={summary.nextPeakScore !== null && summary.nextPeakScore >= 60 ? 'red' : 'blue'}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Spitzentage (30 T.)"
          value={summary.peakDaysPast30.toString()}
          accent="blue"
        />
        <KpiCard
          icon={<Star className="h-4 w-4" />}
          label="Stärkster Wochentag"
          value={summary.topPeakWeekdayName ?? '—'}
          accent="purple"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 border rounded-lg p-1 bg-gray-50">
          {(['alerts', 'patterns', 'events'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t === 'alerts' ? `Alerts (${summary.openAlerts})` : t === 'patterns' ? 'Wochentag-Muster' : `Events (${summary.eventsNext14Days})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'events' && (
            <button
              onClick={() => setShowAddEvent(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Event hinzufügen
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 border text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', analyzing && 'animate-spin')} />
            {analyzing ? 'Analysiere…' : 'Jetzt analysieren'}
          </button>
        </div>
      </div>

      {/* Alerts-Tab */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          {dashboard.upcomingAlerts.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-400" />}
              text="Keine Peak-Alerts für die nächsten 14 Tage." />
          ) : (
            dashboard.upcomingAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
            ))
          )}
          <InfoBox />
        </div>
      )}

      {/* Wochentag-Muster-Tab */}
      {tab === 'patterns' && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Historische Wochentag-Muster (8 Wochen)</h3>
            <p className="text-xs text-gray-500 mt-0.5">Basis für Spitzentag-Vorhersagen</p>
          </div>
          {dashboard.weekdayPatterns.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Noch keine Verlaufsdaten. Muster werden täglich um 02:30 Uhr aktualisiert.
            </div>
          ) : (
            <div className="divide-y">
              {dashboard.weekdayPatterns.map((p) => (
                <WeekdayPatternRow key={p.weekday} pattern={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events-Tab */}
      {tab === 'events' && (
        <div className="space-y-3">
          {showAddEvent && (
            <AddEventForm
              onClose={() => setShowAddEvent(false)}
              onSaved={() => { setShowAddEvent(false); void load(); }}
            />
          )}
          {dashboard.upcomingEvents.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-8 w-8 text-gray-300" />}
              text="Keine Events geplant. Events erhöhen die Vorhersagegenauigkeit."
            />
          ) : (
            dashboard.upcomingEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, accent = 'blue',
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  sub?: string;
  accent?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}) {
  const colors = {
    blue:   'text-blue-600 bg-blue-50',
    green:  'text-emerald-600 bg-emerald-50',
    orange: 'text-orange-600 bg-orange-50',
    red:    'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  return (
    <div className="rounded-lg border bg-white p-4 space-y-2">
      <div className={cn('inline-flex p-2 rounded-lg', colors[accent])}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── AlertCard ───────────────────────────────────────────────────────────────

function AlertCard({ alert, onDismiss }: { alert: PeakAlert; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const cfg = RISK_CONFIG[alert.riskLevel];

  const handleDismiss = async () => {
    setDismissing(true);
    await onDismiss(alert.id);
  };

  const triggerLabels: Record<string, string> = {
    frequent_peak_weekday: 'Häufig Spitzentag',
    weekend:               'Wochenende',
    peak_season:           'Hochsaison',
    linked_event:          'Event verknüpft',
    rising_trend:          'Steigender Trend',
  };

  return (
    <div className={cn('rounded-lg border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', cfg.color, 'bg-white/60')}>
              {alert.riskLevel === 'extreme' ? <Zap className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {cfg.label}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {formatDate(alert.alertDate)}
            </span>
            <span className="text-xs text-gray-500">
              {alert.daysUntil === 0 ? 'Heute' : alert.daysUntil === 1 ? 'Morgen' : `in ${alert.daysUntil} Tagen`}
            </span>
          </div>

          {alert.eventTitle && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-600">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              Event: <strong>{alert.eventTitle}</strong>
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {alert.predictedOrders !== null && (
              <span className="flex items-center gap-1 text-gray-700">
                <TrendingUp className="h-3 w-3" />
                ~{alert.predictedOrders} Bestellungen
              </span>
            )}
            {alert.extraDriversRec > 0 && (
              <span className="flex items-center gap-1 text-gray-700">
                <Users className="h-3 w-3" />
                +{alert.extraDriversRec} Fahrer empfohlen
              </span>
            )}
            {alert.kitchenEarlierMin > 0 && (
              <span className="flex items-center gap-1 text-gray-700">
                <ChefHat className="h-3 w-3" />
                Küche {alert.kitchenEarlierMin} Min früher
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white/60 hover:bg-white text-gray-600 border border-white/40 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            OK
          </button>
        </div>
      </div>

      {/* Score-Bar */}
      <div className="mt-3">
        {scoreBar(alert.peakScore)}
      </div>

      {/* Erweitert: Trigger-Gründe + Checkliste */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/40 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Auslöser:</p>
            <div className="flex flex-wrap gap-1.5">
              {alert.triggerReasons.map((r) => (
                <span key={r} className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-700">
                  {triggerLabels[r] ?? r}
                </span>
              ))}
            </div>
          </div>
          <PreparationChecklist
            extraDrivers={alert.extraDriversRec}
            kitchenMin={alert.kitchenEarlierMin}
            riskLevel={alert.riskLevel}
            predictedOrders={alert.predictedOrders}
          />
        </div>
      )}
    </div>
  );
}

// ─── PreparationChecklist ────────────────────────────────────────────────────

function PreparationChecklist({
  extraDrivers, kitchenMin, riskLevel, predictedOrders,
}: {
  extraDrivers: number;
  kitchenMin: number;
  riskLevel: RiskLevel;
  predictedOrders: number | null;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setChecked((c) => ({ ...c, [k]: !c[k] }));

  const items = [
    extraDrivers > 0 && { key: 'drivers', label: `${extraDrivers} extra Fahrer einplanen / anrufen` },
    kitchenMin > 0 && { key: 'kitchen', label: `Küche ${kitchenMin} Minuten früher öffnen` },
    predictedOrders !== null && { key: 'stock', label: `Zutaten für ~${predictedOrders} Bestellungen bereitstellen` },
    riskLevel === 'extreme' && { key: 'manager', label: 'Filialleiter informieren' },
    riskLevel !== 'elevated' && { key: 'prep', label: 'Vorab-Mise-en-place erhöhen' },
    { key: 'signal', label: 'Queue-Signal auf "Erhöhte Wartezeit" vorbereiten' },
    riskLevel === 'extreme' && { key: 'backup', label: 'Backup-Fahrerpool auf Standby' },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1.5">Vorbereitungs-Checkliste:</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            onClick={() => toggle(item.key)}
            className={cn(
              'flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 transition-colors',
              checked[item.key] ? 'text-gray-400 line-through bg-white/30' : 'text-gray-700 hover:bg-white/40',
            )}
          >
            <div className={cn(
              'h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0',
              checked[item.key] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-400',
            )}>
              {checked[item.key] && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
            </div>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── WeekdayPatternRow ───────────────────────────────────────────────────────

function WeekdayPatternRow({ pattern: p }: { pattern: WeekdayPattern }) {
  const isTopDay = p.avgPeakScore >= 40;
  return (
    <div className={cn('px-4 py-3', isTopDay && 'bg-amber-50/50')}>
      <div className="flex items-center gap-3">
        <span className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
          isTopDay ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600',
        )}>
          {WEEKDAY_NAMES[p.weekday]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-gray-500">Ø {Math.round(p.avgOrders)} Bestellungen</span>
            <span className="text-xs text-gray-500">{p.peakDayPct.toFixed(0)}% Spitzentage</span>
            <span className="text-xs text-gray-500">{p.sampleDays} Datenpunkte</span>
          </div>
          {scoreBar(Math.round(p.avgPeakScore))}
        </div>
        {p.peakDayPct >= 50 && (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium flex-shrink-0">
            Häufig Spitze
          </span>
        )}
      </div>
    </div>
  );
}

// ─── EventCard ───────────────────────────────────────────────────────────────

function EventCard({
  event: ev, onDelete,
}: {
  event: DeliveryEvent;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{ev.title}</span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              {EVENT_LABELS[ev.eventType]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(ev.eventDate)}</p>
          {ev.description && <p className="text-xs text-gray-600 mt-1">{ev.description}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {ev.expectedDemandMult.toFixed(1)}× Nachfrage erwartet
            </span>
            {ev.extraDriversNeeded > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                +{ev.extraDriversNeeded} Fahrer
              </span>
            )}
            {ev.kitchenOpenEarlierMin > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Küche {ev.kitchenOpenEarlierMin} Min früher
              </span>
            )}
          </div>
          {ev.notesForTeam && (
            <p className="mt-2 text-xs text-gray-500 italic">{ev.notesForTeam}</p>
          )}
        </div>
        <button
          onClick={() => onDelete(ev.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── AddEventForm ────────────────────────────────────────────────────────────

function AddEventForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    eventDate: '',
    eventType: 'public_holiday' as EventType,
    title: '',
    description: '',
    expectedDemandMult: '1.5',
    extraDriversNeeded: '2',
    kitchenOpenEarlierMin: '15',
    notesForTeam: '',
  });

  const handleSave = async () => {
    if (!form.eventDate || !form.title) return;
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/peak-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_event',
          eventDate: form.eventDate,
          eventType: form.eventType,
          title: form.title,
          description: form.description || null,
          expectedDemandMult: parseFloat(form.expectedDemandMult) || 1.0,
          extraDriversNeeded: parseInt(form.extraDriversNeeded, 10) || 0,
          kitchenOpenEarlierMin: parseInt(form.kitchenOpenEarlierMin, 10) || 0,
          notesForTeam: form.notesForTeam || null,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text', extra?: Record<string, unknown>) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...extra}
      />
    </div>
  );

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Neues Event hinzufügen</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('eventDate', 'Datum *', 'date')}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Event-Typ *</label>
          <select
            value={form.eventType}
            onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value as EventType }))}
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      {field('title', 'Bezeichnung *')}
      {field('description', 'Beschreibung (optional)')}
      <div className="grid grid-cols-3 gap-3">
        {field('expectedDemandMult', 'Nachfrage-Faktor', 'number', { step: '0.1', min: '0.5', max: '5' })}
        {field('extraDriversNeeded', 'Extra Fahrer', 'number', { min: '0', max: '20' })}
        {field('kitchenOpenEarlierMin', 'Küche früher (Min)', 'number', { min: '0', max: '120' })}
      </div>
      {field('notesForTeam', 'Notizen fürs Team')}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.eventDate || !form.title}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}

// ─── Hilfselemente ────────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: JSX.Element; text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-gray-50 p-10 text-center">
      <div className="mx-auto mb-3 opacity-40">{icon}</div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function InfoBox() {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 flex gap-3">
      <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-blue-700 space-y-1">
        <p className="font-semibold">Peak-Score Erklärung</p>
        <p><strong>30–59:</strong> Erhöhte Last erwartet — 1–2 Fahrer extra einplanen.</p>
        <p><strong>60–79:</strong> Hohe Last — 3–4 Fahrer extra + Küche früher öffnen.</p>
        <p><strong>80–100:</strong> Extremer Spitzentag — maximale Vorbereitung notwendig.</p>
        <p className="mt-1 text-blue-600">Muster werden täglich um 02:30 Uhr aktualisiert. Events erhöhen die Vorhersagegenauigkeit erheblich.</p>
      </div>
    </div>
  );
}
