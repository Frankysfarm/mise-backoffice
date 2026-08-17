'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Check, Gift, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { deleteGratisProduktConfig, saveGratisProduktConfig } from './actions';
import type { FpPlacement, FpTriggerMode, FreeProductConfig } from '@/lib/free-product/types';

type MenuItem = { id: string; name: string; preis: number; option_groups?: { required?: boolean; options?: { default?: boolean }[] }[] | null };
type FormState = {
  id: string | null;
  aktiv: boolean;
  eligible_item_ids: string[];
  trigger_mode: FpTriggerMode;
  trigger_ab_betrag: string;
  trigger_nach_sekunden: string;
  trigger_nach_bestellungen: string;
  placement: FpPlacement;
  cooldown_tage: string;
  anzeige_titel: string;
  anzeige_text: string;
  max_nutzungen_gesamt: string;
  konfig_typ: string;
};

const newCampaign = (): FormState => ({
  id: null,
  aktiv: false,
  eligible_item_ids: [],
  trigger_mode: 'immer',
  trigger_ab_betrag: '20',
  trigger_nach_sekunden: '5',
  trigger_nach_bestellungen: '3',
  placement: 'checkout',
  cooldown_tage: '0',
  anzeige_titel: 'Ein Geschenk für dich 🎁',
  anzeige_text: 'Wähle jetzt dein Gratis-Produkt aus.',
  max_nutzungen_gesamt: '',
  konfig_typ: 'auswahl',
});

const fromConfig = (config: FreeProductConfig): FormState => ({
  id: config.id,
  aktiv: config.aktiv,
  eligible_item_ids: config.eligible_item_ids ?? [],
  trigger_mode: config.trigger_mode,
  trigger_ab_betrag: String(config.trigger_ab_betrag ?? 20),
  trigger_nach_sekunden: String(config.trigger_nach_sekunden ?? 5),
  trigger_nach_bestellungen: String(config.trigger_nach_bestellungen ?? 3),
  placement: config.placement,
  cooldown_tage: String(config.cooldown_tage ?? 0),
  anzeige_titel: config.anzeige_titel ?? 'Ein Geschenk für dich 🎁',
  anzeige_text: config.anzeige_text ?? '',
  max_nutzungen_gesamt: config.max_nutzungen_gesamt ? String(config.max_nutzungen_gesamt) : '',
  konfig_typ: config.konfig_typ ?? 'auswahl',
});

const modeLabel: Record<FpTriggerMode, string> = {
  immer: 'Bei jeder Bestellung',
  erster_kauf: 'Nur bei der ersten Bestellung',
  nach_x_bestellungen: 'Jede N. Bestellung',
  ab_betrag: 'Ab einem Warenwert',
  nach_sekunden: 'Nach Zeit im Shop',
};

export function GratisProdukClientUi({ initialConfigs, menuItems, redemptionsLast30 }: {
  tenantId: string;
  initialConfigs: FreeProductConfig[];
  menuItems: MenuItem[];
  redemptionsLast30: number;
}) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [form, setForm] = useState<FormState>(() => initialConfigs[0] ? fromConfig(initialConfigs[0]) : newCampaign());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const activeCount = configs.filter((config) => config.aktiv).length;
  const selectedProducts = useMemo(() => new Set(form.eligible_item_ids), [form.eligible_item_ids]);
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const toggleItem = (id: string) => {
    update('eligible_item_ids', selectedProducts.has(id) ? form.eligible_item_ids.filter((itemId) => itemId !== id) : [...form.eligible_item_ids, id].slice(0, 12));
  };

  const applyPreset = (mode: 'every' | 'third') => {
    if (mode === 'every') setForm((current) => ({ ...current, trigger_mode: 'immer', cooldown_tage: '0', placement: 'checkout', anzeige_titel: 'Gratis-Getränk zu deiner Bestellung 🥤', anzeige_text: 'Such dir dein Gratis-Getränk aus.' }));
    else setForm((current) => ({ ...current, trigger_mode: 'nach_x_bestellungen', trigger_nach_bestellungen: '3', cooldown_tage: '0', placement: 'checkout', anzeige_titel: 'Deine 3. Bestellung geht auf uns 🎁', anzeige_text: 'Als Dankeschön darfst du dir ein Gratis-Produkt aussuchen.' }));
  };

  async function save() {
    setError(null);
    setSaved(false);
    if (form.aktiv && form.eligible_item_ids.length === 0) return setError('Wähle mindestens ein Produkt aus.');
    setSaving(true);
    const result = await saveGratisProduktConfig({
      id: form.id,
      aktiv: form.aktiv,
      eligible_item_ids: form.eligible_item_ids,
      trigger_mode: form.trigger_mode,
      trigger_ab_betrag: form.trigger_mode === 'ab_betrag' ? Number(form.trigger_ab_betrag) : null,
      trigger_nach_sekunden: form.trigger_mode === 'nach_sekunden' ? Number(form.trigger_nach_sekunden) : null,
      trigger_nach_bestellungen: form.trigger_mode === 'nach_x_bestellungen' ? Number(form.trigger_nach_bestellungen) : null,
      placement: form.placement,
      cooldown_tage: Number(form.cooldown_tage),
      anzeige_titel: form.anzeige_titel,
      anzeige_text: form.anzeige_text,
      max_nutzungen_gesamt: form.max_nutzungen_gesamt ? Number(form.max_nutzungen_gesamt) : null,
      konfig_typ: form.konfig_typ,
    });
    setSaving(false);
    if (!result.ok || !result.config) return setError(result.error ?? 'Speichern fehlgeschlagen.');
    setConfigs((current) => current.some((config) => config.id === result.config!.id) ? current.map((config) => config.id === result.config!.id ? result.config! : config) : [...current, result.config!]);
    setForm(fromConfig(result.config));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  async function remove() {
    if (!form.id || !window.confirm('Diese Aktion wirklich löschen? Historische Einlösungen bleiben für die Auswertung erhalten.')) return;
    setSaving(true);
    const result = await deleteGratisProduktConfig(form.id);
    setSaving(false);
    if (!result.ok) return setError(result.error ?? 'Löschen fehlgeschlagen.');
    const remaining = configs.filter((config) => config.id !== form.id);
    setConfigs(remaining);
    setForm(remaining[0] ? fromConfig(remaining[0]) : newCampaign());
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4"><div className="text-xs font-bold uppercase text-muted-foreground">Aktiv</div><div className="mt-1 text-2xl font-bold">{activeCount}</div></Card>
          <Card className="p-4"><div className="text-xs font-bold uppercase text-muted-foreground">Einlösungen 30d</div><div className="mt-1 text-2xl font-bold">{redemptionsLast30}</div></Card>
        </div>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <div className="font-bold">Deine Aktionen</div>
            <button type="button" onClick={() => { setForm(newCampaign()); setError(null); }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white" aria-label="Neue Aktion"><Plus size={16} /></button>
          </div>
          <div className="divide-y">
            {configs.map((config) => (
              <button key={config.id} type="button" onClick={() => { setForm(fromConfig(config)); setError(null); }} className={`w-full p-4 text-left transition ${form.id === config.id ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="line-clamp-2 text-sm font-semibold">{config.anzeige_titel || 'Gratis-Aktion'}</div>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${config.aktiv ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{modeLabel[config.trigger_mode]} · {config.eligible_item_ids?.length ?? 0} Produkte</div>
              </button>
            ))}
            {configs.length === 0 && <div className="p-5 text-center text-sm text-muted-foreground">Noch keine Aktion angelegt.</div>}
          </div>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={18} /><p className="text-xs leading-relaxed text-emerald-950">Der Shop prüft jede Aktion beim Checkout erneut. Manipulierte Gratispreise, doppelte Einlösungen und fremde Produkte werden blockiert.</p></div>
        </Card>
      </aside>

      <main className="space-y-5">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${form.aktiv ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}><Gift size={21} /></div>
              <div><div className="font-bold">{form.id ? 'Aktion bearbeiten' : 'Neue Aktion'}</div><p className="mt-0.5 text-sm text-muted-foreground">Im Shop gebrandet, im Auftrag als echte 0‑€‑Position.</p></div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.aktiv} onChange={(event) => update('aktiv', event.target.checked)} className="h-5 w-5 accent-emerald-700" /> Aktiv</label>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Titel im Shop"><input className="input" value={form.anzeige_titel} onChange={(event) => update('anzeige_titel', event.target.value)} maxLength={100} /></Field>
            <Field label="Kurzer Erklärungstext"><input className="input" value={form.anzeige_text} onChange={(event) => update('anzeige_text', event.target.value)} maxLength={240} /></Field>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="font-bold">Wann gilt die Aktion?</div><p className="text-sm text-muted-foreground">Die Formulierung „jede 3. Bestellung“ zählt Bestellung 3, 6, 9 …</p></div><div className="flex gap-2"><Preset onClick={() => applyPreset('every')}>Jede Bestellung + Cola</Preset><Preset onClick={() => applyPreset('third')}>Jede 3. Bestellung</Preset></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(modeLabel) as FpTriggerMode[]).map((mode) => <button key={mode} type="button" onClick={() => update('trigger_mode', mode)} className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${form.trigger_mode === mode ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : 'border-neutral-200 hover:border-emerald-300'}`}>{modeLabel[mode]}</button>)}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {form.trigger_mode === 'nach_x_bestellungen' && <Field label="Jede wievielte Bestellung?"><input className="input" type="number" min={2} max={50} value={form.trigger_nach_bestellungen} onChange={(event) => update('trigger_nach_bestellungen', event.target.value)} /></Field>}
            {form.trigger_mode === 'ab_betrag' && <Field label="Mindest-Warenwert (€)"><input className="input" type="number" min={0} step="0.5" value={form.trigger_ab_betrag} onChange={(event) => update('trigger_ab_betrag', event.target.value)} /></Field>}
            {form.trigger_mode === 'nach_sekunden' && <Field label="Nach Sekunden"><input className="input" type="number" min={1} max={120} value={form.trigger_nach_sekunden} onChange={(event) => update('trigger_nach_sekunden', event.target.value)} /></Field>}
            <Field label="Sperrzeit pro Kunde (Tage)"><input className="input" type="number" min={0} max={365} value={form.cooldown_tage} onChange={(event) => update('cooldown_tage', event.target.value)} /><span className="mt-1 block text-[11px] text-muted-foreground">Für „jede Bestellung“ auf 0 setzen.</span></Field>
            <Field label="Max. Einlösungen insgesamt"><input className="input" type="number" min={1} placeholder="unbegrenzt" value={form.max_nutzungen_gesamt} onChange={(event) => update('max_nutzungen_gesamt', event.target.value)} /></Field>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3"><div className="font-bold">Gratis-Produkte ({form.eligible_item_ids.length}/12)</div><p className="text-sm text-muted-foreground">Bei Produkten mit Optionen wird immer die gepflegte Standardauswahl gratis verwendet. Kostenpflichtige Extras werden blockiert.</p></div>
          <div className="grid max-h-80 gap-2 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems.map((item) => {
              const selected = selectedProducts.has(item.id);
              const hasOptions = Boolean(item.option_groups?.length);
              const missingDefaults = item.option_groups?.some((group) => group.required && !group.options?.some((option) => option.default));
              return <button key={item.id} type="button" disabled={missingDefaults} onClick={() => toggleItem(item.id)} className={`rounded-xl border p-3 text-left transition ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 hover:border-emerald-300'} disabled:cursor-not-allowed disabled:opacity-45`}><div className="flex items-start justify-between gap-2"><div className="line-clamp-2 text-sm font-semibold">{item.name}</div>{selected && <Check size={15} className="shrink-0 text-emerald-700" />}</div><div className="mt-1 text-xs text-muted-foreground">{Number(item.preis).toFixed(2)} €{hasOptions ? (missingDefaults ? ' · Standard fehlt' : ' · Standardauswahl') : ''}</div></button>;
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-bold">Darstellung</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">{(['checkout', 'popup', 'cart'] as FpPlacement[]).map((placement) => <button type="button" key={placement} onClick={() => update('placement', placement)} className={`rounded-xl border p-3 text-left ${form.placement === placement ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200'}`}><div className="text-sm font-semibold">{placement === 'checkout' ? 'Im Checkout' : placement === 'popup' ? 'Popup + Checkout' : 'Warenkorb + Checkout'}</div><div className="mt-1 text-xs text-muted-foreground">{placement === 'checkout' ? 'Empfohlen: nach Kontaktdaten sicher geprüft.' : placement === 'popup' ? 'Früher Teaser, finale Auswahl im Checkout.' : 'Hinweis schon im Warenkorb.'}</div></button>)}</div>
        </Card>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">{error}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div>{saved ? <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check size={16} /> Gespeichert und live</span> : <span className="text-sm text-muted-foreground">Aktive Änderungen wirken nach dem Speichern sofort.</span>}</div>
          <div className="flex gap-2">{form.id && <button type="button" onClick={remove} disabled={saving} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 size={15} /> Löschen</button>}<button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Speichern</button></div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-neutral-700">{label}</span>{children}</label>; }
function Preset({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">{children}</button>; }
