'use client';

// Phase 353: Fahrer-Abwesenheits- und Urlaubsmanagement — Admin Dashboard

import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarOff,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  Users,
  CalendarDays,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

type AbsenceType = 'sick_day' | 'vacation' | 'personal_day' | 'training' | 'other';
type AbsenceStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface AbsenceRow {
  id: string;
  driverName: string | null;
  driverVehicle: string | null;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: AbsenceStatus;
  reason: string | null;
  adminNotes: string | null;
  createdAt: string;
}

interface CoverageImpact {
  date: string;
  absentDrivers: number;
  scheduledDrivers: number;
  availabilityPct: number;
  risk: 'low' | 'medium' | 'high';
}

interface AbsenceConfig {
  isEnabled: boolean;
  requiresApproval: boolean;
  maxVacationDaysPerYear: number;
  maxSickDaysPerYear: number;
  minNoticeDays: number;
  autoApproveSickDays: boolean;
}

interface Dashboard {
  config: AbsenceConfig;
  todayAbsent: number;
  pendingRequests: number;
  approvedThisWeek: number;
  availabilityPct: number;
  todaysAbsences: AbsenceRow[];
  upcomingAbsences: AbsenceRow[];
  pendingAbsences: AbsenceRow[];
  coverageImpact: CoverageImpact[];
}

// ── Label-Helfer ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AbsenceType, string> = {
  sick_day:     'Krankmeldung',
  vacation:     'Urlaub',
  personal_day: 'Persönlicher Tag',
  training:     'Schulung',
  other:        'Sonstiges',
};

const TYPE_COLOR: Record<AbsenceType, string> = {
  sick_day:     'bg-red-100 text-red-700',
  vacation:     'bg-blue-100 text-blue-700',
  personal_day: 'bg-purple-100 text-purple-700',
  training:     'bg-amber-100 text-amber-700',
  other:        'bg-stone-100 text-stone-700',
};

const STATUS_COLOR: Record<AbsenceStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-stone-100 text-stone-600',
};

const STATUS_LABEL: Record<AbsenceStatus, string> = {
  pending:   'Ausstehend',
  approved:  'Genehmigt',
  rejected:  'Abgelehnt',
  cancelled: 'Storniert',
};

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name: string | null) {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── KPI-Karte ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className={cn('p-4', accent && 'border-matcha-500/50 bg-matcha-50/40')}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-matcha-700">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

// ── Abwesenheits-Karte ────────────────────────────────────────────────────────

function AbsenceCard({
  row,
  showActions,
  onApprove,
  onReject,
}: {
  row: AbsenceRow;
  showActions?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  return (
    <div className="border rounded-xl p-4 bg-card space-y-2">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-sm font-bold shrink-0">
          {initials(row.driverName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{row.driverName ?? '–'}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', TYPE_COLOR[row.absenceType])}>
              {TYPE_LABELS[row.absenceType]}
            </span>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', STATUS_COLOR[row.status])}>
              {STATUS_LABEL[row.status]}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          <div className="font-semibold text-foreground">{row.daysCount} Tag{row.daysCount !== 1 ? 'e' : ''}</div>
          <div>{formatDate(row.startDate)}</div>
          {row.startDate !== row.endDate && <div>→ {formatDate(row.endDate)}</div>}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground ml-1"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="pl-12 space-y-2 text-sm">
          {row.reason && (
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Grund: </span>{row.reason}
            </div>
          )}
          {row.adminNotes && (
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Admin-Notiz: </span>{row.adminNotes}
            </div>
          )}
          {showActions && row.status === 'pending' && onApprove && onReject && (
            <div className="space-y-2 pt-1">
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Admin-Notiz (optional)..."
                rows={2}
                className="w-full text-xs border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-matcha-500"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-matcha-600 hover:bg-matcha-700 text-white gap-1"
                  onClick={() => { onApprove(row.id); }}
                >
                  <CheckCircle2 size={12} /> Genehmigen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                  onClick={() => { onReject(row.id); }}
                >
                  <XCircle size={12} /> Ablehnen
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Coverage-Kalender ─────────────────────────────────────────────────────────

function CoverageBar({ impact }: { impact: CoverageImpact[] }) {
  if (impact.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max pb-1">
        {impact.map((d) => {
          const color = d.risk === 'high' ? 'bg-red-400' : d.risk === 'medium' ? 'bg-amber-400' : 'bg-green-400';
          const weekday = new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short' });
          const day = d.date.slice(8);
          return (
            <div key={d.date} className="flex flex-col items-center gap-1 w-10">
              <div className={cn('w-10 rounded', color)} style={{ height: `${Math.max(8, d.availabilityPct * 0.4)}px` }} title={`${d.availabilityPct}% verfügbar, ${d.absentDrivers} abwesend`} />
              <div className="text-[9px] text-muted-foreground text-center leading-tight">
                <div>{weekday}</div>
                <div>{day}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-green-400" /> Gut</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-amber-400" /> Mittel</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-red-400" /> Kritisch</span>
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function DriverAbsencesClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'pending' | 'upcoming' | 'config'>('overview');
  const [actionId, setActionId] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<Partial<AbsenceConfig>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-absences?action=dashboard');
      if (res.ok) {
        const d = await res.json() as Dashboard;
        setDashboard(d);
        setConfigDraft({ ...d.config });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = useCallback(async (id: string) => {
    setActionId(id);
    await fetch('/api/delivery/admin/driver-absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', id }),
    });
    setActionId(null);
    void load();
  }, [load]);

  const handleReject = useCallback(async (id: string) => {
    setActionId(id);
    await fetch('/api/delivery/admin/driver-absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', id }),
    });
    setActionId(null);
    void load();
  }, [load]);

  const handleSaveConfig = useCallback(async () => {
    setSaving(true);
    await fetch('/api/delivery/admin/driver-absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_config', ...configDraft }),
    });
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    void load();
  }, [configDraft, load]);

  const tabs: { key: typeof tab; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Heute' },
    { key: 'pending', label: 'Ausstehend', badge: dashboard?.pendingRequests },
    { key: 'upcoming', label: 'Demnächst' },
    { key: 'config', label: 'Konfiguration' },
  ];

  return (
    <>
      <PageHeader
        title="Fahrer-Abwesenheiten"
        description="Urlaubsanfragen, Krankmeldungen und Abwesenheits-Übersicht aller Fahrer."
      />

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={<CalendarOff size={14} />}
          label="Heute abwesend"
          value={dashboard?.todayAbsent ?? '–'}
          sub={`${dashboard?.availabilityPct ?? 100}% verfügbar`}
          accent={(dashboard?.todayAbsent ?? 0) > 0}
        />
        <KpiCard
          icon={<Clock size={14} />}
          label="Ausstehend"
          value={dashboard?.pendingRequests ?? '–'}
          sub="Anfragen warten"
          accent={(dashboard?.pendingRequests ?? 0) > 0}
        />
        <KpiCard
          icon={<CheckCircle2 size={14} />}
          label="Genehmigt (7 Tage)"
          value={dashboard?.approvedThisWeek ?? '–'}
          sub="Diese Woche"
        />
        <KpiCard
          icon={<Users size={14} />}
          label="Verfügbarkeit"
          value={`${dashboard?.availabilityPct ?? 100}%`}
          sub="Fahrer heute aktiv"
        />
      </div>

      {/* Coverage-Vorschau */}
      {dashboard && dashboard.coverageImpact.some((d) => d.absentDrivers > 0) && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-matcha-700" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Verfügbarkeits-Kalender (14 Tage)</span>
          </div>
          <CoverageBar impact={dashboard.coverageImpact} />
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-1.5',
              tab === t.key ? 'border-matcha-600 text-matcha-800' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                {t.badge}
              </span>
            )}
          </button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={load}
          disabled={loading}
          className="ml-auto gap-1 text-xs"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Laden…' : 'Aktualisieren'}
        </Button>
      </div>

      {/* Tab: Heute */}
      {tab === 'overview' && (
        <div className="space-y-3">
          {!loading && (dashboard?.todaysAbsences.length ?? 0) === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Heute keine Abwesenheiten.</p>
            </Card>
          ) : (
            dashboard?.todaysAbsences.map((row) => (
              <AbsenceCard key={row.id} row={row} />
            ))
          )}
        </div>
      )}

      {/* Tab: Ausstehend */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {!loading && (dashboard?.pendingAbsences.length ?? 0) === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Keine ausstehenden Anfragen.</p>
            </Card>
          ) : (
            dashboard?.pendingAbsences.map((row) => (
              <AbsenceCard
                key={row.id}
                row={row}
                showActions
                onApprove={actionId ? undefined : handleApprove}
                onReject={actionId ? undefined : handleReject}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Demnächst */}
      {tab === 'upcoming' && (
        <div className="space-y-3">
          {!loading && (dashboard?.upcomingAbsences.length ?? 0) === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Keine kommenden Abwesenheiten (14 Tage).</p>
            </Card>
          ) : (
            dashboard?.upcomingAbsences.map((row) => (
              <AbsenceCard key={row.id} row={row} showActions onApprove={handleApprove} onReject={handleReject} />
            ))
          )}
        </div>
      )}

      {/* Tab: Konfiguration */}
      {tab === 'config' && (
        <Card className="p-6 space-y-6 max-w-lg">
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">
            <Settings size={14} /> Konfiguration
          </div>

          <div className="space-y-4">
            {/* Toggle: Modul aktiv */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Abwesenheits-Management aktiv</div>
                <div className="text-xs text-muted-foreground">Fahrer können Anfragen einreichen</div>
              </div>
              <button
                onClick={() => setConfigDraft((d) => ({ ...d, isEnabled: !d.isEnabled }))}
                className={cn('w-10 h-6 rounded-full transition-colors relative',
                  configDraft.isEnabled ? 'bg-matcha-600' : 'bg-stone-200')}
              >
                <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  configDraft.isEnabled ? 'translate-x-5' : 'translate-x-1')} />
              </button>
            </div>

            {/* Toggle: Genehmigung erforderlich */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Genehmigung erforderlich</div>
                <div className="text-xs text-muted-foreground">Anfragen müssen manuell genehmigt werden</div>
              </div>
              <button
                onClick={() => setConfigDraft((d) => ({ ...d, requiresApproval: !d.requiresApproval }))}
                className={cn('w-10 h-6 rounded-full transition-colors relative',
                  configDraft.requiresApproval ? 'bg-matcha-600' : 'bg-stone-200')}
              >
                <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  configDraft.requiresApproval ? 'translate-x-5' : 'translate-x-1')} />
              </button>
            </div>

            {/* Toggle: Krankmeldungen auto-genehmigen */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Krankmeldungen auto-genehmigen</div>
                <div className="text-xs text-muted-foreground">Sick Days werden sofort genehmigt</div>
              </div>
              <button
                onClick={() => setConfigDraft((d) => ({ ...d, autoApproveSickDays: !d.autoApproveSickDays }))}
                className={cn('w-10 h-6 rounded-full transition-colors relative',
                  configDraft.autoApproveSickDays ? 'bg-matcha-600' : 'bg-stone-200')}
              >
                <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  configDraft.autoApproveSickDays ? 'translate-x-5' : 'translate-x-1')} />
              </button>
            </div>

            {/* Max Urlaubstage */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-semibold">Max. Urlaubstage / Jahr</label>
                <span className="text-sm font-bold text-matcha-700">{configDraft.maxVacationDaysPerYear ?? 28}</span>
              </div>
              <input type="range" min={5} max={60} step={1}
                value={configDraft.maxVacationDaysPerYear ?? 28}
                onChange={(e) => setConfigDraft((d) => ({ ...d, maxVacationDaysPerYear: Number(e.target.value) }))}
                className="w-full accent-matcha-600" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>5</span><span>60</span></div>
            </div>

            {/* Max Krankheitstage */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-semibold">Max. Kranktage / Jahr</label>
                <span className="text-sm font-bold text-matcha-700">{configDraft.maxSickDaysPerYear ?? 14}</span>
              </div>
              <input type="range" min={0} max={30} step={1}
                value={configDraft.maxSickDaysPerYear ?? 14}
                onChange={(e) => setConfigDraft((d) => ({ ...d, maxSickDaysPerYear: Number(e.target.value) }))}
                className="w-full accent-matcha-600" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>30</span></div>
            </div>

            {/* Mindestkündigungsfrist */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-semibold">Mindestkündigungsfrist (Tage)</label>
                <span className="text-sm font-bold text-matcha-700">{configDraft.minNoticeDays ?? 2}</span>
              </div>
              <input type="range" min={0} max={14} step={1}
                value={configDraft.minNoticeDays ?? 2}
                onChange={(e) => setConfigDraft((d) => ({ ...d, minNoticeDays: Number(e.target.value) }))}
                className="w-full accent-matcha-600" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>14</span></div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              className="bg-matcha-600 hover:bg-matcha-700 text-white"
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
            {savedAt && (
              <span className="text-xs text-matcha-700 font-semibold">
                Gespeichert {savedAt}
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Warnung: Kritische Verfügbarkeit */}
      {dashboard && dashboard.coverageImpact.some((d) => d.risk === 'high') && (
        <Card className="mt-6 p-4 border-red-200 bg-red-50 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-red-700">Kritische Verfügbarkeit: </span>
            <span className="text-red-600">
              In den nächsten 14 Tagen gibt es Tage mit unter 50% Fahrerverfügbarkeit.
              Prüfe ausstehende Anfragen und koordiniere Urlaube.
            </span>
          </div>
        </Card>
      )}
    </>
  );
}
