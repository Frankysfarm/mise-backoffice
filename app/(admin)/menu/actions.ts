'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function getTenantAndLocation() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id,location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp ?? null;
}

/* ---------- Categories ---------- */

export async function createCategory(data: { name: string; icon?: string; sort_order?: number }) {
  const emp = await getTenantAndLocation();
  if (!emp?.location_id) return { ok: false, error: 'Kein Standort' };
  const svc = createServiceClient();
  const { error } = await svc.from('menu_categories').insert({
    location_id: emp.location_id,
    name: data.name,
    icon: data.icon ?? null,
    sort_order: data.sort_order ?? 999,
    aktiv: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/menu');
  return { ok: true };
}

export async function updateCategory(id: string, data: { name?: string; icon?: string; sort_order?: number; aktiv?: boolean }) {
  const svc = createServiceClient();
  const { error } = await svc.from('menu_categories').update(data).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/menu');
  return { ok: true };
}

export async function reorderCategories(ids: string[]) {
  const svc = createServiceClient();
  await Promise.all(
    ids.map((id, i) => svc.from('menu_categories').update({ sort_order: i }).eq('id', id)),
  );
  revalidatePath('/menu');
  return { ok: true };
}

export async function deleteCategory(id: string) {
  const svc = createServiceClient();
  const { error } = await svc.from('menu_categories').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/menu');
  return { ok: true };
}

/* ---------- Items ---------- */

export async function createItem(data: {
  category_id: string | null;
  name: string;
  beschreibung?: string;
  preis: number;
  mwst_satz?: number;
  food_type?: 'speise' | 'getraenk' | 'sonstiges';
  bild_url?: string;
  allergene?: string[];
  tags?: string[];
  beliebt?: boolean;
  verfuegbar?: boolean;
}) {
  const emp = await getTenantAndLocation();
  if (!emp?.location_id) return { ok: false, error: 'Kein Standort' };
  const svc = createServiceClient();
  const { error } = await svc.from('menu_items').insert({
    location_id: emp.location_id,
    category_id: data.category_id,
    name: data.name,
    beschreibung: data.beschreibung ?? null,
    preis: data.preis,
    mwst_satz: data.mwst_satz ?? 19,
    food_type: data.food_type ?? 'getraenk',
    bild_url: data.bild_url ?? null,
    allergene: data.allergene ?? [],
    tags: data.tags ?? [],
    beliebt: data.beliebt ?? false,
    verfuegbar: data.verfuegbar ?? true,
    sort_order: 999,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/menu');
  return { ok: true };
}

export async function updateItem(id: string, data: Partial<{
  category_id: string | null;
  name: string;
  beschreibung: string | null;
  preis: number;
  mwst_satz: number;
  food_type: 'speise' | 'getraenk' | 'sonstiges';
  bild_url: string | null;
  allergene: string[];
  tags: string[];
  beliebt: boolean;
  verfuegbar: boolean;
}>) {
  const svc = createServiceClient();
  const { error } = await svc.from('menu_items').update(data).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/menu');
  return { ok: true };
}

export async function deleteItem(id: string) {
  const svc = createServiceClient();
  const { error } = await svc.from('menu_items').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/menu');
  return { ok: true };
}

export async function toggleItemAvailable(id: string, verfuegbar: boolean) {
  return updateItem(id, { verfuegbar });
}

export async function toggleItemPopular(id: string, beliebt: boolean) {
  return updateItem(id, { beliebt });
}
