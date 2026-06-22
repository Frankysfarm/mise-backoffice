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

// ── #3 Kontoauszug: Buchungen speichern (dedup über import_hash) ──
export async function saveBankTx(txs: Array<{ buchungstag: string | null; betrag: number; richtung: string; verwendungszweck: string; gegenpartei: string; import_hash: string }>, quelle: string) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert' };
  const svc = createServiceClient();
  const { data: existing } = await svc.from('bank_transactions').select('import_hash').eq('tenant_id', emp.tenant_id);
  const seen = new Set((existing ?? []).map((r: any) => r.import_hash));
  const rows = txs.filter((t) => t.import_hash && !seen.has(t.import_hash)).map((t) => ({
    tenant_id: emp.tenant_id, location_id: emp.location_id ?? null,
    buchungstag: t.buchungstag, betrag: Number(t.betrag) || 0,
    richtung: t.richtung === 'einnahme' ? 'einnahme' : 'ausgabe',
    verwendungszweck: t.verwendungszweck || null, gegenpartei: t.gegenpartei || null,
    quelle, import_hash: t.import_hash,
  }));
  if (!rows.length) return { ok: true, inserted: 0, dup: txs.length };
  const { error } = await svc.from('bank_transactions').insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/neo/app/buchhaltung');
  return { ok: true, inserted: rows.length, dup: txs.length - rows.length };
}

// ── #3 Auto-Abgleich: Ausgaben-Buchung ↔ Beleg (Betrag ±0,02 €, Datum ±6 Tage) ──
export async function autoMatchBank() {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { ok: false, error: 'Nicht autorisiert' };
  const svc = createServiceClient();
  const tid = emp.tenant_id;
  const [{ data: txs }, { data: linked }, { data: belege }] = await Promise.all([
    svc.from('bank_transactions').select('id, betrag, buchungstag').eq('tenant_id', tid).eq('richtung', 'ausgabe').is('beleg_id', null),
    svc.from('bank_transactions').select('beleg_id').eq('tenant_id', tid).not('beleg_id', 'is', null),
    svc.from('belege').select('id, betrag_brutto, datum').eq('tenant_id', tid),
  ]);
  const used = new Set((linked ?? []).map((r: any) => r.beleg_id));
  const avail = (belege ?? []).filter((b: any) => !used.has(b.id));
  let matched = 0;
  for (const tx of (txs ?? []) as any[]) {
    const idx = avail.findIndex((b: any) => Math.abs(Number(b.betrag_brutto) - Number(tx.betrag)) < 0.02 && (!tx.buchungstag || !b.datum || Math.abs(+new Date(tx.buchungstag) - +new Date(b.datum)) <= 6 * 86400000));
    if (idx >= 0) {
      const b = avail[idx];
      await svc.from('bank_transactions').update({ beleg_id: b.id, matched_auto: true }).eq('id', tx.id);
      avail.splice(idx, 1); matched++;
    }
  }
  revalidatePath('/neo/app/buchhaltung');
  return { ok: true, matched };
}
