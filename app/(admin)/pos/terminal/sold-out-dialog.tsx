'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Check, Clock, Infinity as InfinityIcon, Loader2, PackageX, X } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Item = { id: string; name: string; bild_url: string | null; preis: number };

export function SoldOutDialog({
  item, onClose, onDone,
}: {
  item: Item;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [nurDieseSchicht, setNurDieseSchicht] = useState(true);
  const [pending, setPending] = useState(false);

  async function markSoldOut() {
    setPending(true);
    await supabase.rpc('mark_item_sold_out', {
      p_item_id: item.id,
      p_nur_diese_schicht: nurDieseSchicht,
    });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 grid place-items-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full">
        <header className="p-5 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-600 text-white grid place-items-center">
            <PackageX className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Ausverkauft</div>
            <h2 className="font-display text-xl font-black truncate">{item.name}</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-muted grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Das Produkt wird sofort aus <strong>Kasse</strong>, <strong>QR-Tischbestellung</strong> und <strong>Lieferseite</strong> ausgeblendet.
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Wie lange?</div>
            <div className="space-y-2">
              <button
                onClick={() => setNurDieseSchicht(true)}
                className={cn(
                  'w-full rounded-xl border-2 p-3 text-left transition flex items-start gap-3',
                  nurDieseSchicht ? 'bg-red-50 border-red-500' : 'bg-white hover:bg-muted',
                )}
              >
                <div className={cn(
                  'h-9 w-9 rounded-lg grid place-items-center shrink-0',
                  nurDieseSchicht ? 'bg-red-600 text-white' : 'bg-gray-100',
                )}>
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold">Nur für diese Schicht</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Die Kasse fragt bei Schicht-Start, ob das Produkt wieder da ist
                  </div>
                </div>
                {nurDieseSchicht && <Check className="h-5 w-5 text-red-600" />}
              </button>
              <button
                onClick={() => setNurDieseSchicht(false)}
                className={cn(
                  'w-full rounded-xl border-2 p-3 text-left transition flex items-start gap-3',
                  !nurDieseSchicht ? 'bg-red-50 border-red-500' : 'bg-white hover:bg-muted',
                )}
              >
                <div className={cn(
                  'h-9 w-9 rounded-lg grid place-items-center shrink-0',
                  !nurDieseSchicht ? 'bg-red-600 text-white' : 'bg-gray-100',
                )}>
                  <InfinityIcon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold">Dauerhaft deaktivieren</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Bleibt aus, bis du es manuell im Menü wieder aktivierst
                  </div>
                </div>
                {!nurDieseSchicht && <Check className="h-5 w-5 text-red-600" />}
              </button>
            </div>
          </div>

          <button
            onClick={markSoldOut}
            disabled={pending}
            className="w-full h-12 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 hover:bg-red-700"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageX className="h-4 w-4" />}
            Als ausverkauft markieren
          </button>
        </div>
      </div>
    </div>
  );
}
