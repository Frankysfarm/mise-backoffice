'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { revalidatePath } from 'next/cache';

const KATEGORIEN = ['Wareneinsatz', 'Getränke', 'Personal', 'Miete', 'Energie', 'Marketing', 'Reparatur', 'Büro', 'Sonstiges'];

export async function saveBeleg(data: {
  datum: string | null; haendler: string; betrag_brutto: number; mwst_satz: number;
  mwst_betrag: number; netto: number; kategorie: string; beleg_url: string | null; ki_confidence: number;
}) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert' };
  const svc = createServiceClient();
  const satz = [0, 7, 19].includes(Number(data.mwst_satz)) ? Number(data.mwst_satz) : 19;
  const { error } = await svc.from('belege').insert({
    tenant_id: emp.tenant_id, location_id: emp.location_id ?? null,
    datum: data.datum || null, haendler: (data.haendler || '').trim() || null,
    betrag_brutto: Number(data.betrag_brutto) || 0, mwst_satz: satz,
    mwst_betrag: Number(data.mwst_betrag) || 0, netto: Number(data.netto) || 0,
    kategorie: KATEGORIEN.includes(data.kategorie) ? data.kategorie : 'Sonstiges',
    beleg_url: data.beleg_url, ki_confidence: data.ki_confidence, status: 'erfasst',
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/neo/app/buchhaltung');
  return { ok: true };
}

export async function deleteBeleg(id: string) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert' };
  const svc = createServiceClient();
  const { error } = await svc.from('belege').delete().eq('id', id).eq('tenant_id', emp.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/neo/app/buchhaltung');
  return { ok: true };
}
