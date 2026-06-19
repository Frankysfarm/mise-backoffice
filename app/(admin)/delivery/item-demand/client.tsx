'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, AlertTriangle, CheckCircle2, Package, RefreshCw,
  ShoppingCart, TrendingUp, Clock, Loader2, Plus, Edit2, Truck,
} from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type AlertLevel = 'warning' | 'critical';
type AlertStatus = 'open' | 'ordered' | 'resolved';

interface DemandAlert {
  id: string;
  itemName: string;
  alertLevel: AlertLevel;
  currentStock: number;
  reorderPoint: number;
  avgDailyDemand: number;
  daysUntilDepletion: number | null;
  suggestedOrderQty: number | null;
  status: AlertStatus;
  unit?: string;
  supplierName?: string | null;
  leadTimeDays?: number;
}

interface ItemStock {
  id: string;
  itemName: string;
  currentStock: number;
  unit: string;
  minStockLevel: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  costPerUnit: number;
  supplierName: string | null;
  lastCheckedAt: string;
}

interface Dashboard {
  locationId: string;
  totalTrackedItems: number;
  itemsOk: number;
  itemsWarning: number;
  itemsCritical: number;
  openAlerts: DemandAlert[];
  stockList: ItemStock[];
  topDemandItems: { itemName: string; avgDailyDemand: number; unit: string }[];
  lastCheckedAt: string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function levelColor(level: AlertLevel) {
  return level === 'critical' ? 'text-red-600 bg-red-50 border-red-200' : 'text-amber-600 bg-amber-50 border-amber-200';
}

function stockBg(item: ItemStock) {
  if (item.currentStock <= item.minStockLevel) return 'border-red-200 bg-red-50';
  if (item.currentStock <= item.reorderPoint) return 'border-amber-200 bg-amber-50';
  return 'border-green-200 bg-green-50';
}

function stockIcon(item: ItemStock) {
  if (item.currentStock <= item.minStockLevel) return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (item.currentStock <= item.reorderPoint) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <CheckCircle2 className="h-4 w-4 text-green-500" />;
}

// ── Stock-Formular Modal ──────────────────────────────────────────────────────

interface StockFormProps {
  initial?: Partial<ItemStock>;
  onSave: (data: {
    itemName: string; currentStock: number; unit: string;
    minStockLevel: number; reorderQty: number; leadTimeDays: number;
    costPerUnit: number; supplierName: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

function StockForm({ initial, onSave, onClose }: StockFormProps) {
  const [itemName, setItemName] = useState(initial?.itemName ?? '');
  const [currentStock, setCurrentStock] = useState(String(initial?.currentStock ?? 0));
  const [unit, setUnit] = useState(initial?.unit ?? 'stk');
  const [minStock, setMinStock] = useState(String(initial?.minStockLevel ?? 0));
  const [reorderQty, setReorderQty] = useState(String(initial?.reorderQty ?? 0));
  const [leadTime, setLeadTime] = useState(String(initial?.leadTimeDays ?? 1));
  const [cost, setCost] = useState(String(initial?.costPerUnit ?? 0));
  const [supplier, setSupplier] = useState(initial?.supplierName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!itemName.trim()) { setError('Artikelname erforderlich'); return; }
    setSaving(true);
    try {
      await onSave({
        itemName: itemName.trim(),
        currentStock: Number(currentStock),
        unit,
        minStockLevel: Number(minStock),
        reorderQty: Number(reorderQty),
        leadTimeDays: Number(leadTime),
        costPerUnit: Number(cost),
        supplierName: supplier.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{initial?.itemName ? 'Lagerstand bearbeiten' : 'Artikel hinzufügen'}</h2>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Artikelname</label>
            <input
              value={itemName} onChange={(e) => setItemName(e.target.value)}
              disabled={!!initial?.itemName}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              placeholder="z. B. Mehl (kg)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Aktueller Bestand</label>
              <input type="number" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Einheit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="stk / kg / l" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Mindestbestand</label>
              <input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Bestellmenge</label>
              <input type="number" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Lieferzeit (Tage)</label>
              <input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Kosten/Einheit (€)</label>
              <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Lieferant (optional)</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Lieferantenname" />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Abbrechen</button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-matcha-600 text-white rounded-lg hover:bg-matcha-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Client ──────────────────────────────────────────────────────────────

type Tab = 'alerts' | 'lager' | 'top-items';

export function ItemDemandClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('alerts');
  const [checking, setChecking] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ItemStock | null>(null);
  const [markingOrdered, setMarkingOrdered] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/item-demand?action=dashboard');
      const json = await res.json() as { ok: boolean; dashboard: Dashboard };
      if (json.ok) setDashboard(json.dashboard);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runCheck() {
    setChecking(true);
    await fetch('/api/delivery/admin/item-demand', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    });
    await load();
    setChecking(false);
  }

  async function handleUpsert(data: Parameters<StockFormProps['onSave']>[0]) {
    const res = await fetch('/api/delivery/admin/item-demand', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_stock', item: data }),
    });
    const json = await res.json() as { ok: boolean };
    if (!json.ok) throw new Error('Speichern fehlgeschlagen');
    await load();
  }

  async function handleMarkOrdered(itemName: string) {
    setMarkingOrdered(itemName);
    await fetch('/api/delivery/admin/item-demand', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_ordered', item_name: itemName }),
    });
    await load();
    setMarkingOrdered(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-matcha-600" />
      </div>
    );
  }

  const d = dashboard;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-matcha-600" />
            Artikel-Nachfrage-Prognose
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Lagerstand-Tracking · Reorder-Point · Alarmierung bei kritischem Bestand</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditItem(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-matcha-600 text-white rounded-lg hover:bg-matcha-700"
          >
            <Plus className="h-3.5 w-3.5" /> Artikel
          </button>
          <button
            onClick={() => void runCheck()} disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Jetzt prüfen
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<Package className="h-4 w-4 text-gray-500" />} label="Artikel gesamt" value={String(d?.totalTrackedItems ?? 0)} />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Bestand OK" value={String(d?.itemsOk ?? 0)} color="green" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Warnung" value={String(d?.itemsWarning ?? 0)} color="amber" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Kritisch" value={String(d?.itemsCritical ?? 0)} color="red" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['alerts', 'Alarme'], ['lager', 'Lagerbestand'], ['top-items', 'Top-Nachfrage']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-matcha-600 text-matcha-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Alarme-Tab */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          {(!d?.openAlerts || d.openAlerts.length === 0) ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
              Kein Alarm aktiv — alle Bestände im grünen Bereich.
            </div>
          ) : (
            d.openAlerts.map((alert) => (
              <div key={alert.id} className={`rounded-xl border p-4 ${levelColor(alert.alertLevel)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="font-semibold text-sm">{alert.itemName}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${alert.alertLevel === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {alert.alertLevel === 'critical' ? 'KRITISCH' : 'WARNUNG'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                      <Stat label="Bestand" value={`${alert.currentStock} ${alert.unit ?? ''}`} />
                      <Stat label="Reorder-Punkt" value={`${alert.reorderPoint} ${alert.unit ?? ''}`} />
                      <Stat label="Tages-Bedarf" value={`${alert.avgDailyDemand.toFixed(1)} ${alert.unit ?? ''}/Tag`} />
                      {alert.daysUntilDepletion !== null && (
                        <Stat label="Erschöpfung in" value={`${alert.daysUntilDepletion} Tage`} emphasis />
                      )}
                      {alert.suggestedOrderQty && (
                        <Stat label="Vorgeschlagene Menge" value={`${alert.suggestedOrderQty} ${alert.unit ?? ''}`} />
                      )}
                      {alert.supplierName && (
                        <Stat label="Lieferant" value={alert.supplierName} />
                      )}
                      {alert.leadTimeDays && (
                        <Stat label="Lieferzeit" value={`${alert.leadTimeDays} Tage`} />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleMarkOrdered(alert.itemName)}
                    disabled={markingOrdered === alert.itemName}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-current rounded-lg hover:opacity-80 disabled:opacity-50"
                  >
                    {markingOrdered === alert.itemName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                    Bestellt
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Lager-Tab */}
      {tab === 'lager' && (
        <div className="space-y-2">
          {(!d?.stockList || d.stockList.length === 0) ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              Noch keine Artikel erfasst. Klick "Artikel" oben rechts zum Hinzufügen.
            </div>
          ) : (
            d.stockList.map((item) => (
              <div key={item.id} className={`rounded-xl border p-3 flex items-center gap-3 ${stockBg(item)}`}>
                {stockIcon(item)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{item.itemName}</div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span>Bestand: <strong>{item.currentStock} {item.unit}</strong></span>
                    <span>Reorder: {item.reorderPoint} {item.unit}</span>
                    <span>Mindest: {item.minStockLevel} {item.unit}</span>
                    {item.supplierName && <span>Lieferant: {item.supplierName}</span>}
                  </div>
                </div>
                <button
                  onClick={() => { setEditItem(item); setShowForm(true); }}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-white/60 text-gray-500"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Top-Nachfrage-Tab */}
      {tab === 'top-items' && (
        <div className="space-y-3">
          {(!d?.topDemandItems || d.topDemandItems.length === 0) ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              Noch keine Nachfrage-Daten vorhanden.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Durchschnittliche Tagesnachfrage der letzten 14 Tage</p>
              {d.topDemandItems.map((item, i) => {
                const maxDemand = d.topDemandItems[0]?.avgDailyDemand ?? 1;
                const pct = Math.round((item.avgDailyDemand / maxDemand) * 100);
                return (
                  <div key={item.itemName} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3">
                    <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-matcha-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-gray-900">{item.avgDailyDemand.toFixed(1)}</div>
                      <div className="text-[10px] text-gray-400">{item.unit}/Tag</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {d?.lastCheckedAt && (
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Zuletzt geprüft: {new Date(d.lastCheckedAt).toLocaleString('de-DE')}
            </p>
          )}
        </div>
      )}

      {/* Stock-Formular Modal */}
      {showForm && (
        <StockForm
          initial={editItem ?? undefined}
          onSave={handleUpsert}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

// ── Kleine Hilfskomponenten ───────────────────────────────────────────────────

function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color?: 'green' | 'amber' | 'red';
}) {
  const bg = color === 'green' ? 'bg-green-50 border-green-100'
    : color === 'amber' ? 'bg-amber-50 border-amber-100'
    : color === 'red' ? 'bg-red-50 border-red-100'
    : 'bg-white border-gray-100';
  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <span className="text-[10px] opacity-70">{label}:</span>{' '}
      <span className={emphasis ? 'font-bold' : ''}>{value}</span>
    </div>
  );
}
