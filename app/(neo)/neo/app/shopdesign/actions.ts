'use server';

import { revalidatePath } from 'next/cache';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import {
  collectStorefrontReferences,
  createDefaultStorefrontDocument,
  normalizeStorefrontBuilderEnvelope,
  sanitizeStorefrontDocument,
  type StorefrontBuilderEnvelope,
  type StorefrontStudioDocument,
} from '@/lib/storefront-builder';

type StudioActionResult = {
  ok: boolean;
  error?: string;
  conflict?: boolean;
  envelope?: StorefrontBuilderEnvelope;
};

async function tenantContext() {
  const employee = await requireManagerPlus();
  if (!employee.tenant_id) throw new Error('Kein Restaurant zugeordnet.');
  const service = createServiceClient();
  const { data: tenant, error } = await service
    .from('tenants')
    .select('id, storefront_settings, storefront_theme_id, theme_primary, theme_accent, hero_image_url')
    .eq('id', employee.tenant_id)
    .maybeSingle();
  if (error || !tenant) throw new Error('Restaurant konnte nicht geladen werden.');
  const settings = (tenant.storefront_settings ?? {}) as Record<string, any>;
  const fallback = createDefaultStorefrontDocument({
    themeId: tenant.storefront_theme_id,
    primary: settings.theme?.primary ?? tenant.theme_primary,
    accent: settings.theme?.accent ?? tenant.theme_accent,
    background: settings.theme?.background,
    heroImageUrl: tenant.hero_image_url,
    heroBadge: settings.hero?.badge,
    heroTitle: settings.hero?.title,
    heroSubtitle: settings.hero?.subtitle,
  });
  return { employee, service, tenant, settings, fallback };
}

async function validateReferences(
  service: ReturnType<typeof createServiceClient>,
  tenantId: string,
  document: StorefrontStudioDocument,
) {
  const { data: locations } = await service.from('locations').select('id').eq('tenant_id', tenantId);
  const locationIds = (locations ?? []).map((location) => location.id);
  const [{ data: products }, { data: categories }] = await Promise.all([
    service.from('menu_items').select('id').in('location_id', locationIds.length ? locationIds : ['00000000-0000-0000-0000-000000000000']),
    service.from('menu_categories').select('id').in('location_id', locationIds.length ? locationIds : ['00000000-0000-0000-0000-000000000000']),
  ]);
  const allowedProducts = new Set((products ?? []).map((product) => product.id));
  const allowedCategories = new Set((categories ?? []).map((category) => category.id));
  const references = collectStorefrontReferences(document);
  if (references.productIds.some((id) => !allowedProducts.has(id))) throw new Error('Mindestens ein ausgewähltes Produkt gehört nicht zu diesem Restaurant.');
  if (references.categoryIds.some((id) => !allowedCategories.has(id))) throw new Error('Mindestens eine ausgewählte Kategorie gehört nicht zu diesem Restaurant.');
}

async function applyBuilder(
  service: ReturnType<typeof createServiceClient>,
  input: {
    tenantId: string;
    expectedRevision: number;
    envelope: StorefrontBuilderEnvelope;
    theme?: Record<string, unknown>;
    themeId?: string;
  },
) {
  const { data, error } = await service.rpc('apply_storefront_builder', {
    p_tenant_id: input.tenantId,
    p_expected_revision: input.expectedRevision,
    p_builder: input.envelope,
    p_theme: input.theme ?? null,
    p_theme_id: input.themeId ?? null,
  });
  if (error) throw error;
  const result = data as { ok?: boolean; conflict?: boolean; error?: string } | null;
  if (!result?.ok) {
    if (result?.conflict) return { conflict: true as const };
    throw new Error(result?.error === 'invalid_next_revision' ? 'Ungültiger Versionsstand.' : 'Shop Studio konnte nicht gespeichert werden.');
  }
  return { conflict: false as const };
}

export async function saveStorefrontDraft(input: {
  document: StorefrontStudioDocument;
  expectedRevision: number;
}): Promise<StudioActionResult> {
  try {
    const { service, tenant, settings, fallback } = await tenantContext();
    const envelope = normalizeStorefrontBuilderEnvelope(settings.storefront_builder, fallback);
    if (envelope.draft.revision !== input.expectedRevision) {
      return { ok: false, conflict: true, error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' };
    }
    const now = new Date().toISOString();
    const document = sanitizeStorefrontDocument(input.document, envelope.draft);
    document.revision = envelope.draft.revision + 1;
    document.updatedAt = now;
    await validateReferences(service, tenant.id, document);
    const nextEnvelope: StorefrontBuilderEnvelope = { ...envelope, draft: document };
    const applied = await applyBuilder(service, { tenantId: tenant.id, expectedRevision: input.expectedRevision, envelope: nextEnvelope });
    if (applied.conflict) return { ok: false, conflict: true, error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' };
    revalidatePath('/neo/app/shopdesign');
    return { ok: true, envelope: nextEnvelope };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Entwurf konnte nicht gespeichert werden.' };
  }
}

export async function publishStorefrontDraft(input: { expectedRevision: number }): Promise<StudioActionResult> {
  try {
    const { service, tenant, settings, fallback } = await tenantContext();
    const envelope = normalizeStorefrontBuilderEnvelope(settings.storefront_builder, fallback);
    if (envelope.draft.revision !== input.expectedRevision) {
      return { ok: false, conflict: true, error: 'Der Entwurf ist nicht mehr aktuell. Bitte neu laden.' };
    }
    await validateReferences(service, tenant.id, envelope.draft);
    const now = new Date().toISOString();
    const revision = envelope.draft.revision + 1;
    const draft = { ...envelope.draft, revision, updatedAt: now };
    const published = { ...draft };
    const history = envelope.published
      ? [{ id: `version_${Date.now().toString(36)}`, publishedAt: envelope.publishedAt ?? now, document: envelope.published }, ...envelope.history].slice(0, 8)
      : envelope.history;
    const nextEnvelope: StorefrontBuilderEnvelope = { draft, published, publishedAt: now, history };
    const nextTheme = {
      ...(settings.theme ?? {}),
      primary: published.appearance.primary,
      accent: published.appearance.accent,
      background: published.appearance.background,
    };
    const applied = await applyBuilder(service, {
      tenantId: tenant.id,
      expectedRevision: input.expectedRevision,
      envelope: nextEnvelope,
      theme: nextTheme,
      themeId: published.themeId,
    });
    if (applied.conflict) return { ok: false, conflict: true, error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' };
    revalidatePath('/neo/app/shopdesign');
    return { ok: true, envelope: nextEnvelope };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Shop konnte nicht veröffentlicht werden.' };
  }
}

export async function restoreStorefrontVersion(input: {
  historyId: string;
  expectedRevision: number;
}): Promise<StudioActionResult> {
  try {
    const { service, tenant, settings, fallback } = await tenantContext();
    const envelope = normalizeStorefrontBuilderEnvelope(settings.storefront_builder, fallback);
    if (envelope.draft.revision !== input.expectedRevision) {
      return { ok: false, conflict: true, error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' };
    }
    const version = envelope.history.find((entry) => entry.id === input.historyId);
    if (!version) return { ok: false, error: 'Diese Version ist nicht mehr verfügbar.' };
    const draft = sanitizeStorefrontDocument(version.document, envelope.draft);
    draft.revision = envelope.draft.revision + 1;
    draft.updatedAt = new Date().toISOString();
    const nextEnvelope = { ...envelope, draft };
    const applied = await applyBuilder(service, { tenantId: tenant.id, expectedRevision: input.expectedRevision, envelope: nextEnvelope });
    if (applied.conflict) return { ok: false, conflict: true, error: 'Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.' };
    revalidatePath('/neo/app/shopdesign');
    return { ok: true, envelope: nextEnvelope };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Version konnte nicht wiederhergestellt werden.' };
  }
}
