'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, ArrowRightLeft, CheckCircle2, ChevronDown, ChevronUp,
  Clock, RefreshCw, Settings, Users, XCircle, AlertTriangle,
  MapPin, Truck, Euro, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { euro } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriverOption {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  state: string;
}

interface LendingCandidate {
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  distanceKm: number;
  availableDrivers: DriverOption[];
  pendingOrdersTo: number;
  activeDriversTo: number;
  urgency: 'low' | 'medium' | 'high';
}

interface LendingRequest {
  id: string;
  fromLocationName: string;
  toLocationName: string;
  driverName: string | null;
  status: string;
  requestedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  hoursWorked: number | null;
  compensationEur: number | null;
  notes: string | null;
}

interface LendingConfig {
  isEnabled: boolean;
  maxDistanceKm: number;
  minIdleToLend: number;
  minPendingToRequest: number;
  autoSuggest: boolean;
  hourlyCompensationEur: number;
}

interface Dashboard {
  config: LendingConfig;
  activeLendings: LendingRequest[];
  pendingRequests: LendingRequest[];
  todaySummary: {
    totalRequests: number;
    acceptedCount: number;
    rejectedCount: number;
    completedHours: number;
    compensationEur: number;
  };
  candidates: LendingCandidate[];
  recentHistory: LendingRequest[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-stone-100 text-stone-700 border-stone-200',
};
const URGENCY_LABEL: Record<string, string> = {
  high: 'Dringend', medium: 'Mittel', low: 'Niedrig',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-stone-100 text-stone-600',
  cancelled: 'bg-stone-100 text-stone-500',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Ausstehend',
  accepted: 'Akzeptiert',
  rejected: 'Abgelehnt',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DriverLendingClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'candidates' | 'active' | 'history' | 'config'>('candidates');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({});
  // config form state
  const [cfgEnabled, setCfgEnabled] = useState(false);
  const [cfgMaxDist, setCfgMaxDist] = useState(25);
  const [cfgMinIdle, setCfgMinIdle] = useState(2);
  const [cfgMinPending, setCfgMinPending] = useState(3);
  const [cfgAutoSuggest, setCfgAutoSuggest] = useState(true);
  const [cfgCompRate, setCfgCompRate] = useState(0);
  const [cfgSaving, setCfgSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-lending?action=dashboard');
      if (!res.ok) return;
      const data: Dashboard = await res.json();
      setDashboard(data);
      setCfgEnabled(data.config.isEnabled);
      setCfgMaxDist(data.config.maxDistanceKm);
      setCfgMinIdle(data.config.minIdleToLend);
      setCfgMinPending(data.config.minPendingToRequest);
      setCfgAutoSuggest(data.config.autoSuggest);
      setCfgCompRate(data.config.hourlyCompensationEur);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  async function postAction(body: Record<string, unknown>) {
    const res = await fetch('/api/delivery/admin/driver-lending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function sendRequest(candidate: LendingCandidate) {
    const key = `${candidate.fromLocationId}-${candidate.toLocationId}`;
    const driverId = selectedDriver[key] ?? candidate.availableDrivers[0]?.driverId;
    if (!driverId) return;
    setActionLoading(`send-${key}`);
    await postAction({
      action: 'create',
      from_location_id: candidate.fromLocationId,
      to_location_id: candidate.toLocationId,
      driver_id: driverId,
    });
    setActionLoading(null);
    load();
  }

  async function updateStatus(requestId: string, status: string) {
    setActionLoading(`status-${requestId}`);
    await postAction({ action: 'update_status', request_id: requestId, status });
    setActionLoading(null);
    load();
  }

  async function saveConfig() {
    setCfgSaving(true);
    await postAction({
      action: 'update_config',
      is_enabled: cfgEnabled,
      max_distance_km: cfgMaxDist,
      min_idle_to_lend: cfgMinIdle,
      min_pending_to_request: cfgMinPending,
      auto_suggest: cfgAutoSuggest,
      hourly_compensation_eur: cfgCompRate,
    });
    setCfgSaving(false);
    load();
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Lade Fahrer-Ausleihe…
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6 text-sm text-red-500">Fehler beim Laden der Daten.</div>
    );
  }

  const { todaySummary, activeLendings, pendingRequests, candidates, recentHistory, config } =
    dashboard;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Cross-Location Fahrer-Ausleihe"
        description="Standorte mit Fahrer-Überschuss leihen ihre idle Fahrer an benachbarte Standorte mit Engpässen aus."
        backHref="/delivery"
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <ArrowRightLeft className="h-4 w-4" />, label: 'Anfragen heute', value: todaySummary.totalRequests, color: 'text-blue-600' },
          { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Akzeptiert', value: todaySummary.acceptedCount, color: 'text-green-600' },
          { icon: <Clock className="h-4 w-4" />, label: 'Geleistete Stunden', value: todaySummary.completedHours.toFixed(1) + ' h', color: 'text-matcha-600' },
          { icon: <Euro className="h-4 w-4" />, label: 'Vergütung heute', value: euro(todaySummary.compensationEur), color: 'text-amber-600' },
        ].map(({ icon, label, value, color }) => (
          <Card key={label} className="p-4">
            <div className={`flex items-center gap-1.5 text-xs text-muted-foreground`}>
              <span className={color}>{icon}</span>
              {label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{value}</div>
          </Card>
        ))}
      </div>

      {/* Status Banner */}
      {!config.isEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Fahrer-Ausleihe ist deaktiviert. In der Konfiguration aktivieren.
        </div>
      )}

      {/* Active Lendings alert */}
      {activeLendings.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex items-start gap-2">
          <Truck className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">{activeLendings.length} aktive Ausleihe{activeLendings.length > 1 ? 'n' : ''}:</span>{' '}
            {activeLendings.map((r) => `${r.driverName ?? 'Fahrer'} → ${r.toLocationName}`).join(' · ')}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(
          [
            { key: 'candidates', label: `Kandidaten (${candidates.length})` },
            { key: 'active', label: `Aktiv & Ausstehend (${activeLendings.length + pendingRequests.length})` },
            { key: 'history', label: 'Verlauf' },
            { key: 'config', label: 'Konfiguration' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
              tab === key
                ? 'border-matcha-600 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto p-2 text-muted-foreground hover:text-foreground"
          title="Aktualisieren"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Tab: Kandidaten ── */}
      {tab === 'candidates' && (
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {config.isEnabled
                ? 'Aktuell keine Ausleihe-Kandidaten — Überschuss-/Mangel-Bedingungen noch nicht erfüllt.'
                : 'Fahrer-Ausleihe ist deaktiviert.'}
            </div>
          ) : (
            candidates.map((c) => {
              const key = `${c.fromLocationId}-${c.toLocationId}`;
              const expanded = expandedCandidate === key;
              const isLoading = actionLoading === `send-${key}`;
              return (
                <Card key={key} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge
                          className={`text-[10px] border ${URGENCY_COLOR[c.urgency]}`}
                          variant="outline"
                        >
                          {URGENCY_LABEL[c.urgency]}
                        </Badge>
                        <span className="font-semibold text-sm">{c.fromLocationName}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm">{c.toLocationName}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {c.distanceKm} km
                        </span>
                      </div>
                      <button
                        onClick={() => setExpandedCandidate(expanded ? null : key)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>
                        <Users className="h-3 w-3 inline mr-1" />
                        {c.availableDrivers.length} idle Fahrer verfügbar
                      </span>
                      <span>
                        <Truck className="h-3 w-3 inline mr-1" />
                        {c.pendingOrdersTo} offene Bestellungen am Zielort
                      </span>
                      <span>{c.activeDriversTo} aktive Fahrer am Zielort</span>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t bg-stone-50 p-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          Fahrer auswählen
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {c.availableDrivers.map((d) => (
                            <button
                              key={d.driverId}
                              onClick={() =>
                                setSelectedDriver((prev) => ({ ...prev, [key]: d.driverId }))
                              }
                              className={`px-2 py-1 rounded-lg border text-xs transition ${
                                (selectedDriver[key] ?? c.availableDrivers[0]?.driverId) ===
                                d.driverId
                                  ? 'border-matcha-500 bg-matcha-50 text-matcha-800'
                                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                              }`}
                            >
                              {d.driverName ?? d.driverId.slice(0, 8)}
                              {d.vehicle ? ` · ${d.vehicle}` : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-matcha-600 hover:bg-matcha-700 text-white"
                        onClick={() => sendRequest(c)}
                        disabled={isLoading || c.availableDrivers.length === 0}
                      >
                        {isLoading ? (
                          <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                        ) : (
                          <ArrowRightLeft className="h-3 w-3 mr-2" />
                        )}
                        Ausleihe anfragen
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab: Aktiv & Ausstehend ── */}
      {tab === 'active' && (
        <div className="space-y-3">
          {activeLendings.length === 0 && pendingRequests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Keine aktiven oder ausstehenden Anfragen.
            </div>
          ) : (
            [...pendingRequests, ...activeLendings].map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                actionLoading={actionLoading}
                onUpdateStatus={updateStatus}
              />
            ))
          )}
        </div>
      )}

      {/* ── Tab: Verlauf ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {recentHistory.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Noch kein Verlauf.
            </div>
          ) : (
            recentHistory.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                actionLoading={null}
                onUpdateStatus={async () => {}}
              />
            ))
          )}
        </div>
      )}

      {/* ── Tab: Konfiguration ── */}
      {tab === 'config' && (
        <Card className="p-6 space-y-5">
          <h3 className="font-display text-lg font-bold">Konfiguration</h3>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Fahrer-Ausleihe aktiviert</p>
              <p className="text-xs text-muted-foreground">
                Ermöglicht das Erkennen und Anfragen von Cross-Location-Lending
              </p>
            </div>
            <button onClick={() => setCfgEnabled((v) => !v)} className="text-matcha-600">
              {cfgEnabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-stone-400" />
              )}
            </button>
          </div>

          {/* Auto-Suggest */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Automatische Kandidaten-Erkennung</p>
              <p className="text-xs text-muted-foreground">
                Erkennt Ungleichgewichte automatisch und zeigt Vorschläge an
              </p>
            </div>
            <button onClick={() => setCfgAutoSuggest((v) => !v)} className="text-matcha-600">
              {cfgAutoSuggest ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-stone-400" />
              )}
            </button>
          </div>

          {/* Sliders */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                label: 'Max. Entfernung (km)',
                value: cfgMaxDist,
                min: 5,
                max: 100,
                step: 5,
                onChange: setCfgMaxDist,
                display: `${cfgMaxDist} km`,
              },
              {
                label: 'Min. idle Fahrer zum Ausleihen',
                value: cfgMinIdle,
                min: 1,
                max: 10,
                step: 1,
                onChange: setCfgMinIdle,
                display: `${cfgMinIdle}`,
              },
              {
                label: 'Min. offene Bestellungen am Zielort',
                value: cfgMinPending,
                min: 1,
                max: 20,
                step: 1,
                onChange: setCfgMinPending,
                display: `${cfgMinPending}`,
              },
              {
                label: 'Stundenvergütung (€/h)',
                value: cfgCompRate,
                min: 0,
                max: 30,
                step: 0.5,
                onChange: setCfgCompRate,
                display: euro(cfgCompRate) + '/h',
              },
            ].map(({ label, value, min, max, step, onChange, display }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{display}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => onChange(Number(e.target.value))}
                  className="w-full accent-matcha-600"
                />
              </div>
            ))}
          </div>

          <Button
            onClick={saveConfig}
            disabled={cfgSaving}
            className="bg-matcha-600 hover:bg-matcha-700 text-white"
          >
            {cfgSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Konfiguration speichern
          </Button>
        </Card>
      )}
    </div>
  );
}

// ── RequestCard ───────────────────────────────────────────────────────────────

function RequestCard({
  request,
  actionLoading,
  onUpdateStatus,
}: {
  request: LendingRequest;
  actionLoading: string | null;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}) {
  const isLoading = actionLoading?.startsWith(`status-${request.id}`);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] ${STATUS_COLOR[request.status]}`} variant="secondary">
              {STATUS_LABEL[request.status] ?? request.status}
            </Badge>
            <span className="font-semibold text-sm">
              {request.driverName ?? 'Fahrer'}
            </span>
            <span className="text-xs text-muted-foreground">
              {request.fromLocationName} → {request.toLocationName}
            </span>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
            <span>
              <Clock className="h-3 w-3 inline mr-1" />
              Angefragt {new Date(request.requestedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {request.startedAt && (
              <span>Start {new Date(request.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {request.hoursWorked != null && (
              <span>{request.hoursWorked.toFixed(1)} h gearbeitet</span>
            )}
            {request.notes && <span className="italic">{request.notes}</span>}
          </div>
        </div>

        {request.status === 'pending' && (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => onUpdateStatus(request.id, 'accepted')}
              disabled={!!isLoading}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Annehmen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => onUpdateStatus(request.id, 'rejected')}
              disabled={!!isLoading}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Ablehnen
            </Button>
          </div>
        )}

        {request.status === 'accepted' && (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            onClick={() => onUpdateStatus(request.id, 'active')}
            disabled={!!isLoading}
          >
            <Truck className="h-3 w-3 mr-1" />
            Fahrer gestartet
          </Button>
        )}

        {request.status === 'active' && (
          <Button
            size="sm"
            className="bg-matcha-600 hover:bg-matcha-700 text-white shrink-0"
            onClick={() => onUpdateStatus(request.id, 'completed')}
            disabled={!!isLoading}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Abschließen
          </Button>
        )}
      </div>
    </Card>
  );
}
