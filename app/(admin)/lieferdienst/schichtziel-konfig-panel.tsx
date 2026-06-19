'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, Save, CheckCircle2, AlertTriangle, Loader2, Settings2 } from 'lucide-react';

interface GoalConfig {
  targetOrders: number;
  targetRevenue: number;
  shiftHoursTotal: number;
  shiftStartHour: number;
}

const DEFAULTS: GoalConfig = {
  targetOrders: 60,
  targetRevenue: 1500,
  shiftHoursTotal: 8,
  shiftStartHour: 10,
};

export function SchichtzielKonfigPanel({ locationId }: { locationId?: string | null }) {
  const [config, setConfig] = useState<GoalConfig>(DEFAULTS);
  const [draft, setDraft] = useState<GoalConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = `/api/delivery/admin/shift-goals?action=config${locationId ? `&location_id=${locationId}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      const cfg: GoalConfig = {
        targetOrders: d.config?.targetOrders ?? DEFAULTS.targetOrders,
        targetRevenue: d.config?.targetRevenue ?? DEFAULTS.targetRevenue,
        shiftHoursTotal: d.config?.shiftHoursTotal ?? DEFAULTS.shiftHoursTotal,
        shiftStartHour: d.config?.shiftStartHour ?? DEFAULTS.shiftStartHour,
      };
      setConfig(cfg);
      setDraft(cfg);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const url = `/api/delivery/admin/shift-goals${locationId ? `?location_id=${locationId}` : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetOrders: draft.targetOrders,
          targetRevenue: draft.targetRevenue,
          shiftHoursTotal: draft.shiftHoursTotal,
          shiftStartHour: draft.shiftStartHour,
        }),
      });
      if (!res.ok) throw new Error('Speichern fehlgeschlagen');
      setConfig(draft);
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
    } catch (e) {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  function NumInput({
    label, value, onChange, min, max, step = 1, unit,
  }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step?: number; unit?: string;
  }) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-matcha-400">{label}</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(Math.max(min, value - step))}
            className="h-8 w-8 rounded-lg bg-matcha-800/60 border border-matcha-700/40 text-matcha-200 font-black text-sm active:scale-95 transition-transform flex items-center justify-center"
          >−</button>
          <div className="flex-1 text-center">
            <span className="text-lg font-black text-white tabular-nums">{value}</span>
            {unit && <span className="text-[10px] text-matcha-400 ml-1">{unit}</span>}
          </div>
          <button
            onClick={() => onChange(Math.min(max, value + step))}
            className="h-8 w-8 rounded-lg bg-matcha-800/60 border border-matcha-700/40 text-matcha-200 font-black text-sm active:scale-95 transition-transform flex items-center justify-center"
          >+</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-matcha-700/40 bg-matcha-900/40 overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-matcha-900/60 hover:bg-matcha-800/60 transition-colors"
      >
        <Settings2 className="h-3.5 w-3.5 text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">Schicht-Ziele konfigurieren</span>
        {!loading && (
          <div className="ml-auto flex items-center gap-3 text-[9px] text-matcha-500">
            <span>{config.targetOrders} Bestellungen</span>
            <span>{config.targetRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} Umsatz</span>
            <span className={cn('font-bold text-[10px] text-matcha-400', open && 'rotate-180 transition-transform')}>▾</span>
          </div>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-matcha-500 ml-auto" />}
      </button>

      {/* Form */}
      {open && (
        <div className="border-t border-matcha-700/40 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumInput
              label="Ziel-Bestellungen"
              value={draft.targetOrders}
              onChange={(v) => setDraft(d => ({ ...d, targetOrders: v }))}
              min={1} max={500} step={5}
              unit="Bestellungen"
            />
            <NumInput
              label="Ziel-Umsatz"
              value={draft.targetRevenue}
              onChange={(v) => setDraft(d => ({ ...d, targetRevenue: v }))}
              min={100} max={10000} step={50}
              unit="€"
            />
            <NumInput
              label="Schichtdauer"
              value={draft.shiftHoursTotal}
              onChange={(v) => setDraft(d => ({ ...d, shiftHoursTotal: v }))}
              min={1} max={16} step={1}
              unit="Stunden"
            />
            <NumInput
              label="Schichtstart"
              value={draft.shiftStartHour}
              onChange={(v) => setDraft(d => ({ ...d, shiftStartHour: v }))}
              min={0} max={23} step={1}
              unit="Uhr"
            />
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-matcha-800/40 border border-matcha-700/30 px-3 py-2.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-matcha-500 mb-1.5">Vorschau</div>
            <div className="text-[10px] text-matcha-300 space-y-0.5">
              <div>
                Schicht: {draft.shiftStartHour}:00 – {(draft.shiftStartHour + draft.shiftHoursTotal) % 24}:00 Uhr ({draft.shiftHoursTotal}h)
              </div>
              <div>
                Ziel: {Math.round(draft.targetOrders / draft.shiftHoursTotal * 10) / 10} Bestellungen/h,{' '}
                {(draft.targetRevenue / draft.shiftHoursTotal).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}/h
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="text-[11px] text-red-300">{error}</span>
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-all active:scale-95',
              saved
                ? 'bg-matcha-500 text-matcha-900'
                : isDirty
                ? 'bg-accent text-matcha-900 hover:bg-accent/90'
                : 'bg-matcha-800/60 text-matcha-500 cursor-not-allowed',
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <><CheckCircle2 className="h-4 w-4" /> Gespeichert</>
            ) : (
              <><Save className="h-4 w-4" /> Ziele speichern</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
