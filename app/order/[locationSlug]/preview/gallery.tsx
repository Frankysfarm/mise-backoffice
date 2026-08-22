'use client';

import { useState, useMemo } from 'react';
import { Plus, Star, Store, Truck, Search, ArrowLeft } from 'lucide-react';
import { ItemImage } from '../components/item-image';
import { cn } from '@/lib/utils';

type Item = {
  id: string; category_id: string | null; name: string;
  beschreibung: string | null; preis: number;
  beliebt: boolean | null; tags: string[] | null;
  allergene: string[] | null; bild_url: string | null;
};
type Cat = { id: string; name: string; icon: string | null; sort_order?: number };
type Loc = { id: string; name: string; stadt: string | null; adresse: string | null };

export function PreviewGallery({
  tenantName, location, items, categories,
}: {
  tenantName: string; location: Loc; items: Item[]; categories: Cat[];
}) {
  const [active, setActive] = useState<1 | 2 | 3 | 4>(1);

  // Gruppiere Items nach Kategorie (sortiert)
  const grouped = useMemo(() => {
    return categories.map((cat) => ({
      cat,
      items: items.filter((i) => i.category_id === cat.id),
    })).filter((g) => g.items.length > 0);
  }, [categories, items]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Stil-Umschalter */}
      <div className="sticky top-0 z-50 bg-matcha-900 px-4 py-3 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <a href={`/order/${location.id ? encodeURIComponent('frankys-farm') : ''}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold hover:bg-white/20">
            <ArrowLeft size={14} /> Zurück
          </a>
          <div className="text-sm hidden sm:block">
            <div className="font-bold">Design-Vorschau</div>
            <div className="text-[11px] text-matcha-200">{items.length} Produkte · {grouped.length} Kategorien</div>
          </div>
          <div className="ml-auto flex gap-1 overflow-x-auto">
            {[
              { n: 1 as const, label: '1 Flink' },
              { n: 2 as const, label: '2 Deliveroo' },
              { n: 3 as const, label: '3 Uber' },
              { n: 4 as const, label: '4 Boutique' },
            ].map((s) => (
              <button
                key={s.n}
                onClick={() => setActive(s.n)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition',
                  active === s.n ? 'bg-accent text-matcha-900' : 'bg-white/10 text-white',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        {active === 1 && <Style1 location={location} grouped={grouped} />}
        {active === 2 && <Style2 location={location} grouped={grouped} />}
        {active === 3 && <Style3 location={location} grouped={grouped} />}
        {active === 4 && <Style4 location={location} grouped={grouped} />}
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-gray-500">
        Teste alle 4 Stile. Sag welche Nummer gefällt — dann baue ich sie komplett aus.
      </div>
    </div>
  );
}

type G = { cat: Cat; items: Item[] };
type P = { location: Loc; grouped: G[] };

function fmt(n: number) { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* =============================== 1 · FLINK =============================== */
function Style1({ location, grouped }: P) {
  return (
    <div className="bg-white">
      <section className="bg-matcha-900 px-4 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-accent grid place-items-center text-matcha-900 font-black">{location.name.charAt(0)}</div>
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold">{location.name}</h1>
            <div className="text-[11px] text-matcha-200">Geöffnet · {location.stadt ?? 'Aachen'}</div>
          </div>
        </div>
        <div className="mt-3 inline-flex rounded-full bg-matcha-800 p-1 ring-1 ring-white/10">
          <button className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-matcha-900">Abholung</button>
          <button className="rounded-full px-4 py-1.5 text-sm font-semibold text-matcha-100">Lieferung</button>
        </div>
      </section>
      <section className="px-4 py-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-matcha-900/40" />
          <input placeholder="Suche…" className="h-10 w-full rounded-xl border px-3 pl-9 text-sm" />
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {['🍽️ Alle', '⭐ Beliebt', '🌱 Vegan', '💶 Unter 10 €'].map((f, i) => (
            <span key={i} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-bold', i === 0 ? 'bg-matcha-900 text-accent' : 'bg-matcha-50')}>{f}</span>
          ))}
        </div>

        {grouped.map(({ cat, items }) => (
          <div key={cat.id} className="mb-6">
            <h2 className="mb-3 font-display text-lg font-bold">{cat.name}</h2>
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <article key={item.id} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
                  <div className="relative aspect-square bg-matcha-50">
                    <ItemImage item={item as any} category={cat as any} className="h-full w-full" rounded="rounded-none" emojiClass="text-5xl" />
                    {item.beliebt && <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase text-matcha-900">⭐ Top</span>}
                    <button className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-matcha-900 text-white shadow-lg"><Plus className="mx-auto" size={18} /></button>
                  </div>
                  <div className="p-2.5">
                    <h3 className="font-display text-[13px] font-bold leading-tight line-clamp-2 min-h-[2.3em] text-matcha-900">{item.name}</h3>
                    <div className="mt-1 font-display text-[15px] font-black text-matcha-900">{fmt(item.preis)} €</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/* =============================== 2 · DELIVEROO =============================== */
function Style2({ location, grouped }: P) {
  return (
    <div className="bg-white">
      <section className="relative h-44 overflow-hidden bg-gradient-to-br from-amber-900 via-amber-800 to-amber-600">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3), transparent 70%)' }} />
        <div className="relative flex h-full items-end px-4 pb-4 text-white">
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">{location.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-white" /> 4.8</span>
              <span>·</span>
              <span>15-25 min</span>
              <span>·</span>
              <span>{location.stadt ?? 'Aachen'}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-3 -mt-4 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5">
        <div className="flex gap-2">
          <button className="flex-1 rounded-full bg-amber-700 py-2.5 text-sm font-bold text-white">🛵 Lieferung</button>
          <button className="flex-1 rounded-full bg-amber-50 py-2.5 text-sm font-bold text-amber-900">🏪 Abholung</button>
        </div>
      </section>
      <section className="px-4 py-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-900/40" />
          <input placeholder="Menü durchsuchen…" className="h-11 w-full rounded-full border bg-amber-50/30 px-3 pl-9 text-sm" />
        </div>
        {grouped.map(({ cat, items }) => (
          <div key={cat.id} className="mb-6">
            <h2 className="mb-3 font-display text-xl font-bold">{cat.name}</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className="flex gap-3 rounded-2xl border border-amber-900/10 bg-white p-3">
                  <div className="flex-1">
                    <h3 className="font-display text-base font-bold text-amber-950">{item.name}</h3>
                    {item.beschreibung && <p className="mt-1 text-xs leading-relaxed text-amber-900/60 line-clamp-2">{item.beschreibung}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-display text-lg font-black text-amber-950">{fmt(item.preis)} €</span>
                      {item.beliebt && <span className="text-[10px] font-bold text-amber-700">⭐ Beliebt</span>}
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <ItemImage item={item as any} category={cat as any} className="h-[92px] w-[92px]" emojiClass="text-4xl" />
                    <button className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-amber-700 text-white shadow-lg ring-2 ring-white"><Plus className="mx-auto" size={16} /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/* =============================== 3 · UBER-EATS =============================== */
function Style3({ location, grouped }: P) {
  return (
    <div className="bg-gray-50">
      <section className="border-b bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-black grid place-items-center text-white font-bold">{location.name.charAt(0)}</div>
          <div className="flex-1">
            <h1 className="font-display text-base font-bold">{location.name}</h1>
            <div className="text-xs text-gray-500">25-40 min · ⭐ 4.7 (320)</div>
          </div>
        </div>
      </section>
      <section className="border-b bg-white px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search menu" className="h-10 w-full rounded-full bg-gray-100 px-3 pl-9 text-sm" />
        </div>
      </section>

      {grouped.map(({ cat, items }) => (
        <section key={cat.id} className="px-4 py-4">
          <h2 className="mb-2 font-display text-lg font-black">{cat.name}</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <article key={item.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-black">{item.name}</h3>
                  {item.beschreibung && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.beschreibung}</p>}
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-sm font-bold">{fmt(item.preis)} €</span>
                    {item.beliebt && <span className="text-[10px] font-bold text-green-700">#1 Most liked</span>}
                  </div>
                </div>
                <div className="relative shrink-0">
                  <ItemImage item={item as any} category={cat as any} className="h-[72px] w-[72px]" emojiClass="text-3xl" rounded="rounded-lg" />
                  <button className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white shadow-lg ring-2 ring-black/10"><Plus className="mx-auto" size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* =============================== 4 · BOUTIQUE =============================== */
function Style4({ location, grouped }: P) {
  return (
    <div className="bg-stone-50">
      <section className="bg-matcha-900 px-6 pt-8 pb-12 text-white">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">{location.stadt ?? 'Aachen'} · est. 2026</div>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[0.95] tracking-tight">{location.name}</h1>
        <p className="mt-3 max-w-md text-sm italic leading-relaxed text-matcha-200">
          „Handgeschlagener Matcha aus Uji. Kaffee vor Ort geröstet. Jeder Moment sorgfältig kuratiert."
        </p>
        <div className="mt-6 inline-flex gap-2">
          <button className="rounded-full bg-accent px-5 py-2 text-xs font-bold uppercase tracking-wider text-matcha-900">Bei uns bestellen</button>
          <button className="rounded-full border border-white/30 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white">Abholung</button>
        </div>
      </section>

      {grouped.map(({ cat, items }) => {
        const signature = items.filter((i) => i.beliebt);
        const rest = items.filter((i) => !i.beliebt);
        return (
          <section key={cat.id} className="px-6 py-10">
            <div className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-matcha-700">{cat.name}</div>
            <h2 className="mt-2 text-center font-display text-3xl font-bold tracking-tight text-matcha-900">Unsere Auswahl</h2>

            {signature.length > 0 && (
              <div className="mt-6 space-y-6">
                {signature.map((item) => (
                  <article key={item.id} className="group overflow-hidden rounded-3xl bg-white ring-1 ring-matcha-900/10">
                    <div className="relative aspect-[16/10] bg-matcha-50">
                      <ItemImage item={item as any} category={cat as any} className="h-full w-full" rounded="rounded-none" emojiClass="text-7xl" />
                      <span className="absolute left-4 top-4 rounded-full bg-matcha-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">Signature</span>
                    </div>
                    <div className="p-6">
                      <h3 className="font-display text-2xl font-bold tracking-tight text-matcha-900">{item.name}</h3>
                      {item.beschreibung && <p className="mt-2 text-sm italic leading-relaxed text-matcha-900/60">{item.beschreibung}</p>}
                      <div className="mt-5 flex items-center justify-between border-t border-matcha-900/10 pt-4">
                        <span className="font-display text-2xl font-black text-matcha-900">{fmt(item.preis)} €</span>
                        <button className="inline-flex h-11 items-center gap-2 rounded-full bg-matcha-900 px-5 text-sm font-bold text-accent">
                          <Plus size={16} /> Hinzufügen
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-4">
                {rest.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-matcha-900/10">
                    <div className="aspect-square bg-matcha-50">
                      <ItemImage item={item as any} category={cat as any} className="h-full w-full" rounded="rounded-none" emojiClass="text-5xl" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-display text-sm font-bold text-matcha-900 line-clamp-2 min-h-[2.4em]">{item.name}</h3>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-display text-base font-black text-matcha-900">{fmt(item.preis)} €</span>
                        <button className="h-8 w-8 rounded-full bg-matcha-900 text-accent"><Plus className="mx-auto" size={16} /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
