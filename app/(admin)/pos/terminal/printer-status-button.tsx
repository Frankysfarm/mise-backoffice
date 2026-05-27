'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativePOS, nativeBridge } from '@/lib/mise-pos-native';
import { PrinterPairingDialog } from './printer-pairing-dialog';

export function PrinterStatusButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [paired, setPaired] = useState<{ name: string | null } | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isNat = isNativePOS();
      if (cancelled) return;
      setNative(isNat);
      if (!isNat) return;
      const b = nativeBridge();
      if (!b) return;
      const p = await b.getPairedPrinter();
      if (!cancelled) setPaired(p);
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!native) {
    return null;
  }

  const label = paired ? (paired.name || 'Drucker verbunden') : 'Kein Drucker';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition',
          paired
            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
            : 'bg-amber-100 text-amber-800 hover:bg-amber-200',
          className,
        )}
        title={paired ? `Drucker: ${label}` : 'Bondrucker einrichten'}
      >
        <Printer className="h-3.5 w-3.5" />
        <span className="truncate max-w-[120px]">{label}</span>
      </button>
      {open && <PrinterPairingDialog onClose={() => setOpen(false)} />}
    </>
  );
}
