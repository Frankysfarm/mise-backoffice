'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toastError, toastSuccess } from '@/components/ui/toaster';

type InventoryItem = {
  id: string;
  name: string;
  einheit: string;
  zähl_typ: string | null;
  zähl_einheit: string | null;
  zähl_faktor: number | null;
  fach_position: number | null;
  shelf: { name: string } | { name: string }[] | null;
};

function shelfName(item: InventoryItem): string | null {
  if (!item.shelf) return null;
  return Array.isArray(item.shelf) ? item.shelf[0]?.name ?? null : item.shelf.name;
}

function parseCount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function InventoryCounter({ sessionId, items }: { sessionId: string; items: InventoryItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>({});

  const completed = useMemo(
    () => items.filter((item) => parseCount(values[item.id] ?? '') !== null).length,
    [items, values],
  );
  const allComplete = items.length > 0 && completed === items.length;

  function finish() {
    if (!allComplete) {
      toastError('Inventur unvollständig', `Bitte noch ${items.length - completed} Produkt(e) zählen.`);
      return;
    }
    const counts = items.map((item) => {
      const entered = parseCount(values[item.id] ?? '') ?? 0;
      const factor = item.zähl_typ === 'karton' ? Math.max(1, Number(item.zähl_faktor ?? 1)) : 1;
      return { item_id: item.id, count: entered * factor };
    });

    startTransition(async () => {
      const { error } = await createClient().rpc('complete_inventory_session' as any, {
        p_session_id: sessionId,
        p_counts: counts,
      } as any);
      if (error) {
        toastError('Abschluss fehlgeschlagen', error.message);
        return;
      }
      toastSuccess('Inventur abgeschlossen', `${items.length} Produkte wurden sicher verbucht.`);
      router.push('/mitarbeiter?inventory=complete');
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">In diesem Bereich sind keine aktiven Produkte angelegt.</div>;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Fortschritt</span>
          <span className="font-bold text-slate-700">{completed}/{items.length}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${(completed / items.length) * 100}%` }} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item, index) => {
          const value = values[item.id] ?? '';
          const valid = parseCount(value) !== null;
          const factor = item.zähl_typ === 'karton' ? Math.max(1, Number(item.zähl_faktor ?? 1)) : 1;
          return (
            <label key={item.id} className={`block rounded-2xl border bg-white p-4 shadow-sm transition ${valid ? 'border-emerald-300' : 'border-slate-200 focus-within:border-slate-500'}`}>
              <span className="flex items-start gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${valid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                  {valid ? <CheckCircle2 size={17} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-950">{item.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {shelfName(item) ? `${shelfName(item)} · ` : ''}{item.fach_position ? `Fach ${item.fach_position} · ` : ''}
                    {factor > 1 ? `1 ${item.zähl_einheit || 'Karton'} = ${factor} ${item.einheit}` : item.einheit}
                  </span>
                </span>
              </span>
              <span className="mt-4 flex items-center gap-3">
                <Input
                  aria-label={`Gezählter Bestand ${item.name}`}
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={value}
                  onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))}
                  className="h-12 text-right text-lg font-bold"
                  placeholder="0"
                />
                <span className="w-24 text-sm font-semibold text-slate-600">{factor > 1 ? item.zähl_einheit || 'Kartons' : item.einheit}</span>
              </span>
              {valid && factor > 1 && <span className="mt-2 block text-right text-xs font-semibold text-emerald-700">= {(parseCount(value) ?? 0) * factor} {item.einheit}</span>}
            </label>
          );
        })}
      </div>

      <Button type="button" onClick={finish} disabled={pending || !allComplete} className="mt-6 min-h-12 w-full bg-emerald-700 text-base hover:bg-emerald-800">
        {pending ? <><Loader2 className="h-5 w-5 animate-spin" /> Wird verbucht …</> : <><CheckCircle2 className="h-5 w-5" /> Inventur verbindlich abschließen</>}
      </Button>
      <p className="mt-3 text-center text-xs leading-5 text-slate-500">Nach dem Abschluss werden Bestände und Bewegungsprotokoll atomar aktualisiert.</p>
    </div>
  );
}
