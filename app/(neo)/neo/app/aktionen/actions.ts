'use server';

import { revalidatePath } from 'next/cache';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import type { FpPlacement, FpTriggerMode, FreeProductConfig } from '@/lib/free-product/types';

type CampaignPayload = {
  id?: string | null;
  aktiv: boolean;
  eligible_item_ids: string[];
  trigger_mode: FpTriggerMode;
  trigger_ab_betrag: number | null;
  trigger_nach_sekunden: number | null;
  trigger_nach_bestellungen: number | null;
  placement: FpPlacement;
  cooldown_tage: number;
  anzeige_titel: string;
  anzeige_text: string;
  max_nutzungen_gesamt: number | null;
  konfig_typ: string;
};

async function managerTenantId(): Promise<string | null> {
  const employee = await requireManagerPlus();
  const sb = createServiceClient();
  const { data } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  return data?.tenant_id ?? null;
}

export async function saveGratisProduktConfig(payload: CampaignPayload): Promise<{ ok: boolean; error?: string; config?: FreeProductConfig }> {
  const tenantId = await managerTenantId();
  if (!tenantId) return { ok: false, error: 'Kein Restaurant zugeordnet.' };

  const ids = [...new Set(payload.eligible_item_ids)].slice(0, 12);
  if (payload.aktiv && ids.length === 0) return { ok: false, error: 'Wähle mindestens ein Gratis-Produkt.' };
  if (payload.trigger_mode === 'nach_x_bestellungen' && (payload.trigger_nach_bestellungen ?? 0) < 2) {
    return { ok: false, error: 'Der Bestellrhythmus muss mindestens 2 sein.' };
  }

  const sb = createServiceClient();
  if (ids.length) {
    const { data: locations } = await sb.from('locations').select('id').eq('tenant_id', tenantId);
    const locationIds = (locations ?? []).map((location) => location.id);
    const { data: ownedItems } = await sb
      .from('menu_items')
      .select('id')
      .in('id', ids)
      .in('location_id', locationIds.length ? locationIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('verfuegbar', true);
    if ((ownedItems ?? []).length !== ids.length) return { ok: false, error: 'Mindestens ein Produkt gehört nicht zu diesem Restaurant oder ist nicht verfügbar.' };
  }

  const values = {
    tenant_id: tenantId,
    aktiv: payload.aktiv,
    eligible_item_ids: ids,
    trigger_mode: payload.trigger_mode,
    trigger_ab_betrag: payload.trigger_mode === 'ab_betrag' ? Math.max(0, Number(payload.trigger_ab_betrag) || 0) : null,
    trigger_nach_sekunden: payload.trigger_mode === 'nach_sekunden' ? Math.max(1, Number(payload.trigger_nach_sekunden) || 5) : null,
    trigger_nach_bestellungen: payload.trigger_mode === 'nach_x_bestellungen' ? Math.max(2, Number(payload.trigger_nach_bestellungen) || 3) : 5,
    placement: payload.placement,
    cooldown_tage: Math.max(0, Math.min(365, Number(payload.cooldown_tage) || 0)),
    anzeige_titel: payload.anzeige_titel.trim().slice(0, 100) || 'Dein Gratis-Produkt',
    anzeige_text: payload.anzeige_text.trim().slice(0, 240) || null,
    max_nutzungen_gesamt: payload.max_nutzungen_gesamt && payload.max_nutzungen_gesamt > 0 ? Math.floor(payload.max_nutzungen_gesamt) : null,
    konfig_typ: payload.konfig_typ === 'treue' ? 'treue' : 'auswahl',
  };

  const query = payload.id
    ? sb.from('free_product_configs').update(values).eq('id', payload.id).eq('tenant_id', tenantId)
    : sb.from('free_product_configs').insert(values);
  const { data, error } = await query.select('*').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Aktion konnte nicht gespeichert werden.' };

  revalidatePath('/neo/app/aktionen');
  return { ok: true, config: data as FreeProductConfig };
}

export async function deleteGratisProduktConfig(id: string): Promise<{ ok: boolean; error?: string }> {
  const tenantId = await managerTenantId();
  if (!tenantId) return { ok: false, error: 'Kein Restaurant zugeordnet.' };
  const sb = createServiceClient();
  const { error } = await sb.from('free_product_configs').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/neo/app/aktionen');
  return { ok: true };
}
