'use client';

import { useState, useEffect } from 'react';
import { Share2, MessageCircle, Copy } from 'lucide-react';

interface Props {
  bestellnummer: string;
  locationSlug: string;
}

export function BestellTeilenWidget({ bestellnummer, locationSlug: _locationSlug }: Props) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState(`/track/${bestellnummer}`);

  useEffect(() => {
    setTrackingUrl(`${window.location.origin}/track/${bestellnummer}`);
    setCanShare('share' in navigator);
  }, [bestellnummer]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleNativeShare = () => {
    navigator.share({
      title: 'Meine Bestellung',
      text: 'Verfolge meine Lieferung live:',
      url: trackingUrl,
    }).catch(() => {});
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingUrl).then(() => setCopied(true)).catch(() => {});
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Verfolge meine Lieferung live: ${trackingUrl}`)}`;

  return (
    <div className="bg-white border border-stone-100 shadow-sm rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Share2 className="w-3.5 h-3.5 text-stone-400" />
        <span className="text-xs font-medium text-stone-500">Bestellung teilen</span>
      </div>

      <div className="flex items-center gap-2">
        {canShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Teilen
          </button>
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? 'Kopiert!' : 'Kopieren'}
        </button>
      </div>
    </div>
  );
}
