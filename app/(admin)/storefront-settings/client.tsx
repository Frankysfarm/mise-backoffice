'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Gift, Star, Sparkles, Clock, MapPin, Save, Check } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  preis: number;
  category_id: string;
  menu_categories?: { name: string } | null;
};

type StorefrontSettings = {
  welcome_popup?: {
    enabled?: boolean;
    title?: string;
    title_emphasis?: string;
    subtitle?: string;
    free_product_ids?: string[];
    delay_ms?: number;
  };
  loyalty?: {
    enabled?: boolean;
    target_stamps?: number;
    current_stamps?: number;
    reward_title?: string;
    reward_text?: string;
  };
  hero?: {
    badge?: string;
    title?: string;
    title_italic?: string;
  };
  delivery?: {
    min_minutes?: number;
    max_minutes?: number;
  };
  cross_sell?: {
    enabled?: boolean;
    title?: string;
    product_ids?: string[];
  };
  section_order?: string[];
  sections?: {
    welcome_banner?: boolean;
    bestseller_rail?: boolean;
    loyalty_card?: boolean;
    delivery_band?: boolean;
    bonus_card?: boolean;
    diet_filter?: boolean;
    sticky_cart?: boolean;
    [key: string]: boolean | undefined;
  };
  theme?: {
    primary?: string;
    accent?: string;
    background?: string;
  };
};

interface Props {
  tenant: {
    id: string;
    name: string;
    slug: string;
    storefront_settings: StorefrontSettings | null;
    free_delivery_threshold: number | null;
    mindestbestellwert: number | null;
    liefergebuehr: number | null;
    durchschnittliche_lieferzeit_min: number | null;
  } | null;
  products: Product[];
}

export function StorefrontSettingsClient({ tenant, products }: Props) {
  const [settings, setSettings] = useState<StorefrontSettings>(tenant?.storefront_settings ?? {});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!tenant) {
    return <div className="p-8 text-neutral-600">Kein Restaurant gefunden. Bitte einloggen.</div>;
  }

  const update = <K extends keyof StorefrontSettings>(section: K, patch: Partial<NonNullable<StorefrontSettings[K]>>) => {
    setSettings((s) => ({ ...s, [section]: { ...(s[section] ?? {}), ...patch } }));
  };

  const toggleFreeProduct = (id: string) => {
    const current = settings.welcome_popup?.free_product_ids ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    update('welcome_popup', { free_product_ids: next.slice(0, 4) });
  };

  const toggleCrossSellProduct = (id: string) => {
    const current = settings.cross_sell?.product_ids ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    update('cross_sell', { product_ids: next.slice(0, 6) });
  };

  const save = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from('tenants').update({ storefront_settings: settings }).eq('id', tenant.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    });
  };

  const wp = settings.welcome_popup ?? {};
  const ly = settings.loyalty ?? {};
  const he = settings.hero ?? {};
  const dl = settings.delivery ?? {};

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-32">
      <div className="mb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Storefront-Einstellungen</div>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">{tenant.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">Anpassungen erscheinen sofort auf mise-gastro.de/biss-app/{tenant.slug}</p>
      </div>

      <div className="space-y-6">
        {/* SECTION: Welcome Popup */}
        <Card icon={<Gift size={18} className="text-amber-600" />} title="Welcome-Popup" subtitle="Begrüßt Neukunden mit einem Gratis-Geschenk">
          <Switch
            checked={wp.enabled !== false}
            onChange={(v) => update('welcome_popup', { enabled: v })}
            label="Popup aktivieren"
          />

          {wp.enabled !== false && (
            <>
              <Field label="Titel (Hauptteil)">
                <input
                  type="text"
                  value={wp.title ?? ''}
                  onChange={(e) => update('welcome_popup', { title: e.target.value })}
                  placeholder="1 Getränk"
                  className="input"
                />
              </Field>

              <Field label="Titel (italic-Teil mit Gold)">
                <input
                  type="text"
                  value={wp.title_emphasis ?? ''}
                  onChange={(e) => update('welcome_popup', { title_emphasis: e.target.value })}
                  placeholder="gratis 🍝"
                  className="input"
                />
              </Field>

              <Field label="Untertitel">
                <input
                  type="text"
                  value={wp.subtitle ?? ''}
                  onChange={(e) => update('welcome_popup', { subtitle: e.target.value })}
                  placeholder="Such dir eins aus..."
                  className="input"
                />
              </Field>

              <Field label="Verzögerung nach Seitenaufruf (Millisekunden)">
                <input
                  type="number"
                  value={wp.delay_ms ?? 1500}
                  onChange={(e) => update('welcome_popup', { delay_ms: Number(e.target.value) })}
                  className="input"
                />
              </Field>

              <Field label={`Gratis-Produkte (${(wp.free_product_ids ?? []).length}/4 ausgewählt)`}>
                <div className="text-[11px] text-neutral-500 mb-2">Wähle bis zu 4 Produkte aus dem Menü die der Kunde kostenlos erhalten kann.</div>
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                  {products.map((p) => {
                    const checked = (wp.free_product_ids ?? []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleFreeProduct(p.id)}
                        className={`text-left rounded-lg p-2.5 text-xs border transition-all ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-white border-neutral-200 hover:border-emerald-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            checked ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-300'
                          }`}>
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-neutral-900 truncate">{p.name}</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              {p.menu_categories?.name ?? p.category_id} · {p.preis.toFixed(2)} €
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </>
          )}
        </Card>

        {/* SECTION: Loyalty / Stempel */}
        <Card icon={<Star size={18} className="text-amber-600" />} title="Stempel-System" subtitle="Belohne treue Kunden">
          <Switch
            checked={ly.enabled !== false}
            onChange={(v) => update('loyalty', { enabled: v })}
            label="Stempel-Karte zeigen"
          />

          {ly.enabled !== false && (
            <>
              <Field label="Wie viele Bestellungen für die Belohnung?">
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={ly.target_stamps ?? 5}
                  onChange={(e) => update('loyalty', { target_stamps: Number(e.target.value) })}
                  className="input"
                />
              </Field>

              <Field label="Belohnungs-Titel (z.B. 'Jede 5. Bestellung')">
                <input
                  type="text"
                  value={ly.reward_title ?? ''}
                  onChange={(e) => update('loyalty', { reward_title: e.target.value })}
                  placeholder="Jede 5. Bestellung"
                  className="input"
                />
              </Field>

              <Field label="Belohnungs-Text (z.B. '1 Pasta gratis')">
                <input
                  type="text"
                  value={ly.reward_text ?? ''}
                  onChange={(e) => update('loyalty', { reward_text: e.target.value })}
                  placeholder="1 Pasta gratis"
                  className="input"
                />
              </Field>
            </>
          )}
        </Card>

        {/* SECTION: Hero */}
        <Card icon={<Sparkles size={18} className="text-amber-600" />} title="Bestseller-Hero" subtitle="Der große Block ganz oben">
          <Field label="Badge oben (kleine Caps)">
            <input
              type="text"
              value={he.badge ?? ''}
              onChange={(e) => update('hero', { badge: e.target.value })}
              placeholder="DIESE WOCHE TRENDING"
              className="input"
            />
          </Field>

          <Field label="Haupt-Titel">
            <input
              type="text"
              value={he.title ?? ''}
              onChange={(e) => update('hero', { title: e.target.value })}
              placeholder="Mamma Mia —"
              className="input"
            />
          </Field>

          <Field label="Italic-Teil des Titels">
            <input
              type="text"
              value={he.title_italic ?? ''}
              onChange={(e) => update('hero', { title_italic: e.target.value })}
              placeholder="die Top 5"
              className="input"
            />
          </Field>
        </Card>

        {/* SECTION: Liefer-Zeit */}
        <Card icon={<Clock size={18} className="text-amber-600" />} title="Liefer-Zeit-Bereich" subtitle="Wird Kunden als 'X-Y Min Lieferung' angezeigt">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min Minuten">
              <input
                type="number"
                min={5}
                max={120}
                value={dl.min_minutes ?? 25}
                onChange={(e) => update('delivery', { min_minutes: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Max Minuten">
              <input
                type="number"
                min={10}
                max={180}
                value={dl.max_minutes ?? 40}
                onChange={(e) => update('delivery', { max_minutes: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
        </Card>

        {/* SECTION: Bestehende Werte (Read-only Info) */}
        <Card icon={<MapPin size={18} className="text-neutral-500" />} title="Aktuelle Werte (in den Restaurant-Settings änderbar)">
          <div className="grid grid-cols-2 gap-3 text-sm text-neutral-700">
            <Info label="Mindestbestellwert" value={`${tenant.mindestbestellwert ?? 15} €`} />
            <Info label="Liefergebühr" value={`${tenant.liefergebuehr ?? 1.99} €`} />
            <Info label="Gratis ab" value={`${tenant.free_delivery_threshold ?? 25} €`} />
            <Info label="Ø Lieferzeit" value={`${tenant.durchschnittliche_lieferzeit_min ?? 30} Min`} />
          </div>
        </Card>
      </div>

      {/* Sticky save bar */}
        {/* SECTION: Cross-Sell vor Checkout */}
        <Card icon={<Sparkles size={18} className="text-amber-600" />} title="Cross-Sell vor Checkout" subtitle="Produkt-Vorschläge im Warenkorb/Checkout">
          <div className="space-y-3">
            <Switch
              checked={settings.cross_sell?.enabled ?? true}
              onChange={(v) => update('cross_sell', { enabled: v })}
              label="Cross-Sell aktivieren"
            />
            {(settings.cross_sell?.enabled ?? true) && (
              <>
                <Field label="Titel">
                  <input
                    type="text"
                    value={settings.cross_sell?.title ?? 'Vergiss diese nicht!'}
                    onChange={(e) => update('cross_sell', { title: e.target.value })}
                    className="input"
                    placeholder="z.B. Das passt dazu"
                  />
                </Field>
                <Field label={`Produkte (${settings.cross_sell?.product_ids?.length ?? 0}/6)`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                    {products.map((p) => {
                      const sel = (settings.cross_sell?.product_ids ?? []).includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleCrossSellProduct(p.id)}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                            sel ? 'border-amber-500 bg-amber-50' : 'border-neutral-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-xs text-neutral-500">€{p.preis.toFixed(2)}</div>
                          </div>
                          {sel && <Check size={16} className="text-amber-600" />}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </>
            )}
          </div>
        </Card>

        {/* SECTION: Sichtbarkeit + Reihenfolge / Baukasten */}
        <Card icon={<Sparkles size={18} className="text-amber-600" />} title="Sektionen — Reihenfolge & Sichtbarkeit" subtitle="Pfeile sortieren, Schalter aktiviert/deaktiviert">
          {(() => {
            const ALL_SECTIONS = [
              { key: 'welcome_banner', label: 'Hero-Banner (Top 5)', defaultOn: true },
              { key: 'bestseller_rail', label: 'Bestseller-Rail', defaultOn: true },
              { key: 'loyalty_card', label: 'Loyalty-Card', defaultOn: true },
              { key: 'delivery_band', label: 'Delivery-Info-Band', defaultOn: true },
              { key: 'bonus_card', label: 'Bonus-Card (Cart)', defaultOn: true },
              { key: 'diet_filter', label: 'Diät-Filter', defaultOn: false },
              { key: 'sticky_cart', label: 'Sticky-Cart-Bar', defaultOn: true },
            ];
            const defaultOrder = ALL_SECTIONS.map((s) => s.key);
            const order = settings.section_order && settings.section_order.length === ALL_SECTIONS.length
              ? settings.section_order
              : defaultOrder;
            const ordered = order.map((k) => ALL_SECTIONS.find((s) => s.key === k)).filter(Boolean) as typeof ALL_SECTIONS;
            const move = (idx: number, dir: -1 | 1) => {
              const ni = idx + dir;
              if (ni < 0 || ni >= ordered.length) return;
              const newOrder = [...order];
              [newOrder[idx], newOrder[ni]] = [newOrder[ni], newOrder[idx]];
              setSettings((s) => ({ ...s, section_order: newOrder }));
            };
            return (
              <div className="space-y-1.5">
                {ordered.map((s, i) => {
                  const k = s.key as keyof NonNullable<StorefrontSettings['sections']>;
                  const checked = settings.sections?.[k] ?? s.defaultOn;
                  return (
                    <div key={s.key} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-neutral-50 hover:bg-amber-50/40 border border-neutral-100">
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none">▲</button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === ordered.length - 1} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none">▼</button>
                      </div>
                      <span className="text-xs font-mono text-neutral-400 w-5">{i + 1}.</span>
                      <span className="text-sm font-medium text-neutral-700 flex-1">{s.label}</span>
                      <button
                        type="button"
                        onClick={() => update('sections', { [k]: !checked })}
                        className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-neutral-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>

        {/* SECTION: Theme / Farben */}
        <Card icon={<Sparkles size={18} className="text-amber-600" />} title="Farben & Theme" subtitle="Wie die Storefront aussieht — wird sofort live">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Hauptfarbe (Sage / Brand)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.theme?.primary ?? '#4a5e4a'}
                  onChange={(e) => update('theme', { primary: e.target.value })}
                  className="w-12 h-10 rounded-lg border cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.theme?.primary ?? '#4a5e4a'}
                  onChange={(e) => update('theme', { primary: e.target.value })}
                  className="input flex-1 font-mono text-xs"
                />
              </div>
            </Field>
            <Field label="Akzent (Gold / CTA)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.theme?.accent ?? '#c9a227'}
                  onChange={(e) => update('theme', { accent: e.target.value })}
                  className="w-12 h-10 rounded-lg border cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.theme?.accent ?? '#c9a227'}
                  onChange={(e) => update('theme', { accent: e.target.value })}
                  className="input flex-1 font-mono text-xs"
                />
              </div>
            </Field>
            <Field label="Hintergrund">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.theme?.background ?? '#faf7ed'}
                  onChange={(e) => update('theme', { background: e.target.value })}
                  className="w-12 h-10 rounded-lg border cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.theme?.background ?? '#faf7ed'}
                  onChange={(e) => update('theme', { background: e.target.value })}
                  className="input flex-1 font-mono text-xs"
                />
              </div>
            </Field>
          </div>
        </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-neutral-600">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <Check size={16} /> Gespeichert · Live auf mise-gastro.de
              </span>
            ) : (
              <>Änderungen sind sofort live, sobald gespeichert</>
            )}
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={15} />
            {pending ? 'Speichert...' : 'Änderungen speichern'}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #d4d4d4;
          border-radius: 10px;
          background: white;
          font-size: 14px;
          color: #171717;
          outline: none;
          transition: border 0.2s, box-shadow 0.2s;
        }
        :global(.input:focus) {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
        }
      `}</style>
    </div>
  );
}

function Card({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className="flex-1">
          <h3 className="font-bold text-base text-neutral-900">{title}</h3>
          {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-semibold text-neutral-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex w-12 h-7 rounded-full transition-colors duration-200 ${
          checked ? 'bg-emerald-600' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-base font-bold text-neutral-900 mt-0.5">{value}</div>
    </div>
  );
}
