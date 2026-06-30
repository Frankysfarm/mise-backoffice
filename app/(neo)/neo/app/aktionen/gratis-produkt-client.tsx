'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Gift, Check, X, Loader2, TrendingUp, ShieldCheck } from 'lucide-react';
import { saveGratisProduktConfig } from './actions';
import type { FreeProductConfig } from '@/lib/free-product/types';

type MenuItem = { id: string; name: string; preis: number };

type Props = {
  tenantId: string;
  initialConfig: FreeProductConfig | null;
  menuItems: MenuItem[];
  redemptionsLast30: number;
};

export function GratisProdukClientUi({ tenantId, initialConfig, menuItems, redemptionsLast30 }: Props) {
  const [aktiv, setAktiv] = useState(initialConfig?.aktiv ?? false);
  const [selectedItems, setSelectedItems] = useState<string[]>(initialConfig?.eligible_item_ids ?? []);
  const [triggerMode, setTriggerMode] = useState(initialConfig?.trigger_mode ?? 'immer');
  const [triggerBetrag, setTriggerBetrag] = useState(initialConfig?.trigger_ab_betrag?.toString() ?? '15');
  const [placement, setPlacement] = useState(initialConfig?.placement ?? 'popup');
  const [cooldownTage, setCooldownTage] = useState(initialConfig?.cooldown_tage?.toString() ?? '7');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleItem(id: string) {
    setSelectedItems(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function save() {
    setError(null);
    if (aktiv && selectedItems.length === 0) {
      setError('Wähle mindestens 1 Produkt aus.');
      return;
    }
    setSaving(true);
    const res = await saveGratisProduktConfig({
      aktiv,
      eligible_item_ids: selectedItems,
      trigger_mode: triggerMode as any,
      trigger_ab_betrag: triggerMode === 'ab_betrag' ? parseFloat(triggerBetrag) : null,
      trigger_nach_sekunden: null,
      placement: placement as any,
      cooldown_tage: parseInt(cooldownTage) || 7,
    });
    setSaving(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Einlösungen (30d)</div>
          <div className="text-2xl font-bold mt-1">{redemptionsLast30}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Cooldown</div>
          <div className="text-2xl font-bold mt-1">{cooldownTage}d</div>
        </Card>
      </div>

      {/* Toggle */}
      <Card className="p-5 border-2 border-dashed">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${aktiv ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Gift size={20} className={aktiv ? 'text-green-700' : 'text-gray-500'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold">Gratis Produkt pro Bestellung</span>
              {aktiv ? <Badge>aktiv</Badge> : <Badge variant="secondary">aus</Badge>}
            </div>
            <p className="text-sm text-gray-600 mt-1">Max. 1x alle {cooldownTage} Tage pro Kunde (Anti-Cheat)</p>
          </div>
          <button
            onClick={() => setAktiv(!aktiv)}
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              aktiv ? 'bg-red-100 text-red-900' : 'bg-green-700 text-white'
            }`}
          >
            {aktiv ? 'Aus' : 'An'}
          </button>
        </div>
      </Card>

      {/* Produkt-Auswahl */}
      <Card className="p-5">
        <div className="font-bold mb-2">Wählbare Produkte ({selectedItems.length})</div>
        <div className="grid grid-cols-2 gap-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`rounded-lg border p-2 text-sm text-left transition ${
                selectedItems.includes(item.id)
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="font-semibold">{item.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.preis.toFixed(2)} €</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Trigger */}
      <Card className="p-5">
        <div className="font-bold mb-3">Trigger</div>
        <div className="space-y-2">
          {['immer', 'ab_betrag'].map(mode => (
            <label key={mode} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={triggerMode === mode}
                onChange={() => setTriggerMode(mode)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium capitalize">{mode === 'immer' ? 'Immer' : 'Ab Bestellwert'}</span>
              {mode === 'ab_betrag' && triggerMode === 'ab_betrag' && (
                <input
                  type="number"
                  value={triggerBetrag}
                  onChange={e => setTriggerBetrag(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border rounded"
                />
              )}
            </label>
          ))}
        </div>
      </Card>

      {/* Placement */}
      <Card className="p-5">
        <div className="font-bold mb-3">Wo anzeigen?</div>
        <div className="space-y-2">
          {['popup', 'cart', 'checkout'].map(p => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={placement === p}
                onChange={() => setPlacement(p)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium capitalize">{p}</span>
            </label>
          ))}
        </div>
      </Card>

      {error && <div className="p-3 rounded bg-red-100 text-red-900 text-sm">{error}</div>}
      <button
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded font-semibold disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Speichern
      </button>
    </div>
  );
}
