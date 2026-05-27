'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';

export function BannerLogoUpload({
  tenantId,
  heroImageUrl,
  logoUrl,
  fieldPrefix = '',
  contextLabel = 'Online-Bestellseite',
}: {
  tenantId: string;
  heroImageUrl: string | null;
  logoUrl: string | null;
  /** '' = standard Felder (logo_url, hero_image_url), 'qr_' = QR-Tisch-Felder */
  fieldPrefix?: '' | 'qr_';
  /** Anzeige-Label im Header z.B. "QR-Tisch" oder "Online-Bestellseite" */
  contextLabel?: string;
}) {
  const supabase = createClient();
  const [heroUrl, setHeroUrl] = useState<string | null>(heroImageUrl);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [uploadingKind, setUploadingKind] = useState<'hero' | 'logo' | null>(null);

  async function uploadImage(file: File, kind: 'hero' | 'logo') {
    setUploadingKind(kind);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${tenantId}/${fieldPrefix}${kind}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('tenant_assets')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('tenant_assets').getPublicUrl(path);
      const field = `${fieldPrefix}${kind === 'hero' ? 'hero_image_url' : 'logo_url'}`;
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
    const field = `${fieldPrefix}${kind === 'hero' ? 'hero_image_url' : 'logo_url'}`;
    await supabase.from('tenants').update({ [field]: null }).eq('id', tenantId);
    if (kind === 'hero') setHeroUrl(null);
    else setLogo(null);
  }

  return (
    <Card className="p-6">
      <h2 className="font-display font-bold mb-1">Banner & Logo</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Hero-Bild als Banner-Hintergrund deiner Bestellseite. Logo erscheint im Header.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Hero-Bild */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Hero-Bild · Banner (min. 1600 × 900 px, quer)
          </div>
          <div
            className={cn(
              'relative aspect-[16/9] rounded-2xl border-2 border-dashed overflow-hidden',
              heroUrl ? 'border-matcha-300' : 'border-border bg-muted/40',
            )}
          >
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
          <div
            className={cn(
              'relative aspect-square rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center',
              logo ? 'border-matcha-300' : 'border-border bg-muted/40',
            )}
          >
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
  );
}
