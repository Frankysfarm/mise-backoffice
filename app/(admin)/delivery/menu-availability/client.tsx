'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  UtensilsCrossed, AlertTriangle, CheckCircle2, RefreshCw,
  Plus, Trash2, EyeOff, Eye, Clock, BarChart2, Loader2,
  ChevronDown, ChevronUp, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type ItemState = 'available' | 'disabled';
type EventType =
  | 'auto_disabled' | 'manual_disabled'
  | 'auto_restored' | 'manual_restored'
  | 'item_added' | 'item_removed';

interface ManagedItem {
  id: string;
  itemName: string;
  autoDisableEnabled: boolean;
  queueDepthThreshold: number;
  isDisabled: boolean;
  currentState: ItemState;
  disabledReason: string | null;
  disabledBy: string | null;
  disabledUntil: string | null;
  disabledMinutesRemaining: number | null;
  disableCount7d: number;
  lastAutoDisabledAt: string | null;
}

interface AvailabilityEvent {
  id: string;
  itemName: string;
  eventType: EventType;
  triggerQueueDepth: number | null;
  triggerReason: string | null;
  disabledBy: string | null;
  durationMin: number | null;
  createdAt: string;
}

interface Dashboard {
  totalManaged: number;
  currentlyDisabled: number;
  autoDisabledToday: number;
  manualDisabledCount: number;
  mostDisabledItem: string | null;
  items: ManagedItem[];
  recentEvents: AvailabilityEvent[];
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMinutesAgo(ts: string): string {
  const min = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  return `vor ${Math.floor(min / 60)} Std`;
}

function eventLabel(type: EventType): { label: string; color: string } {
  switch (type) {
    case 'auto_disabled':    return { label: 'Auto-Deaktiviert',  color: 'text-orange-600' };
    case 'manual_disabled':  return { label: 'Manuell Deaktiviert', color: 'text-red-600' };
    case 'auto_restored':    return { label: 'Auto-Wiederhergestellt', color: 'text-green-600' };
    case 'manual_restored':  return { label: 'Manuell Wiederhergestellt', color: 'text-emerald-600' };
    case 'item_added':       return { label: 'Artikel Hinzugefügt', color: 'text-blue-600' };
    case 'item_removed':     return { label: 'Artikel Entfernt',   color: 'text-slate-500' };
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MenuAvailabilityClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'items' | 'events'>('items');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Add form state
  const [newItemName, setNewItemName] = useState('');
  const [newThreshold, setNewThreshold] = useState(8);
  const [newAutoDisable, setNewAutoDisable] = useState(true);

  // Disable form state
  const [disableItemName, setDisableItemName] = useState<string | null>(null);
  const [disableDuration, setDisableDuration] = useState<number | null>(30);
  const [disableReason, setDisableReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/menu-availability?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/delivery/admin/menu-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, ...body }),
    });
    if (!res.ok) throw new Error(await res.text());
    await load();
  }

  function handleAddItem() {
    if (!newItemName.trim()) return;
    startTransition(async () => {
      await post({
        action: 'add_item',
        item_name: newItemName.trim(),
        auto_disable_enabled: newAutoDisable,
        queue_depth_threshold: newThreshold,
      });
      setNewItemName('');
      setShowAddForm(false);
    });
  }

  function handleRemove(itemName: string) {
    startTransition(() => post({ action: 'remove_item', item_name: itemName }));
  }

  function handleRestore(itemName: string) {
    startTransition(() => post({ action: 'restore', item_name: itemName }));
  }

  function handleDisable() {
    if (!disableItemName || !disableReason.trim()) return;
    startTransition(async () => {
      await post({
        action: 'disable',
        item_name: disableItemName,
        duration_min: disableDuration,
        reason: disableReason.trim(),
      });
      setDisableItemName(null);
      setDisableReason('');
    });
  }

  function handleEvaluate() {
    startTransition(() => post({ action: 'evaluate' }));
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<UtensilsCrossed className="h-5 w-5" />}
          label="Artikel überwacht"
          value={d.totalManaged}
          color="blue"
        />
        <KpiCard
          icon={<EyeOff className="h-5 w-5" />}
          label="Aktuell deaktiviert"
          value={d.currentlyDisabled}
          color={d.currentlyDisabled > 0 ? 'red' : 'green'}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Auto-Deaktivierungen heute"
          value={d.autoDisabledToday}
          color={d.autoDisabledToday > 3 ? 'orange' : 'slate'}
        />
        <KpiCard
          icon={<BarChart2 className="h-5 w-5" />}
          label="Häufigster Ausfall (7T)"
          value={d.mostDisabledItem ?? '—'}
          color="slate"
          isText
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['items', 'events'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                activeTab === t
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'items' ? 'Artikel' : 'Ereignisse'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <button
          onClick={handleEvaluate}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
          Jetzt evaluieren
        </button>

        <button
          onClick={() => load()}
          className="p-1.5 border rounded-lg hover:bg-muted transition-colors"
          title="Aktualisieren"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {activeTab === 'items' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-matcha-600 text-white rounded-lg hover:bg-matcha-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Artikel hinzufügen
          </button>
        )}
      </div>

      {/* Add-Form */}
      {showAddForm && activeTab === 'items' && (
        <div className="border rounded-xl p-4 bg-muted/40 space-y-4">
          <h3 className="font-semibold text-sm">Neuen Artikel zur Verfügbarkeits-Engine hinzufügen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Artikel-Name (exakt wie in der Speisekarte)</label>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="z.B. Pulled Pork Burger"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Queue-Schwelle (Auto-Disable bei ≥ N)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={newThreshold}
                onChange={(e) => setNewThreshold(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newAutoDisable}
                onChange={(e) => setNewAutoDisable(e.target.checked)}
                className="rounded"
              />
              Auto-Disable aktivieren
            </label>
            <div className="flex-1" />
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
            >
              Abbrechen
            </button>
            <button
              onClick={handleAddItem}
              disabled={!newItemName.trim() || isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-matcha-600 text-white rounded-lg hover:bg-matcha-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {disableItemName && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-semibold">„{disableItemName}" deaktivieren</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grund *</label>
              <input
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                placeholder="z.B. Zutat nicht verfügbar"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dauer (Min, leer = dauerhaft)</label>
              <div className="flex gap-2 flex-wrap">
                {[null, 15, 30, 60, 120].map((v) => (
                  <button
                    key={v ?? 'inf'}
                    onClick={() => setDisableDuration(v)}
                    className={cn(
                      'px-3 py-1 text-sm rounded-lg border transition-colors',
                      disableDuration === v
                        ? 'bg-red-600 text-white border-red-600'
                        : 'hover:bg-muted',
                    )}
                  >
                    {v === null ? 'Dauerhaft' : `${v} Min`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDisableItemName(null)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDisable}
                disabled={!disableReason.trim() || isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                Deaktivieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'items' && (
        <div className="space-y-3">
          {d.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Keine Artikel konfiguriert</p>
              <p className="text-sm mt-1">Füge Menü-Artikel hinzu, um ihre Verfügbarkeit zu steuern.</p>
            </div>
          ) : (
            d.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                expanded={expandedItem === item.id}
                onToggleExpand={() =>
                  setExpandedItem(expandedItem === item.id ? null : item.id)
                }
                onDisable={() => setDisableItemName(item.itemName)}
                onRestore={() => handleRestore(item.itemName)}
                onRemove={() => handleRemove(item.itemName)}
                isPending={isPending}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-2">
          {d.recentEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Noch keine Ereignisse aufgezeichnet.</p>
            </div>
          ) : (
            d.recentEvents.map((ev) => {
              const { label, color } = eventLabel(ev.eventType);
              return (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="pt-0.5">
                    {ev.eventType.includes('disabled') ? (
                      <EyeOff className={cn('h-4 w-4', color)} />
                    ) : (
                      <Eye className={cn('h-4 w-4', color)} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm font-medium', color)}>{label}</span>
                      <span className="text-sm font-semibold truncate">„{ev.itemName}"</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                      {ev.triggerQueueDepth != null && (
                        <span>Queue: {ev.triggerQueueDepth}</span>
                      )}
                      {ev.durationMin != null && (
                        <span>Dauer: {ev.durationMin} Min</span>
                      )}
                      {ev.disabledBy && (
                        <span>von: {ev.disabledBy}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatMinutesAgo(ev.createdAt)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-right">
        Stand: {data ? formatMinutesAgo(data.generatedAt) : '—'} · Auto-Refresh 30s
      </p>
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, color, isText = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'red' | 'orange' | 'slate';
  isText?: boolean;
}) {
  const colorMap = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-emerald-50 text-emerald-700',
    red:    'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    slate:  'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center mb-3', colorMap[color])}>
        {icon}
      </div>
      <div className={cn('font-bold', isText ? 'text-base truncate' : 'text-2xl')}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function ItemRow({
  item, expanded, onToggleExpand, onDisable, onRestore, onRemove, isPending,
}: {
  item: ManagedItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onDisable: () => void;
  onRestore: () => void;
  onRemove: () => void;
  isPending: boolean;
}) {
  const isDisabled = item.currentState === 'disabled';

  return (
    <div className={cn(
      'rounded-xl border transition-colors',
      isDisabled ? 'border-red-200 bg-red-50/50' : 'border-border bg-card',
    )}>
      <div className="flex items-center gap-3 p-4">
        {/* Status Dot */}
        <div className={cn(
          'h-2.5 w-2.5 rounded-full flex-shrink-0',
          isDisabled ? 'bg-red-500 animate-pulse' : 'bg-emerald-500',
        )} />

        {/* Name + Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{item.itemName}</span>
            {isDisabled && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                <EyeOff className="h-3 w-3" />
                {item.disabledBy === 'auto' ? 'Auto-Deaktiviert' : 'Manuell Deaktiviert'}
              </span>
            )}
            {item.disableCount7d > 0 && (
              <span className="text-xs text-muted-foreground">
                {item.disableCount7d}× diese Woche
              </span>
            )}
          </div>
          {isDisabled && item.disabledReason && (
            <p className="text-xs text-red-600 mt-0.5">{item.disabledReason}</p>
          )}
          {isDisabled && item.disabledMinutesRemaining != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3 inline mr-1" />
              Noch ca. {item.disabledMinutesRemaining} Min
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDisabled ? (
            <button
              onClick={onRestore}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              Wiederherstellen
            </button>
          ) : (
            <button
              onClick={onDisable}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Deaktivieren
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Auto-Disable</p>
              <p className={cn('font-medium', item.autoDisableEnabled ? 'text-emerald-600' : 'text-muted-foreground')}>
                {item.autoDisableEnabled ? 'Aktiv' : 'Deaktiviert'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Queue-Schwelle</p>
              <p className="font-medium">{item.queueDepthThreshold} Bestellungen</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Letzte Auto-Deaktivierung</p>
              <p className="font-medium text-sm">
                {item.lastAutoDisabledAt ? formatMinutesAgo(item.lastAutoDisabledAt) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ausfälle diese Woche</p>
              <p className={cn('font-bold text-lg', item.disableCount7d > 3 ? 'text-red-600' : '')}>
                {item.disableCount7d}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onRemove}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Aus Engine entfernen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
