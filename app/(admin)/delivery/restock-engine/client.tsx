'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package, AlertTriangle, CheckCircle, Clock, TrendingDown,
  RefreshCw, Edit2, ShoppingCart, ChevronDown, ChevronUp,
  Euro, Box,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { RestockDashboard, MaterialBurnRate, RestockAlert, AlertStatus } from '@/lib/delivery/restock-engine';

interface Props {
  locationId: string;
  initial: RestockDashboard | null;
}

const STOCK_COLORS: Record<string, string> = {
  critical: 'text-red-600',
  warning:  'text-amber-600',
  ok:       'text-emerald-600',
};

const STOCK_BG: Record<string, string> = {
  critical: 'bg-red-50 border-red-200',
  warning:  'bg-amber-50 border-amber-200',
  ok:       'bg-white border-gray-200',
};

const STOCK_BAR: Record<string, string> = {
  critical: 'bg-red-500',
  warning:  'bg-amber-500',
  ok:       'bg-emerald-500',
};

const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open:     'Offen',
  ordered:  'Bestellt',
  resolved: 'Erledigt',
};

const ALERT_STATUS_COLORS: Record<AlertStatus, string> = {
  open:     'bg-red-100 text-red-700',
  ordered:  'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

function euro(n: number) {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StockBar({ material }: { material: MaterialBurnRate }) {
  const pct = material.min_stock_level > 0
    ? Math.min(100, Math.round((material.current_stock / (material.min_stock_level * 3)) * 100))
    : 100;

  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${STOCK_BAR[material.stock_level]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="text-gray-400 mt-1">{icon}</div>
      </div>
    </Card>
  );
}

function StockUpdateModal({
  material,
  onClose,
  onSave,
}: {
  material: MaterialBurnRate;
  onClose: () => void;
  onSave: (newStock: number) => Promise<void>;
}) {
  const [stock, setStock] = useState(material.current_stock.toString());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const n = parseInt(stock, 10);
    if (isNaN(n) || n < 0) return;
    setSaving(true);
    await onSave(n);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-gray-900 mb-1">{material.name}</h3>
        <p className="text-sm text-gray-500 mb-4">Neuen Lagerbestand eintragen</p>

        <label className="block text-xs font-medium text-gray-700 mb-1">
          Bestand ({material.unit})
        </label>
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialRow({
  material,
  onUpdateStock,
}: {
  material: MaterialBurnRate;
  onUpdateStock: (m: MaterialBurnRate) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg p-4 ${STOCK_BG[material.stock_level]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{material.name}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              material.stock_level === 'critical' ? 'bg-red-100 text-red-700' :
              material.stock_level === 'warning'  ? 'bg-amber-100 text-amber-700' :
                                                     'bg-emerald-100 text-emerald-700'
            }`}>
              {material.stock_level === 'critical' ? 'Kritisch' :
               material.stock_level === 'warning'  ? 'Warnung' : 'OK'}
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {material.category}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <span className={`text-lg font-bold ${STOCK_COLORS[material.stock_level]}`}>
              {material.current_stock} {material.unit}
            </span>
            <span className="text-xs text-gray-500">
              Min: {material.min_stock_level}
            </span>
            {material.days_until_depletion !== null && (
              <span className={`text-xs font-medium ${
                material.days_until_depletion <= 3  ? 'text-red-600' :
                material.days_until_depletion <= 7  ? 'text-amber-600' :
                                                       'text-gray-500'
              }`}>
                Reicht noch {material.days_until_depletion} Tage
              </span>
            )}
          </div>

          <div className="mt-2">
            <StockBar material={material} />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onUpdateStock(material)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Bestand aktualisieren"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
          <div>
            <span className="text-gray-400 block">Ø Tagesverbrauch</span>
            <span className="font-medium">{material.avg_daily_usage.toFixed(1)} {material.unit}/Tag</span>
          </div>
          <div>
            <span className="text-gray-400 block">Nachbestellmenge</span>
            <span className="font-medium">{material.reorder_qty} {material.unit}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Kostpreis</span>
            <span className="font-medium">{euro(Number(material.cost_per_unit))}/{material.unit}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Pro Bestellung</span>
            <span className="font-medium">{material.items_per_order} {material.unit}</span>
          </div>
          {material.depletion_date_est && (
            <div>
              <span className="text-gray-400 block">Erschöpft am</span>
              <span className={`font-medium ${material.stock_level === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                {formatDate(material.depletion_date_est)}
              </span>
            </div>
          )}
          {material.last_restocked_at && (
            <div>
              <span className="text-gray-400 block">Zuletzt aufgefüllt</span>
              <span className="font-medium">{formatDate(material.last_restocked_at)}</span>
            </div>
          )}
          {material.supplier_name && (
            <div className="col-span-2">
              <span className="text-gray-400 block">Lieferant</span>
              <span className="font-medium">{material.supplier_name}</span>
              {material.supplier_email && (
                <a href={`mailto:${material.supplier_email}`} className="block text-blue-600 hover:underline">
                  {material.supplier_email}
                </a>
              )}
              {material.supplier_phone && <span className="block">{material.supplier_phone}</span>}
            </div>
          )}
          {material.snapshot_days > 0 && (
            <div>
              <span className="text-gray-400 block">Datengrundlage</span>
              <span className="font-medium">{material.snapshot_days} Tage</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  onUpdateStatus,
}: {
  alert: RestockAlert;
  onUpdateStatus: (id: string, status: AlertStatus, notes?: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);

  async function handleStatus(status: AlertStatus) {
    setUpdating(true);
    await onUpdateStatus(alert.id, status);
    setUpdating(false);
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">
              {alert.material_name ?? 'Material'}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ALERT_STATUS_COLORS[alert.status]}`}>
              {ALERT_STATUS_LABELS[alert.status]}
            </span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-gray-500">
            <span>Bestand: <strong className="text-red-600">{alert.current_stock}</strong></span>
            <span>Mindest: {alert.min_stock_level}</span>
            {alert.days_until_depletion !== null && (
              <span>Reicht: <strong className="text-amber-600">{alert.days_until_depletion} Tage</strong></span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Ausgelöst: {formatDate(alert.triggered_at)}
            {alert.ordered_at && ` · Bestellt: ${formatDate(alert.ordered_at)}`}
          </p>
          {alert.notes && (
            <p className="text-xs text-gray-500 mt-1 italic">{alert.notes}</p>
          )}
        </div>

        {alert.status !== 'resolved' && (
          <div className="flex gap-1 shrink-0">
            {alert.status === 'open' && (
              <button
                disabled={updating}
                onClick={() => handleStatus('ordered')}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <ShoppingCart size={12} />
                Bestellt
              </button>
            )}
            <button
              disabled={updating}
              onClick={() => handleStatus('resolved')}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle size={12} />
              Erledigt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Trend14dChart({ trend }: { trend: RestockDashboard['trend14d'] }) {
  if (!trend.length) return (
    <p className="text-sm text-gray-400 text-center py-6">Noch keine Verbrauchsdaten</p>
  );

  const maxUnits = Math.max(...trend.map((d) => d.total_units), 1);

  return (
    <div className="flex items-end gap-1 h-24">
      {trend.map((d) => {
        const h = Math.max(4, Math.round((d.total_units / maxUnits) * 80));
        const label = new Date(d.date).toLocaleDateString('de-DE', { weekday: 'short' });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.total_units} Einheiten, ${d.orders} Bestellungen`}>
            <div
              className="w-full bg-blue-400 rounded-t"
              style={{ height: `${h}px` }}
            />
            <span className="text-gray-400 text-[10px]">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function RestockEngineClient({ locationId, initial }: Props) {
  const [data, setData] = useState<RestockDashboard | null>(initial);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'materials' | 'alerts'>('materials');
  const [editMaterial, setEditMaterial] = useState<MaterialBurnRate | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'ok'>('all');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/restock-engine?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json() as { ok: boolean; dashboard: RestockDashboard };
        setData(json.dashboard);
        setLastRefresh(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000); // 5-Min Auto-Refresh
    return () => clearInterval(t);
  }, [load]);

  async function handleUpdateStock(material: MaterialBurnRate) {
    setEditMaterial(material);
  }

  async function saveStock(newStock: number) {
    if (!editMaterial) return;
    await fetch('/api/delivery/admin/restock-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_stock',
        material_id: editMaterial.id,
        new_stock: newStock,
        location_id: locationId,
      }),
    });
    await load();
  }

  async function handleAlertStatus(alertId: string, status: AlertStatus, notes?: string) {
    await fetch('/api/delivery/admin/restock-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_alert',
        alert_id: alertId,
        status,
        notes,
        location_id: locationId,
      }),
    });
    await load();
  }

  const summary = data?.summary;
  const materials = (data?.materials ?? []).filter((m) =>
    filter === 'all' ? true : m.stock_level === filter,
  );
  const alerts = data?.alerts ?? [];
  const trend  = data?.trend14d ?? [];

  const refreshAge = Math.floor((Date.now() - lastRefresh) / 1000);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={22} className="text-blue-600" />
            Restock-Engine
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Liefermaterial-Prognose · Verbrauch &amp; Bestellbedarf
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {refreshAge < 60 ? `vor ${refreshAge}s` : 'Aktualisieren'}
        </button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Box size={16} />}
          label="Materialien gesamt"
          value={summary?.total_materials ?? '—'}
        />
        <KpiCard
          icon={<AlertTriangle size={16} />}
          label="Kritischer Bestand"
          value={summary?.critical_count ?? 0}
          color={summary?.critical_count ? 'text-red-600' : undefined}
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Bald nachbestellen"
          value={summary?.warning_count ?? 0}
          color={summary?.warning_count ? 'text-amber-600' : undefined}
        />
        <KpiCard
          icon={<Euro size={16} />}
          label="Lagerwert (gesamt)"
          value={summary ? euro(summary.total_stock_value_eur) : '—'}
          sub={summary ? `Ø ${summary.avg_daily_orders} Bestellungen/Tag` : undefined}
        />
      </div>

      {/* Kritisch-Banner */}
      {(summary?.critical_count ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {summary!.critical_count} Material{summary!.critical_count > 1 ? 'ien' : ''} unter Mindestbestand
            </p>
            <p className="text-xs text-red-500">Sofortige Nachbestellung empfohlen</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        {(['materials', 'alerts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'materials' ? `Materialien (${data?.materials.length ?? 0})` : `Alarme (${alerts.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'critical', 'warning', 'ok'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all'      ? 'Alle' :
                 f === 'critical' ? 'Kritisch' :
                 f === 'warning'  ? 'Warnung' : 'OK'}
              </button>
            ))}
          </div>

          {/* Material-Liste */}
          <div className="space-y-2">
            {materials.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                Keine Materialien in dieser Kategorie
              </p>
            )}
            {materials.map((m) => (
              <MaterialRow
                key={m.id}
                material={m}
                onUpdateStock={handleUpdateStock}
              />
            ))}
          </div>

          {/* 14-Tage Trend */}
          {trend.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingDown size={14} className="text-blue-500" />
                Gesamtverbrauch (letzte 14 Tage)
              </h3>
              <Trend14dChart trend={trend} />
            </Card>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Keine aktiven Alarme</p>
              <p className="text-xs text-gray-400">Alle Materialien sind ausreichend bevorratet</p>
            </div>
          )}
          {alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onUpdateStatus={handleAlertStatus}
            />
          ))}

          {alerts.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Workflow</p>
              <p>1. <strong>Offen</strong> → Material unter Mindestbestand erkannt</p>
              <p>2. <strong>Bestellt</strong> → Nachbestellung ausgelöst (manuell markieren)</p>
              <p>3. <strong>Erledigt</strong> → Lieferung eingegangen, Bestand aktualisieren</p>
            </div>
          )}
        </div>
      )}

      {/* Stock-Update Modal */}
      {editMaterial && (
        <StockUpdateModal
          material={editMaterial}
          onClose={() => setEditMaterial(null)}
          onSave={saveStock}
        />
      )}

      {/* Info-Fußzeile */}
      <div className="text-xs text-gray-400 border-t border-gray-100 pt-4 flex items-center justify-between">
        <span>Verbrauch wird täglich aus Lieferbestellungen berechnet · 5-Min Auto-Refresh</span>
        {data?.last_snapshot_at && (
          <span>Letzter Snapshot: {formatDate(data.last_snapshot_at)}</span>
        )}
      </div>
    </div>
  );
}
