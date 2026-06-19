'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Euro,
  RefreshCw,
  Scan,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  UserX,
  BadgeX,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ── Typen ──────────────────────────────────────────────────────────────────────

type RiskLevel = 'gering' | 'mittel' | 'hoch' | 'kritisch';
type InterventionType =
  | 'push_notify'
  | 'status_update'
  | 'voucher_offer'
  | 'priority_boost'
  | 'driver_reassign';

interface RiskFactor {
  key: string;
  label: string;
  points: number;
}

interface RescueEvent {
  id: string;
  orderId: string;
  orderNr: string | null;
  detectedAt: string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  status: string;
  waitMinAtDetection: number | null;
  hadDriver: boolean;
  etaPassed: boolean;
  interventionCount: number;
  outcome: string | null;
  revenueEur: number | null;
}

interface RecentIntervention {
  id: string;
  orderId: string;
  orderNr: string | null;
  interventionType: InterventionType;
  executedAt: string;
  success: boolean | null;
}

interface RescueSummary {
  activeRisks: number;
  ordersSaved: number;
  ordersLost: number;
  flaggedLast24h: number;
  revenueSavedEur: number;
  avgRiskScore24h: number | null;
  totalInterventions: number;
}

interface RescueConfig {
  enabled: boolean;
  riskThreshold: number;
  waitMinTrigger: number;
  etaOverrunTriggerMin: number;
  autoPushEnabled: boolean;
  autoPriorityBoostEnabled: boolean;
  autoVoucherEnabled: boolean;
  voucherValueEur: number;
}

interface Dashboard {
  config: RescueConfig;
  summary: RescueSummary;
  activeEvents: RescueEvent[];
  recentInterventions: RecentIntervention[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function riskColors(level: RiskLevel): { badge: string; border: string; bg: string } {
  switch (level) {
    case 'kritisch': return { badge: 'bg-red-100 text-red-700', border: 'border-red-400', bg: 'bg-red-50' };
    case 'hoch':     return { badge: 'bg-orange-100 text-orange-700', border: 'border-orange-400', bg: 'bg-orange-50' };
    case 'mittel':   return { badge: 'bg-amber-100 text-amber-700', border: 'border-amber-400', bg: 'bg-amber-50' };
    default:         return { badge: 'bg-gray-100 text-gray-600', border: 'border-gray-200', bg: 'bg-gray-50' };
  }
}

function riskIcon(level: RiskLevel) {
  if (level === 'kritisch') return <AlertCircle className="w-4 h-4 text-red-500" />;
  if (level === 'hoch')     return <AlertTriangle className="w-4 h-4 text-orange-500" />;
  if (level === 'mittel')   return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <ShieldCheck className="w-4 h-4 text-gray-400" />;
}

const INTERVENTION_LABELS: Record<InterventionType, string> = {
  push_notify:     'Push-Benachrichtigung',
  status_update:   'Status-Update',
  voucher_offer:   'Voucher-Angebot',
  priority_boost:  'Priorität erhöht',
  driver_reassign: 'Fahrer-Neuzuweisung',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtEur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €';
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Rescue Event Card ─────────────────────────────────────────────────────────

function RescueEventCard({
  event,
  onIntervene,
}: {
  event: RescueEvent;
  onIntervene: (rescueId: string, type: InterventionType) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = riskColors(event.riskLevel);

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
      <div className="flex items-start gap-2">
        {riskIcon(event.riskLevel)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-gray-800">
              {event.orderNr ?? event.orderId.slice(0, 8)}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
              {event.riskLevel.toUpperCase()} · {Math.round(event.riskScore)} Pkt
            </span>
            {event.hadDriver && (
              <span className="text-[10px] text-gray-500">Fahrer zugewiesen</span>
            )}
            {event.etaPassed && (
              <span className="text-[10px] text-red-600 font-semibold">ETA überschritten</span>
            )}
            <span className="ml-auto text-[10px] text-gray-400">
              {event.interventionCount} Interventionen
            </span>
          </div>

          {event.waitMinAtDetection !== null && (
            <p className="text-xs text-gray-600 mt-1">
              <Clock className="inline w-3 h-3 mr-1" />
              Wartezeit bei Erkennung: {event.waitMinAtDetection} Min
              {event.revenueEur !== null && ` · ${fmtEur(event.revenueEur)} gefährdet`}
            </p>
          )}

          {/* Expand factors */}
          {event.riskFactors.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Risikofaktoren verbergen' : `${event.riskFactors.length} Risikofaktoren`}
            </button>
          )}

          {expanded && (
            <div className="mt-2 space-y-1">
              {event.riskFactors.map((f) => (
                <div key={f.key} className="flex justify-between text-[11px] text-gray-600">
                  <span>{f.label}</span>
                  <span className="font-semibold text-orange-600">+{f.points} Pkt</span>
                </div>
              ))}
            </div>
          )}

          {/* Intervention buttons */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button
              onClick={() => onIntervene(event.id, 'priority_boost')}
              className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
            >
              <Zap className="inline w-3 h-3 mr-1" />Priorität
            </button>
            <button
              onClick={() => onIntervene(event.id, 'push_notify')}
              className="text-[11px] px-2 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
            >
              Push-Notify
            </button>
            <button
              onClick={() => onIntervene(event.id, 'driver_reassign')}
              className="text-[11px] px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
            >
              <UserX className="inline w-3 h-3 mr-1" />Fahrer neu
            </button>
            {event.riskLevel === 'kritisch' && (
              <button
                onClick={() => onIntervene(event.id, 'voucher_offer')}
                className="text-[11px] px-2 py-1 rounded bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
              >
                Voucher
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Config Panel ──────────────────────────────────────────────────────────────

function ConfigPanel({
  config,
  onSave,
  saving,
}: {
  config: RescueConfig;
  onSave: (c: RescueConfig) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<RescueConfig>({ ...config });

  useEffect(() => { setDraft({ ...config }); }, [config]);

  function toggle(key: keyof RescueConfig) {
    setDraft((d) => ({ ...d, [key]: !d[key] }));
  }

  function num(key: keyof RescueConfig, val: string) {
    const n = parseFloat(val);
    if (!isNaN(n)) setDraft((d) => ({ ...d, [key]: n }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h3 className="font-bold text-gray-800 flex items-center gap-2">
        <Settings className="w-4 h-4" /> Rescue-Konfiguration
      </h3>

      {/* Engine Toggle */}
      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Rescue Engine aktiv</span>
        <button onClick={() => toggle('enabled')}>
          {draft.enabled
            ? <ToggleRight className="w-7 h-7 text-matcha-600" />
            : <ToggleLeft className="w-7 h-7 text-gray-400" />}
        </button>
      </div>

      {/* Threshold & Triggers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { key: 'riskThreshold' as const, label: 'Rescue-Schwelle (Score)', unit: 'Pkt' },
          { key: 'waitMinTrigger' as const, label: 'Wartezeit-Schwelle', unit: 'Min' },
          { key: 'etaOverrunTriggerMin' as const, label: 'ETA-Überschreitung', unit: 'Min' },
        ].map(({ key, label, unit }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={draft[key] as number}
                min={1}
                max={key === 'riskThreshold' ? 100 : 120}
                onChange={(e) => num(key, e.target.value)}
                className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-xs text-gray-500">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Auto-toggles */}
      <div className="space-y-2">
        {[
          { key: 'autoPushEnabled' as const, label: 'Auto Push-Notify' },
          { key: 'autoPriorityBoostEnabled' as const, label: 'Auto Prioritäts-Boost' },
          { key: 'autoVoucherEnabled' as const, label: 'Auto Voucher-Angebot' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{label}</span>
            <button onClick={() => toggle(key)}>
              {draft[key]
                ? <ToggleRight className="w-6 h-6 text-matcha-600" />
                : <ToggleLeft className="w-6 h-6 text-gray-400" />}
            </button>
          </div>
        ))}
      </div>

      {draft.autoVoucherEnabled && (
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Voucher-Wert</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={draft.voucherValueEur}
              min={0.5}
              max={20}
              step={0.5}
              onChange={(e) => num('voucherValueEur', e.target.value)}
              className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-center"
            />
            <span className="text-xs text-gray-500">€</span>
          </div>
        </div>
      )}

      <button
        onClick={() => onSave(draft)}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Speichern…' : 'Konfiguration speichern'}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OrderRescueClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'active' | 'history' | 'config'>('active');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/order-rescue?action=dashboard&location_id=${locationId}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { ok: boolean; dashboard: Dashboard };
      if (json.ok) {
        setDashboard(json.dashboard);
        setLastRefresh(new Date());
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(fetchDashboard, 30_000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/order-rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' }),
      });
      await fetchDashboard();
    } finally {
      setScanning(false);
    }
  };

  const handleIntervene = async (rescueEventId: string, interventionType: string) => {
    await fetch('/api/delivery/admin/order-rescue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'apply_intervention', rescueEventId, interventionType }),
    });
    await fetchDashboard();
  };

  const handleSaveConfig = async (config: RescueConfig) => {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/order-rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', config }),
      });
      await fetchDashboard();
    } finally {
      setSaving(false);
    }
  };

  const s = dashboard?.summary;

  return (
    <div className="space-y-5 pb-10">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          label="Aktive Risiken"
          value={loading ? '…' : (s?.activeRisks ?? 0)}
          sub="gerade gefährdet"
          color="bg-red-50"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4 text-matcha-600" />}
          label="Bestellungen gerettet"
          value={loading ? '…' : (s?.ordersSaved ?? 0)}
          sub="Stornierung verhindert"
          color="bg-matcha-50"
        />
        <KpiCard
          icon={<Euro className="w-4 h-4 text-blue-600" />}
          label="Umsatz geschützt"
          value={loading ? '…' : fmtEur(s?.revenueSavedEur ?? 0)}
          sub="durch Interventionen"
          color="bg-blue-50"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
          label="Gemeldet (24h)"
          value={loading ? '…' : (s?.flaggedLast24h ?? 0)}
          sub={s?.avgRiskScore24h != null ? `Ø Score: ${s.avgRiskScore24h.toFixed(0)}` : 'Kein Schnitt'}
          color="bg-amber-50"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['active', 'history', 'config'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === t
                  ? 'bg-matcha-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'active' ? 'Aktive Risiken' : t === 'history' ? 'Interventions-Log' : 'Konfiguration'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-matcha-600 text-white text-sm font-semibold hover:bg-matcha-700 disabled:opacity-50 transition-colors"
          >
            <Scan className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scannen…' : 'Jetzt scannen'}
          </button>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-40"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Risks Tab */}
      {tab === 'active' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Lade Daten…</div>
          ) : (dashboard?.activeEvents ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <ShieldCheck className="w-10 h-10 text-matcha-400 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">Keine aktiven Risiken</p>
              <p className="text-sm text-gray-400 mt-1">
                Alle Lieferbestellungen sind im grünen Bereich.
              </p>
            </div>
          ) : (
            dashboard!.activeEvents.map((event) => (
              <RescueEventCard
                key={event.id}
                event={event}
                onIntervene={handleIntervene}
              />
            ))
          )}
        </div>
      )}

      {/* Intervention Log Tab */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2">Uhrzeit</th>
                <th className="text-left px-4 py-2">Bestellung</th>
                <th className="text-left px-4 py-2">Intervention</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(dashboard?.recentInterventions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-gray-400 text-xs">
                    Noch keine Interventionen
                  </td>
                </tr>
              ) : (
                dashboard!.recentInterventions.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-500">{fmtTime(i.executedAt)}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {i.orderNr ?? i.orderId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {INTERVENTION_LABELS[i.interventionType]}
                    </td>
                    <td className="px-4 py-2">
                      {i.success === true ? (
                        <span className="flex items-center gap-1 text-matcha-600 text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      ) : i.success === false ? (
                        <span className="flex items-center gap-1 text-red-500 text-xs font-semibold">
                          <BadgeX className="w-3 h-3" /> Fehler
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Config Tab */}
      {tab === 'config' && dashboard?.config && (
        <div className="max-w-lg">
          <ConfigPanel
            config={dashboard.config}
            onSave={handleSaveConfig}
            saving={saving}
          />
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Wie funktioniert die Rescue Engine?</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Scannt alle aktiven Lieferbestellungen alle 2 Minuten</li>
              <li>Berechnet einen Risiko-Score (0–100) aus 5 Faktoren</li>
              <li>Ab Rescue-Schwelle werden automatische Interventionen ausgelöst</li>
              <li>Prioritäts-Boost: Bestellung wird beim nächsten Dispatch bevorzugt</li>
              <li>Voucher-Angebot: Bei kritischen Fällen optional aktivierbar</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
