'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import {
  Check, ChevronDown, ChevronUp, Coffee, Edit3, Eye, EyeOff, Flame, ImagePlus,
  Loader2, Plus, Settings, Star, Trash2, UtensilsCrossed,
} from 'lucide-react';
import {
  createCategory, updateCategory, deleteCategory,
  createItem, updateItem, deleteItem,
  toggleItemAvailable, toggleItemPopular,
} from './actions';
import { ItemEditorDialog } from './item-dialog';
import { CategoryEditorDialog } from './category-dialog';
import { OptionsEditor } from './options-editor';

type Category = {
  id: string; name: string; icon: string | null; sort_order: number; aktiv: boolean;
};

type MenuItem = {
  id: string; name: string; beschreibung: string | null; preis: number;
  bild_url: string | null; bestseller_bild_url: string | null; category_id: string | null; allergene: string[] | null;
  tags: string[] | null; beliebt: boolean; verfuegbar: boolean;
  mwst_satz: number | null; food_type: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extras?: any;
};

export function MenuEditor({
  categories: initialCats, items: initialItems,
}: {
  categories: Category[]; items: MenuItem[];
}) {
  const [categories, setCategories] = useState(initialCats);
  const [items, setItems] = useState(initialItems);
  const [openCat, setOpenCat] = useState<string | null>(initialCats[0]?.id ?? null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingOptionsFor, setEditingOptionsFor] = useState<MenuItem | null>(null);
  const [newItemForCat, setNewItemForCat] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [, startTransition] = useTransition();

  function refresh(newItems?: MenuItem[], newCats?: Category[]) {
    if (newItems) setItems(newItems);
    if (newCats) setCategories(newCats);
  }

  const uncategorized = items.filter((i) => !i.category_id || !categories.find((c) => c.id === i.category_id));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {categories.length} Kategorien · {items.length} Artikel
        </div>
        <button
          onClick={() => setNewCat(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-semibold hover:bg-matcha-800"
        >
          <Plus size={14} /> Kategorie
        </button>
      </div>

      {/* Kategorien-Liste */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id);
          const isOpen = openCat === cat.id;
          return (
            <Card key={cat.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCat(isOpen ? null : cat.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 text-left"
              >
                <span className="text-2xl">{cat.icon ?? '📋'}</span>
                <div className="flex-1">
                  <div className="font-display font-bold">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {catItems.length} {catItems.length === 1 ? 'Artikel' : 'Artikel'}
                    {!cat.aktiv && ' · versteckt'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingCat(cat); }}
                    className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted"
                    aria-label="Kategorie bearbeiten"
                  >
                    <Edit3 size={14} />
                  </button>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t">
                  {catItems.length === 0 && (
                    <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                      Noch keine Artikel in dieser Kategorie.
                    </div>
                  )}
                  <div className="divide-y">
                    {catItems.map((it) => (
                      <ItemRow
                        key={it.id}
                        item={it}
                        onEdit={() => setEditingItem(it)}
                        onEditOptions={() => setEditingOptionsFor(it)}
                        onToggleAvail={(v) =>
                          startTransition(async () => {
                            await toggleItemAvailable(it.id, v);
                            setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, verfuegbar: v } : x));
                          })
                        }
                        onTogglePop={(v) =>
                          startTransition(async () => {
                            await toggleItemPopular(it.id, v);
                            setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, beliebt: v } : x));
                          })
                        }
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewItemForCat(cat.id)}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 border-t text-sm text-matcha-700 hover:bg-matcha-50 font-semibold"
                  >
                    <Plus size={14} /> Artikel hinzufügen
                  </button>
                </div>
              )}
            </Card>
          );
        })}

        {uncategorized.length > 0 && (
          <Card className="overflow-hidden border-amber-200 bg-amber-50/50">
            <div className="px-5 py-4">
              <div className="font-display font-bold text-amber-900">Ohne Kategorie</div>
              <div className="text-xs text-amber-700">{uncategorized.length} Artikel — bitte zuordnen</div>
            </div>
            <div className="divide-y border-t border-amber-200">
              {uncategorized.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  onEdit={() => setEditingItem(it)}
                  onEditOptions={() => setEditingOptionsFor(it)}
                  onToggleAvail={(v) =>
                    startTransition(async () => { await toggleItemAvailable(it.id, v); setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, verfuegbar: v } : x)); })
                  }
                  onTogglePop={(v) =>
                    startTransition(async () => { await toggleItemPopular(it.id, v); setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, beliebt: v } : x)); })
                  }
                />
              ))}
            </div>
          </Card>
        )}

        {categories.length === 0 && (
          <Card className="p-10 text-center">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <div className="font-display text-lg font-bold">Noch keine Kategorien</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Starte mit einer Kategorie (z.B. „Heißgetränke") und füge dann Artikel hinzu.
            </p>
            <button
              onClick={() => setNewCat(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-semibold"
            >
              <Plus size={14} /> Erste Kategorie
            </button>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      {(editingItem || newItemForCat !== null) && (
        <ItemEditorDialog
          item={editingItem}
          categoryId={newItemForCat}
          categories={categories}
          onClose={() => { setEditingItem(null); setNewItemForCat(null); }}
          onSaved={(saved) => {
            if (editingItem) {
              setItems((xs) => xs.map((x) => x.id === saved.id ? { ...x, ...saved } : x));
            } else {
              setItems((xs) => [...xs, saved]);
            }
            setEditingItem(null);
            setNewItemForCat(null);
          }}
          onDelete={
            editingItem
              ? async () => {
                  await deleteItem(editingItem.id);
                  setItems((xs) => xs.filter((x) => x.id !== editingItem.id));
                  setEditingItem(null);
                }
              : undefined
          }
        />
      )}

      {editingOptionsFor && (
        <OptionsEditor
          item={editingOptionsFor}
          onClose={() => setEditingOptionsFor(null)}
          onSaved={(extras) => {
            setItems((xs) => xs.map((x) => x.id === editingOptionsFor.id ? { ...x, extras } : x));
            setEditingOptionsFor(null);
          }}
        />
      )}

      {(editingCat || newCat) && (
        <CategoryEditorDialog
          category={editingCat}
          onClose={() => { setEditingCat(null); setNewCat(false); }}
          onSaved={(saved) => {
            if (editingCat) {
              setCategories((cs) => cs.map((c) => c.id === saved.id ? saved : c));
            } else {
              setCategories((cs) => [...cs, saved]);
              setOpenCat(saved.id);
            }
            setEditingCat(null); setNewCat(false);
          }}
          onDelete={
            editingCat
              ? async () => {
                  await deleteCategory(editingCat.id);
                  setCategories((cs) => cs.filter((c) => c.id !== editingCat.id));
                  setEditingCat(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function ItemRow({
  item, onEdit, onEditOptions, onToggleAvail, onTogglePop,
}: {
  item: MenuItem;
  onEdit: () => void;
  onEditOptions: () => void;
  onToggleAvail: (v: boolean) => void;
  onTogglePop: (v: boolean) => void;
}) {
  const extrasCount = Array.isArray(item.extras) ? item.extras.length : 0;
  return (
    <div className={cn('flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition', !item.verfuegbar && 'opacity-50')}>
      {item.bild_url ? (
        <img src={item.bild_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-matcha-100 flex items-center justify-center shrink-0">
          {item.food_type === 'speise' ? <UtensilsCrossed size={18} className="text-matcha-700" /> : <Coffee size={18} className="text-matcha-700" />}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{item.name}</span>
          {item.beliebt && <Badge variant="gold" className="h-5 px-1.5 text-[10px]"><Star className="h-2.5 w-2.5 mr-0.5" /> Beliebt</Badge>}
          {!item.verfuegbar && <Badge variant="muted" className="h-5 px-1.5 text-[10px]">versteckt</Badge>}
          {item.tags?.includes('signature') && <Badge variant="accent" className="h-5 px-1.5 text-[10px]">Signature</Badge>}
        </div>
        {item.beschreibung && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">{item.beschreibung}</div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onTogglePop(!item.beliebt)}
          className={cn('h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted', item.beliebt && 'text-gold')}
          title={item.beliebt ? 'Nicht mehr hervorheben' : 'Als beliebt markieren'}
          aria-label="Beliebt"
        >
          <Star size={14} className={item.beliebt ? 'fill-current' : ''} />
        </button>
        <button
          onClick={() => onToggleAvail(!item.verfuegbar)}
          className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted"
          title={item.verfuegbar ? 'Ausblenden' : 'Einblenden'}
          aria-label="Verfügbarkeit"
        >
          {item.verfuegbar ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      <div className="font-display font-bold text-sm w-20 text-right">{euro(item.preis)}</div>

      <button
        onClick={onEditOptions}
        className={cn(
          'hidden sm:inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition',
          extrasCount > 0 ? 'bg-matcha-100 text-matcha-800 hover:bg-matcha-200' : 'hover:bg-muted text-muted-foreground',
        )}
        title="Optionen bearbeiten"
      >
        <Settings size={12} />
        {extrasCount > 0 ? `${extrasCount}` : 'Optionen'}
      </button>

      <button
        onClick={onEdit}
        className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted"
        aria-label="Bearbeiten"
      >
        <Edit3 size={14} />
      </button>
    </div>
  );
}
