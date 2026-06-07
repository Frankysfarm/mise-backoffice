'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Save, ExternalLink, Eye, Check, Image as ImageIcon, Palette, Calendar, UtensilsCrossed, Truck, Instagram, Facebook, Music2 } from 'lucide-react';
import { BannerLogoUpload } from '../design/banner-logo-upload';

interface ButtonConfig {
  id: string;
  label: string;
  url: string;
  icon?: string;
}

interface BrandPage {
  enabled?: boolean;
  hero?: { title?: string; subtitle?: string; image_url?: string; video_url?: string; overlay_opacity?: number };
  buttons?: ButtonConfig[];
  about?: { title?: string; text?: string };
  gallery?: string[];
  contact?: { address?: string; phone?: string; email?: string; hours?: string };
}

const ICON_OPTIONS = [
  { value: 'calendar', label: 'Kalender', Icon: Calendar },
  { value: 'menu', label: 'Speisekarte', Icon: UtensilsCrossed },
  { value: 'truck', label: 'Lieferung', Icon: Truck },
  { value: 'instagram', label: 'Instagram', Icon: Instagram },
  { value: 'facebook', label: 'Facebook', Icon: Facebook },
  { value: 'tiktok', label: 'TikTok', Icon: Music2 },
  { value: 'external', label: 'Extern', Icon: ExternalLink },
];

export function BrandPageEditor({ tenant }: { tenant: { id: string; name: string; slug: string; storefront_settings: Record<string, unknown> | null; hero_image_url: string | null; logo_url: string | null } }) {
  const initial = (tenant.storefront_settings?.brand_page as BrandPage | undefined) ?? {};
  const [brand, setBrand] = useState<BrandPage>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

  // Markenfarben (Theme) — werden an die Brand-Page durchgereicht. Leer = Orange-Fallback.
  const initialTheme = (tenant.storefront_settings?.theme as { primary?: string; accent?: string } | undefined) ?? {};
  const [theme, setTheme] = useState<{ primary?: string; accent?: string }>(initialTheme);

  const generateAiImages = async () => {
    if (!confirm('Lass DALL-E 3 jetzt 8 Galerie-Bilder + 1 Hero generieren (~$0.36)?')) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const r = await fetch('/api/brand-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id, type: 'both', count: 8 }),
      });
      const d = await r.json();
      if (d.ok) {
        setGenResult(`✓ ${d.total_generated} Bilder generiert · $${d.cost_estimate_usd.toFixed(2)} · Lade Seite neu für Vorschau`);
        setTimeout(() => window.location.reload(), 1800);
      } else {
        setGenResult('✗ ' + (d.error ?? 'Unbekannter Fehler'));
      }
    } catch (e) {
      setGenResult('✗ ' + (e instanceof Error ? e.message : 'Network-Fehler'));
    } finally {
      setGenerating(false);
    }
  };


  const update = <K extends keyof BrandPage>(key: K, patch: Partial<NonNullable<BrandPage[K]>>) => {
    setBrand((b) => ({ ...b, [key]: { ...((b[key] ?? {}) as Record<string, unknown>), ...patch } }));
  };

  const setButtons = (buttons: ButtonConfig[]) => setBrand((b) => ({ ...b, buttons }));
  const buttons = brand.buttons ?? [
    { id: 'reserve', label: 'Tisch reservieren', url: '#', icon: 'calendar' },
    { id: 'menu', label: 'Speisekarte', url: '#', icon: 'menu' },
    { id: 'deliver', label: 'Online bestellen', url: '/Pasta-Aachen', icon: 'truck' },
    { id: 'instagram', label: 'Instagram', url: '#', icon: 'instagram' },
  ];

  const addButton = () => {
    setButtons([...buttons, { id: `btn_${Date.now()}`, label: 'Neuer Button', url: '#', icon: 'external' }]);
  };

  const removeButton = (i: number) => {
    setButtons(buttons.filter((_, idx) => idx !== i));
  };

  const updateButton = (i: number, patch: Partial<ButtonConfig>) => {
    setButtons(buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const save = () => {
    startTransition(async () => {
      const sb = createClient();
      const newSettings = {
        ...(tenant.storefront_settings ?? {}),
        brand_page: brand,
        theme: { ...((tenant.storefront_settings?.theme as Record<string, unknown>) ?? {}), ...theme },
      };
      await sb.from('tenants').update({ storefront_settings: newSettings }).eq('id', tenant.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  };

  const brandPageUrl = `https://frankys-home.de/Brand-${tenant.slug}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* Status Bar */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <div className="font-display text-lg font-bold">Deine Brand-Page</div>
          <div className="text-sm text-muted-foreground font-mono break-all">{brandPageUrl}</div>
        </div>
        <a
          href={brandPageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-matcha-900 text-matcha-900 px-4 py-2 text-sm font-bold hover:bg-matcha-50"
        >
          <Eye size={14} /> Live ansehen
        </a>
      </div>

      {/* KI-MAGIC */}
      <div className="rounded-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 border-2 border-purple-200 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center text-white text-2xl flex-shrink-0">
            🪄
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-bold">KI-Bilder mit DALL-E 3 generieren</div>
            <div className="text-sm text-muted-foreground">
              Lass die KI 1 cinematic Hero + 8 Galerie-Bilder basierend auf deinem Menü erzeugen. Ø $0.36 pro Setup.
            </div>
          </div>
          <button
            onClick={generateAiImages}
            disabled={generating}
            className="flex-shrink-0 px-5 py-3 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg hover:scale-[1.03] active:scale-95 disabled:opacity-50 transition-transform"
          >
            {generating ? '🎨 Generiere ~60 Sek...' : '✨ Auto-Bilder generieren'}
          </button>
        </div>
        {genResult && (
          <div className={`mt-3 text-sm font-bold ${genResult.startsWith('✓') ? 'text-emerald-700' : 'text-red-700'}`}>
            {genResult}
          </div>
        )}
      </div>

      {/* FARBEN */}
      <Section title="🎨 Markenfarben" subtitle="Färben Buttons, Topbar, Titel & Preise auf deiner Brand-Page. Leer lassen = aktuelles Orange.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Hauptfarbe">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.primary && /^#[0-9a-fA-F]{6}$/.test(theme.primary) ? theme.primary : '#FF5A1F'}
                onChange={(e) => setTheme((t) => ({ ...t, primary: e.target.value }))}
                className="h-10 w-14 rounded-lg border cursor-pointer p-0.5"
                aria-label="Hauptfarbe wählen"
              />
              <input
                type="text"
                value={theme.primary ?? ''}
                onChange={(e) => setTheme((t) => ({ ...t, primary: e.target.value }))}
                placeholder="#FF5A1F (leer = Orange)"
                className="input flex-1"
              />
            </div>
          </Field>
          <Field label="Akzentfarbe">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.accent && /^#[0-9a-fA-F]{6}$/.test(theme.accent) ? theme.accent : '#F2B25C'}
                onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))}
                className="h-10 w-14 rounded-lg border cursor-pointer p-0.5"
                aria-label="Akzentfarbe wählen"
              />
              <input
                type="text"
                value={theme.accent ?? ''}
                onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))}
                placeholder="#F2B25C"
                className="input flex-1"
              />
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Palette size={13} /> Nach „Speichern" sofort live auf der Brand-Page sichtbar.
        </div>
      </Section>

      {/* LOGO & BANNER (eigenes Storage, speichert direkt) */}
      <BannerLogoUpload
        tenantId={tenant.id}
        heroImageUrl={tenant.hero_image_url}
        logoUrl={tenant.logo_url}
        contextLabel="Brand-Page"
      />

      {/* HERO */}
      <Section title="🎬 Hero (groß ganz oben)" subtitle="Erster Eindruck — Bild/Video + Title + Subtitle">
        <Field label="Titel (groß)">
          <input
            type="text"
            value={brand.hero?.title ?? ''}
            onChange={(e) => update('hero', { title: e.target.value })}
            placeholder={tenant.name}
            className="input"
          />
        </Field>
        <Field label="Untertitel">
          <input
            type="text"
            value={brand.hero?.subtitle ?? ''}
            onChange={(e) => update('hero', { subtitle: e.target.value })}
            placeholder="Authentische italienische Pasta — frisch gemacht jeden Tag."
            className="input"
          />
        </Field>
        <Field label="Hero-Bild URL (oder Video unten)">
          <input
            type="url"
            value={brand.hero?.image_url ?? ''}
            onChange={(e) => update('hero', { image_url: e.target.value })}
            placeholder="https://..."
            className="input"
          />
        </Field>
        <Field label="Hero-Video URL (optional — überschreibt Bild)">
          <input
            type="url"
            value={brand.hero?.video_url ?? ''}
            onChange={(e) => update('hero', { video_url: e.target.value })}
            placeholder="https://.../video.mp4"
            className="input"
          />
        </Field>
        <Field label={`Overlay-Dunkelheit (${Math.round((brand.hero?.overlay_opacity ?? 0.55) * 100)}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((brand.hero?.overlay_opacity ?? 0.55) * 100)}
            onChange={(e) => update('hero', { overlay_opacity: Number(e.target.value) / 100 })}
            className="w-full"
          />
        </Field>
      </Section>

      {/* BUTTONS */}
      <Section title="🎯 Buttons (Call-to-Action)" subtitle="Was Kunden ganz oben anklicken können">
        <div className="space-y-3">
          {buttons.map((btn, i) => (
            <div key={btn.id} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto] gap-2 items-end p-3 rounded-xl bg-neutral-50 border">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Icon</div>
                <select value={btn.icon ?? 'external'} onChange={(e) => updateButton(i, { icon: e.target.value })} className="input">
                  {ICON_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Label</div>
                <input value={btn.label} onChange={(e) => updateButton(i, { label: e.target.value })} className="input" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">URL</div>
                <input value={btn.url} onChange={(e) => updateButton(i, { url: e.target.value })} className="input" placeholder="https://..." />
              </div>
              <button onClick={() => removeButton(i)} className="h-10 w-10 grid place-items-center rounded-lg text-red-600 hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button onClick={addButton} className="w-full py-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-amber-500 hover:text-amber-600 inline-flex items-center justify-center gap-2 font-bold">
            <Plus size={16} /> Button hinzufügen
          </button>
        </div>
      </Section>

      {/* ABOUT */}
      <Section title="📖 Über uns" subtitle="Storytelling (optional)">
        <Field label="Titel">
          <input value={brand.about?.title ?? ''} onChange={(e) => update('about', { title: e.target.value })} className="input" placeholder="Frische Pasta aus Aachen" />
        </Field>
        <Field label="Text">
          <textarea value={brand.about?.text ?? ''} onChange={(e) => update('about', { text: e.target.value })} className="input" rows={4} placeholder="Erzähl deine Geschichte..." />
        </Field>
      </Section>

      {/* CONTACT */}
      <Section title="📍 Kontakt & Öffnungszeiten">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Adresse"><textarea value={brand.contact?.address ?? ''} onChange={(e) => update('contact', { address: e.target.value })} className="input" rows={2} /></Field>
          <Field label="Öffnungszeiten"><textarea value={brand.contact?.hours ?? ''} onChange={(e) => update('contact', { hours: e.target.value })} className="input" rows={2} placeholder="Mo-Fr 11:00–22:00\nSa+So 12:00–23:00" /></Field>
          <Field label="Telefon"><input value={brand.contact?.phone ?? ''} onChange={(e) => update('contact', { phone: e.target.value })} className="input" placeholder="+49..." /></Field>
          <Field label="E-Mail"><input value={brand.contact?.email ?? ''} onChange={(e) => update('contact', { email: e.target.value })} className="input" placeholder="info@..." /></Field>
        </div>
      </Section>

      {/* SAVE-BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm">
            {saved ? <span className="text-emerald-700 font-bold inline-flex items-center gap-1.5"><Check size={16} /> Gespeichert · live sichtbar</span> : <span className="text-muted-foreground">Änderungen werden sofort live nach Speichern</span>}
          </div>
          <button onClick={save} disabled={pending} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2">
            <Save size={15} /> {pending ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #d4d4d4;
          border-radius: 10px;
          background: white;
          font-size: 14px;
          outline: none;
        }
        :global(.input:focus) { border-color: #059669; box-shadow: 0 0 0 3px rgba(5,150,105,0.12); }
      `}</style>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-bold text-lg">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">{label}</div>
      {children}
    </label>
  );
}
