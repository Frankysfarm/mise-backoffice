'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, ExternalLink, ImagePlus, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import { THEMES, type ThemeId } from '@/lib/storefront-themes';

export function ThemePicker({
  tenantId, slug, current, heroImageUrl, logoUrl,
}: {
  tenantId: string; slug: string; current: string;
  heroImageUrl: string | null; logoUrl: string | null;
}) {
  const supabase = createClient();
  const [selected, setSelected] = useState<ThemeId>((current as ThemeId) || 'classic');
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  // Upload state
  const [heroUrl, setHeroUrl] = useState<string | null>(heroImageUrl);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [uploadingKind, setUploadingKind] = useState<'hero' | 'logo' | null>(null);

  function save(id: ThemeId) {
    setSelected(id);
    startSaving(async () => {
      const { error } = await supabase.from('tenants').update({ storefront_theme_id: id }).eq('id', tenantId);
      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  async function uploadImage(file: File, kind: 'hero' | 'logo') {
    setUploadingKind(kind);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${tenantId}/${kind}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('tenant_assets')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('tenant_assets').getPublicUrl(path);
      const field = kind === 'hero' ? 'hero_image_url' : 'logo_url';
      await supabase.from('tenants').update({ [field]: data.publicUrl }).eq('id', tenantId);
      if (kind === 'hero') setHeroUrl(data.publicUrl);
      else setLogo(data.publicUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload fehlgeschlagen');
    } finally {
      setUploadingKind(null);
    }
  }

  async function removeImage(kind: 'hero' | 'logo') {
    const field = kind === 'hero' ? 'hero_image_url' : 'logo_url';
    await supabase.from('tenants').update({ [field]: null }).eq('id', tenantId);
    if (kind === 'hero') setHeroUrl(null);
    else setLogo(null);
  }

  return (
    <div className="space-y-6">
      {saved && (
        <div className="rounded-xl border-2 border-matcha-500 bg-matcha-50 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-matcha-700" />
          <div>
            <div className="font-bold text-matcha-900">Theme aktualisiert</div>
            <div className="text-xs text-muted-foreground">Die Änderung ist sofort auf deiner Bestellseite sichtbar.</div>
          </div>
        </div>
      )}

      {/* === BANNER + LOGO === */}
      <Card className="p-6">
        <h2 className="font-display font-bold mb-1">Banner & Logo</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Dein Hero-Bild wird im Bold-Theme als Vollbild-Hintergrund genutzt, im Classic/Minimal als subtile Akzent-Grafik.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Hero-Bild */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Hero-Bild · Banner (min. 1600 × 900 px, quer)
            </div>
            <div className={cn(
              'relative aspect-[16/9] rounded-2xl border-2 border-dashed overflow-hidden',
              heroUrl ? 'border-matcha-300' : 'border-border bg-muted/40',
            )}>
              {heroUrl ? (
                <>
                  <img src={heroUrl} alt="Hero" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage('hero')}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <ImagePlus size={28} />
                  <div className="mt-2 text-xs">Kein Banner hochgeladen</div>
                </div>
              )}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 rounded-lg bg-matcha-100 hover:bg-matcha-200 px-3 py-2 text-sm font-semibold cursor-pointer text-matcha-900">
              {uploadingKind === 'hero' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingKind === 'hero' ? 'Lädt …' : heroUrl ? 'Banner ersetzen' : 'Banner hochladen'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'hero')}
                className="hidden"
              />
            </label>
          </div>

          {/* Logo */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Logo · transparentes PNG (quadratisch)
            </div>
            <div className={cn(
              'relative aspect-square rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center',
              logo ? 'border-matcha-300' : 'border-border bg-muted/40',
            )}>
              {logo ? (
                <>
                  <img src={logo} alt="Logo" className="h-full w-full object-contain p-4" />
                  <button
                    type="button"
                    onClick={() => removeImage('logo')}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <ImagePlus size={28} />
                  <div className="mt-2 text-xs">Kein Logo</div>
                </div>
              )}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 rounded-lg bg-matcha-100 hover:bg-matcha-200 px-3 py-2 text-sm font-semibold cursor-pointer text-matcha-900">
              {uploadingKind === 'logo' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingKind === 'logo' ? 'Lädt …' : logo ? 'Logo ersetzen' : 'Logo hochladen'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo')}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </Card>

      {/* === THEME-AUSWAHL === */}
      <div>
        <h2 className="font-display font-bold mb-1">Theme</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Die 6 Themes haben unterschiedliche Layouts — nicht nur andere Farben.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {Object.values(THEMES).map((theme) => {
          const active = selected === theme.id;
          return (
            <Card
              key={theme.id}
              className={cn(
                'overflow-hidden transition relative cursor-pointer',
                active ? 'ring-2 ring-matcha-700 shadow-strong' : 'hover:shadow-soft',
                saving && active && 'opacity-60',
              )}
              onClick={() => !saving && save(theme.id)}
            >
              {/* Preview-Karte */}
              <div
                className="h-48 relative overflow-hidden"
                style={{ background: theme.preview.background }}
              >
                <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.25em] opacity-70">Filiale · Aachen</div>
                    <div
                      className="font-display font-bold mt-2"
                      style={{
                        fontSize: theme.id === 'bold' ? '32px' : theme.id === 'minimal' ? '24px' : '28px',
                        lineHeight: 1,
                      }}
                    >
                      Restaurant
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-6 w-14 rounded-full border"
                        style={{
                          borderColor: theme.preview.accent,
                          backgroundColor: i === 1 ? theme.preview.accent : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
                {active && (
                  <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-matcha-700 text-white flex items-center justify-center shadow-strong">
                    <Check size={16} />
                  </div>
                )}
                {saving && active && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Menü-Card-Mock */}
              <div
                className="p-3 border-t flex items-center gap-3"
                style={{
                  background: theme.id === 'urban' ? '#1A1A1A' : theme.id === 'farmhouse' ? '#FFFFFF' : theme.id === 'aurora' ? '#FFFFFF' : theme.id === 'bold' ? '#FFFFFF' : theme.id === 'minimal' ? '#FAFAFA' : '#FFFFFF',
                  borderColor: theme.id === 'urban' ? '#262626' : theme.id === 'farmhouse' ? '#E2D3B7' : '#E4E4E7',
                  color: theme.id === 'urban' ? '#FAFAFA' : theme.id === 'farmhouse' ? '#2B1F17' : theme.id === 'aurora' ? '#0A0A0A' : theme.id === 'bold' ? '#000000' : theme.id === 'minimal' ? '#171717' : '#14532D',
                }}
              >
                <div
                  className="h-12 w-12 flex items-center justify-center shrink-0 text-xl rounded-xl"
                  style={{
                    background: theme.id === 'urban' ? '#0A0A0A' : theme.id === 'farmhouse' ? '#F8F1E4' : theme.id === 'aurora' ? '#EEF2FF' : theme.id === 'bold' ? '#F5F5F5' : theme.id === 'minimal' ? '#E5E5E5' : '#DCFCE7',
                    borderRadius: theme.id === 'bold' ? 0 : theme.id === 'minimal' ? 6 : 12,
                  }}
                >
                  ☕
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">Matcha Latte</div>
                  <div className="text-xs opacity-70">Cremig mit Milchschaum</div>
                </div>
                <div className="text-right font-bold text-sm">4,80 €</div>
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: theme.preview.accent,
                    color: theme.id === 'urban' ? '#0A0A0A' : theme.id === 'farmhouse' ? '#FFFFFF' : theme.id === 'aurora' ? '#FFFFFF' : theme.id === 'bold' ? '#FFFFFF' : theme.id === 'minimal' ? '#FFFFFF' : '#14532D',
                  }}
                >
                  +
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold">{theme.name}</h3>
                  {active && <span className="inline-flex items-center rounded-full bg-matcha-500/20 px-2 py-0.5 text-[10px] font-bold text-matcha-800 uppercase tracking-wider">Aktiv</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{theme.description}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
        <div>
          <div className="font-bold">Änderungen sofort live</div>
          <div className="text-sm text-muted-foreground">Dein aktuelles Theme: <strong>{THEMES[selected]?.name ?? "Eigenes Design"}</strong></div>
        </div>
        <a
          href={`/order/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2.5 text-sm font-bold hover:bg-matcha-800"
        >
          <Sparkles size={14} /> Bestellseite ansehen <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
