'use client';

import { Card } from '@/components/ui/card';
import {
  Check,
  ExternalLink,
  Globe,
  Sparkles,
  Wand2,
  Eye,
} from 'lucide-react';

const PREVIEW_URL = '/biss-app';

export function BissWhitelabelCard({
  tenantSlug,
  tenantId: _tenantId,
  current: _current,
  mode = 'delivery',
  livePreviewUrl,
  qrToken,
}: {
  tenantId: string;
  tenantSlug: string;
  current: string | null;
  /** 'qr' = QR-Tisch-Brand-Studio (schreibt in qr_brand_config) */
  mode?: 'delivery' | 'qr';
  /** Override für Live-URL (z.B. /t/{token} bei qr-Mode) */
  livePreviewUrl?: string;
  /** QR-Token für iframe-Preview im Brand-Studio bei mode=qr */
  qrToken?: string;
}) {
  const modeQs = mode === 'qr' ? '&mode=qr' : '';
  const qrTokenQs = qrToken ? `&qrToken=${encodeURIComponent(qrToken)}` : '';
  const studioUrl = `/biss-app/brand-studio?slug=${encodeURIComponent(tenantSlug)}${modeQs}${qrTokenQs}`;
  const liveUrl = livePreviewUrl ?? `${PREVIEW_URL}/${encodeURIComponent(tenantSlug)}`;

  return (
    <Card
      className="relative overflow-hidden p-0 border-2"
      style={{
        borderImage: 'linear-gradient(135deg, #FF4D14, #C73A0F, #E8A93A) 1',
      }}
    >
      {/* Top-Gradient Banner */}
      <div
        className="px-6 py-5 text-white"
        style={{
          background:
            'linear-gradient(135deg, #1C1916 0%, #C73A0F 60%, #FF4D14 100%)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white">
                <Check size={10} strokeWidth={3} /> Live
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 backdrop-blur">
                <Sparkles size={10} /> Whitelabel-App
              </span>
            </div>
            <h3
              className="text-3xl font-bold italic leading-none mb-1"
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                letterSpacing: '-0.04em',
              }}
            >
              Dein Online-Shop
            </h3>
            <p className="text-sm text-white/85 mt-2 max-w-md">
              Premium-Bestell-App, voll anpassbar — Farben, Schriften, Texte,
              Animationen, eigene Domain. Bestellungen fließen direkt in
              Kitchen, Dispatch und Fahrer-App.
            </p>
          </div>
          <div className="hidden sm:flex w-16 h-16 rounded-full shrink-0 items-center justify-center bg-white/10 backdrop-blur">
            <Wand2 size={28} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 bg-card">
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <Feature
            icon={<Wand2 size={14} />}
            title="Voll anpassbar"
            desc="Farben, Schriften, Texte, Animationen — alles per Studio steuerbar"
          />
          <Feature
            icon={<Globe size={14} />}
            title="Eigene Domain"
            desc="Verbinde deine bei IONOS, GoDaddy, Strato gekaufte Domain mit DNS-Anleitung"
          />
          <Feature
            icon={<Eye size={14} />}
            title="Live-Vorschau"
            desc="Klick durchs Studio bis zum Warenkorb — sieh sofort wie's für deine Gäste aussieht"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition"
            style={{ background: '#FF4D14', color: 'white' }}
          >
            <Wand2 size={14} /> Brand-Studio öffnen
            <ExternalLink size={12} className="opacity-60" />
          </a>
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <Eye size={14} /> Live-Shop öffnen
            <ExternalLink size={12} className="opacity-60" />
          </a>
        </div>
      </div>
    </Card>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider mb-0.5">
          {title}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
      </div>
    </div>
  );
}
