'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import {
  Bike, Check, Clock, Coffee, Loader2, MapPin, Plus, ShoppingBag,
  Star, Trash2, UtensilsCrossed, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Profile = {
  id: string;
  name: string;
  type: string;
  beschreibung: string | null;
  zeit_aktiv: boolean;
  wochentage: number[];
  start_zeit: string | null;
  end_zeit: string | null;
  preis_modifier_pct: number;
  service_charge_pct: number;
  steuersatz_strategie: string;
  farbe: string | null;
  icon: string | null;
  sort_order: number;
  aktiv: boolean;
  is_default: boolean;
};

const TYPE_OPTIONS = [
  { id: 'dine_in',    label: 'Dine-in (Im Restaurant)', icon: UtensilsCrossed, color: '#14532d', desc: 'Gast isst vor Ort, Kellner bedient' },
  { id: 'takeaway',   label: 'Takeaway / Abholung',     icon: ShoppingBag,     color: '#92400e', desc: 'Kunde holt ab, kein Service' },
  { id: 'delivery',   label: 'Lieferung',                icon: Bike,            color: '#1e3a8a', desc: 'Fahrer bringt zum Kunden' },
  { id: 'qr_table',   label: 'QR-Tisch-Bestellung',      icon: MapPin,          color: '#f59e0b', desc: 'Gast scannt QR und bestellt selbst' },
  { id: 'happy_hour', label: 'Happy Hour',               icon: Zap,             color: '#dc2626', desc: 'Sonderpreise zu bestimmten Zeiten' },
  { id: 'lunch_menu', label: 'Lunch-Menu',               icon: Clock,           color: '#65a30d', desc: 'Mittagsangebot' },
  { id: 'event',      label: 'Event / Catering',         icon: Star,            color: '#7e22ce', desc: 'Sonder-Veranstaltung' },
] as const;

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function OrderProfilesManager({ tenantId, locationId, initialProfiles }: {
  tenantId: string;
  locationId: string;
  initialProfiles: Profile[];
}) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [busy, startBusy] = useTransition();

  function newProfile() {
    setEditing({
      id: '', name: 'Neues Profil', type: 'dine_in', beschreibung: '',
      zeit_aktiv: false, wochentage: [1,2,3,4,5,6,7],
      start_zeit: null, end_zeit: null,
      preis_modifier_pct: 0, service_charge_pct: 0, steuersatz_strategie: 'standard',
      farbe: '#14532d', icon: null, sort_order: profiles.length,
      aktiv: true, is_default: false,
    });
  }

  function save(p: Profile) {
    startBusy(async () => {
      if (p.id) {
        await supabase.from('order_profiles').update({
          name: p.name, type: p.type, beschreibung: p.beschreibung,
          zeit_aktiv: p.zeit_aktiv, wochentage: p.wochentage,
          start_zeit: p.start_zeit, end_zeit: p.end_zeit,
          preis_modifier_pct: p.preis_modifier_pct, service_charge_pct: p.service_charge_pct,
          steuersatz_strategie: p.steuersatz_strategie,
          farbe: p.farbe, sort_order: p.sort_order, aktiv: p.aktiv, is_default: p.is_default,
        }).eq('id', p.id);
        setProfiles((arr) => arr.map((x) => x.id === p.id ? p : x));
      } else {
        const { data } = await supabase.from('order_profiles').insert({
          ...p, tenant_id: tenantId, location_id: locationId, id: undefined,
        }).select('*').single();
        if (data) setProfiles((arr) => [...arr, data as Profile]);
      }
      setEditing(null);
    });
  }

  async function remove(id: string) {
    if (!confirm('Profil wirklich löschen?')) return;
    await supabase.from('order_profiles').delete().eq('id', id);
    setProfiles((arr) => arr.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{profiles.length} Profile angelegt</p>
        <button
          onClick={newProfile}
          className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 px-4 py-2 text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> Neues Profil
        </button>
      </div>

      {profiles.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <Coffee className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Noch keine Profile. Leg dein erstes an — z. B. „Dine-in" oder „Happy Hour".</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map((p) => {
            const typeMeta = TYPE_OPTIONS.find((t) => t.id === p.type);
            const Icon = typeMeta?.icon ?? Coffee;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl grid place-items-center text-white shrink-0" style={{ backgroundColor: p.farbe ?? '#14532d' }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{p.name}</h3>
                    <div className="text-[11px] text-gray-500">{typeMeta?.label}</div>
                    {p.zeit_aktiv && (
                      <div className="text-[11px] mt-1 text-blue-700 font-mono">
                        {p.start_zeit?.slice(0,5)} – {p.end_zeit?.slice(0,5)} · {p.wochentage.map((d) => WOCHENTAGE[d-1]).join(' ')}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.preis_modifier_pct !== 0 && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{p.preis_modifier_pct > 0 ? '+' : ''}{p.preis_modifier_pct}%</span>
                      )}
                      {p.service_charge_pct > 0 && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">+{p.service_charge_pct}% Service</span>
                      )}
                      {p.is_default && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Standard</span>}
                      {!p.aktiv && <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Inaktiv</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  <button onClick={() => setEditing(p)} className="flex-1 text-xs font-bold text-matcha-900 hover:bg-matcha-50 py-1.5 rounded">Bearbeiten</button>
                  <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 rounded">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor-Modal */}
      {editing && <ProfileEditor profile={editing} onSave={save} onCancel={() => setEditing(null)} busy={busy} />}

      <div className="text-xs text-gray-500 leading-relaxed pt-4 border-t">
        <strong>Hinweis:</strong> Owner-CRUD läuft. Anbindung an Storefront + POS (verschiedene Preise pro Profil + automatische Profile-Wahl basierend auf Zeit) kommt in einer eigenen Session.
      </div>
    </div>
  );
}

function ProfileEditor({ profile, onSave, onCancel, busy }: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [p, setP] = useState<Profile>(profile);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: number) {
    setP((prev) => {
      const has = prev.wochentage.includes(day);
      return { ...prev, wochentage: has ? prev.wochentage.filter((d) => d !== day) : [...prev.wochentage, day].sort() };
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 grid items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        <header className="px-5 py-4 border-b flex items-center gap-3 bg-gradient-to-br from-matcha-50 to-matcha-100 shrink-0">
          <h2 className="font-display text-xl font-black flex-1">{p.id ? 'Profil bearbeiten' : 'Neues Profil'}</h2>
          <button onClick={onCancel} className="h-9 w-9 rounded-full hover:bg-white/60 grid place-items-center"><X className="h-5 w-5" /></button>
        </header>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Name + Typ */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Name</label>
              <input value={p.name} onChange={(e) => update('name', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Typ</label>
              <select value={p.type} onChange={(e) => update('type', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 bg-white">
                {TYPE_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Beschreibung (optional)</label>
            <input value={p.beschreibung ?? ''} onChange={(e) => update('beschreibung', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
          </div>

          {/* Zeit-Steuerung */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.zeit_aktiv} onChange={(e) => update('zeit_aktiv', e.target.checked)} className="h-4 w-4" />
              <span className="font-bold text-sm">Nur zu bestimmten Zeiten aktiv</span>
            </label>
            {p.zeit_aktiv && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-blue-900">Von</label>
                    <input type="time" value={p.start_zeit ?? ''} onChange={(e) => update('start_zeit', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-blue-300" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-blue-900">Bis</label>
                    <input type="time" value={p.end_zeit ?? ''} onChange={(e) => update('end_zeit', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-blue-300" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-blue-900">Wochentage</label>
                  <div className="mt-1 flex gap-1">
                    {WOCHENTAGE.map((d, i) => {
                      const day = i + 1;
                      const selected = p.wochentage.includes(day);
                      return (
                        <button key={d} type="button" onClick={() => toggleDay(day)}
                          className={cn('h-9 w-9 rounded-lg font-bold text-xs', selected ? 'bg-blue-600 text-white' : 'bg-white border border-blue-300 text-blue-700')}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preis & Service */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Preis-Modifier (%)</label>
              <input type="number" step="0.5" value={p.preis_modifier_pct} onChange={(e) => update('preis_modifier_pct', Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
              <div className="text-[10px] text-gray-500 mt-1">Negativ = Rabatt (z.B. -20 für Happy Hour)</div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Service-Charge (%)</label>
              <input type="number" step="0.5" value={p.service_charge_pct} onChange={(e) => update('service_charge_pct', Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Steuersatz-Strategie</label>
            <select value={p.steuersatz_strategie} onChange={(e) => update('steuersatz_strategie', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 bg-white">
              <option value="standard">Standard (wie pro Item gesetzt)</option>
              <option value="aussenhaus_7">Außer-Haus (Speisen → 7 %)</option>
              <option value="sonderregel">Sonderregel (manuell)</option>
            </select>
          </div>

          {/* Farbe + Standard + Aktiv */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Farbe</label>
              <input type="color" value={p.farbe ?? '#14532d'} onChange={(e) => update('farbe', e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-gray-300" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer self-end">
              <input type="checkbox" checked={p.is_default} onChange={(e) => update('is_default', e.target.checked)} className="h-4 w-4" />
              <span className="text-sm font-bold">Standard-Profil</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer self-end">
              <input type="checkbox" checked={p.aktiv} onChange={(e) => update('aktiv', e.target.checked)} className="h-4 w-4" />
              <span className="text-sm font-bold">Aktiv</span>
            </label>
          </div>
        </div>

        <footer className="px-5 py-4 border-t flex gap-2 shrink-0 bg-gray-50">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold">Abbrechen</button>
          <button onClick={() => onSave(p)} disabled={busy || !p.name.trim()} className="flex-1 py-3 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Speichern
          </button>
        </footer>
      </div>
    </div>
  );
}
