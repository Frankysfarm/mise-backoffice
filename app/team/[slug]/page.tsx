import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { TeamLogin, type TeamBrand } from '../team-login';

export const dynamic = 'force-dynamic';

const MISE_PRIMARY = '#1f5a3a';
const MISE_ACCENT = '#7ee2a8';

function isHexColor(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

async function loadBrand(slug: string): Promise<TeamBrand | null> {
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return null;
  const service = createServiceClient();
  const { data } = await service
    .from('tenants')
    .select('name, slug, logo_url, qr_logo_url, theme_primary, theme_accent, qr_theme_primary, qr_theme_accent, stadt, aktiv')
    .eq('slug', slug)
    .maybeSingle();
  if (!data || data.aktiv === false) return null;
  const primary = isHexColor(data.theme_primary) ? data.theme_primary : isHexColor(data.qr_theme_primary) ? data.qr_theme_primary : MISE_PRIMARY;
  const accent = isHexColor(data.theme_accent) ? data.theme_accent : isHexColor(data.qr_theme_accent) ? data.qr_theme_accent : MISE_ACCENT;
  return {
    name: data.name,
    slug: data.slug,
    logoUrl: data.logo_url || data.qr_logo_url || null,
    primary,
    accent,
    stadt: data.stadt ?? null,
  };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { slug } = params;
  const brand = await loadBrand(slug);
  const name = brand?.name ?? 'Mise Team';
  return {
    title: `${name} · Team-Anmeldung`,
    description: `Mitarbeiter-Anmeldung für ${name}: Schichten, Aufgaben und Übergaben.`,
    robots: { index: false, follow: false },
    appleWebApp: { capable: true, title: `${name} Team`, statusBarStyle: 'black-translucent' },
  };
}

export async function generateViewport({ params }: { params: { slug: string } }): Promise<Viewport> {
  const { slug } = params;
  const brand = await loadBrand(slug);
  return { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: brand?.primary ?? MISE_PRIMARY };
}

export default async function TeamLoginPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const brand = await loadBrand(slug);
  if (!brand) notFound();
  return <TeamLogin brand={brand} />;
}
