'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type ThemeV3 = 'aurora-v3' | 'bento-pro' | 'liquid' | 'konkret' | 'gazette' | 'noir';

const THEMES: Array<{
  id: ThemeV3;
  name: string;
  tagline: string;
  description: string;
  bestFor: string;
  preview: { bg: string; surface: string; ink: string; primary: string; accent: string; font: string };
}> = [
  {
    id: 'aurora-v3',
    name: 'Aurora',
    tagline: 'Modern Minimalism',
    description: 'Luftig, ruhig, hochwertig. Inspiriert von Lilia, Cutler & Co, Café Kitsuné.',
    bestFor: 'Spezialitätencafés · Bistros · Bäckereien · gesunde Gastro',
    preview: { bg: '#FBF9F4', surface: '#FFFFFF', ink: '#0B0B0F', primary: '#0B0B0F', accent: '#C2654E', font: 'Fraunces' },
  },
  {
    id: 'bento-pro',
    name: 'Bento Pro',
    tagline: 'Modular Tech',
    description: 'Asymmetrisches Bento-Grid, Floating-Header, Persimmon CTAs. Apple-/Notion-/Framer-Stil.',
    bestFor: 'Quick-Service · Food-Tech · Ghost Kitchens',
    preview: { bg: '#0F0F12', surface: '#17171C', ink: '#F2F2F4', primary: '#FF5A1F', accent: '#FFD23F', font: 'Space Grotesk' },
  },
  {
    id: 'liquid',
    name: 'Liquid',
    tagline: 'Glassmorphism 2.0',
    description: 'Animated Gradient-Blobs, Glas-Layers, Iris-Akzent. Apple Liquid Glass-inspiriert.',
    bestFor: 'Trend-Konzepte · Premium-Saftbars · Loyalty-fokussiert',
    preview: { bg: '#0E0A1F', surface: 'rgba(255,255,255,0.10)', ink: '#FFFFFF', primary: '#7C5CFF', accent: '#3DDCFF', font: 'Manrope' },
  },
  {
    id: 'konkret',
    name: 'Konkret',
    tagline: 'Neo-Brutalism',
    description: 'Hazard Yellow, harte Schatten, Archivo Black UPPERCASE, 0px Radius. Streetfood-Punk.',
    bestFor: 'Streetfood · Burger · Pizza · Craft-Bars',
    preview: { bg: '#FFFCEC', surface: '#FFFFFF', ink: '#0A0A0A', primary: '#FFE600', accent: '#FF5A8A', font: 'Archivo Black' },
  },
  {
    id: 'gazette',
    name: 'Gazette',
    tagline: 'Editorial / Magazine',
    description: 'Fraunces 300 Light Display, Italic-Headlines, Hairlines, Bordeaux + Ocker. Print-Charakter.',
    bestFor: 'Fine Dining · Slow Food · Weingüter · Konditoreien',
    preview: { bg: '#F6F1E8', surface: '#FDFAF2', ink: '#1A1208', primary: '#5B2A1E', accent: '#A7813F', font: 'Fraunces' },
  },
  {
    id: 'noir',
    name: 'Noir',
    tagline: 'Dark Luxury',
    description: 'Cormorant Garamond, 4:5 Bilder mit Filter, Gold-Hairlines, Cinematic Easing.',
    bestFor: 'Steakhäuser · Cocktail-Bars · Hotelgastronomie',
    preview: { bg: '#0A0A0A', surface: '#141414', ink: '#F5F1E8', primary: '#C9A86A', accent: '#E2C078', font: 'Cormorant Garamond' },
  },
];

export function ThemePickerV3({
  tenantId,
  tenantSlug,
  current,
}: {
  tenantId: string;
  tenantSlug: string;
  current: string | null;
}) {
  const sb = createClient();
  const [selected, setSelected] = useState<string>(current ?? 'aurora-v3');
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function save(id: ThemeV3) {
    setSelected(id);
    startSaving(async () => {
      const { error } = await sb.from('tenants').update({ storefront_theme_id: id }).eq('id', tenantId);
      if (!error) setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aktuell aktiv</div>
          <div className="font-display text-xl font-bold mt-0.5">
            {THEMES.find((t) => t.id === selected)?.name ?? 'Kein Theme'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {THEMES.find((t) => t.id === selected)?.tagline ?? ''}
          </div>
        </div>
        <a
          href={`/order/${tenantSlug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50"
        >
          <ExternalLink size={14} /> Live-Vorschau
        </a>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => {
          const active = selected === theme.id;
          return (
            <Card
              key={theme.id}
              onClick={() => !saving && save(theme.id)}
              className={cn(
                'overflow-hidden cursor-pointer transition relative',
                active ? 'ring-2 ring-emerald-600 shadow-lg' : 'hover:shadow-md',
                saving && active && 'opacity-60',
              )}
            >
              {/* Preview */}
              <div
                className="h-44 relative overflow-hidden"
                style={{ background: theme.preview.bg }}
              >
                {/* Mock layout */}
                <div className="absolute inset-0 p-4 flex flex-col justify-between">
                  {/* Top badge */}
                  <div
                    className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      background: theme.id === 'konkret' ? theme.preview.accent : theme.preview.surface,
                      color: theme.id === 'konkret' ? theme.preview.ink : theme.preview.accent,
                      border: theme.id === 'konkret' ? '2px solid ' + theme.preview.ink : 'none',
                    }}
                  >
                    Beliebt
                  </div>
                  {/* Name + price */}
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-base font-semibold truncate"
                        style={{
                          color: theme.preview.ink,
                          fontFamily: theme.preview.font,
                          fontWeight: theme.id === 'konkret' ? 900 : theme.id === 'gazette' || theme.id === 'noir' ? 400 : 600,
                          textTransform: theme.id === 'konkret' ? 'uppercase' : 'none',
                          letterSpacing: theme.id === 'konkret' ? '-0.03em' : '-0.01em',
                          fontStyle: theme.id === 'gazette' ? 'italic' : 'normal',
                        }}
                      >
                        Cappuccino
                      </div>
                      <div
                        className="text-[10px] opacity-70 mt-1"
                        style={{ color: theme.preview.ink }}
                      >
                        Doppelter Espresso
                      </div>
                    </div>
                    <div
                      className="px-3 py-1.5 text-xs font-bold tabular-nums shrink-0"
                      style={{
                        background:
                          theme.id === 'aurora-v3' || theme.id === 'gazette'
                            ? theme.preview.ink
                            : theme.id === 'noir'
                              ? 'transparent'
                              : theme.preview.primary,
                        color:
                          theme.id === 'aurora-v3' || theme.id === 'gazette'
                            ? theme.preview.bg
                            : theme.id === 'noir'
                              ? theme.preview.primary
                              : theme.preview.ink === '#0A0A0A' ? theme.preview.ink : '#FFFFFF',
                        borderRadius: theme.id === 'konkret' ? 0 : theme.id === 'noir' ? 2 : 9999,
                        border: theme.id === 'konkret' ? '2px solid ' + theme.preview.ink : theme.id === 'noir' ? '1px solid ' + theme.preview.primary : 'none',
                        fontFamily: theme.id === 'noir' || theme.id === 'gazette' ? theme.preview.font : 'inherit',
                        fontStyle: theme.id === 'noir' ? 'italic' : 'normal',
                      }}
                    >
                      €4,40
                    </div>
                  </div>
                </div>

                {active && (
                  <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <Check size={14} />
                  </div>
                )}
                {saving && active && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display text-base font-bold">{theme.name}</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {theme.tagline}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {theme.description}
                </p>
                <div className="text-[10px] text-muted-foreground leading-relaxed pt-3 border-t">
                  <strong className="text-foreground">Optimal für:</strong> {theme.bestFor}
                </div>

                <a
                  href={`/order/${tenantSlug}?v=${theme.id === 'aurora-v3' ? 'aurora' : theme.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Vorschau öffnen <ExternalLink size={11} />
                </a>
              </div>
            </Card>
          );
        })}
      </div>

      {savedAt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check size={14} /> Theme gespeichert
        </div>
      )}
    </div>
  );
}
