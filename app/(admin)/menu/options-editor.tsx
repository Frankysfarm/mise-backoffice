'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, Copy, Info, Loader2, Plus, Settings, Trash2, X,
} from 'lucide-react';

type ExtraOption = { id: string; name: string; preis: number };
type ExtraGroup = {
  id: string;
  name: string;
  typ: 'size' | 'milk' | 'extra' | 'note';
  required: boolean;
  multiple: boolean;
  options?: ExtraOption[];
};

const GROUP_PRESETS: { typ: ExtraGroup['typ']; label: string; icon: string; required: boolean; multiple: boolean; defaultOptions: ExtraOption[] }[] = [
  { typ: 'size',  label: 'Größe',    icon: '📏', required: true,  multiple: false, defaultOptions: [
    { id: 's', name: 'Klein',  preis: 0 },
    { id: 'm', name: 'Medium', preis: 0.5 },
    { id: 'l', name: 'Groß',   preis: 1 },
  ]},
  { typ: 'milk',  label: 'Milch',    icon: '🥛', required: true,  multiple: false, defaultOptions: [
    { id: 'kuh',    name: 'Kuhmilch',    preis: 0 },
    { id: 'hafer',  name: 'Hafermilch',  preis: 0.5 },
    { id: 'mandel', name: 'Mandelmilch', preis: 0.5 },
    { id: 'kokos',  name: 'Kokosmilch',  preis: 0.5 },
    { id: 'soja',   name: 'Sojamilch',   preis: 0.5 },
  ]},
  { typ: 'extra', label: 'Sirup',    icon: '🍯', required: false, multiple: true,  defaultOptions: [
    { id: 'vanille',   name: 'Vanille',   preis: 0.4 },
    { id: 'karamel',   name: 'Karamel',   preis: 0.4 },
    { id: 'haselnuss', name: 'Haselnuss', preis: 0.4 },
  ]},
  { typ: 'extra', label: 'Toppings', icon: '✨', required: false, multiple: true,  defaultOptions: [] },
  { typ: 'note',  label: 'Sonderwunsch', icon: '📝', required: false, multiple: false, defaultOptions: [] },
];

export function OptionsEditor({
  item, onClose, onSaved,
}: {
  item: { id: string; name: string; extras?: unknown };
  onClose: () => void;
  onSaved: (extras: ExtraGroup[]) => void;
}) {
  const supabase = createClient();
  const [groups, setGroups] = useState<ExtraGroup[]>(() => {
    const arr = Array.isArray(item.extras) ? item.extras : [];
    return arr.map((g: any) => ({
      id: g.id ?? rndId(),
      name: g.name ?? '',
      typ: g.typ ?? 'extra',
      required: !!g.required,
      multiple: !!g.multiple,
      options: Array.isArray(g.options) ? g.options : [],
    }));
  });
  const [saving, startSaving] = useTransition();

  function update(idx: number, patch: Partial<ExtraGroup>) {
    setGroups((g) => g.map((x, i) => i === idx ? { ...x, ...patch } : x));
  }

  function move(idx: number, dir: -1 | 1) {
    setGroups((g) => {
      const next = [...g];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return g;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function remove(idx: number) {
    if (!confirm('Options-Gruppe wirklich löschen?')) return;
    setGroups((g) => g.filter((_, i) => i !== idx));
  }

  function addGroup(preset: typeof GROUP_PRESETS[number]) {
    setGroups((g) => [...g, {
      id: rndId(),
      name: preset.label,
      typ: preset.typ,
      required: preset.required,
      multiple: preset.multiple,
      options: preset.defaultOptions.map((o) => ({ ...o })),
    }]);
  }

  function duplicateGroup(idx: number) {
    setGroups((g) => {
      const src = g[idx];
      if (!src) return g;
      const copy: ExtraGroup = {
        ...src,
        id: rndId(),
        name: `${src.name} (Kopie)`,
        options: src.options?.map((o) => ({ ...o })) ?? [],
      };
      const next = [...g];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function addOption(groupIdx: number) {
    setGroups((g) => g.map((x, i) => i === groupIdx
      ? { ...x, options: [...(x.options ?? []), { id: rndId(6), name: '', preis: 0 }] }
      : x,
    ));
  }
  function updateOption(groupIdx: number, optIdx: number, patch: Partial<ExtraOption>) {
    setGroups((g) => g.map((x, i) => i === groupIdx ? {
      ...x,
      options: x.options?.map((o, j) => j === optIdx ? { ...o, ...patch } : o),
    } : x));
  }
  function removeOption(groupIdx: number, optIdx: number) {
    setGroups((g) => g.map((x, i) => i === groupIdx ? {
      ...x,
      options: x.options?.filter((_, j) => j !== optIdx),
    } : x));
  }
  function moveOption(groupIdx: number, optIdx: number, dir: -1 | 1) {
    setGroups((g) => g.map((x, i) => {
      if (i !== groupIdx || !x.options) return x;
      const opts = [...x.options];
      const target = optIdx + dir;
      if (target < 0 || target >= opts.length) return x;
      [opts[optIdx], opts[target]] = [opts[target], opts[optIdx]];
      return { ...x, options: opts };
    }));
  }

  async function save() {
    startSaving(async () => {
      const clean = groups.map((g) => ({
        id: g.id,
        name: g.name.trim(),
        typ: g.typ,
        required: g.required,
        multiple: g.multiple,
        options: g.typ === 'note' ? undefined : (g.options ?? []).filter((o) => o.name.trim()).map((o) => ({
          id: o.id, name: o.name.trim(), preis: Number(o.preis) || 0,
        })),
      })).filter((g) => g.name);

      await supabase.from('menu_items').update({ extras: clean }).eq('id', item.id);
      onSaved(clean as any);
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <header className="p-5 border-b flex items-center gap-3 bg-white shrink-0">
          <div className="h-10 w-10 rounded-xl bg-gray-900 text-white grid place-items-center shrink-0">
            <Settings className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Optionen</div>
            <h2 className="font-display text-xl font-bold truncate">{item.name}</h2>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-gray-100 grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {groups.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Info className="h-10 w-10 mx-auto opacity-30 mb-2" />
              <div className="font-bold text-gray-900 mb-1">Noch keine Optionen</div>
              <div className="text-sm">Füg unten eine Gruppe hinzu — z.B. Größe, Milch, Sirup.</div>
            </div>
          )}

          {groups.map((g, gi) => (
            <GroupCard
              key={g.id}
              group={g}
              isFirst={gi === 0}
              isLast={gi === groups.length - 1}
              onUpdate={(patch) => update(gi, patch)}
              onMoveUp={() => move(gi, -1)}
              onMoveDown={() => move(gi, 1)}
              onDuplicate={() => duplicateGroup(gi)}
              onRemove={() => remove(gi)}
              onAddOption={() => addOption(gi)}
              onUpdateOption={(oi, patch) => updateOption(gi, oi, patch)}
              onRemoveOption={(oi) => removeOption(gi, oi)}
              onMoveOption={(oi, dir) => moveOption(gi, oi, dir)}
            />
          ))}

          {/* Add group */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-1">
              Vorlagen hinzufügen
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GROUP_PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => addGroup(p)}
                  className="h-12 rounded-xl border-2 border-dashed hover:border-gray-900 hover:bg-gray-50 px-3 text-sm font-semibold inline-flex items-center gap-2"
                >
                  <span className="text-lg">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 border-t bg-white shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="h-12 px-4 rounded-xl border-2 hover:bg-gray-50 font-bold text-sm"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 h-12 rounded-xl bg-gray-900 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-gray-800"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Optionen speichern
          </button>
        </footer>
      </Card>
    </div>
  );
}

/* ===================== Group Card ===================== */

function GroupCard({
  group, isFirst, isLast,
  onUpdate, onMoveUp, onMoveDown, onDuplicate, onRemove,
  onAddOption, onUpdateOption, onRemoveOption, onMoveOption,
}: {
  group: ExtraGroup;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<ExtraGroup>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (optIdx: number, patch: Partial<ExtraOption>) => void;
  onRemoveOption: (optIdx: number) => void;
  onMoveOption: (optIdx: number, dir: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isNote = group.typ === 'note';

  return (
    <div className="rounded-2xl border-2 bg-white overflow-hidden">
      {/* Header: Position + Name + Badges */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={isFirst} className="h-5 w-6 rounded hover:bg-gray-200 disabled:opacity-30 grid place-items-center">
            <ArrowUp className="h-3 w-3" />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="h-5 w-6 rounded hover:bg-gray-200 disabled:opacity-30 grid place-items-center">
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        <input
          value={group.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 h-9 rounded-lg border bg-white px-3 font-display font-bold text-base"
          placeholder="Gruppen-Name"
        />

        <button
          onClick={() => onUpdate({ required: !group.required })}
          className={cn(
            'h-8 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition',
            group.required ? 'bg-red-100 text-red-900 hover:bg-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          )}
          title="Kunde muss wählen"
        >
          {group.required ? '● Pflicht' : '○ Optional'}
        </button>
        {!isNote && (
          <button
            onClick={() => onUpdate({ multiple: !group.multiple })}
            className={cn(
              'h-8 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition',
              group.multiple ? 'bg-blue-100 text-blue-900 hover:bg-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            )}
            title="Mehrere auswählbar"
          >
            {group.multiple ? 'Mehrfach' : 'Einmal'}
          </button>
        )}

        <button onClick={onDuplicate} className="h-8 w-8 rounded-md hover:bg-gray-200 grid place-items-center" title="Duplizieren">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button onClick={onRemove} className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-700 grid place-items-center" title="Löschen">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {!isNote && (
          <button onClick={() => setExpanded(!expanded)} className="h-8 w-8 rounded-md hover:bg-gray-200 grid place-items-center">
            <ChevronDown className={cn('h-4 w-4 transition', expanded ? 'rotate-180' : '')} />
          </button>
        )}
      </div>

      {/* Body */}
      {!isNote && expanded && (
        <div className="p-3 space-y-2">
          {(group.options ?? []).map((o, oi) => (
            <div key={o.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => onMoveOption(oi, -1)} disabled={oi === 0} className="h-5 w-5 rounded hover:bg-white disabled:opacity-30 grid place-items-center">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button onClick={() => onMoveOption(oi, 1)} disabled={oi === (group.options?.length ?? 0) - 1} className="h-5 w-5 rounded hover:bg-white disabled:opacity-30 grid place-items-center">
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <input
                value={o.name}
                onChange={(e) => onUpdateOption(oi, { name: e.target.value })}
                placeholder="Name (z.B. Kokosmilch)"
                className="flex-1 h-9 rounded-md border bg-white px-3 text-sm"
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">+</span>
                <input
                  type="number"
                  step="0.10"
                  value={o.preis}
                  onChange={(e) => onUpdateOption(oi, { preis: Number(e.target.value) })}
                  className="w-20 h-9 rounded-md border bg-white px-2 font-mono text-sm text-right"
                />
                <span className="text-xs text-gray-500">€</span>
              </div>
              <button onClick={() => onRemoveOption(oi)} className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-700 grid place-items-center">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={onAddOption}
            className="w-full h-10 rounded-lg border-2 border-dashed text-sm font-semibold text-gray-500 hover:text-gray-900 hover:border-gray-900 hover:bg-gray-50 inline-flex items-center justify-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" /> Option hinzufügen
          </button>
        </div>
      )}

      {isNote && (
        <div className="p-3 text-xs text-gray-500 italic">
          Textfeld für Sonderwünsche — der Kunde kann frei schreiben (kein Preis-Effekt).
        </div>
      )}
    </div>
  );
}

function rndId(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len);
}
