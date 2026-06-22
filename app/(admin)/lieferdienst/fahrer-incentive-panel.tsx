'use client';

/**
 * FahrerIncentivePanel — Phase 431
 *
 * Manager-Panel: Incentive-Ziele je Fahrer erstellen, Fortschritt überwachen,
 * erzielte Boni anzeigen. Integration: lieferdienst/client.tsx nach SchichtAbschlussUebersicht.
 */

import { useCallback, useEffect, useState } from 'react';
import { Trophy, Plus, Trash2, ChevronDown, ChevronUp, Target, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZielTyp = 'score' | 'puenktlichkeit' | 'lieferungen';

interface Incentive {
  id:             string;
  driverId:       string;
  driverName:     string | null;
  zielTyp:        ZielTyp;
  zielwert:       number;
  istWert:        number | null;
  bonusEur:       number;
  erreichterAm:   string | null;
  zeitraumStart:  string;
  zeitraumEnd:    string;
  fortschrittPct: number | null;
}

interface Driver {
  id:   string;
  name: string;
}

interface Props {
  locationId: string | null;
}

const ZIEL_LABEL: Record<ZielTyp, string> = {
  score:         'Composite Score',
  puenktlichkeit:'Pünktlichkeit %',
  lieferungen:   'Lieferungen',
};

const ZIEL_UNIT: Record<ZielTyp, string> = {
  score:         'Pkt.',
  puenktlichkeit:'%',
  lieferungen:   'Ldg.',
};

export function FahrerIncentivePanel({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    driver_id:      '',
    ziel_typ:       'lieferungen' as ZielTyp,
    zielwert:       '',
    bonus_eur:      '',
    zeitraum_start: '',
    zeitraum_end:   '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-incentive?location_id=${locationId}`);
      const json = await res.json() as { incentives?: Incentive[] };
      setIncentives(json.incentives ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const loadDrivers = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/employees?location_id=${locationId}&role=driver`);
      const json = await res.json() as { employees?: { id: string; full_name: string | null }[] };
      setDrivers((json.employees ?? []).map(e => ({ id: e.id, name: e.full_name ?? e.id })));
    } catch {
      // silent
    }
  }, [locationId]);

  useEffect(() => {
    if (open) { void load(); void loadDrivers(); }
  }, [open, load, loadDrivers]);

  const handleCreate = async () => {
    if (!locationId || !form.driver_id || !form.zielwert || !form.bonus_eur || !form.zeitraum_start || !form.zeitraum_end) return;
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/fahrer-incentive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'create',
          location_id:    locationId,
          driver_id:      form.driver_id,
          ziel_typ:       form.ziel_typ,
          zielwert:       parseFloat(form.zielwert),
          bonus_eur:      parseFloat(form.bonus_eur),
          zeitraum_start: form.zeitraum_start,
          zeitraum_end:   form.zeitraum_end,
        }),
      });
      setShowForm(false);
      setForm({ driver_id: '', ziel_typ: 'lieferungen', zielwert: '', bonus_eur: '', zeitraum_start: '', zeitraum_end: '' });
      void load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!locationId) return;
    await fetch('/api/delivery/admin/fahrer-incentive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, location_id: locationId }),
    });
    void load();
  };

  const handleEvaluate = async () => {
    if (!locationId) return;
    await fetch('/api/delivery/admin/fahrer-incentive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'evaluate', location_id: locationId }),
    });
    void load();
  };

  const achieved = incentives.filter(i => i.erreichterAm !== null).length;
  const active   = incentives.filter(i => i.erreichterAm === null).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Fahrer-Incentive-Ziele</div>
            <div className="text-xs text-stone-400">
              {active} aktiv · {achieved} erreicht
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
          {/* Header-Aktionen */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                <Target className="h-3 w-3" /> {active} aktiv
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-matcha-50 px-2.5 py-0.5 text-xs font-medium text-matcha-700">
                <CheckCircle2 className="h-3 w-3" /> {achieved} erreicht
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEvaluate}
                className="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors"
              >
                Neu berechnen
              </button>
              <button
                onClick={() => setShowForm(f => !f)}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
              >
                <Plus className="h-3 w-3" /> Ziel hinzufügen
              </button>
            </div>
          </div>

          {/* Formular */}
          {showForm && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 space-y-3">
              <div className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Neues Incentive-Ziel</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Fahrer</label>
                  <select
                    value={form.driver_id}
                    onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="">Fahrer wählen…</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Ziel-Typ</label>
                  <select
                    value={form.ziel_typ}
                    onChange={e => setForm(f => ({ ...f, ziel_typ: e.target.value as ZielTyp }))}
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="lieferungen">Lieferungen</option>
                    <option value="puenktlichkeit">Pünktlichkeit %</option>
                    <option value="score">Composite Score</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Zielwert</label>
                  <input
                    type="number"
                    value={form.zielwert}
                    onChange={e => setForm(f => ({ ...f, zielwert: e.target.value }))}
                    placeholder="z.B. 50"
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Bonus (€)</label>
                  <input
                    type="number"
                    value={form.bonus_eur}
                    onChange={e => setForm(f => ({ ...f, bonus_eur: e.target.value }))}
                    placeholder="z.B. 25"
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Von</label>
                  <input
                    type="date"
                    value={form.zeitraum_start}
                    onChange={e => setForm(f => ({ ...f, zeitraum_start: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Bis</label>
                  <input
                    type="date"
                    value={form.zeitraum_end}
                    onChange={e => setForm(f => ({ ...f, zeitraum_end: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Speichern…' : 'Ziel speichern'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-sm text-stone-600 hover:bg-stone-200 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Ziele-Liste */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />)}
            </div>
          ) : incentives.length === 0 ? (
            <div className="py-8 text-center text-sm text-stone-400">
              Noch keine Incentive-Ziele definiert
            </div>
          ) : (
            <div className="space-y-2">
              {incentives.map(inc => (
                <IncentiveRow key={inc.id} inc={inc} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IncentiveRow({
  inc,
  onDelete,
}: {
  inc: Incentive;
  onDelete: (id: string) => void;
}) {
  const reached = inc.erreichterAm !== null;
  const pct = inc.fortschrittPct ?? 0;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  return (
    <div className={cn(
      'rounded-xl border p-3',
      reached ? 'border-matcha-200 bg-matcha-50' : 'border-stone-200 bg-white',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {reached
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-matcha-600" />
              : <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            }
            <span className="text-sm font-semibold text-char truncate">
              {inc.driverName ?? 'Fahrer'}
            </span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              reached ? 'bg-matcha-100 text-matcha-700' : 'bg-stone-100 text-stone-600',
            )}>
              {ZIEL_LABEL[inc.zielTyp]}
            </span>
          </div>
          <div className="mt-1 text-xs text-stone-500">
            Ziel: {inc.zielwert} {ZIEL_UNIT[inc.zielTyp]}
            {inc.istWert !== null && (
              <span className="ml-1 font-medium text-stone-700">
                · Ist: {inc.istWert} {ZIEL_UNIT[inc.zielTyp]}
              </span>
            )}
            <span className="mx-1">·</span>
            {fmt(inc.zeitraumStart)} – {fmt(inc.zeitraumEnd)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold text-violet-700">+{inc.bonusEur.toFixed(0)} €</div>
          <button
            onClick={() => onDelete(inc.id)}
            className="mt-1 text-stone-300 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!reached && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-0.5 text-right text-[10px] text-stone-400">{pct}%</div>
        </div>
      )}

      {reached && inc.erreichterAm && (
        <div className="mt-1.5 text-xs text-matcha-600 font-medium">
          Erreicht am {new Date(inc.erreichterAm).toLocaleDateString('de-DE')}
        </div>
      )}
    </div>
  );
}
