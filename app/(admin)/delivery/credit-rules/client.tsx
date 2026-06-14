'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Save, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';

type CreditTrigger = 'late_delivery' | 'failed_delivery' | 'manual';

interface CreditRule {
  id: string;
  triggerType: CreditTrigger;
  thresholdMin: number | null;
  creditEur: number;
  creditPct: number | null;
  maxCreditEur: number;
  expiresInDays: number;
  active: boolean;
}

const TRIGGER_LABELS: Record<CreditTrigger, string> = {
  late_delivery:   'Verspätete Lieferung',
  failed_delivery: 'Fehlgeschlagene Zustellung',
  manual:          'Manuell ausgelöst',
};

const DEFAULT_RULE: Omit<CreditRule, 'id'> = {
  triggerType: 'late_delivery',
  thresholdMin: 15,
  creditEur: 3.00,
  creditPct: null,
  maxCreditEur: 10.00,
  expiresInDays: 30,
  active: true,
};

export function CreditRulesClient({ locationId }: { locationId: string }) {
  const [rules, setRules] = useState<CreditRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState({ ...DEFAULT_RULE });

  useEffect(() => {
    fetch('/api/delivery/admin/credit-rules')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rules) setRules(d.rules as CreditRule[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const saveRule = async (rule: Partial<CreditRule> & { triggerType: CreditTrigger }) => {
    const isNew = !rule.id;
    setSaving(rule.id ?? '__new__');
    setError(null);
    const res = await fetch('/api/delivery/admin/credit-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger_type: rule.triggerType,
        threshold_min: rule.thresholdMin,
        credit_eur: rule.creditEur,
        credit_pct: rule.creditPct,
        max_credit_eur: rule.maxCreditEur,
        expires_in_days: rule.expiresInDays,
        active: rule.active ?? true,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      if (isNew && json.rule) {
        setRules(prev => {
          const existing = prev.findIndex(r => r.triggerType === json.rule.triggerType);
          return existing >= 0
            ? prev.map((r, i) => i === existing ? json.rule as CreditRule : r)
            : [...prev, json.rule as CreditRule];
        });
        setAdding(false);
        setNewRule({ ...DEFAULT_RULE });
      } else {
        setRules(prev => prev.map(r => r.triggerType === rule.triggerType ? { ...r, ...rule } : r));
      }
      setSaved(rule.id ?? '__new__');
      setTimeout(() => setSaved(null), 3000);
    } else {
      setError(json.error ?? 'Fehler beim Speichern');
    }
    setSaving(null);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Regeln…</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {rules.map(rule => (
        <div key={rule.id} className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="font-display font-bold">{TRIGGER_LABELS[rule.triggerType]}</div>
            <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold border',
              rule.active ? 'bg-matcha-50 border-matcha-200 text-matcha-700' : 'bg-muted border-border text-muted-foreground')}>
              {rule.active ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {rule.triggerType === 'late_delivery' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Schwellwert (Min)</label>
                <input type="number" min={1} value={rule.thresholdMin ?? ''} placeholder="Minuten Verspätung"
                  onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, thresholdMin: e.target.value ? Number(e.target.value) : null } : r))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gutschrift (€)</label>
              <input type="number" min={0} step={0.50} value={rule.creditEur}
                onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, creditEur: Number(e.target.value) } : r))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Max. Gutschrift (€)</label>
              <input type="number" min={0} step={1} value={rule.maxCreditEur}
                onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, maxCreditEur: Number(e.target.value) } : r))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gültig (Tage)</label>
              <input type="number" min={1} value={rule.expiresInDays}
                onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, expiresInDays: Number(e.target.value) } : r))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Gutschrift: <strong>{euro(rule.creditEur)}</strong> · Max: <strong>{euro(rule.maxCreditEur)}</strong> · Läuft ab in <strong>{rule.expiresInDays} Tagen</strong>
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
            <button onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              {rule.active ? 'Deaktivieren' : 'Aktivieren'}
            </button>
          </div>
        </div>
      ))}

      {/* Add new rule */}
      {adding ? (
        <div className="rounded-xl border border-matcha-200 bg-matcha-50/30 p-5 space-y-4">
          <div className="font-display font-bold text-sm">Neue Regel</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Auslöser</label>
              <select value={newRule.triggerType} onChange={e => setNewRule({ ...newRule, triggerType: e.target.value as CreditTrigger })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500">
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Schwellwert (Min)</label>
              <input type="number" min={1} value={newRule.thresholdMin ?? ''}
                onChange={e => setNewRule({ ...newRule, thresholdMin: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gutschrift (€)</label>
              <input type="number" min={0} step={0.50} value={newRule.creditEur}
                onChange={e => setNewRule({ ...newRule, creditEur: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gültig (Tage)</label>
              <input type="number" min={1} value={newRule.expiresInDays}
                onChange={e => setNewRule({ ...newRule, expiresInDays: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => saveRule({ ...newRule })} disabled={saving === '__new__'}
              className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50">
              <Save className="h-3.5 w-3.5" />
              {saving === '__new__' ? 'Speichert…' : 'Erstellen'}
            </button>
            {saved === '__new__' && <div className="flex items-center gap-1.5 text-sm text-matcha-700"><CheckCircle2 className="h-4 w-4" /> Erstellt</div>}
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground">Abbrechen</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-matcha-500 hover:text-matcha-700 transition w-full">
          <Plus className="h-4 w-4" /> Neue Regel hinzufügen
        </button>
      )}
    </div>
  );
}
