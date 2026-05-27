'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, ChefHat, Coffee, Cookie, Loader2, Pizza, Salad, Soup, Wine } from 'lucide-react';
import { cn } from '@/lib/utils';

const GANG_OPTIONS = [
  { id: 'vorspeise', label: 'Vorspeise',  icon: Salad,   color: 'bg-emerald-100 text-emerald-700' },
  { id: 'hauptgang', label: 'Hauptgang',  icon: Pizza,   color: 'bg-amber-100 text-amber-700' },
  { id: 'dessert',   label: 'Dessert',    icon: Cookie,  color: 'bg-pink-100 text-pink-700' },
  { id: 'getraenk',  label: 'Getränke',   icon: Wine,    color: 'bg-blue-100 text-blue-700' },
  { id: 'beilage',   label: 'Beilage',    icon: Soup,    color: 'bg-purple-100 text-purple-700' },
  { id: 'sonstiges', label: 'Sonstiges',  icon: Coffee,  color: 'bg-gray-100 text-gray-700' },
] as const;

export function CoursingSettings({ tenantId, defaultAktiv, aktiveGaenge }: {
  tenantId: string;
  defaultAktiv: boolean;
  aktiveGaenge: string[];
}) {
  const supabase = createClient();
  const [active, setActive] = useState(defaultAktiv);
  const [gaenge, setGaenge] = useState<string[]>(aktiveGaenge);
  const [busy, startBusy] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function toggleGang(id: string) {
    setGaenge((g) => g.includes(id) ? g.filter((x) => x !== id) : [...g, id]);
  }

  function save() {
    startBusy(async () => {
      await supabase.from('tenants').update({
        coursing_default_aktiv: active,
        coursing_aktive_gaenge: gaenge,
      }).eq('id', tenantId);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            'h-14 w-14 rounded-2xl grid place-items-center shrink-0',
            active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500',
          )}>
            <ChefHat className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-black">Coursing aktivieren</h2>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">
              Bei aktivem Coursing wählt der Kellner pro Item den Gang.
              Die Küche kriegt Tickets pro Gang (Vorspeise zuerst, Hauptgang nach „Fire next course").
            </p>
            <label className="mt-4 inline-flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="sr-only peer" />
              <div className="w-12 h-7 bg-gray-300 peer-checked:bg-emerald-500 rounded-full relative transition-colors">
                <div className={cn(
                  'absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform shadow',
                  active && 'translate-x-5',
                )} />
              </div>
              <span className="font-bold text-sm">{active ? 'Coursing aktiv' : 'Coursing aus'}</span>
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-bold text-lg">Welche Gänge nutzt dein Restaurant?</h3>
          <p className="text-sm text-gray-600 mt-1">Wähle aus — nur diese erscheinen im POS und der Küche.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {GANG_OPTIONS.map((g) => {
            const Icon = g.icon;
            const selected = gaenge.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggleGang(g.id)}
                className={cn(
                  'p-4 rounded-2xl border-2 transition text-left',
                  selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('h-10 w-10 rounded-xl grid place-items-center', selected ? 'bg-emerald-500 text-white' : g.color)}>
                    {selected ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{g.label}</div>
                    <div className="text-[11px] font-mono text-gray-500">{g.id}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <button
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 px-5 py-3 font-bold disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : savedAt ? <Check className="h-4 w-4" /> : null}
        {savedAt ? 'Gespeichert' : 'Speichern'}
      </button>

      <div className="text-xs text-gray-500 leading-relaxed">
        <strong>Hinweis:</strong> Coursing-Integration in POS-Terminal + KDS folgt in einer eigenen Session.
        Hier konfigurierst du nur die Vorbereitung — DB ist bereits vorhanden.
      </div>
    </div>
  );
}
