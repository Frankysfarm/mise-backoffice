'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type Props = {
  code: string;
  /** Ziel-URL, die der QR-Scanner öffnet. Fallback: Homepage */
  baseUrl?: string;
};

export function BonVoucherQR({ code, baseUrl }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://mise.app');
    const url = `${origin}/order/redeem?code=${encodeURIComponent(code)}`;
    QRCode.toDataURL(url, { margin: 1, width: 140 }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [code, baseUrl]);

  return (
    <div className="border-t border-dashed mt-2 pt-3 text-center">
      <div className="text-xs font-bold uppercase tracking-wider">10 % auf deinen nächsten Einkauf</div>
      {dataUrl && <img src={dataUrl} alt={`QR ${code}`} className="mx-auto my-2" width={140} height={140} />}
      <div className="text-xs font-mono">{code}</div>
      <div className="text-[10px] text-gray-500 mt-1">
        Einlösbar 30 Tage · Min. Bestellwert 5 €
      </div>
    </div>
  );
}
