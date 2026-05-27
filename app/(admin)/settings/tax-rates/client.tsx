'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Check, Info, Loader2, Percent, Plus, Save, Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type TaxRate = {
  id: string;
  name: string;
  satz: number;
  beschreibung: string | null;
  aktiv: boolean;
};

export function TaxRatesClient({ initialRates }: { initialRates: TaxRate[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rates, setRates] = useState<TaxRate[]>(initialRates);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<TaxRate>>({});
  const [showNew, setShowNew] = useState(false);
  const [newRate, setNewRate] = useState({ id: '', name: '', satz: 0, beschreibung: '' });
  const [saving, startSaving] = useTransition();
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function notify(kind: 'ok' | 'err', text: string) {
    setFlash({ kind, text });
    setTimeout(() => setFlash(null), 2500);
  }

  function beginEdit(r: TaxRate) {
    setEditing(r.id);
    setDraft({ name: r.name, satz: r.satz, beschreibung: r.beschreibung });
  }

  function cancelEdit() {
    setEditing(null);
    setDraft({});
  }

  function saveEdit(id: string) {
    startSaving(async () => {
      const { error } = await supabase
        .from('tax_rates')
        .update({
          name: draft.name,
          satz: draft.satz,
          beschreibung: draft.beschreibung ?? null,
        })
        .eq('id', id);
      if (error) { notify('err', error.message); return; }
      setRates((prev) => prev.map((r) => r.id === id ? { ...r, ...draft } as TaxRate : r));
      cancelEdit();
      notify('ok', 'Gespeichert');
    });
  }

  function toggleAktiv(r: TaxRate) {
    startSaving(async () => {
      const next = !r.aktiv;
      const { error } = await supabase.from('tax_rates').update({ aktiv: next }).eq('id', r.id);
      if (error) { notify('err', error.message); return; }
      setRates((prev) => prev.map((x) => x.id === r.id ? { ...x, aktiv: next } : x));
      notify('ok', next ? 'Aktiviert' : 'Deaktiviert');
    });
  }

  function removeRate(r: TaxRate) {
    if (!confirm(`Steuersatz „${r.name}" wirklich löschen?\n\nWARNUNG: Wenn dieser Satz bei Artikeln zugeordnet ist, schlagen Buchungen fehl.`)) return;
    startSaving(async () => {
      const { error } = await supabase.from('tax_rates').delete().eq('id', r.id);
      if (error) { notify('err', error.message); return; }
      setRates((prev) => prev.filter((x) => x.id !== r.id));
      notify('ok', 'Gelöscht');
    });
  }

  function createNew() {
    const id = newRate.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!id) { notify('err', 'ID darf nicht leer sein'); return; }
    if (!newRate.name.trim()) { notify('err', 'Name darf nicht leer sein'); return; }
    if (rates.some((r) => r.id === id)) { notify('err', 'ID existiert bereits'); return; }

    startSaving(async () => {
      const { error } = await supabase.from('tax_rates').insert({
        id,
        name: newRate.name.trim(),
        satz: newRate.satz,
        beschreibung: newRate.beschreibung.trim() || null,
        aktiv: true,
      });
      if (error) { notify('err', error.message); return; }
      setRates((prev) => [...prev, {
        id, name: newRate.name.trim(), satz: newRate.satz,
        beschreibung: newRate.beschreibung.trim() || null, aktiv: true,
      }].sort((a, b) => b.satz - a.satz));
      setShowNew(false);
      setNewRate({ id: '', name: '', satz: 0, beschreibung: '' });
      notify('ok', 'Steuersatz angelegt');
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {flash && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-sm flex items-center gap-2',
          flash.kind === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-red-200 bg-red-50 text-red-900',
        )}>
          {flash.kind === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
          {flash.text}
        </div>
      )}

      {/* Info-Karte */}
      <Card className="p-5 bg-blue-50/40 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 leading-relaxed">
            <strong className="block mb-1">So funktionieren Steuersätze in Mise</strong>
            Pro Artikel wählst du EINEN Steuersatz aus dieser Liste (im Artikel-Editor unter <code className="font-mono text-xs bg-blue-100 px-1 rounded">/menu</code>).
            Der Satz wird auf den Brutto-Preis angewendet und auf jedem Bon + DSFinV-K-Export korrekt aufgeschlüsselt.
            <br />
            Sonderfälle wie „Kaffee mit &gt; 70 % Milch = 7 %" lassen sich besser direkt am Artikel als Override pflegen statt eigenen Steuersatz anzulegen.
          </div>
        </div>
      </Card>

      {/* Liste */}
      <div className="space-y-2">
        {rates.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            Keine Steuersätze hinterlegt. Lege den deutschen Standard an: 19 %, 7 %, 0 %.
          </Card>
        )}
        {rates.map((r) => {
          const isEditing = editing === r.id;
          return (
            <Card key={r.id} className={cn('p-4', !r.aktiv && 'opacity-60')}>
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Prozentbadge */}
                <div className="col-span-2 sm:col-span-1">
                  <div className={cn(
                    'h-12 w-12 rounded-xl grid place-items-center font-display font-black text-sm',
                    r.satz === 0 ? 'bg-zinc-100 text-zinc-700' :
                    r.satz < 10 ? 'bg-emerald-100 text-emerald-800' :
                    'bg-amber-100 text-amber-800',
                  )}>
                    {r.satz}%
                  </div>
                </div>

                {/* Name + Beschreibung */}
                <div className="col-span-10 sm:col-span-7 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={draft.name ?? ''}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full rounded-lg border px-3 py-2 text-sm font-bold"
                        placeholder="Name (z. B. Normalsteuersatz)"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={draft.satz ?? 0}
                          onChange={(e) => setDraft({ ...draft, satz: Number(e.target.value) })}
                          className="w-24 rounded-lg border px-3 py-2 text-sm font-mono"
                        />
                        <span className="text-sm">%</span>
                      </div>
                      <input
                        value={draft.beschreibung ?? ''}
                        onChange={(e) => setDraft({ ...draft, beschreibung: e.target.value })}
                        className="w-full rounded-lg border px-3 py-2 text-xs text-muted-foreground"
                        placeholder="Beschreibung (optional)"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-base">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ID <code className="font-mono">{r.id}</code>
                        {r.beschreibung && <> · {r.beschreibung}</>}
                      </div>
                    </>
                  )}
                </div>

                {/* Aktionen */}
                <div className="col-span-12 sm:col-span-4 flex items-center justify-end gap-2 flex-wrap">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(r.id)}
                        disabled={saving}
                        className="rounded-lg bg-matcha-900 text-matcha-50 px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1 hover:bg-matcha-800 disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Speichern
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50"
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleAktiv(r)}
                        disabled={saving}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                          r.aktiv ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
                        )}
                      >
                        {r.aktiv ? 'aktiv' : 'inaktiv'}
                      </button>
                      <button
                        onClick={() => beginEdit(r)}
                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50 inline-flex items-center gap-1"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => removeRate(r)}
                        disabled={saving}
                        className="rounded-lg text-red-700 hover:bg-red-50 px-2 py-1.5 text-xs inline-flex items-center gap-1"
                        title="Löschen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Neuen anlegen */}
      {showNew ? (
        <Card className="p-5 border-dashed border-matcha-300 bg-matcha-50/30">
          <h3 className="font-bold text-base mb-3 flex items-center gap-2">
            <Plus size={16} /> Neuen Steuersatz anlegen
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  ID (kurz, kleinbuchstaben)
                </label>
                <input
                  value={newRate.id}
                  onChange={(e) => setNewRate({ ...newRate, id: e.target.value })}
                  placeholder="z. B. kaffee_milch_70"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Satz in %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={newRate.satz}
                  onChange={(e) => setNewRate({ ...newRate, satz: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Anzeige-Name
              </label>
              <input
                value={newRate.name}
                onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
                placeholder="z. B. Kaffee mit ≥ 70 % Milch"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Beschreibung (optional)
              </label>
              <input
                value={newRate.beschreibung}
                onChange={(e) => setNewRate({ ...newRate, beschreibung: e.target.value })}
                placeholder="Wofür dieser Satz gilt"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createNew}
                disabled={saving}
                className="rounded-lg bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold inline-flex items-center gap-2 hover:bg-matcha-800 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Anlegen
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted/50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="w-full rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-3 text-sm text-muted-foreground hover:border-matcha-400 hover:text-matcha-800 hover:bg-matcha-50/30 inline-flex items-center justify-center gap-2"
        >
          <Percent size={14} /> Sonderregel-Steuersatz anlegen
        </button>
      )}
    </div>
  );
}
