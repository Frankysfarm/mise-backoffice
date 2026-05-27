'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { revalidatePath } from 'next/cache';

// Wiederverwendbare Extra-Gruppen (JSONB)
const MILK_EXTRAS = [
  {
    id: 'size', name: 'Größe', typ: 'size', required: true, multiple: false,
    options: [
      { id: 's', name: 'Klein (250 ml)',  preis: 0 },
      { id: 'm', name: 'Medium (350 ml)', preis: 0.5 },
      { id: 'l', name: 'Groß (450 ml)',   preis: 1.0 },
    ],
  },
  {
    id: 'milk', name: 'Milch', typ: 'milk', required: true, multiple: false,
    options: [
      { id: 'kuh',    name: 'Kuhmilch',    preis: 0 },
      { id: 'hafer',  name: 'Hafermilch',  preis: 0.5 },
      { id: 'mandel', name: 'Mandelmilch', preis: 0.5 },
      { id: 'soja',   name: 'Sojamilch',   preis: 0.5 },
    ],
  },
  {
    id: 'sirup', name: 'Sirup (optional)', typ: 'extra', required: false, multiple: true,
    options: [
      { id: 'vanille',   name: 'Vanille',   preis: 0.4 },
      { id: 'karamel',   name: 'Karamel',   preis: 0.4 },
      { id: 'haselnuss', name: 'Haselnuss', preis: 0.4 },
    ],
  },
];

const COFFEE_EXTRAS = [
  {
    id: 'size', name: 'Größe', typ: 'size', required: true, multiple: false,
    options: [
      { id: 's', name: 'Klein',  preis: 0 },
      { id: 'm', name: 'Medium', preis: 0.5 },
      { id: 'l', name: 'Groß',   preis: 1.0 },
    ],
  },
  {
    id: 'shot', name: 'Extra-Shot (optional)', typ: 'extra', required: false, multiple: true,
    options: [
      { id: 'shot1', name: '+1 Espresso-Shot', preis: 0.8 },
    ],
  },
];

const FOOD_EXTRAS = [
  {
    id: 'zusatz', name: 'Extras', typ: 'extra', required: false, multiple: true,
    options: [
      { id: 'ei',      name: 'Spiegelei (+1,50)',          preis: 1.5 },
      { id: 'avocado', name: 'Extra Avocado (+2,00)',       preis: 2.0 },
      { id: 'veggie',  name: 'Gegrilltes Gemüse (+1,80)',   preis: 1.8 },
    ],
  },
  { id: 'notiz', name: 'Sonderwunsch', typ: 'note', required: false, multiple: false },
];

const CATEGORIES = [
  { name: 'Matcha',       icon: '🍵', sort_order: 1 },
  { name: 'Kaffee',       icon: '☕', sort_order: 2 },
  { name: 'Kalte Drinks', icon: '🧊', sort_order: 3 },
  { name: 'Frühstück',    icon: '🥑', sort_order: 4 },
  { name: 'Süßes',        icon: '🍰', sort_order: 5 },
];

type ItemSeed = {
  name: string;
  beschreibung: string;
  preis: number;
  bild_url: string;
  category: string;
  extras: unknown;
  beliebt?: boolean;
  allergene?: string[];
};

const ITEMS: ItemSeed[] = [
  // Matcha
  { name: 'Matcha Latte',          beschreibung: 'Zeremoniell-Matcha aus Uji + cremige Milch.',  preis: 4.9, category: 'Matcha', extras: MILK_EXTRAS, beliebt: true,  bild_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800&q=80', allergene: ['laktose'] },
  { name: 'Iced Matcha',           beschreibung: 'Erfrischend, kalt aufgegossen, dezent süß.',   preis: 4.9, category: 'Matcha', extras: MILK_EXTRAS, beliebt: true,  bild_url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', allergene: ['laktose'] },
  { name: 'Matcha Espresso Fusion',beschreibung: 'Unser Signature — Matcha trifft Espresso.',    preis: 5.4, category: 'Matcha', extras: MILK_EXTRAS, bild_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80', allergene: ['laktose'] },
  { name: 'Lemonade Matcha',       beschreibung: 'Matcha + Zitrone + Sprudel. Sommerfrisch.',    preis: 5.2, category: 'Matcha', extras: [MILK_EXTRAS[0]], bild_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80' },

  // Kaffee
  { name: 'Cappuccino',            beschreibung: 'Doppelter Espresso, seidig aufgeschäumte Milch.', preis: 3.6, category: 'Kaffee', extras: MILK_EXTRAS, beliebt: true, bild_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80', allergene: ['laktose'] },
  { name: 'Filterkaffee',          beschreibung: 'Single Origin, handfiltriert.',                preis: 3.2, category: 'Kaffee', extras: COFFEE_EXTRAS, bild_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&q=80' },
  { name: 'Chai Latte',            beschreibung: 'Hausgemachter Chai mit warmen Gewürzen.',       preis: 4.6, category: 'Kaffee', extras: MILK_EXTRAS, bild_url: 'https://images.unsplash.com/photo-1567748157439-651aca2ff064?w=800&q=80', allergene: ['laktose'] },

  // Kalte Drinks
  { name: 'Iced Americano',        beschreibung: 'Doppelter Espresso auf Eis.',                  preis: 3.8, category: 'Kalte Drinks', extras: COFFEE_EXTRAS, bild_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80' },
  { name: 'Homemade Eistee',       beschreibung: 'Hauseigener Kaltaufguss mit Pfirsich.',         preis: 4.2, category: 'Kalte Drinks', extras: [], bild_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&q=80' },

  // Frühstück
  { name: 'Avocado Toast',         beschreibung: 'Sauerteig, Avocado, Limette, Chili, Kresse.',  preis: 8.9, category: 'Frühstück', extras: FOOD_EXTRAS, beliebt: true, bild_url: 'https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=800&q=80', allergene: ['gluten'] },
  { name: 'Matcha Bowl',           beschreibung: 'Kokos-Joghurt, Granola, Beeren, Matcha-Topping.', preis: 9.4, category: 'Frühstück', extras: FOOD_EXTRAS, bild_url: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=800&q=80', allergene: ['gluten', 'nuss'] },
  { name: 'Granola Bowl',          beschreibung: 'Haferflocken, Joghurt, saisonales Obst.',       preis: 7.9, category: 'Frühstück', extras: FOOD_EXTRAS, bild_url: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=800&q=80', allergene: ['gluten', 'laktose', 'nuss'] },

  // Süßes
  { name: 'Croissant (frisch)',    beschreibung: 'Aus der Backstube nebenan.',                   preis: 2.4, category: 'Süßes', extras: [], bild_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80', allergene: ['gluten', 'laktose', 'ei'] },
  { name: 'Matcha Cheesecake',     beschreibung: 'No-bake, cremig, grasig-grün.',                preis: 4.8, category: 'Süßes', extras: [], beliebt: true, bild_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80', allergene: ['gluten', 'laktose', 'ei'] },
];

export async function seedDemoMenu(): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('location_id,tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.location_id) return { ok: false, error: 'Kein Standort für diesen Account.' };

  // Check — nur wenn Menü leer ist
  const { count: existingCount } = await svc
    .from('menu_items').select('id', { count: 'exact', head: true })
    .eq('location_id', empRow.location_id);

  if ((existingCount ?? 0) > 0) {
    return { ok: false, error: 'Menü enthält bereits Produkte. Zum Neuladen erst leeren.' };
  }

  // 1) Kategorien einfügen
  const categoryRows = CATEGORIES.map((c) => ({
    ...c,
    location_id: empRow.location_id,
    aktiv: true,
  }));

  const { data: insertedCategories, error: catErr } = await svc
    .from('menu_categories').insert(categoryRows).select('id,name');

  if (catErr || !insertedCategories) {
    return { ok: false, error: catErr?.message ?? 'Kategorien konnten nicht erstellt werden.' };
  }

  const catIdByName = new Map(insertedCategories.map((c) => [c.name as string, c.id as string]));

  // 2) Items einfügen
  const itemRows = ITEMS.map((it, idx) => ({
    location_id: empRow.location_id,
    category_id: catIdByName.get(it.category) ?? null,
    name: it.name,
    beschreibung: it.beschreibung,
    preis: it.preis,
    bild_url: it.bild_url,
    allergene: it.allergene ?? [],
    tags: [],
    verfuegbar: true,
    beliebt: it.beliebt ?? false,
    sort_order: idx,
    extras: it.extras,
  }));

  const { data: insertedItems, error: itemErr } = await svc
    .from('menu_items').insert(itemRows).select('id,name');

  if (itemErr || !insertedItems) {
    return { ok: false, error: itemErr?.message ?? 'Produkte konnten nicht eingefügt werden.' };
  }

  // 3) Cross-Sells
  const byName = new Map(insertedItems.map((i) => [i.name as string, i.id as string]));
  const rel = (fromName: string, toName: string, typ: 'upsell' | 'crosssell', sort_order: number) => {
    const item_id = byName.get(fromName);
    const related_item_id = byName.get(toName);
    if (!item_id || !related_item_id) return null;
    return { item_id, related_item_id, typ, sort_order };
  };

  const relations = [
    rel('Matcha Latte',    'Croissant (frisch)',  'crosssell', 1),
    rel('Matcha Latte',    'Matcha Cheesecake',   'crosssell', 2),
    rel('Avocado Toast',   'Matcha Latte',        'crosssell', 1),
    rel('Avocado Toast',   'Iced Matcha',         'crosssell', 2),
    rel('Matcha Bowl',     'Chai Latte',          'crosssell', 1),
    rel('Matcha Bowl',     'Matcha Cheesecake',   'crosssell', 2),
    rel('Iced Matcha',     'Matcha Cheesecake',   'crosssell', 1),
    rel('Iced Matcha',     'Croissant (frisch)',  'crosssell', 2),
    rel('Iced Americano',  'Croissant (frisch)',  'crosssell', 1),
    rel('Matcha Cheesecake','Matcha Latte',       'upsell',    1),
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  if (relations.length > 0) {
    await svc.from('menu_item_relations').upsert(relations, { onConflict: 'item_id,related_item_id,typ' });
  }

  revalidatePath('/menu');
  revalidatePath('/shop');

  return { ok: true, inserted: insertedItems.length };
}
