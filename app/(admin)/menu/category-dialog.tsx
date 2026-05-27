'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Trash2, X } from 'lucide-react';
import { createCategory, updateCategory } from './actions';
import { createClient } from '@/lib/supabase/client';

type Category = { id: string; name: string; icon: string | null; sort_order: number; aktiv: boolean };

const ICON_SUGGESTIONS = ['☕', '🧊', '🍽', '✨', '🥐', '🍰', '🥗', '🍕', '🍜', '🥤', '🧁', '🍦'];

export function CategoryEditorDialog({
  category, onClose, onSaved, onDelete,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (c: Category) => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [aktiv, setAktiv] = useState(category?.aktiv ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    setError(null);
    if (!name.trim()) return setError('Name ist Pflicht');

    startSaving(async () => {
      if (category) {
        const res = await updateCategory(category.id, { name, icon, aktiv });
        if (!res.ok) return setError(res.error!);
        onSaved({ ...category, name, icon, aktiv });
      } else {
        const res = await createCategory({ name, icon });
        if (!res.ok) return setError(res.error!);
        // Zuletzt erstellte Kat laden
        const sb = createClient();
        const { data } = await sb.from('menu_categories').select('*').eq('name', name).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (data) onSaved(data as any);
        else onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md shadow-strong" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-display font-bold">{category ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</div>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted"><X size={16} /></button>
        </header>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Heißgetränke"
              autoFocus
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Icon (Emoji)</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="h-11 w-16 rounded-xl border bg-background text-center text-2xl"
              />
              <div className="flex flex-wrap gap-1">
                {ICON_SUGGESTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setIcon(e)}
                    className="h-8 w-8 rounded-md hover:bg-muted text-xl"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
            <span className="text-sm">Kategorie aktiv (auf Karte sichtbar)</span>
          </label>
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
          )}
        </div>
        <footer className="border-t px-5 py-3 flex items-center justify-between">
          {onDelete ? (
            <button
              onClick={async () => {
                if (confirm('Kategorie löschen? Enthaltene Artikel werden "ohne Kategorie"')) await onDelete();
              }}
              className="inline-flex items-center gap-1 text-sm text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg"
            >
              <Trash2 size={14} /> Löschen
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm">Abbrechen</button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Speichern
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
