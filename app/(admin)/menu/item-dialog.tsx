'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Check, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { createItem, updateItem } from './actions';

const ALLERGENS = ['gluten', 'laktose', 'nuss', 'soja', 'ei', 'fisch', 'sesam', 'senf', 'sellerie'];
const DEFAULT_TAGS = ['signature', 'vegan', 'vegetarisch', 'glutenfrei', 'hot', 'iced', 'food', 'neu'];

type Category = { id: string; name: string };

type Item = {
  id: string;
  category_id: string | null;
  name: string;
  beschreibung: string | null;
  preis: number;
  mwst_satz: number | null;
  food_type: string | null;
  bild_url: string | null;
  bestseller_bild_url: string | null;
  allergene: string[] | null;
  tags: string[] | null;
  beliebt: boolean;
  verfuegbar: boolean;
};

export function ItemEditorDialog({
  item, categoryId, categories, onClose, onSaved, onDelete,
}: {
  item: Item | null;
  categoryId: string | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (item: Item) => void;
  onDelete?: () => Promise<void>;
}) {
  const supabase = createClient();
  const [name, setName] = useState(item?.name ?? '');
  const [beschreibung, setBeschreibung] = useState(item?.beschreibung ?? '');
  const [preis, setPreis] = useState(item?.preis?.toString() ?? '');
  const [mwst, setMwst] = useState(item?.mwst_satz?.toString() ?? '19');
  const [foodType, setFoodType] = useState<'speise' | 'getraenk' | 'sonstiges'>((item?.food_type as any) ?? 'getraenk');
  const [catId, setCatId] = useState<string | null>(item?.category_id ?? categoryId);
  const [bildUrl, setBildUrl] = useState(item?.bild_url ?? '');
  const [bestsellerBildUrl, setBestsellerBildUrl] = useState(item?.bestseller_bild_url ?? '');
  const [uploadingBestseller, setUploadingBestseller] = useState(false);
  const [allergene, setAllergene] = useState<string[]>(item?.allergene ?? []);
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [beliebt, setBeliebt] = useState(item?.beliebt ?? false);
  const [verfuegbar, setVerfuegbar] = useState(item?.verfuegbar ?? true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('menu_images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('menu_images').getPublicUrl(path);
      setBildUrl(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  }

  async function uploadBestseller(file: File) {
    setUploadingBestseller(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `bestseller-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('menu_images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('menu_images').getPublicUrl(path);
      setBestsellerBildUrl(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen');
    } finally {
      setUploadingBestseller(false);
    }
  }

  function toggleArr(arr: string[], v: string, set: (x: string[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function save() {
    setError(null);
    const p = parseFloat(preis.replace(',', '.'));
    const m = parseFloat(mwst.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(p) || p <= 0) {
      setError('Name und Preis sind Pflicht');
      return;
    }
    startSaving(async () => {
      const payload = {
        category_id: catId,
        name: name.trim(),
        beschreibung: beschreibung.trim() || null,
        preis: p,
        mwst_satz: m,
        food_type: foodType,
        bild_url: bildUrl || null,
        bestseller_bild_url: bestsellerBildUrl || null,
        allergene,
        tags,
        beliebt,
        verfuegbar,
      };
      const res = item
        ? await updateItem(item.id, payload as any)
        : await createItem(payload as any);
      if (!res.ok) {
        setError(res.error ?? 'Speichern fehlgeschlagen');
        return;
      }
      // Lokalen State aktualisieren — da wir keine id zurückbekommen, bei neu: fetch latest
      if (item) {
        onSaved({ ...item, ...(payload as any) });
      } else {
        const sb = createClient();
        const { data } = await sb
          .from('menu_items')
          .select('*')
          .eq('name', payload.name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) onSaved(data as any);
        else onClose();
      }
    });
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm(`"${item?.name}" wirklich löschen?`)) return;
    setDeleting(true);
    await onDelete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-strong"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <div className="font-display text-lg font-bold">
            {item ? 'Artikel bearbeiten' : 'Neuer Artikel'}
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted" aria-label="Schließen">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Bild */}
          <div>
            <Label>Bild</Label>
            <div className="mt-2 flex items-start gap-4">
              <div className="h-24 w-24 rounded-xl border-2 border-dashed border-border bg-muted overflow-hidden flex items-center justify-center">
                {bildUrl ? (
                  <img src={bildUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 rounded-lg bg-matcha-100 hover:bg-matcha-200 px-3 py-2 text-sm font-semibold cursor-pointer text-matcha-900">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Lädt …' : bildUrl ? 'Bild ersetzen' : 'Bild hochladen'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                    className="hidden"
                  />
                </label>
                {bildUrl && (
                  <button
                    onClick={() => setBildUrl('')}
                    className="text-xs text-muted-foreground hover:text-red-700"
                  >
                    Bild entfernen
                  </button>
                )}
                <input
                  type="url"
                  value={bildUrl}
                  onChange={(e) => setBildUrl(e.target.value)}
                  placeholder="oder URL einfügen"
                  className="w-full text-xs rounded-lg border bg-background px-3 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Bestseller-Bild (nur sichtbar wenn Beliebt aktiv) */}
          {beliebt && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <Label>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-amber-600">⭐</span> Bestseller-Bild
                  <span className="text-xs font-normal text-muted-foreground">(optional — sonst wird das obige Bild verwendet)</span>
                </span>
              </Label>
              <div className="mt-2 flex items-start gap-4">
                <div className="h-24 w-24 rounded-xl border-2 border-dashed border-amber-300 bg-white overflow-hidden flex items-center justify-center">
                  {bestsellerBildUrl ? (
                    <img src={bestsellerBildUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-amber-400" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="inline-flex items-center gap-2 rounded-lg bg-amber-100 hover:bg-amber-200 px-3 py-2 text-sm font-semibold cursor-pointer text-amber-900">
                    {uploadingBestseller ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingBestseller ? 'Lädt …' : bestsellerBildUrl ? 'Bestseller-Bild ersetzen' : 'Bestseller-Bild hochladen'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && uploadBestseller(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  {bestsellerBildUrl && (
                    <button
                      onClick={() => setBestsellerBildUrl('')}
                      className="text-xs text-muted-foreground hover:text-red-700"
                    >
                      Bild entfernen
                    </button>
                  )}
                  <input
                    type="url"
                    value={bestsellerBildUrl}
                    onChange={(e) => setBestsellerBildUrl(e.target.value)}
                    placeholder="oder URL einfügen"
                    className="w-full text-xs rounded-lg border bg-background px-3 py-1.5 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Wird nur im Bestseller-Carousel auf der Bestellseite verwendet. Tipp: 1:1 quadratisch, mind. 800×800px.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Grundinfo */}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Name *" value={name} onChange={setName} placeholder="Matcha Latte" autoFocus />
            <Field label="Preis (€) *" value={preis} onChange={setPreis} placeholder="4,80" type="number" step="0.10" small />
          </div>

          <div>
            <Label>Beschreibung</Label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={2}
              placeholder="Cremig, umami — der Klassiker mit Milchschaum-Krone."
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Kategorie</Label>
              <select
                value={catId ?? ''}
                onChange={(e) => setCatId(e.target.value || null)}
                className="mt-1.5 w-full h-10 rounded-xl border bg-background px-3"
              >
                <option value="">— Keine —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Typ</Label>
              <select
                value={foodType}
                onChange={(e) => setFoodType(e.target.value as any)}
                className="mt-1.5 w-full h-10 rounded-xl border bg-background px-3"
              >
                <option value="getraenk">Getränk</option>
                <option value="speise">Speise</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </div>
            <div>
              <Label>MwSt (%)</Label>
              <select
                value={mwst}
                onChange={(e) => setMwst(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-xl border bg-background px-3"
              >
                <option value="19">19 %</option>
                <option value="7">7 %</option>
                <option value="0">0 %</option>
              </select>
            </div>
          </div>

          {/* Allergene */}
          <div>
            <Label>Allergene</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => (
                <Chip key={a} active={allergene.includes(a)} onClick={() => toggleArr(allergene, a, setAllergene)}>
                  {a}
                </Chip>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEFAULT_TAGS.map((t) => (
                <Chip key={t} active={tags.includes(t)} onClick={() => toggleArr(tags, t, setTags)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-5">
            <Switch checked={beliebt} onChange={setBeliebt} label="Als beliebt hervorheben" />
            <Switch checked={verfuegbar} onChange={setVerfuegbar} label="Verfügbar (sichtbar auf Karte)" />
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          )}
        </div>

        <footer className="border-t px-6 py-4 flex items-center justify-between gap-2">
          {onDelete ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 text-sm text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Löschen
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm">Abbrechen</button>
            <button
              onClick={save}
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {item ? 'Speichern' : 'Anlegen'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', step, small, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; step?: string; small?: boolean; autoFocus?: boolean;
}) {
  return (
    <div className={small ? 'w-32' : undefined}>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        step={step}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-matcha-700 bg-matcha-900 text-matcha-50'
          : 'border-border bg-background hover:bg-muted',
      )}
    >
      {active && <Check size={10} />}
      {children}
    </button>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={cn(
          'inline-flex h-6 w-11 items-center rounded-full transition',
          checked ? 'bg-matcha-500' : 'bg-muted',
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}
