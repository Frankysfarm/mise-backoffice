'use client';

import { useEffect, useState } from 'react';
import { Zap, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface Props { orderId: string }

interface ZoneRow {
  delivery_zone: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
}

const ZONE_META: Record<string, {
  label: string; desc: string;
  bg: string; text: string;
  Icon: typeof Zap;
}> = {
  A: { label: 'Express-Zone A', desc: 'Du bist ganz nah — blitzschnelle Lieferung!', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', Icon: Zap },
  B: { label: 'Zone B',         desc: 'Schnelle Lieferung — wir sind unterwegs.',    bg: 'bg-blue-50 border-blue-200',      text: 'text-blue-700',   Icon: MapPin },
  C: { label: 'Zone C',         desc: 'Deine Bestellung ist auf dem Weg.',            bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-700',  Icon: MapPin },
  D: { label: 'Fernzone D',     desc: 'Lieferung in deine Zone läuft.',              bg: 'bg-orange-50 border-orange-200',  text: 'text-orange-700', Icon: MapPin },
};

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function BestellZonenHinweis({ orderId }: Props) {
  const [row, setRow] = useState<ZoneRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createClient();
    sb.from('customer_orders')
      .select('delivery_zone, eta_earliest, eta_latest')
      .eq('id', orderId)
      .maybeSingle()
      .then(({ data }: { data: ZoneRow | null }) => {
        setRow(data);
        setLoading(false);
      });
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex h-10 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-stone-300" />
      </div>
    );
  }

  if (!row?.delivery_zone) return null;

  const meta = ZONE_META[row.delivery_zone] ?? ZONE_META['B'];
  const { Icon } = meta;
  const earliest = fmtTime(row.eta_earliest);
  const latest   = fmtTime(row.eta_latest);

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', meta.bg)}>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80', meta.text)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-xs font-bold', meta.text)}>{meta.label}</div>
        <div className="text-[11px] text-stone-500">{meta.desc}</div>
        {earliest && latest && (
          <div className="mt-0.5 text-[10px] text-stone-400">
            Lieferfenster: {earliest}–{latest} Uhr
          </div>
        )}
      </div>
    </div>
  );
}
