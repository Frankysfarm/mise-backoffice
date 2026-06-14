'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Save, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

type AlertType = 'dispatch_queue_high' | 'no_drivers_online' | 'kitchen_overload' | 'stale_orders_critical' | 'eta_accuracy_low';
type AlertSeverity = 'info' | 'warning' | 'critical';

interface AlertRule {
  id: string;
  alert_type: AlertType;
  threshold_value: number;
  window_minutes: number;
  severity: AlertSeverity;
  enabled: boolean;
}

const TYPE_CONFIG: Record<AlertType, { label: string; desc: string; unit: string }> = {
  dispatch_queue_high:    { label: 'Dispatch-Queue hoch',      desc: 'Alarm wenn mehr als N Bestellungen warten',    unit: 'Bestellungen' },
  no_drivers_online:      { label: 'Keine Fahrer online',      desc: 'Alarm wenn 0 Fahrer seit N Minuten aktiv',     unit: 'Minuten' },
  kitchen_overload:       { label: 'Küche überlastet',         desc: 'Alarm wenn Küche-Queue N Bestellungen übersteigt', unit: 'Bestellungen' },
  stale_orders_critical:  { label: 'Feststeckende Bestellungen', desc: 'Alarm wenn N Bestellungen > 10 Min ohne Fahrer', unit: 'Bestellungen' },
  eta_accuracy_low:       { label: 'ETA-Genauigkeit niedrig',  desc: 'Alarm wenn ETA-Trefferquote unter N %',        unit: '%' },
};

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; badge: string }> = {
  info:     { label: 'Info',     badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  warning:  { label: 'Warnung',  badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  critical: { label: 'Kritisch', badge: 'bg-red-50 border-red-200 text-red-700' },
};

export function AlertRulesClient({ locationId }: { locationId: string }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/alert-rules?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rules) setRules(d.rules as AlertRule[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const update = (id: string, key: keyof AlertRule, value: unknown) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
  };

  const saveRule = async (rule: AlertRule) => {
    setSaving(rule.id);
    setError(null);
    const res = await fetch('/api/delivery/admin/alert-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id: locationId,
        alert_type: rule.alert_type,
        threshold_value: rule.threshold_value,
        window_minutes: rule.window_minutes,
        severity: rule.severity,
        enabled: rule.enabled,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setSaved(rule.id);
      setTimeout(() => setSaved(null), 3000);
    } else {
      setError(json.error ?? 'Fehler beim Speichern');
    }
    setSaving(null);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Alarm-Regeln…</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {rules.length === 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Keine Alarm-Regeln gefunden. Regeln werden beim ersten Alarm-Check automatisch erstellt.
        </div>
      )}

      {rules.map(rule => {
        const tc = TYPE_CONFIG[rule.alert_type];
        const sc = SEVERITY_CONFIG[rule.severity];
        return (
          <div key={rule.id} className={cn('rounded-xl border bg-card p-5 space-y-4', !rule.enabled && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="font-display font-bold">{tc?.label ?? rule.alert_type}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{tc?.desc}</div>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', sc.badge)}>{sc.label}</span>
              <button onClick={() => update(rule.id, 'enabled', !rule.enabled)}
                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0',
                  rule.enabled ? 'bg-matcha-700' : 'bg-muted')}>
                <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition',
                  rule.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Schwellwert ({tc?.unit ?? ''})
                </label>
                <input type="number" min={0} value={rule.threshold_value}
                  onChange={e => update(rule.id, 'threshold_value', Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fenster (Min)</label>
                <input type="number" min={1} value={rule.window_minutes}
                  onChange={e => update(rule.id, 'window_minutes', Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Schweregrad</label>
                <select value={rule.severity} onChange={e => update(rule.id, 'severity', e.target.value as AlertSeverity)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500">
                  <option value="info">Info</option>
                  <option value="warning">Warnung</option>
                  <option value="critical">Kritisch</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => saveRule(rule)} disabled={saving === rule.id}
                className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50">
                <Save className="h-3.5 w-3.5" />
                {saving === rule.id ? 'Speichert…' : 'Speichern'}
              </button>
              {saved === rule.id && (
                <div className="flex items-center gap-1.5 text-sm text-matcha-700">
                  <CheckCircle2 className="h-4 w-4" /> Gespeichert
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
