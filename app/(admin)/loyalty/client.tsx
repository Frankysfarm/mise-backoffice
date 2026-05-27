'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Save, X, Gift, Sparkles, Trophy } from 'lucide-react';

interface Program {
  id: string;
  title: string;
  description: string;
  trigger_text: string;
  threshold: number;
  reward_text: string;
  emoji: string;
  active: boolean;
  sort_order: number;
}

const EMOJI_PICKER = ['🎁', '🍝', '☕', '🍔', '🍕', '🥗', '🍩', '🍰', '🥤', '🍣', '🍺', '🌮', '⭐', '🏆', '✨'];

const TEMPLATES: Omit<Program, 'id' | 'sort_order' | 'active'>[] = [
  { title: 'Pasta-Liebhaber', description: 'Bei jeder 5. Pasta-Bestellung gibt es einen Cheesecake gratis aufs Haus.', trigger_text: 'Pasta', threshold: 5, reward_text: 'Cheesecake', emoji: '🍝' },
  { title: 'Kaffee-Treue', description: 'Sammle 10 Kaffees — der 11. ist gratis.', trigger_text: 'Kaffee', threshold: 10, reward_text: 'Kaffee gratis', emoji: '☕' },
  { title: 'Pizza-Pakt', description: 'Alle 7 Pizzen — eine Pizza Margherita aufs Haus.', trigger_text: 'Pizza', threshold: 7, reward_text: 'Pizza Margherita', emoji: '🍕' },
];

export function LoyaltyClient({ initialPrograms, tenantId }: { initialPrograms: Program[]; tenantId: string }) {
  const sb = createClient();
  const [programs, setPrograms] = useState<Program[]>(initialPrograms);
  const [editing, setEditing] = useState<Program | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();

  async function save(p: Program) {
    if (p.id === 'new') {
      const { data, error } = await sb
        .from('loyalty_programs')
        .insert({
          tenant_id: tenantId,
          title: p.title.trim(),
          description: p.description.trim(),
          trigger_text: p.trigger_text.trim(),
          threshold: p.threshold,
          reward_text: p.reward_text.trim(),
          emoji: p.emoji,
          active: p.active,
          sort_order: programs.length,
        })
        .select()
        .single();
      if (error) return alert(error.message);
      setPrograms((prev) => [...prev, data as Program]);
    } else {
      const { error } = await sb
        .from('loyalty_programs')
        .update({
          title: p.title.trim(),
          description: p.description.trim(),
          trigger_text: p.trigger_text.trim(),
          threshold: p.threshold,
          reward_text: p.reward_text.trim(),
          emoji: p.emoji,
          active: p.active,
        })
        .eq('id', p.id);
      if (error) return alert(error.message);
      setPrograms((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    }
    setEditing(null);
    setShowCreate(false);
  }

  async function remove(id: string) {
    if (!confirm('Bonus-Programm wirklich löschen?')) return;
    const { error } = await sb.from('loyalty_programs').delete().eq('id', id);
    if (error) return alert(error.message);
    setPrograms((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleActive(p: Program) {
    const newActive = !p.active;
    const { error } = await sb.from('loyalty_programs').update({ active: newActive }).eq('id', p.id);
    if (error) return alert(error.message);
    setPrograms((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: newActive } : x)));
  }

  const editorProgram = editing ?? (showCreate ? { id: 'new', title: '', description: '', trigger_text: '', threshold: 5, reward_text: '', emoji: '🎁', active: true, sort_order: 0 } : null);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full grid place-items-center" style={{ background: 'conic-gradient(from 215deg, #FFE9A0 0%, #FFD86A 25%, #E8A93A 55%, #C7841F 80%, #FFE9A0 100%)', boxShadow: '0 6px 20px -4px rgba(255,180,60,0.5)' }}>
            <Gift size={22} strokeWidth={2.5} color="#1A1410" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bonus-Programme</h1>
            <p className="text-sm text-muted-foreground">Treue-Aktionen für deine Stammkunden</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditing(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-semibold text-sm transition"
        >
          <Plus size={16} /> Neues Programm
        </button>
      </div>

      {/* Liste */}
      <div className="space-y-2.5">
        {programs.length === 0 && !showCreate && (
          <div className="rounded-2xl border-2 border-dashed border-stone-300 p-12 text-center">
            <Gift size={36} className="mx-auto text-stone-400 mb-3" />
            <div className="font-semibold text-lg">Noch keine Bonus-Programme</div>
            <p className="text-sm text-muted-foreground mt-1">Belohne deine Stammkunden mit Gratis-Goodies.</p>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  onClick={() => { setShowCreate(true); setEditing({ ...t, id: 'new', sort_order: 0, active: true } as Program); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200"
                >
                  <span>{t.emoji}</span> {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {programs.map((p) => (
          <div key={p.id} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-stone-200 hover:border-amber-300 transition">
            <div className="w-12 h-12 rounded-xl grid place-items-center text-2xl bg-gradient-to-br from-amber-100 to-amber-50 ring-1 ring-amber-200 shrink-0">
              {p.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-base">{p.title}</div>
                {!p.active && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">Pausiert</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                  <Trophy size={10} /> Alle {p.threshold} × {p.trigger_text}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  <Sparkles size={10} /> = {p.reward_text}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 items-end shrink-0">
              <button
                onClick={() => toggleActive(p)}
                className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full transition ${p.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
              >
                {p.active ? 'Aktiv' : 'Pausiert'}
              </button>
              <button onClick={() => setEditing(p)} className="text-xs text-amber-700 hover:text-amber-900 font-semibold">Bearbeiten</button>
              <button onClick={() => remove(p.id)} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor-Modal */}
      {editorProgram && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={() => { setEditing(null); setShowCreate(false); }}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <Editor
              program={editorProgram}
              onSave={save}
              onClose={() => { setEditing(null); setShowCreate(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Editor({ program, onSave, onClose }: { program: Program; onSave: (p: Program) => void; onClose: () => void }) {
  const [p, setP] = useState<Program>(program);
  const valid = p.title.trim().length > 1 && p.trigger_text.trim() && p.reward_text.trim() && p.threshold >= 1;

  return (
    <div>
      <div className="flex items-center justify-between p-4 border-b border-stone-200">
        <div className="font-bold text-lg">{p.id === 'new' ? 'Neues Bonus-Programm' : 'Programm bearbeiten'}</div>
        <button onClick={onClose}><X size={18} /></button>
      </div>

      <div className="p-5 space-y-4">
        {/* Emoji-Picker */}
        <div>
          <label className="text-sm font-semibold">Icon</label>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {EMOJI_PICKER.map((e) => (
              <button
                key={e}
                onClick={() => setP({ ...p, emoji: e })}
                className={`w-9 h-9 rounded-lg grid place-items-center text-xl transition ${p.emoji === e ? 'bg-amber-100 ring-2 ring-amber-500' : 'bg-stone-50 hover:bg-stone-100'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">Titel</label>
          <input
            type="text"
            value={p.title}
            onChange={(e) => setP({ ...p, title: e.target.value })}
            placeholder="z.B. Pasta-Liebhaber"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 focus:border-amber-500 focus:outline-none"
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm font-semibold">Beschreibung</label>
          <textarea
            value={p.description}
            onChange={(e) => setP({ ...p, description: e.target.value })}
            placeholder="Bei jeder 5. Pasta-Bestellung gibt es einen Cheesecake gratis aufs Haus."
            className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 focus:border-amber-500 focus:outline-none min-h-[68px]"
          />
        </div>

        <div className="grid grid-cols-[1fr_88px_1fr] gap-3 items-end">
          <div>
            <label className="text-sm font-semibold">Was zählt?</label>
            <input
              type="text"
              value={p.trigger_text}
              onChange={(e) => setP({ ...p, trigger_text: e.target.value })}
              placeholder="Pasta"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Anzahl</label>
            <input
              type="number"
              min={1}
              value={p.threshold}
              onChange={(e) => setP({ ...p, threshold: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 focus:border-amber-500 focus:outline-none text-center font-bold"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Belohnung</label>
            <input
              type="text"
              value={p.reward_text}
              onChange={(e) => setP({ ...p, reward_text: e.target.value })}
              placeholder="Cheesecake"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Live-Preview */}
        <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Vorschau auf Bestellseite:</div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl grid place-items-center text-xl bg-gradient-to-br from-amber-100 to-amber-50 ring-1 ring-amber-200">{p.emoji}</div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{p.title || '(noch kein Titel)'}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{p.description || '(noch keine Beschreibung)'}</div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Alle {p.threshold} × {p.trigger_text || '?'}</span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">= {p.reward_text || '?'}</span>
              </div>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={p.active}
            onChange={(e) => setP({ ...p, active: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">Aktiv (auf der Bestellseite anzeigen)</span>
        </label>
      </div>

      <div className="flex gap-2 p-4 border-t border-stone-200">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 hover:bg-stone-50 font-semibold text-sm">Abbrechen</button>
        <button
          disabled={!valid}
          onClick={() => onSave(p)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} /> Speichern
        </button>
      </div>
    </div>
  );
}
