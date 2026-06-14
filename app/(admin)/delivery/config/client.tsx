'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Save, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';

interface SettingRow {
  key: string;
  effective_value: number;
  default_value: number;
  custom_value: number | null;
  is_customised: boolean;
  description: string;
  category: string;
  min_value: number | null;
  max_value: number | null;
}

type EditMap = Record<string, number>;

const CATEGORY_LABELS: Record<string, string> = {
  dispatch:  'Dispatch',
  bundling:  'Bundling',
  zones:     'Zonen',
  eta:       'ETA',
  kitchen:   'Küche',
  scoring:   'Scoring-Gewichte',
};

export function DeliveryConfigClient({ locationId }: { locationId: string }) {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [edits, setEdits] = useState<EditMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setEdits({});
    fetch(`/api/delivery/admin/config?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.settings) setSettings(d.settings as SettingRow[]);
        if (d?.categories) setCategories(d.categories as string[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const saveSetting = async (key: string) => {
    const value = edits[key];
    if (value === undefined) return;
    setSaving(key);
    setError(null);
    const res = await fetch('/api/delivery/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, key, value }),
    });
    const json = await res.json();
    if (res.ok) {
      setSettings(prev => prev.map(s => s.key === key
        ? { ...s, effective_value: json.effective_value, custom_value: value, is_customised: true }
        : s));
      setEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
      setSaved(key);
      setTimeout(() => setSaved(null), 3000);
    } else {
      setError(json.error ?? 'Fehler beim Speichern');
    }
    setSaving(null);
  };

  const resetAll = async () => {
    if (!confirm('Alle benutzerdefinierten Einstellungen auf Standardwerte zurücksetzen?')) return;
    setResetting(true);
    setError(null);
    const res = await fetch('/api/delivery/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, action: 'reset' }),
    });
    if (res.ok) { load(); }
    else { const json = await res.json(); setError(json.error ?? 'Fehler beim Zurücksetzen'); }
    setResetting(false);
  };

  const groupedByCategory = (categories.length > 0 ? categories : [...new Set(settings.map(s => s.category))])
    .map(cat => ({ cat, rows: settings.filter(s => s.category === cat) }))
    .filter(g => g.rows.length > 0);

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Konfiguration…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        <button onClick={resetAll} disabled={resetting}
          className="flex items-center gap-1.5 rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50 ml-auto">
          <RotateCcw className="h-3.5 w-3.5" />
          {resetting ? 'Setzt zurück…' : 'Alle zurücksetzen'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {groupedByCategory.map(({ cat, rows }) => (
        <div key={cat} className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 font-display font-bold text-sm">
            {CATEGORY_LABELS[cat] ?? cat}
          </div>
          <div className="divide-y divide-border">
            {rows.map(s => {
              const editVal = edits[s.key];
              const isDirty = editVal !== undefined;
              const displayVal = editVal ?? s.effective_value;
              return (
                <div key={s.key} className={cn('px-4 py-3 space-y-1.5', isDirty && 'bg-amber-50/50')}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.description || s.key}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{s.key}</div>
                    </div>
                    {s.is_customised && !isDirty && (
                      <span className="text-[10px] font-bold text-matcha-700 border border-matcha-200 bg-matcha-50 rounded-full px-1.5 py-0.5">Angepasst</span>
                    )}
                    {isDirty && (
                      <span className="text-[10px] font-bold text-amber-700 border border-amber-200 bg-amber-50 rounded-full px-1.5 py-0.5">Ungespeichert</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={displayVal}
                      min={s.min_value ?? undefined}
                      max={s.max_value ?? undefined}
                      step={displayVal < 1 ? 0.01 : displayVal < 10 ? 0.1 : 1}
                      onChange={e => setEdits(prev => ({ ...prev, [s.key]: Number(e.target.value) }))}
                      className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
                    />
                    {s.min_value !== null && s.max_value !== null && (
                      <span className="text-xs text-muted-foreground">({s.min_value} – {s.max_value})</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-1">Standard: {s.default_value}</span>
                    {isDirty && (
                      <button onClick={() => saveSetting(s.key)} disabled={saving === s.key}
                        className="ml-auto flex items-center gap-1 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-2.5 py-1 text-xs font-bold hover:bg-matcha-800 transition disabled:opacity-50">
                        <Save className="h-3 w-3" />
                        {saving === s.key ? '…' : 'Speichern'}
                      </button>
                    )}
                    {saved === s.key && (
                      <span className="flex items-center gap-1 text-xs text-matcha-700 font-bold ml-auto">
                        <CheckCircle2 className="h-3.5 w-3.5" /> OK
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {settings.length === 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Keine Einstellungen gefunden. Migration 027 möglicherweise ausstehend.
        </div>
      )}
    </div>
  );
}
