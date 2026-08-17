'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  LayoutTemplate,
  Megaphone,
  Monitor,
  Navigation,
  Palette,
  PanelTop,
  Plus,
  Rocket,
  Rows3,
  Save,
  Smartphone,
  Sparkles,
  Star,
  Tablet,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import {
  createStorefrontSection,
  type StorefrontBuilderEnvelope,
  type StorefrontSectionType,
  type StorefrontStudioDocument,
  type StorefrontStudioSection,
} from '@/lib/storefront-builder';
import { publishStorefrontDraft, restoreStorefrontVersion, saveStorefrontDraft } from './actions';

type StudioProduct = {
  id: string;
  name: string;
  preis: number;
  bild_url: string | null;
  category_id: string;
  beliebt: boolean | null;
  sort_order: number | null;
};

type StudioCategory = { id: string; name: string; icon: string | null; sort_order: number | null };

type Props = {
  tenant: { id: string; name: string; slug: string; logoUrl: string | null; heroImageUrl: string | null };
  initialEnvelope: StorefrontBuilderEnvelope;
  products: StudioProduct[];
  categories: StudioCategory[];
};

type Device = 'phone' | 'tablet' | 'desktop';
type Selection = 'appearance' | 'header' | string;

const TYPE_META: Record<StorefrontSectionType, { label: string; hint: string; icon: typeof Sparkles }> = {
  announcement: { label: 'Hinweisleiste', hint: 'Kurze Aktion ganz oben', icon: Megaphone },
  navigation: { label: 'Navigation', hint: 'Eigene Menüpunkte', icon: Navigation },
  hero: { label: 'Hero-Banner', hint: 'Großer erster Eindruck', icon: LayoutTemplate },
  bestsellers: { label: 'Bestseller', hint: 'Automatisch oder kuratiert', icon: Star },
  product_rail: { label: 'Produktleiste', hint: 'Ausgewählte Artikel', icon: Rows3 },
  category_tiles: { label: 'Kategorie-Kacheln', hint: 'Schnelleinstiege', icon: PanelTop },
  image_banner: { label: 'Bildbanner', hint: 'Kampagne mit CTA', icon: ImageIcon },
  text: { label: 'Textbereich', hint: 'Story oder Information', icon: Type },
};

const THEME_OPTIONS = [
  ['classic', 'Classic'],
  ['biss-whitelabel', "Franky's Farm"],
  ['aurora', 'Bento'],
  ['noir', 'Fresco'],
  ['mercato', 'Mercato'],
  ['chicken', 'Chicken'],
] as const;

const DEVICE_SIZES: Record<Device, { label: string; width: number; height: number; icon: typeof Smartphone }> = {
  phone: { label: 'Mobil', width: 390, height: 760, icon: Smartphone },
  tablet: { label: 'Tablet', width: 768, height: 760, icon: Tablet },
  desktop: { label: 'Desktop', width: 1180, height: 760, icon: Monitor },
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const money = (value: number) => value.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';

export function ShopDesignClient({ tenant, initialEnvelope, products, categories }: Props) {
  const [document, setDocument] = useState<StorefrontStudioDocument>(() => clone(initialEnvelope.draft));
  const [envelope, setEnvelope] = useState<StorefrontBuilderEnvelope>(() => clone(initialEnvelope));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialEnvelope.draft));
  const [selection, setSelection] = useState<Selection>('appearance');
  const [device, setDevice] = useState<Device>('phone');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(document) !== baseline;
  const selectedSection = document.sections.find((section) => section.id === selection) ?? null;
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  function updateDocument(patch: Partial<StorefrontStudioDocument>) {
    setDocument((current) => ({ ...current, ...patch }));
  }

  function updateSection(id: string, patch: Partial<StorefrontStudioSection>) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section),
    }));
  }

  function addSection(type: StorefrontSectionType) {
    const section = createStorefrontSection(type, `section_${Date.now().toString(36)}`);
    if (type === 'hero' || type === 'image_banner') section.imageUrl = tenant.heroImageUrl ?? '';
    setDocument((current) => ({ ...current, sections: [...current.sections, section] }));
    setSelection(section.id);
  }

  function moveSection(id: string, direction: -1 | 1) {
    setDocument((current) => {
      const index = current.sections.findIndex((section) => section.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      return { ...current, sections };
    });
  }

  function duplicateSection(section: StorefrontStudioSection) {
    const copy = { ...clone(section), id: `section_${Date.now().toString(36)}`, title: `${section.title} – Kopie` };
    setDocument((current) => {
      const index = current.sections.findIndex((item) => item.id === section.id);
      const sections = [...current.sections];
      sections.splice(index + 1, 0, copy);
      return { ...current, sections };
    });
    setSelection(copy.id);
  }

  function removeSection(id: string) {
    setDocument((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }));
    setSelection('appearance');
  }

  function acceptEnvelope(next: StorefrontBuilderEnvelope) {
    setEnvelope(clone(next));
    setDocument(clone(next.draft));
    setBaseline(JSON.stringify(next.draft));
  }

  async function persistDraft() {
    const result = await saveStorefrontDraft({ document, expectedRevision: envelope.draft.revision });
    if (!result.ok || !result.envelope) {
      setNotice({ tone: 'error', text: result.error ?? 'Entwurf konnte nicht gespeichert werden.' });
      return null;
    }
    acceptEnvelope(result.envelope);
    setNotice({ tone: 'ok', text: 'Entwurf gespeichert. Der Live-Shop blieb unverändert.' });
    return result.envelope;
  }

  function save() {
    startTransition(async () => { await persistDraft(); });
  }

  function publish() {
    startTransition(async () => {
      setNotice(null);
      let currentEnvelope = envelope;
      if (dirty) {
        const savedEnvelope = await persistDraft();
        if (!savedEnvelope) return;
        currentEnvelope = savedEnvelope;
      }
      const result = await publishStorefrontDraft({ expectedRevision: currentEnvelope.draft.revision });
      if (!result.ok || !result.envelope) {
        setNotice({ tone: 'error', text: result.error ?? 'Veröffentlichung fehlgeschlagen.' });
        return;
      }
      acceptEnvelope(result.envelope);
      setNotice({ tone: 'ok', text: 'Veröffentlicht. Der Shop verwendet jetzt diese Version.' });
    });
  }

  function restore(historyId: string) {
    if (!historyId) return;
    startTransition(async () => {
      const result = await restoreStorefrontVersion({ historyId, expectedRevision: envelope.draft.revision });
      if (!result.ok || !result.envelope) {
        setNotice({ tone: 'error', text: result.error ?? 'Version konnte nicht geladen werden.' });
        return;
      }
      acceptEnvelope(result.envelope);
      setNotice({ tone: 'ok', text: 'Alte Version als Entwurf geladen. Zum Live-Schalten bitte veröffentlichen.' });
    });
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F3F2EE] -m-4 sm:-m-6 p-4 sm:p-6 text-[#17202A]">
      <header className="mb-5 rounded-[22px] border border-[#D9D8D1] bg-[#FCFBF7] px-5 py-4 shadow-[0_12px_40px_rgba(24,32,42,.07)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#17202A] text-[#FFB45B]"><LayoutTemplate size={22} /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-['Space_Grotesk'] text-xl font-bold tracking-[-.03em]">Shop Studio</h1>
                <span className="rounded-full bg-[#E7E4DD] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#5A6068]">{tenant.name}</span>
                {dirty ? <span className="rounded-full bg-[#FFF0D9] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#A65300]">Nicht gespeichert</span> : <span className="rounded-full bg-[#E6F4EA] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#247243]">Entwurf sicher</span>}
              </div>
              <p className="mt-1 text-sm text-[#6D747C]">Baue die Verkaufsseite wie eine Speisekarte: Abschnitt wählen, Inhalt einstellen, prüfen, veröffentlichen.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {envelope.history.length > 0 && (
              <label className="flex h-10 items-center gap-2 rounded-xl border border-[#D9D8D1] bg-white px-3 text-xs font-bold text-[#59616A]">
                <Undo2 size={14} />
                <select className="bg-transparent outline-none" defaultValue="" onChange={(event) => restore(event.target.value)} disabled={pending} aria-label="Alte Version laden">
                  <option value="" disabled>Version laden</option>
                  {envelope.history.map((entry) => <option key={entry.id} value={entry.id}>{new Date(entry.publishedAt).toLocaleString('de-DE')}</option>)}
                </select>
              </label>
            )}
            <Link href={`https://mise-gastro.de/biss-app/${tenant.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9D8D1] bg-white px-3.5 text-xs font-bold hover:border-[#9CA3AA]"><ExternalLink size={14} /> Live-Shop</Link>
            <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#B8BDC2] bg-white px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"><Save size={14} /> Entwurf speichern</button>
            <button type="button" onClick={publish} disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F26A3D] px-4 text-xs font-black text-white shadow-[0_8px_20px_rgba(242,106,61,.28)] hover:bg-[#DC5730] disabled:opacity-50"><Rocket size={14} /> {pending ? 'Bitte warten…' : 'Veröffentlichen'}</button>
          </div>
        </div>
        {notice && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${notice.tone === 'ok' ? 'border-[#B9DFC4] bg-[#EDF8F0] text-[#25633A]' : 'border-[#F0B7AE] bg-[#FFF0ED] text-[#9B3427]'}`}>
            {notice.tone === 'ok' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}{notice.text}
          </div>
        )}
      </header>

      <div className="grid gap-4 xl:grid-cols-[270px_minmax(420px,1fr)_350px]">
        <aside className="space-y-4">
          <WorkbenchCard title="Grundlage" eyebrow="01 · MARKE">
            <button type="button" onClick={() => setSelection('appearance')} className={`studio-row ${selection === 'appearance' ? 'studio-row-active' : ''}`}><Palette size={16} /><span>Design & Farben</span></button>
            <button type="button" onClick={() => setSelection('header')} className={`studio-row ${selection === 'header' ? 'studio-row-active' : ''}`}><PanelTop size={16} /><span>Header & Bedienung</span></button>
          </WorkbenchCard>

          <WorkbenchCard title="Seitenrezept" eyebrow="02 · REIHENFOLGE">
            <div className="space-y-1.5">
              {document.sections.map((section, index) => {
                const meta = TYPE_META[section.type];
                const Icon = meta.icon;
                return (
                  <button key={section.id} type="button" onClick={() => setSelection(section.id)} className={`group flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${selection === section.id ? 'border-[#F26A3D] bg-[#FFF0EA]' : 'border-transparent bg-[#F4F3EF] hover:border-[#D4D2CB]'}`}>
                    <GripVertical size={13} className="shrink-0 text-[#A5A8AA]" />
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[#59616A]"><Icon size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{section.title || meta.label}</span><span className="block text-[10px] text-[#8A9096]">{String(index + 1).padStart(2, '0')} · {meta.label}</span></span>
                    {!section.enabled && <EyeOff size={13} className="text-[#A5A8AA]" />}
                  </button>
                );
              })}
            </div>
          </WorkbenchCard>

          <WorkbenchCard title="Abschnitt ergänzen" eyebrow="03 · BAUSTEINE">
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TYPE_META) as [StorefrontSectionType, (typeof TYPE_META)[StorefrontSectionType]][]).map(([type, meta]) => {
                const Icon = meta.icon;
                return <button key={type} type="button" onClick={() => addSection(type)} className="rounded-xl border border-[#DDDAD2] bg-white p-2.5 text-left hover:border-[#F26A3D] hover:bg-[#FFF8F4]"><Icon size={15} className="mb-2 text-[#F26A3D]" /><div className="text-[11px] font-black leading-tight">{meta.label}</div><div className="mt-0.5 text-[9px] leading-tight text-[#8A9096]">{meta.hint}</div></button>;
              })}
            </div>
          </WorkbenchCard>
        </aside>

        <main className="min-w-0 rounded-[22px] bg-[#17202A] p-3 shadow-[0_18px_55px_rgba(22,28,36,.2)] sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-white">
            <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-[#FFB45B]">Live-Vorschau</div><div className="text-xs text-white/60">Entwurf · Revision {document.revision}</div></div>
            <div className="flex rounded-xl bg-white/8 p-1">
              {(Object.keys(DEVICE_SIZES) as Device[]).map((key) => {
                const option = DEVICE_SIZES[key];
                const Icon = option.icon;
                return <button key={key} type="button" onClick={() => setDevice(key)} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black ${device === key ? 'bg-[#FFB45B] text-[#17202A]' : 'text-white/65 hover:text-white'}`}><Icon size={13} />{option.label}</button>;
              })}
            </div>
          </div>
          <div className="flex min-h-[720px] items-start justify-center overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_50%_0%,#37414A,#111820_70%)] px-2 py-5">
            <div className="origin-top overflow-hidden bg-white shadow-[0_24px_70px_rgba(0,0,0,.45)] transition-all duration-300" style={{ width: DEVICE_SIZES[device].width, height: DEVICE_SIZES[device].height, maxWidth: '100%', borderRadius: device === 'phone' ? 34 : 16 }}>
              <StudioPreview document={document} tenant={tenant} products={products} categories={categories} productById={productById} categoryById={categoryById} device={device} />
            </div>
          </div>
        </main>

        <aside>
          <div className="sticky top-4 rounded-[22px] border border-[#D9D8D1] bg-[#FCFBF7] p-4 shadow-[0_12px_40px_rgba(24,32,42,.07)]">
            {selection === 'appearance' ? (
              <AppearanceInspector document={document} update={updateDocument} />
            ) : selection === 'header' ? (
              <HeaderInspector document={document} update={updateDocument} />
            ) : selectedSection ? (
              <SectionInspector
                section={selectedSection}
                index={document.sections.findIndex((section) => section.id === selectedSection.id)}
                total={document.sections.length}
                products={products}
                categories={categories}
                onUpdate={(patch) => updateSection(selectedSection.id, patch)}
                onMove={(direction) => moveSection(selectedSection.id, direction)}
                onDuplicate={() => duplicateSection(selectedSection)}
                onRemove={() => removeSection(selectedSection.id)}
              />
            ) : null}
          </div>
        </aside>
      </div>

      <style jsx global>{`
        .studio-row { display:flex; align-items:center; gap:10px; width:100%; min-height:40px; padding:0 12px; border-radius:12px; color:#59616A; font-size:12px; font-weight:800; text-align:left; }
        .studio-row:hover { background:#F1EFEA; color:#17202A; }
        .studio-row-active { background:#17202A!important; color:#fff!important; }
        .studio-input { width:100%; min-height:40px; border:1px solid #D7D5CF; border-radius:11px; background:#fff; padding:9px 11px; font-size:12px; color:#17202A; outline:none; }
        .studio-input:focus { border-color:#F26A3D; box-shadow:0 0 0 3px rgba(242,106,61,.12); }
        .studio-label { display:block; margin-bottom:6px; color:#737980; font-size:9px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        .studio-scroll { scrollbar-width:none; }
        .studio-scroll::-webkit-scrollbar { display:none; }
      `}</style>
    </div>
  );
}

function WorkbenchCard({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded-[18px] border border-[#D9D8D1] bg-[#FCFBF7] p-3.5 shadow-[0_8px_24px_rgba(24,32,42,.05)]"><div className="mb-3"><div className="text-[9px] font-black uppercase tracking-[.17em] text-[#F26A3D]">{eyebrow}</div><h2 className="mt-0.5 font-['Space_Grotesk'] text-sm font-bold">{title}</h2></div>{children}</section>;
}

function AppearanceInspector({ document, update }: { document: StorefrontStudioDocument; update: (patch: Partial<StorefrontStudioDocument>) => void }) {
  const appearance = document.appearance;
  const patch = (next: Partial<typeof appearance>) => update({ appearance: { ...appearance, ...next } });
  return <div className="space-y-4"><InspectorTitle icon={Palette} eyebrow="Marke" title="Design & Farben" text="Die Theme-Auswahl liefert die Formsprache. Deine Farben bleiben restaurant-spezifisch." />
    <Field label="Shop-Theme"><select className="studio-input" value={document.themeId} onChange={(event) => update({ themeId: event.target.value as StorefrontStudioDocument['themeId'] })}>{THEME_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <div className="grid grid-cols-2 gap-3"><ColorField label="Hauptfarbe" value={appearance.primary} onChange={(value) => patch({ primary: value })} /><ColorField label="Akzent" value={appearance.accent} onChange={(value) => patch({ accent: value })} /><ColorField label="Hintergrund" value={appearance.background} onChange={(value) => patch({ background: value })} /><ColorField label="Flächen" value={appearance.surface} onChange={(value) => patch({ surface: value })} /></div>
    <ColorField label="Textfarbe" value={appearance.text} onChange={(value) => patch({ text: value })} />
    <Field label={`Ecken · ${appearance.radius}px`}><input type="range" min="0" max="36" value={appearance.radius} onChange={(event) => patch({ radius: Number(event.target.value) })} className="w-full accent-[#F26A3D]" /></Field>
    <Field label="Abstände"><select className="studio-input" value={appearance.density} onChange={(event) => patch({ density: event.target.value as typeof appearance.density })}><option value="compact">Kompakt</option><option value="comfortable">Ausgewogen</option><option value="spacious">Großzügig</option></select></Field>
    <Field label="Überschriften"><select className="studio-input" value={appearance.headingStyle} onChange={(event) => patch({ headingStyle: event.target.value as typeof appearance.headingStyle })}><option value="brand">Vom Marken-Theme</option><option value="editorial">Editorial</option><option value="bold">Kräftig</option><option value="clean">Klar</option></select></Field>
  </div>;
}

function HeaderInspector({ document, update }: { document: StorefrontStudioDocument; update: (patch: Partial<StorefrontStudioDocument>) => void }) {
  const header = document.header;
  const patch = (next: Partial<typeof header>) => update({ header: { ...header, ...next } });
  return <div className="space-y-4"><InspectorTitle icon={PanelTop} eyebrow="Bedienung" title="Header" text="Lege fest, welche Werkzeuge Kunden jederzeit erreichen." />
    <Toggle label="Beim Scrollen sichtbar" checked={header.sticky} onChange={(value) => patch({ sticky: value })} />
    <Toggle label="Logo anzeigen" checked={header.showLogo} onChange={(value) => patch({ showLogo: value })} />
    <Toggle label="Suche anzeigen" checked={header.showSearch} onChange={(value) => patch({ showSearch: value })} />
    <Toggle label="Kundenkonto anzeigen" checked={header.showAccount} onChange={(value) => patch({ showAccount: value })} />
    <Toggle label="Warenkorb anzeigen" checked={header.showCart} onChange={(value) => patch({ showCart: value })} />
    <div className="rounded-xl border border-[#E1DED7] bg-[#F4F3EF] p-3 text-[11px] leading-relaxed text-[#687078]">Eigene Menüpunkte werden über den Abschnitt „Navigation“ eingefügt. Logo und Bannerbilder kannst du unter <Link href="/shop/design" className="font-black text-[#C34D27] underline">Bilder & Logo</Link> hochladen.</div>
  </div>;
}

function SectionInspector({ section, index, total, products, categories, onUpdate, onMove, onDuplicate, onRemove }: {
  section: StorefrontStudioSection;
  index: number;
  total: number;
  products: StudioProduct[];
  categories: StudioCategory[];
  onUpdate: (patch: Partial<StorefrontStudioSection>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const meta = TYPE_META[section.type];
  return <div className="space-y-4"><InspectorTitle icon={meta.icon} eyebrow={`${String(index + 1).padStart(2, '0')} · ${meta.label}`} title={section.title || meta.label} text={meta.hint} />
    <div className="flex gap-2"><button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border bg-white text-[10px] font-black disabled:opacity-30"><ChevronUp size={13} /> Hoch</button><button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border bg-white text-[10px] font-black disabled:opacity-30"><ChevronDown size={13} /> Runter</button><button type="button" onClick={onDuplicate} className="grid h-9 w-9 place-items-center rounded-lg border bg-white" aria-label="Duplizieren"><Copy size={13} /></button></div>
    <Toggle label="Abschnitt aktiv" checked={section.enabled} onChange={(value) => onUpdate({ enabled: value })} />
    <div className="grid grid-cols-2 gap-2"><Toggle label="Mobil" compact checked={section.showMobile} onChange={(value) => onUpdate({ showMobile: value })} /><Toggle label="Desktop" compact checked={section.showDesktop} onChange={(value) => onUpdate({ showDesktop: value })} /></div>
    {section.type !== 'navigation' && <><Field label="Kleine Zeile"><input className="studio-input" maxLength={80} value={section.kicker} onChange={(event) => onUpdate({ kicker: event.target.value })} /></Field><Field label="Überschrift"><input className="studio-input" maxLength={120} value={section.title} onChange={(event) => onUpdate({ title: event.target.value })} /></Field><Field label="Beschreibung"><textarea className="studio-input min-h-[76px] resize-y" maxLength={320} value={section.subtitle} onChange={(event) => onUpdate({ subtitle: event.target.value })} /></Field></>}
    {(section.type === 'hero' || section.type === 'image_banner') && <><Field label="Bild-URL"><input className="studio-input" value={section.imageUrl} placeholder="https://…" onChange={(event) => onUpdate({ imageUrl: event.target.value })} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Button"><input className="studio-input" maxLength={48} value={section.ctaLabel} onChange={(event) => onUpdate({ ctaLabel: event.target.value })} /></Field><Field label="Button-Ziel"><input className="studio-input" value={section.ctaTarget} placeholder="#speisekarte" onChange={(event) => onUpdate({ ctaTarget: event.target.value })} /></Field></div></>}
    {(section.type === 'bestsellers' || section.type === 'product_rail') && <ProductPicker products={products} selected={section.productIds} onChange={(productIds) => onUpdate({ productIds })} automatic={section.type === 'bestsellers'} />}
    {section.type === 'category_tiles' && <CategoryPicker categories={categories} selected={section.categoryIds} onChange={(categoryIds) => onUpdate({ categoryIds })} />}
    {section.type === 'navigation' && <NavigationEditor section={section} categories={categories} onUpdate={onUpdate} />}
    <Field label="Darstellung"><select className="studio-input" value={section.layout} onChange={(event) => onUpdate({ layout: event.target.value as StorefrontStudioSection['layout'] })}><option value="compact">Kompakt</option><option value="cover">Bildfüllend</option><option value="split">Geteilt</option><option value="cards">Karten</option><option value="scroll">Horizontal</option><option value="grid">Raster</option></select></Field>
    <details className="rounded-xl border border-[#DDDAD2] bg-[#F6F4EF] p-3"><summary className="cursor-pointer text-[10px] font-black uppercase tracking-[.12em] text-[#737980]">Eigene Abschnittsfarben</summary><div className="mt-3 grid grid-cols-3 gap-2"><ColorField label="Fläche" value={section.background || '#FFFFFF'} onChange={(value) => onUpdate({ background: value })} /><ColorField label="Text" value={section.foreground || '#17231B'} onChange={(value) => onUpdate({ foreground: value })} /><ColorField label="Akzent" value={section.accent || '#F26A3D'} onChange={(value) => onUpdate({ accent: value })} /></div></details>
    <button type="button" onClick={onRemove} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#EDC1B9] bg-[#FFF4F1] text-xs font-black text-[#A63E2D]"><Trash2 size={14} /> Abschnitt entfernen</button>
  </div>;
}

function NavigationEditor({ section, categories, onUpdate }: { section: StorefrontStudioSection; categories: StudioCategory[]; onUpdate: (patch: Partial<StorefrontStudioSection>) => void }) {
  const items = section.navigationItems;
  const updateItem = (index: number, patch: Partial<(typeof items)[number]>) => onUpdate({ navigationItems: items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  return <div className="space-y-2"><div className="flex items-center justify-between"><span className="studio-label !mb-0">Menüpunkte · {items.length}/12</span><button type="button" disabled={items.length >= 12} onClick={() => onUpdate({ navigationItems: [...items, { id: `nav_${Date.now().toString(36)}`, label: 'Neuer Punkt', target: categories[0] ? `category:${categories[0].id}` : '#speisekarte' }] })} className="flex items-center gap-1 text-[10px] font-black text-[#C34D27] disabled:opacity-40"><Plus size={12} /> Punkt</button></div>{items.length === 0 && <button type="button" onClick={() => onUpdate({ navigationItems: categories.slice(0, 6).map((category) => ({ id: `nav_${category.id}`, label: category.name, target: `category:${category.id}` })) })} className="w-full rounded-xl border border-dashed border-[#C8C4BB] p-3 text-[11px] font-bold text-[#747A80]">Kategorien automatisch übernehmen</button>}{items.map((item, index) => <div key={item.id} className="rounded-xl border border-[#DEDCD5] bg-white p-2"><div className="flex gap-2"><input className="studio-input !min-h-9 flex-1" maxLength={40} value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /><button type="button" onClick={() => onUpdate({ navigationItems: items.filter((_, itemIndex) => itemIndex !== index) })} className="grid h-9 w-9 place-items-center rounded-lg text-[#A63E2D]"><Trash2 size={13} /></button></div><select className="studio-input !mt-2 !min-h-9" value={item.target.startsWith('category:') ? item.target : 'custom'} onChange={(event) => updateItem(index, { target: event.target.value === 'custom' ? '#' : event.target.value })}><option value="custom">Eigener Link / Anker</option><option value="#speisekarte">Speisekarte</option>{categories.map((category) => <option key={category.id} value={`category:${category.id}`}>{category.name}</option>)}</select>{!item.target.startsWith('category:') && item.target !== '#speisekarte' && <input className="studio-input !mt-2 !min-h-9" value={item.target} placeholder="/seite oder https://…" onChange={(event) => updateItem(index, { target: event.target.value })} />}</div>)}</div>;
}

function ProductPicker({ products, selected, onChange, automatic }: { products: StudioProduct[]; selected: string[]; onChange: (ids: string[]) => void; automatic: boolean }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id].slice(0, 12));
  return <Field label={`Produkte · ${selected.length}/12`}><div className="mb-2 text-[10px] leading-relaxed text-[#81878C]">{automatic && selected.length === 0 ? 'Keine Auswahl: beliebte Artikel werden automatisch verwendet.' : 'Die Reihenfolge folgt der Auswahl.'}</div><div className="studio-scroll max-h-56 space-y-1 overflow-y-auto rounded-xl border bg-white p-1.5">{products.map((product) => { const active = selected.includes(product.id); return <button key={product.id} type="button" onClick={() => toggle(product.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left ${active ? 'bg-[#FFF0EA]' : 'hover:bg-[#F4F3EF]'}`}><span className="h-8 w-8 shrink-0 rounded-lg bg-[#E8E5DE] bg-cover bg-center" style={product.bild_url ? { backgroundImage: `url(${product.bild_url})` } : undefined} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black">{product.name}</span><span className="text-[9px] text-[#8A9096]">{money(product.preis)}</span></span>{active && <Check size={13} className="text-[#C34D27]" />}</button>; })}</div></Field>;
}

function CategoryPicker({ categories, selected, onChange }: { categories: StudioCategory[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id].slice(0, 12));
  return <Field label={`Kategorien · ${selected.length}/12`}><div className="grid grid-cols-2 gap-1.5">{categories.map((category) => { const active = selected.includes(category.id); return <button key={category.id} type="button" onClick={() => toggle(category.id)} className={`rounded-lg border px-2 py-2 text-left text-[10px] font-black ${active ? 'border-[#F26A3D] bg-[#FFF0EA]' : 'border-[#DDDAD2] bg-white'}`}>{category.icon ? `${category.icon} ` : ''}{category.name}</button>; })}</div></Field>;
}

function StudioPreview({ document, tenant, products, categories, productById, categoryById, device }: { document: StorefrontStudioDocument; tenant: Props['tenant']; products: StudioProduct[]; categories: StudioCategory[]; productById: Map<string, StudioProduct>; categoryById: Map<string, StudioCategory>; device: Device }) {
  const appearance = document.appearance;
  const spacing = appearance.density === 'compact' ? 12 : appearance.density === 'spacious' ? 24 : 18;
  const heading = appearance.headingStyle === 'editorial' ? 'Georgia,serif' : appearance.headingStyle === 'bold' ? 'Arial Black,sans-serif' : appearance.headingStyle === 'clean' ? 'Inter,sans-serif' : 'Space Grotesk,system-ui';
  const visibleSections = document.sections.filter((section) => section.enabled && (device === 'phone' ? section.showMobile : section.showDesktop));
  const previewProducts = (ids: string[], automatic = false) => {
    const chosen = ids.map((id) => productById.get(id)).filter(Boolean) as StudioProduct[];
    if (chosen.length) return chosen;
    return [...products].filter((product) => automatic ? product.beliebt : true).slice(0, 6);
  };
  return <div className="studio-scroll h-full overflow-y-auto" style={{ background: appearance.background, color: appearance.text, fontFamily: 'Inter,system-ui' }}>
    <div style={{ position: document.header.sticky ? 'sticky' : 'relative', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, height: device === 'phone' ? 58 : 66, padding: `0 ${spacing}px`, background: `${appearance.surface}F2`, borderBottom: `1px solid ${appearance.primary}22`, backdropFilter: 'blur(12px)' }}>
      {document.header.showLogo && (tenant.logoUrl ? <img src={tenant.logoUrl} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} /> : <span style={{ display: 'grid', width: 32, height: 32, placeItems: 'center', borderRadius: 10, background: appearance.primary, color: '#fff', fontWeight: 900 }}>{tenant.name.slice(0, 1)}</span>)}
      <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: heading, fontSize: device === 'phone' ? 14 : 17 }}>{tenant.name}</strong>
      {document.header.showSearch && <span>⌕</span>}{document.header.showAccount && <span>○</span>}{document.header.showCart && <span style={{ borderRadius: 999, background: appearance.primary, color: '#fff', padding: '6px 9px', fontSize: 10, fontWeight: 900 }}>🛒 0</span>}
    </div>
    {visibleSections.map((section) => {
      const background = section.background || appearance.surface;
      const foreground = section.foreground || appearance.text;
      const accent = section.accent || appearance.accent;
      const common = { margin: `${spacing}px`, borderRadius: appearance.radius, overflow: 'hidden', background, color: foreground } as React.CSSProperties;
      if (section.type === 'announcement') return <section key={section.id} style={{ padding: '10px 14px', background: section.background || appearance.primary, color: section.foreground || '#fff', textAlign: 'center', fontSize: 11, fontWeight: 900 }}>{section.title}</section>;
      if (section.type === 'navigation') {
        const navItems = section.navigationItems.length ? section.navigationItems : categories.slice(0, 6).map((category) => ({ id: category.id, label: category.name, target: '' }));
        return <nav key={section.id} className="studio-scroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: `${spacing - 5}px ${spacing}px`, background }}><span style={{ flex: '0 0 auto', borderRadius: 999, background: appearance.primary, color: '#fff', padding: '7px 12px', fontSize: 10, fontWeight: 900 }}>Alle</span>{navItems.map((item) => <span key={item.id} style={{ flex: '0 0 auto', border: `1px solid ${appearance.primary}30`, borderRadius: 999, background: appearance.surface, padding: '7px 12px', fontSize: 10, fontWeight: 800 }}>{item.label}</span>)}</nav>;
      }
      if (section.type === 'hero' || section.type === 'image_banner') return <section key={section.id} style={{ ...common, position: 'relative', minHeight: section.type === 'hero' ? (device === 'phone' ? 220 : 300) : 160, display: 'flex', alignItems: 'flex-end', padding: device === 'phone' ? 18 : 30, backgroundImage: section.imageUrl ? `linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.72)),url(${section.imageUrl})` : `linear-gradient(135deg,${appearance.primary},${accent})`, backgroundSize: 'cover', backgroundPosition: 'center', color: section.imageUrl ? '#fff' : foreground }}><div style={{ maxWidth: 520 }}><div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.14em' }}>{section.kicker}</div><h2 style={{ margin: '6px 0', fontFamily: heading, fontSize: device === 'phone' ? 25 : 38, lineHeight: 1.02 }}>{section.title}</h2><p style={{ margin: 0, maxWidth: 440, fontSize: device === 'phone' ? 11 : 14, lineHeight: 1.45, opacity: .84 }}>{section.subtitle}</p>{section.ctaLabel && <span style={{ display: 'inline-block', marginTop: 14, borderRadius: Math.max(8, appearance.radius - 6), background: accent, color: '#151515', padding: '9px 13px', fontSize: 10, fontWeight: 900 }}>{section.ctaLabel} →</span>}</div></section>;
      if (section.type === 'bestsellers' || section.type === 'product_rail') {
        const list = previewProducts(section.productIds, section.type === 'bestsellers');
        return <section key={section.id} style={{ padding: `${spacing}px 0` }}><PreviewHeading section={section} heading={heading} spacing={spacing} accent={accent} /><div className="studio-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: `0 ${spacing}px` }}>{list.map((product) => <article key={product.id} style={{ flex: `0 0 ${device === 'phone' ? 132 : 170}px`, overflow: 'hidden', borderRadius: appearance.radius, background: appearance.surface, boxShadow: '0 5px 18px rgba(20,25,30,.08)' }}><div style={{ height: device === 'phone' ? 82 : 108, background: product.bild_url ? `url(${product.bild_url}) center/cover` : `${appearance.primary}18`, display: 'grid', placeItems: 'center', fontSize: 24 }}>{!product.bild_url && '🍽️'}</div><div style={{ padding: 10 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 900 }}>{product.name}</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, color: accent, fontSize: 10, fontWeight: 900 }}><span>{money(product.preis)}</span><span>＋</span></div></div></article>)}</div></section>;
      }
      if (section.type === 'category_tiles') {
        const list = (section.categoryIds.length ? section.categoryIds.map((id) => categoryById.get(id)).filter(Boolean) : categories.slice(0, 6)) as StudioCategory[];
        return <section key={section.id} style={{ padding: `${spacing}px` }}><PreviewHeading section={section} heading={heading} spacing={0} accent={accent} /><div style={{ display: 'grid', gridTemplateColumns: device === 'phone' ? '1fr 1fr' : 'repeat(3,1fr)', gap: 9 }}>{list.map((category) => <div key={category.id} style={{ minHeight: 74, borderRadius: appearance.radius, background: appearance.surface, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 11, fontWeight: 900 }}><span style={{ fontSize: 20 }}>{category.icon || '🍴'}</span>{category.name}</div>)}</div></section>;
      }
      return <section key={section.id} style={{ ...common, padding: device === 'phone' ? 18 : 28 }}><div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.14em', color: accent }}>{section.kicker}</div><h2 style={{ margin: '7px 0', fontFamily: heading, fontSize: device === 'phone' ? 21 : 30 }}>{section.title}</h2><p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, opacity: .72 }}>{section.subtitle}</p></section>;
    })}
    <section id="speisekarte" style={{ padding: `${spacing}px` }}><div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.14em', color: appearance.accent }}>SPEISEKARTE</div><h2 style={{ margin: '5px 0 12px', fontFamily: heading, fontSize: device === 'phone' ? 23 : 31 }}>Alle Produkte</h2><div style={{ display: 'grid', gridTemplateColumns: device === 'phone' ? '1fr 1fr' : 'repeat(3,1fr)', gap: 9 }}>{products.slice(0, 6).map((product) => <div key={product.id} style={{ minHeight: 94, borderRadius: appearance.radius, background: appearance.surface, padding: 10 }}><div style={{ fontSize: 10, fontWeight: 900 }}>{product.name}</div><div style={{ marginTop: 18, color: appearance.accent, fontSize: 10, fontWeight: 900 }}>{money(product.preis)}　＋</div></div>)}</div></section>
  </div>;
}

function PreviewHeading({ section, heading, spacing, accent }: { section: StorefrontStudioSection; heading: string; spacing: number; accent: string }) {
  return <div style={{ padding: `0 ${spacing}px`, marginBottom: 11 }}><div style={{ color: accent, fontSize: 8, fontWeight: 900, letterSpacing: '.14em' }}>{section.kicker}</div><h2 style={{ margin: '4px 0 0', fontFamily: heading, fontSize: 20 }}>{section.title}</h2>{section.subtitle && <p style={{ margin: '3px 0 0', fontSize: 10, opacity: .6 }}>{section.subtitle}</p>}</div>;
}

function InspectorTitle({ icon: Icon, eyebrow, title, text }: { icon: typeof Sparkles; eyebrow: string; title: string; text: string }) {
  return <div className="border-b border-[#E3E0D9] pb-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#17202A] text-[#FFB45B]"><Icon size={17} /></span><div><div className="text-[9px] font-black uppercase tracking-[.16em] text-[#F26A3D]">{eyebrow}</div><h2 className="mt-0.5 font-['Space_Grotesk'] text-base font-bold">{title}</h2></div></div><p className="mt-3 text-[11px] leading-relaxed text-[#747A80]">{text}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="studio-label">{label}</span>{children}</label>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><div className="flex h-10 items-center gap-2 rounded-xl border border-[#D7D5CF] bg-white px-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" /><input value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} maxLength={7} className="min-w-0 flex-1 bg-transparent font-mono text-[10px] outline-none" /></div></Field>; }
function Toggle({ label, checked, onChange, compact = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; compact?: boolean }) { return <button type="button" onClick={() => onChange(!checked)} className={`flex w-full items-center justify-between gap-2 rounded-xl border border-[#E0DDD6] bg-white ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}><span className="text-left text-[11px] font-bold text-[#59616A]">{label}</span><span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-[#F26A3D]' : 'bg-[#CACAC6]'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-[18px]' : 'left-0.5'}`} /></span></button>; }
