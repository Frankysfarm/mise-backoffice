'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, Clock, Loader2, Percent, Plus, Tag, Trash2, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type List = {
  id: string;
  name: string;
  beschreibung: string | null;
  zeit_aktiv: boolean;
  wochentage: number[];
  start_zeit: string | null;
  end_zeit: string | null;
  profile_id: string | null;
  modus: 'override' | 'rabatt_pct' | 'aufschlag_pct';
  rabatt_pct: number | null;
  aufschlag_pct: number | null;
  prioritaet: number;
  aktiv: boolean;
  items_count?: { count: number }[];
};

type Profile = { id: string; name: string; type: string };

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function PriceListsManager({ tenantId, locationId, initialLists, availableProfiles, totalItemsCount }: {
  tenantId: string;
  locationId: string;
  initialLists: List[];
  availableProfiles: Profile[];
  totalItemsCount: number;
}) {
  const supabase = createClient();
  const [lists, setLists] = useState<List[]>(initialLists);
  const [editing, setEditing] = useState<List | null>(null);
  const [busy, startBusy] = useTransition();

  function newList() {
    setEditing({
      id: '', name: 'Neue Preisliste', beschreibung: '',
      zeit_aktiv: false, wochentage: [1,2,3,4,5,6,7],
      start_zeit: null, end_zeit: null,
      profile_id: null, modus: 'rabatt_pct',
      rabatt_pct: 0, aufschlag_pct: null,
      prioritaet: lists.length, aktiv: true,
    });
  }

  function save(l: List) {
    startBusy(async () => {
      if (l.id) {
        await supabase.from('price_lists').update({
          name: l.name, beschreibung: l.beschreibung,
          zeit_aktiv: l.zeit_aktiv, wochentage: l.wochentage,
          start_zeit: l.start_zeit, end_zeit: l.end_zeit,
          profile_id: l.profile_id, modus: l.modus,
          rabatt_pct: l.rabatt_pct, aufschlag_pct: l.aufschlag_pct,
          prioritaet: l.prioritaet, aktiv: l.aktiv,
        }).eq('id', l.id);
        setLists((arr) => arr.map((x) => x.id === l.id ? { ...l, items_count: x.items_count } : x));
      } else {
        const { data } = await supabase.from('price_lists').insert({
          ...l, tenant_id: tenantId, location_id: locationId, id: undefined, items_count: undefined,
        }).select('*').single();
        if (data) setLists((arr) => [...arr, data as List]);
      }
      setEditing(null);
    });
  }

  async function remove(id: string) {
    if (!confirm('Preisliste wirklich löschen?')) return;
    await supabase.from('price_lists').delete().eq('id', id);
    setLists((arr) => arr.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{lists.length} Preisliste{lists.length === 1 ? '' : 'n'} · {totalItemsCount} Artikel im Standard-Menü</p>
        <button onClick={newList} className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 px-4 py-2 text-sm font-bold">
          <Plus className="h-4 w-4" /> Neue Preisliste
        </button>
      </div>

      {lists.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <Tag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Noch keine Preislisten. Leg eine an — z. B. <strong>Happy Hour</strong> mit -25% jeden Freitag 17–19 Uhr.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {lists.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex items-start gap-4">
                <div className={cn('h-12 w-12 rounded-2xl grid place-items-center shrink-0', l.zeit_aktiv ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                  {l.zeit_aktiv ? <Clock className="h-6 w-6" /> : <Tag className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg">{l.name}</h3>
                    {!l.aktiv && <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Inaktiv</span>}
                    {l.modus === 'rabatt_pct' && l.rabatt_pct ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">−{l.rabatt_pct}%</span>
                    ) : null}
                    {l.modus === 'aufschlag_pct' && l.aufschlag_pct ? (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">+{l.aufschlag_pct}%</span>
                    ) : null}
                    {l.modus === 'override' && (
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">{l.items_count?.[0]?.count ?? 0} Items mit eigenem Preis</span>
                    )}
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Priorität {l.prioritaet}</span>
                  </div>
                  {l.beschreibung && <p className="text-sm text-gray-600 mt-1">{l.beschreibung}</p>}
                  {l.zeit_aktiv && (
                    <div className="text-xs mt-2 text-blue-700 font-mono">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {l.start_zeit?.slice(0,5) ?? '00:00'} – {l.end_zeit?.slice(0,5) ?? '23:59'} · {l.wochentage.map((d) => WOCHENTAGE[d-1]).join(' ')}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(l)} className="text-xs font-bold text-matcha-900 hover:bg-matcha-50 px-3 py-1.5 rounded">Bearbeiten</button>
                  <button onClick={() => remove(l.id)} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 rounded"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <ListEditor list={editing} availableProfiles={availableProfiles} onSave={save} onCancel={() => setEditing(null)} busy={busy} />}

      <div className="text-xs text-gray-500 leading-relaxed pt-4 border-t">
        <strong>Hinweis:</strong> Owner-CRUD läuft. Einzelpreise pro Item festlegen + automatische Aktivierung im POS/Storefront kommen in einer eigenen Session.
      </div>
    </div>
  );
}

function ListEditor({ list, availableProfiles, onSave, onCancel, busy }: {
  list: List;
  availableProfiles: Profile[];
  onSave: (l: List) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [l, setL] = useState<List>(list);

  function update<K extends keyof List>(key: K, value: List[K]) {
    setL((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: number) {
    setL((prev) => {
      const has = prev.wochentage.includes(day);
      return { ...prev, wochentage: has ? prev.wochentage.filter((d) => d !== day) : [...prev.wochentage, day].sort() };
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 grid items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        <header className="px-5 py-4 border-b flex items-center gap-3 bg-gradient-to-br from-matcha-50 to-matcha-100">
          <h2 className="font-display text-xl font-black flex-1">{l.id ? 'Preisliste bearbeiten' : 'Neue Preisliste'}</h2>
          <button onClick={onCancel} className="h-9 w-9 rounded-full hover:bg-white/60 grid place-items-center"><X className="h-5 w-5" /></button>
        </header>

        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Name</label>
            <input value={l.name} onChange={(e) => update('name', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Beschreibung (optional)</label>
            <input value={l.beschreibung ?? ''} onChange={(e) => update('beschreibung', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Modus</label>
            <select value={l.modus} onChange={(e) => update('modus', e.target.value as List['modus'])} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 bg-white">
              <option value="rabatt_pct">Rabatt in % auf alle Items</option>
              <option value="aufschlag_pct">Aufschlag in % auf alle Items</option>
              <option value="override">Eigene Preise pro Item festlegen</option>
            </select>
          </div>

          {l.modus === 'rabatt_pct' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Rabatt %</label>
              <input type="number" step="0.5" value={l.rabatt_pct ?? 0} onChange={(e) => update('rabatt_pct', Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
            </div>
          )}
          {l.modus === 'aufschlag_pct' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Aufschlag %</label>
              <input type="number" step="0.5" value={l.aufschlag_pct ?? 0} onChange={(e) => update('aufschlag_pct', Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
            </div>
          )}

          {/* Zeitsteuerung */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={l.zeit_aktiv} onChange={(e) => update('zeit_aktiv', e.target.checked)} className="h-4 w-4" />
              <span className="font-bold text-sm flex items-center gap-1"><Clock className="h-4 w-4" /> Nur zu bestimmten Zeiten aktiv</span>
            </label>
            {l.zeit_aktiv && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-amber-900">Von</label>
                    <input type="time" value={l.start_zeit ?? ''} onChange={(e) => update('start_zeit', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-amber-300" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-amber-900">Bis</label>
                    <input type="time" value={l.end_zeit ?? ''} onChange={(e) => update('end_zeit', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-amber-300" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-900">Wochentage</label>
                  <div className="mt-1 flex gap-1">
                    {WOCHENTAGE.map((d, i) => {
                      const day = i + 1;
                      const selected = l.wochentage.includes(day);
                      return (
                        <button key={d} type="button" onClick={() => toggleDay(day)}
                          className={cn('h-9 w-9 rounded-lg font-bold text-xs', selected ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-700')}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profil-Bindung */}
          {availableProfiles.length > 0 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">An Bestell-Profil binden (optional)</label>
              <select value={l.profile_id ?? ''} onChange={(e) => update('profile_id', e.target.value || null)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 bg-white">
                <option value="">— Kein Profil — gilt überall</option>
                {availableProfiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
              </select>
              <div className="text-[10px] text-gray-500 mt-1">Wenn gebunden: gilt nur wenn dieses Profil aktiv ist</div>
            </div>
          )}

          {/* Priorität + Aktiv */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Priorität</label>
              <input type="number" value={l.prioritaet} onChange={(e) => update('prioritaet', Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
              <div className="text-[10px] text-gray-500 mt-1">Höher = greift zuerst bei Konflikt</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer self-end">
              <input type="checkbox" checked={l.aktiv} onChange={(e) => update('aktiv', e.target.checked)} className="h-4 w-4" />
              <span className="text-sm font-bold">Aktiv</span>
            </label>
          </div>
        </div>

        <footer className="px-5 py-4 border-t flex gap-2 bg-gray-50">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold">Abbrechen</button>
          <button onClick={() => onSave(l)} disabled={busy || !l.name.trim()} className="flex-1 py-3 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Speichern
          </button>
        </footer>
      </div>
    </div>
  );
}
