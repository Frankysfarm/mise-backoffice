'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { toastError } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Clock, Zap, X } from 'lucide-react';

import { Hero } from './components/hero';
import { LanguageSwitcher } from './components/language-switcher';
import { StickyCategoryBar } from './components/sticky-category-bar';
import { PopularCarousel } from './components/popular-carousel';
import { MenuItemCard } from './components/menu-item-card';
import { CartSidebar } from './components/cart-sidebar';
import { CartFab } from './components/cart-fab';
import { CheckoutSheet } from './components/checkout-sheet';
import { ItemDetailModal } from './components/item-detail-modal';
import { SuccessState } from './components/success-state';
import type {
  CartItem,
  Category,
  CheckoutForm,
  Location,
  MenuItem,
  OrderType,
  SelectedExtras,
} from './components/types';
import { UpsellPopup } from './components/upsell-popup';
import { DELIVERY_FEE } from './components/types';
import { WetterLieferverzugHinweis } from './components/wetter-lieferverzug-hinweis';
import { ServiceStatusBanner } from './components/service-status-banner';
import { BestellungFortschrittBand } from './components/bestellung-fortschritt-band';
import { WiederbestellShortcut, saveLastCart } from './components/wiederbestell-shortcut';
import { WarteschlangenIndikator } from './warteschlangen-indikator';
import { BestellungFortschrittKarte } from './bestellung-fortschritt-karte';
import { AktuelleLieferzeitWidget } from './aktuelle-lieferzeit-widget';
import { BestellPaceIndikator } from './bestell-pace-indikator';
import { FahrerNaeheLiveAnzeige } from './fahrer-naehe-live-anzeige';
import { EtaLiveTrackerV2 } from './eta-live-tracker-v2';
import { BestellungsKlimaIndikator } from './components/bestellungs-klima-indikator';
import LiveWaitBadge from './components/live-wait-badge';
import { DynamicPricingBanner } from './components/dynamic-pricing-banner';
import { OpsServiceKapazitaetsBand } from './components/ops-service-kapazitaets-band';
import { StornoSchutzBadge } from './components/storno-schutz-badge';
import { EtaVertrauensAnzeige } from './components/eta-vertrauens-anzeige';
import { ZonenLieferzeitInfo } from './components/zonen-lieferzeit-info';
import { BestellQualitaetsRing } from './bestell-qualitaets-ring';
import { FahrerQualitaetsBadge } from './components/fahrer-qualitaets-badge';
import { EtaKonfidenzBanner } from './eta-konfidenz-banner';
import { EtaFortschrittsLeiste } from './eta-fortschritts-leiste';
import { BestellEchtzeitAmpel } from './bestell-echtzeit-ampel';
import { BestellungLiveTimeline } from './bestellung-live-timeline';
import { EtaLiveFortschrittBanner } from './eta-live-fortschritt-banner';
import { BestellPhasenBanner } from './bestell-phasen-banner';
import { StorefrontFahrerKarte } from './storefront-fahrer-karte';
import { OrderJourneyTimeline } from './order-journey-timeline';
import { EtaDynamicLivePanel } from './eta-dynamic-live-panel';
import { LiveWartezeitRing } from './components/live-wartezeit-ring';
import { StorefrontLiveWartezeitRing } from './live-wartezeit-ring';
import { LiveTrackingPulse } from './live-tracking-pulse';
import { BestellungEmpfangsBestaetigung } from './bestellung-empfangs-bestaetigung';
import { BestPhaseTimer } from './bestell-phase-timer';
import { LiveOrderKompass } from './live-order-kompass';
import { BewertungsErinnerung } from './bestell-bewertungs-erinnerung';
import { BewertungsFlow } from './bewertungs-flow';
import { OrderLiveStatusPanel } from './order-live-status-panel';
import { BestellungEtaStatusRing } from './bestellung-eta-status-ring';
import { LiveDriverTracker } from './live-driver-tracker';
import { EtaLiveRing } from './eta-live-ring';
import { FahrerAnkunftsCountdown } from './fahrer-ankunfts-countdown';
import { BestellTeilenWidget } from './bestell-teilen-widget';
import { BestellungEchtzeitCountdown } from './bestellung-echtzeit-countdown';
import { EtaConfidenceCard } from './eta-confidence-card';
import { VerzoegerungsInfoBanner } from './verzoegerungs-info-banner';
import { LiveEtaFahrerPanel } from './live-eta-fahrer-panel';
import { WetterVerzoegerungshinweis } from './wetter-verzoegerungshinweis';
import { Phase566LiveTrackingStrip } from './components/phase566-live-tracking-strip';
import { Storefront571LiveEtaMegaPanel } from './phase571-live-eta-mega-panel';
import { Phase576BestellFortschrittsRing } from './phase576-bestell-fortschritts-ring';
import { Phase582KuechenstatusBadge } from './phase582-kuechenstatus-badge';
import { Phase587BestellEtaKomfortBanner } from './phase587-bestell-eta-komfort-banner';
import { Phase597KuechenauslastungsBanner } from './phase597-kuechenauslastungs-banner';
import { Phase604FahrerProfilVorschau } from './phase604-fahrer-profil-vorschau';
import { Phase609BestellstatusTimeline } from './phase609-bestellstatus-timeline';
import { Phase624WarteschlangenIndikator } from './phase624-warteschlangen-indikator';
import { Phase629LieferQualitaetsSiegel } from './phase629-liefer-qualitaets-siegel';
import { Phase630DynamischeEtaAnzeige } from './phase630-dynamische-eta-anzeige';
import { Phase631LiveTrackingWidget } from './phase631-live-tracking-widget';
import { Phase632BestellhistorieKurzansicht } from './phase632-bestellhistorie-kurzansicht';
import { Phase640LieferzeitTransparenzWidget } from './phase640-lieferzeit-transparenz-widget';
import { Phase645BewertungsAufforderungsBanner } from './phase645-bewertungs-aufforderungs-banner';
import { Phase649LiveLieferzeitIndikator } from './phase649-live-lieferzeit-indikator';
import { Phase650KundenbewertungsWidget } from './phase650-kundenbewertungs-widget';
import { Phase658AllergenesWarnBanner } from './phase658-allergene-warn-banner';
import { Phase663KuechenVertrauenBadge } from './phase663-kuechen-vertrauen-badge';
import { Phase668BestellStatusAmpel } from './phase668-bestell-status-ampel';
import { Phase673ZonenLieferzeit } from './phase673-zonen-lieferzeit';
import { Phase678VorbestellungSlot } from './phase678-vorbestellung-slot';
import { Phase683LieferQualitaetsVersprechen } from './phase683-liefer-qualitaets-versprechen';
import { Phase684DynamischeEtaAnzeige } from './phase684-dynamische-eta-anzeige';
import { Phase685LiveTrackingCommander } from './phase685-live-tracking-commander';
import { Phase690LieferzeitfensterWaehler } from './phase690-lieferzeitfenster-waehler';
import { StorefrontPhase694LiveEtaTracking } from './phase694-live-eta-tracking';
import { Phase695LiefergebuehrTransparenz } from './phase695-liefergebuehr-transparenz';
import { Phase700BestellbestaetigungCountdown } from './phase700-bestellbestaetigung-countdown';
import { Phase705LiveLieferstatusEmoji } from './phase705-live-lieferstatus-emoji';
import { Phase710WartezeitIndikator } from './phase710-wartezeit-indikator';
import { Phase715BestsellerHighlight } from './phase715-bestseller-highlight';
import { Phase720WarteschlangenAnzeige } from './phase720-warteschlangen-anzeige';
import { Phase725AktionsBanner } from './phase725-aktions-banner';
import { Phase730LieferZonenBadge } from './phase730-liefer-zonen-badge';
import { Phase735FeedbackEinladung } from './phase735-feedback-einladung';
import { Phase740FahrerNaehe } from './phase740-fahrer-naehe-anzeige';
import { Phase745BestellstatusLeiste } from './phase745-bestellstatus-leiste';
import { Phase750KapazitaetsRing } from './phase750-kapazitaets-ring';
import { Phase755LiefergebuehrCountdown } from './phase755-liefergebuehr-countdown';
import { Phase760BestellverlaufAnzeige } from './phase760-bestellverlauf-anzeige';
import { Phase760BestellFortschrittsTracker } from './phase760-bestell-fortschritts-tracker';
import { Phase764EtaKonfidenzWidget } from './phase764-eta-konfidenz-widget';
import { Phase765LieferSchnelligkeitsIndikator } from './phase765-liefer-schnelligkeits-indikator';
import { Phase769KuechenVertrauenSeal } from './phase769-kuechen-vertrauen-seal';
import { Phase774BestellTransparenzSiegel } from './phase774-bestell-transparenz-siegel';
import { Phase778EtaDynamikLivePanel } from './phase778-eta-dynamik-live-panel';
import { Phase784KuechenWartezeitIndikator } from './phase784-kuechen-wartezeit-indikator';
import { Phase785DynamischeEtaLive } from './phase785-dynamische-eta-live';
import { Phase794WartezeitVorhersageBanner } from './phase794-wartezeit-vorhersage-banner';
import { Phase799BestellhistorieSchnellansicht } from './phase799-bestellhistorie-schnellansicht';
import { Phase804LieferVersprechenSiegel } from './phase804-liefer-versprechen-siegel';
import { Phase813KundenTreuepunkte } from './phase813-kunden-treuepunkte';
import { Phase818KuechenStatusBadge } from './phase818-kuechen-status-badge';
import { Phase823FahrerProfilCard } from './phase823-fahrer-profil-card';
import { Phase828LiveBewertungsPrompt } from './phase828-live-bewertungs-prompt';
import { Phase833LieferzeitCountdown } from './phase833-lieferzeit-countdown';
import { StorefrontPhase829DynamischeEtaLivePanel } from './phase829-dynamische-eta-live-panel';
import { StorefrontPhase830LiveTrackingPanel } from './phase830-live-tracking-panel';
import { StorefrontPhase834LieferstatusTransparenz } from './phase834-lieferstatus-transparenz';
import { Phase840BestAnlass } from './phase840-bestell-anlass';
import { Phase845NachhaltigkeitsBadge } from './phase845-nachhaltigkeits-badge';
import { Phase850KuechenTransparenzTimeline } from './phase850-kuechen-transparenz-timeline';
import { StorefrontPhase851LiveEtaKommando } from './phase851-live-eta-kommando';
import { Phase855LieferEtaVertrauensBand } from './phase855-liefer-eta-vertrauens-band';
import { Phase860AnkunftsKonfetti } from './phase860-ankunfts-konfetti';
import { Phase864LieferstatusFortschritt } from './phase864-lieferstatus-fortschritt';
import { Phase870KuechenKapazitaetBanner } from './phase870-kuechen-kapazitaet-banner';
import { Phase875BestellungsBestaetigungsTicker } from './phase875-bestellungs-bestaetigung-ticker';
import { EtaLiveKommando } from './eta-live-kommando';
import { Phase883BewertungsIncentiveBanner } from './phase883-bewertungs-incentive-banner';
import { Phase888LieferPreisTransparenz } from './phase888-liefer-preis-transparenz';
import { Phase893LieferzeitKomfortBanner } from './phase893-lieferzeit-komfort-banner';
import { Phase898LiveBestellZaehler } from './phase898-live-bestell-zaehler';
import { Phase903LieferQualitaetsSiegel } from './phase903-liefer-qualitaets-siegel';
import { Phase915LieferantenTransparenzWidget } from './phase915-lieferanten-transparenz-widget';
import { StorefrontPhase916EtaLiveTrackingPro } from './phase916-eta-live-tracking-pro';
import { Phase922BestellmengenEmpfehlung } from './phase922-bestellmengen-empfehlung';
import { StorefrontPhase925LiveLieferungTracker } from './phase925-live-lieferung-tracker';
import { Phase928LiveWartezeitIndikator } from './phase928-live-wartezeit-indikator';
import { Phase930DynamischeEtaLive } from './phase930-dynamische-eta-live';
import { Phase935BestellstatusAmpel } from './phase935-bestellstatus-ampel';
import { Phase940BestellzusammenfassungWidget } from './phase940-bestellzusammenfassung-widget';
import { Phase945TreuepunkteVorschau } from './phase945-treuepunkte-vorschau';
import { Phase950AllergenSchnellfilter } from './phase950-allergen-schnellfilter';
import { Phase955LiveEtaFahrerTracking } from './phase955-live-eta-fahrer-tracking';
import { Phase960ProduktVerfuegbarkeitsLoader, VerfuegbarkeitsBadge } from './phase960-produktverfuegbarkeits-indikator';
import { Phase962LieferQualitaetsBadge } from './phase962-liefer-qualitaets-badge';
import { Phase965BestellzahlCountdown } from './phase965-bestellzahl-countdown';
import { Phase970LieferzonenVisualisierung } from './phase970-lieferzonen-visualisierung';
import { StorefrontPhase975DynamischeEtaLiveKommando } from './phase975-dynamische-eta-live-kommando';
import { Phase980LiveKochTransparenzWidget } from './phase980-live-koch-transparenz-widget';
import { Phase985LiveEtaTrackingBanner } from './phase985-live-eta-tracking-banner';
import { Phase990FahrerAnnaeherungsRadar } from './phase990-fahrer-annaeherungs-radar';
import { Phase995EchtzeitKuechenTransparenzWidget } from './phase995-echtzeit-kuechen-transparenz-widget';
import { Phase1000LiveBestellstatusTimelinePro } from './phase1000-live-bestellstatus-timeline-pro';
import { StorefrontPhase1006KuechenAuslastungsAnzeige } from './phase1006-kuechen-auslastungs-anzeige';
import { BestellungsEtaVorschauBand } from './bestellungs-eta-vorschau-band';
import { LiveEtaTracker900 } from './phase900-live-eta-tracker';

type Props = {
  location: Location;
  categories: Category[];
  items: MenuItem[];
  paymentMethods?: {
    method: string;
    label: string | null;
    enabled_lieferung: boolean;
    enabled_abholung: boolean;
    enabled_vor_ort: boolean;
  }[];
  themeId?: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  locale?: 'de' | 'en' | 'tr' | 'ar';
  deliveryTimeMin?: number;
  minOrder?: number;
  tenantDeliveryFee?: number;
};

export function Storefront({ location, categories, items, paymentMethods = [], themeId = 'classic', heroImageUrl = null, logoUrl = null, locale = 'de', deliveryTimeMin = 35, minOrder = 12, tenantDeliveryFee = 0 }: Props) {
  /* ---------------- state ---------------- */
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [orderType, setOrderType] = React.useState<OrderType>('abholung');
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [cartSheetOpen, setCartSheetOpen] = React.useState(false);
  const [ordering, setOrdering] = React.useState(false);
  const [orderSuccess, setOrderSuccess] = React.useState<{
    bestellnummer: string;
    name: string;
    eta: number;
    type: OrderType;
    orderId: string;
    items: CartItem[];
    orderedAt: string;
  } | null>(null);

  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);

  const [detailItem, setDetailItem] = React.useState<MenuItem | null>(null);
  const [detailNotiz, setDetailNotiz] = React.useState('');
  const [anlass, setAnlass] = React.useState('');

  // Voucher-Code aus URL auto-einlösen (z.B. ?code=THX-ABC123 vom Bon-QR)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    // Storage für späteren Checkout
    try {
      sessionStorage.setItem(`pending_voucher:${location.id}`, code);
    } catch {}
  }, [location.id]);

  /* ---------------- search + filter ---------------- */
  const [search, setSearch] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'beliebt' | 'vegan' | 'under10'>('all');
  const [allergenFilter, setAllergenFilter] = React.useState<string | null>(null);
  // Phase 960: Produktverfügbarkeits-Map item_id → status
  const [verfuegbarkeitsMap, setVerfuegbarkeitsMap] = React.useState<Map<string, 'verfuegbar' | 'wenige_uebrig' | 'ausverkauft'>>(new Map());
  const itemIds = React.useMemo(() => items.map((i) => i.id), [items]);

  const filteredItems = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((i) => {
      if (needle) {
        const hay = `${i.name} ${i.beschreibung ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (activeFilter === 'beliebt' && !i.beliebt) return false;
      if (activeFilter === 'vegan' && !(i.tags ?? []).includes('vegan')) return false;
      if (activeFilter === 'under10' && i.preis >= 10) return false;
      // Phase 950: Allergen-Filter — zeige nur Artikel ohne das gewählte Allergen
      if (allergenFilter) {
        const allergens = (i.allergene ?? []).map((a) => a.toLowerCase());
        if (allergens.includes(allergenFilter)) return false;
      }
      return true;
    });
  }, [items, search, activeFilter, allergenFilter]);

  /* ---------------- derived ---------------- */
  const popular = React.useMemo(() => filteredItems.filter((i) => i.beliebt), [filteredItems]);

  const categoryMap = React.useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const itemsByCategory = React.useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const cat of categories) {
      m.set(
        cat.id,
        filteredItems.filter((i) => i.category_id === cat.id),
      );
    }
    return m;
  }, [categories, filteredItems]);

  const totalItems = React.useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);
  const subtotal = React.useMemo(
    () => cart.reduce((s, c) => s + c.qty * (c.item.preis + (c.extra_preis ?? 0)), 0),
    [cart],
  );
  // Voucher-State
  const [voucher, setVoucher] = React.useState<{ voucher_id: string; code: string; typ: string; rabatt: number; beschreibung: string | null } | null>(null);
  // Delivery Credit State
  const [deliveryCredit, setDeliveryCredit] = React.useState<{ token: string; amountEur: number } | null>(null);
  // Loyalty-Punkte-State
  const [loyalty, setLoyalty] = React.useState<{ pointsToRedeem: number; discountEur: number } | null>(null);
  const deliveryFeeBase = orderType === 'lieferung' ? DELIVERY_FEE : 0;
  const deliveryFee = voucher?.typ === 'gratis_lieferung' && orderType === 'lieferung' ? 0 : deliveryFeeBase;
  const voucherRabatt = voucher?.typ !== 'gratis_lieferung' ? (voucher?.rabatt ?? 0) : 0;
  const creditDiscount = deliveryCredit?.amountEur ?? 0;
  const loyaltyDiscount = loyalty?.discountEur ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - voucherRabatt - creditDiscount - loyaltyDiscount);

  const getCategory = React.useCallback(
    (id: string | null) => (id ? categoryMap.get(id) : undefined),
    [categoryMap],
  );

  /* ---------------- cart ---------------- */
  const [upsellFor, setUpsellFor] = React.useState<MenuItem | null>(null);

  const addToCart = React.useCallback((item: MenuItem) => {
    setCart((c) => {
      const ex = c.find((x) => x.item.id === item.id && !x.extras);
      if (ex) return c.map((x) => (x.item.id === item.id && !x.extras ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { item, qty: 1, lineId: item.id }];
    });
    // Upsell-Vorschlag wenn das Item verwandte Artikel hat
    setUpsellFor(item);
  }, []);

  const addItemWithExtras = React.useCallback((item: MenuItem, qty: number, extras: SelectedExtras, notiz: string, extraPreis: number) => {
    // Hash der Extras-Wahl — gleiche Wahl = selbe Cart-Line
    const extraHash = JSON.stringify(extras) + '|' + notiz;
    const lineId = `${item.id}::${extraHash}`;

    setCart((c) => {
      const existing = c.find((x) => x.lineId === lineId);
      if (existing) {
        return c.map((x) => (x.lineId === lineId ? { ...x, qty: x.qty + qty } : x));
      }
      return [...c, { item, qty, lineId, extras, notiz, extra_preis: extraPreis }];
    });
    setUpsellFor(item);
  }, []);

  const addById = React.useCallback(
    (id: string) => {
      const it = items.find((i) => i.id === id);
      if (it) addToCart(it);
    },
    [items, addToCart],
  );

  const removeFromCart = React.useCallback((itemId: string) => {
    setCart((c) =>
      c.map((x) => (x.item.id === itemId ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0),
    );
  }, []);

  const deleteFromCart = React.useCallback((itemId: string) => {
    setCart((c) => c.filter((x) => x.item.id !== itemId));
  }, []);

  const getQty = React.useCallback(
    (itemId: string) => cart.find((c) => c.item.id === itemId)?.qty ?? 0,
    [cart],
  );

  /* ---------------- IntersectionObserver for sticky bar ---------------- */
  const sectionRefs = React.useRef<Map<string, HTMLElement>>(new Map());

  const registerSection = React.useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top (most visible above fold).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).id;
          if (id) setActiveSectionId(id);
        }
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: [0, 0.2, 0.6] },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories.length, popular.length]);

  const scrollToSection = React.useCallback((id: string) => {
    const el = sectionRefs.current.get(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  /* ---------------- detail modal ---------------- */
  const openDetail = React.useCallback((item: MenuItem) => {
    setDetailItem(item);
    setDetailNotiz('');
  }, []);
  const closeDetail = React.useCallback(() => setDetailItem(null), []);

  /* ---------------- submit ---------------- */
  async function placeOrder(form: CheckoutForm) {
    setOrdering(true);
    try {
      const sb = createClient();
      const eta = Math.max(10, cart.length * 3);
      const { data: order, error } = await sb
        .from('customer_orders')
        .insert({
          location_id: location.id,
          typ: orderType,
          kunde_name: form.name,
          kunde_telefon: form.telefon,
          kunde_email: form.email ?? null,
          kunde_adresse: form.adresse ?? null,
          kunde_plz: form.plz ?? null,
          kunde_stadt: form.stadt ?? null,
          kunde_lat: form.lat ?? null,
          kunde_lng: form.lng ?? null,
          kunde_etage: form.etage ?? null,
          kunde_tuer_code: form.tuercode ?? null,
          kunde_lieferhinweis: form.lieferhinweis ?? null,
          kunde_notiz: [form.lieferhinweis, anlass].filter(Boolean).join(' · ') || null,
          zwischensumme: subtotal,
          liefergebuehr: deliveryFee,
          gesamtbetrag: total,
          geschaetzte_zubereitung_min: eta,
          zahlungsart: form.zahlungsart,
          voucher_code: voucher?.code ?? null,
          voucher_rabatt: voucherRabatt + (voucher?.typ === 'gratis_lieferung' ? deliveryFeeBase : 0),
          marketing_optin: form.marketing_optin ?? false,
        })
        .select('id,bestellnummer')
        .single();
      if (error) throw error;

      await sb.from('order_items').insert(
        cart.map((c) => ({
          order_id: order.id,
          menu_item_id: c.item.id,
          name: c.item.name,
          menge: c.qty,
          einzelpreis: c.item.preis + (c.extra_preis ?? 0),
          extras: c.extras ? { selections: c.extras, extra_preis: c.extra_preis ?? 0 } : [],
          notiz: c.notiz ?? null,
        })),
      );

      // Adress-Präferenzen speichern (fire-and-forget, damit zukünftige Bestellungen vorausgefüllt werden)
      if (orderType === 'lieferung' && form.email && form.adresse) {
        const addressDisplay = [form.adresse, form.plz, form.stadt].filter(Boolean).join(', ');
        void fetch('/api/delivery/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            location_id: location.id,
            address_display: addressDisplay,
            floor: form.etage ?? undefined,
            gate_code: form.tuercode ?? undefined,
            special_instructions: form.lieferhinweis ?? undefined,
          }),
        }).catch(() => null);
      }

      // WhatsApp Opt-In speichern (fire-and-forget)
      if (form.whatsapp_optin && form.telefon && orderType === 'lieferung') {
        void fetch('/api/delivery/whatsapp-optin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId: location.id, phone: form.telefon, optedIn: true }),
        }).catch(() => null);
      }

      // Voucher-Einlösung bestätigen
      if (voucher) {
        await sb.rpc('confirm_voucher_redemption', {
          p_voucher_id: voucher.voucher_id,
          p_order_id: order.id,
          p_rabatt: voucherRabatt + (voucher.typ === 'gratis_lieferung' ? deliveryFeeBase : 0),
          p_kunde_email: form.email ?? null,
          p_kunde_telefon: form.telefon ?? null,
        });
        try { sessionStorage.removeItem(`pending_voucher:${location.id}`); } catch {}
      }

      // Delivery Credit einlösen (fire-and-forget — kein Fatal wenn es fehlschlägt)
      if (deliveryCredit) {
        void fetch(`/api/delivery/credits/${deliveryCredit.token}/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: order.id, location_id: location.id }),
        }).catch(() => null);
      }

      // Loyalty-Punkte einlösen (fire-and-forget)
      if (loyalty && form.email) {
        void fetch('/api/delivery/loyalty/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            location_id: location.id,
            points: loyalty.pointsToRedeem,
            order_id: order.id,
            order_amount_eur: subtotal,
          }),
        }).catch(() => null);
      }

      // Trinkgeld für Fahrer aufzeichnen (fire-and-forget)
      if (form.tipEur && form.tipEur > 0) {
        void fetch('/api/delivery/tip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, tipEur: form.tipEur, locationId: location.id }),
        }).catch(() => null);
      }

      // Wenn Online-Zahlung: Stripe-Checkout-Session erstellen + Redirect
      if (form.zahlungsart === 'online' && total > 0) {
        try {
          const res = await fetch('/api/checkout/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: order.id }),
          });
          const json = await res.json();
          if (res.ok && json.url) {
            window.location.href = json.url;
            return;
          }
          // Fallback: Order bleibt bestehen, zeige Fehler + trotzdem Success (als Reservierung)
          toastError('Online-Zahlung nicht möglich', json.error ?? 'Bitte im Laden oder beim Fahrer bezahlen');
        } catch (e) {
          toastError('Stripe-Fehler', e instanceof Error ? e.message : 'Bitte vor Ort bezahlen');
        }
      }

      setOrderSuccess({
        bestellnummer: order.bestellnummer,
        name: form.name,
        eta,
        type: orderType,
        orderId: order.id,
        items: cart,
        orderedAt: new Date().toISOString(),
      });
      // Persist for returning-visitor tracking banner
      try {
        localStorage.setItem(`active_order:${location.id}`, JSON.stringify({
          bestellnummer: order.bestellnummer,
          orderId: order.id,
          isDelivery: orderType === 'lieferung',
          placedAt: Date.now(),
          etaMs: Date.now() + eta * 60_000,
        }));
      } catch {}
      // Save cart snapshot for "Wieder bestellen" shortcut
      saveLastCart(location.id, cart);
      setCart([]);
      setCheckoutOpen(false);
      setCartSheetOpen(false);

      // Bestellbestätigungs-Email asynchron triggern (fire-and-forget)
      if (form.email) {
        void fetch('/api/email/process-outbox', { method: 'POST' }).catch(() => {});
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
      toastError('Bestellung fehlgeschlagen', message);
    } finally {
      setOrdering(false);
    }
  }

  /* ---------------- success screen ---------------- */
  if (orderSuccess) {
    return (
      <div>
        <SuccessState
          bestellnummer={orderSuccess.bestellnummer}
          name={orderSuccess.name}
          etaMinutes={orderSuccess.eta}
          isDelivery={orderSuccess.type === 'lieferung'}
          onNewOrder={() => setOrderSuccess(null)}
          orderId={orderSuccess.orderId}
          cartItems={orderSuccess.items}
        />
        {/* Phase 955: Live-ETA Fahrer-Tracking — Dynamischer Countdown-Ring + Fahrer-Name + Tour-Phase + Nähe-Puls */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase955LiveEtaFahrerTracking orderId={orderSuccess.orderId} initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : 25} />
          </div>
        )}
        {/* Phase 960: Liefer-Qualitäts-Badge — Bewertungs-Sterne + Pünktlichkeitsquote + Ø-Lieferzeit als Vertrauensbadge */}
        <div className="px-4 pb-4 max-w-lg mx-auto">
          <Phase962LieferQualitaetsBadge locationId={location.id} />
        </div>
        {/* Phase 778: ETA-Dynamik-Live-Panel — Phasen-Timeline mit Echtzeit-ETA und Fahrer-Infos */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase778EtaDynamikLivePanel
              orderId={orderSuccess.orderId}
              status="bestätigt"
              estimatedMinutes={orderSuccess.eta > 0 ? orderSuccess.eta : null}
              orderedAt={orderSuccess.orderedAt}
            />
          </div>
        )}
        {/* Phase 458: Dynamische ETA-Anzeige mit Live-Fahrer-Status */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-6 max-w-lg mx-auto">
            <EtaDynamicLivePanel
              orderId={orderSuccess.orderId}
              locationId={location.id}
              bestellnummer={orderSuccess.bestellnummer}
            />
          </div>
        )}
        {/* Phase 460: Animierter Warte-Ring — visueller Kreisfortschritt */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <LiveWartezeitRing
              orderedAt={orderSuccess.orderedAt}
              etaMinutes={orderSuccess.eta}
              orderType={orderSuccess.type}
            />
          </div>
        )}
        {/* Phase 460: SVG-Countdown-Ring mit Live-API-Polling */}
        {orderSuccess.type === 'lieferung' && orderSuccess.eta > 0 && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <StorefrontLiveWartezeitRing
              orderId={orderSuccess.orderId}
              etaMinutes={orderSuccess.eta}
              locationId={location.id}
            />
          </div>
        )}
        {/* Phase 461: Live-Tracking-Pulse — animierte 5-Phasen-Timeline mit Supabase-Realtime */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-6 max-w-lg mx-auto">
            <LiveTrackingPulse
              orderId={orderSuccess.orderId}
              locationId={location.id}
            />
          </div>
        )}
        {/* Phase 463: Phase-Timer — Live-Countdown der aktuellen Bestellphase */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <BestPhaseTimer
              orderId={orderSuccess.orderId}
              estimatedMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
            />
          </div>
        )}
        {/* Phase 551: Live-ETA-Fahrer-Panel — Dynamische ETA + Phase-Timeline + Progress-Ring */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <LiveEtaFahrerPanel
              orderId={orderSuccess.orderId}
              phase="bestätigt"
              etaMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
              progressPct={orderSuccess.eta > 0 ? Math.max(5, Math.min(95, (1 - orderSuccess.eta / 45) * 100)) : 10}
            />
          </div>
        )}
        {/* Phase 556: Wetter-Verzögerungshinweis — Banner bei schlechtem Wetter mit erweiterter ETA */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <WetterVerzoegerungshinweis
              locationId={location.id}
              etaMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
            />
          </div>
        )}
        {/* Phase 566: Live-Tracking-Strip — Animierter Statusstreifen mit Realtime-Updates */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <Phase566LiveTrackingStrip
              orderId={orderSuccess.orderId}
              initialStatus="bestätigt"
              initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
            />
          </div>
        )}
        {/* Phase 571: Live-ETA-Mega-Panel — Phasen-Display mit Live-ETA für Kunden */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <Storefront571LiveEtaMegaPanel
              locationId={location.id}
              orderStatus="bestätigt"
              orderedAt={orderSuccess.orderedAt}
            />
          </div>
        )}
        {/* Phase 576: Bestellstatus-Fortschritts-Ring — Animierter SVG-Ring mit Phasen-Stepper */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <Phase576BestellFortschrittsRing
              orderStatus="bestätigt"
              etaMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
              orderedAt={orderSuccess.orderedAt}
            />
          </div>
        )}
        {/* Phase 470: Live-Order-Kompass — Stufen-Tracker mit Fahrernamen + ETA-Countdown */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <LiveOrderKompass
              orderId={orderSuccess.orderId}
              locationId={location.id}
              estimatedMinutes={orderSuccess.eta}
            />
          </div>
        )}
        {/* Phase 478: ETA-Status-Ring — SVG-Ring mit Phasen-Stepper, Echtzeit-Supabase-Updates */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <BestellungEtaStatusRing
              orderId={orderSuccess.orderId}
              initialStatus="bestätigt"
              initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : undefined}
            />
          </div>
        )}
        {/* Phase 785: Dynamische ETA Live — Phasen-Timeline mit Live-Status-Updates für Kunden */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase785DynamischeEtaLive
              orderId={orderSuccess.orderId}
              initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
            />
          </div>
        )}
        {/* Phase 462: Empfangsbestätigung — animierte Eingangsbestätigung mit ETA + Sterne */}
        <div className="px-4 pb-8 max-w-lg mx-auto">
          <BestellungEmpfangsBestaetigung
            bestellnummer={orderSuccess.bestellnummer}
            name={orderSuccess.name}
            etaMinutes={orderSuccess.eta}
            isDelivery={orderSuccess.type === 'lieferung'}
          />
        </div>
        {/* Phase 475: Bewertungs-Erinnerung — Floating-Toast 15 Min nach Lieferung */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <BewertungsErinnerung
            orderId={orderSuccess.orderId}
            deliveredAt={
              orderSuccess.orderedAt && orderSuccess.eta > 0
                ? new Date(new Date(orderSuccess.orderedAt).getTime() + orderSuccess.eta * 60_000).toISOString()
                : null
            }
            locationSlug={location.id}
          />
        )}
        {/* Phase 475b: Bewertungs-Flow — sofortiger Rating-Prompt mit Sterne-Auswahl + Kommentar */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-8 max-w-lg mx-auto">
            <BewertungsFlow
              orderId={orderSuccess.orderId}
              bestellnummer={orderSuccess.bestellnummer}
            />
          </div>
        )}
        {/* Phase 475c: Order-Live-Status-Panel — Live-Status-Tracker mit Phasen-Stepper + Countdown */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-6 max-w-lg mx-auto">
            <OrderLiveStatusPanel
              orderId={orderSuccess.orderId}
              bestellnummer={orderSuccess.bestellnummer}
              initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : 30}
            />
          </div>
        )}
        {/* Phase 480: Live-Fahrer-Tracker — GPS-Proximity-Ring + Fahrerinfo wenn unterwegs */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-6 max-w-lg mx-auto">
            <LiveDriverTracker
              orderId={orderSuccess.orderId}
              initialStatus="bestätigt"
            />
          </div>
        )}
        {/* Phase 481: ETA-Live-Ring — SVG-Countdown-Ring mit Phasen-Status */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <EtaLiveRing
              orderId={orderSuccess.orderId}
              status="bestätigt"
            />
          </div>
        )}
        {/* Phase 482: ETA-Konfidenz-Karte — Supabase-Realtime ETA mit Step-Stepper */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <EtaConfidenceCard
              orderId={orderSuccess.orderId}
              orderNumber={orderSuccess.bestellnummer}
              initialStatus="bestätigt"
              customerName={orderSuccess.name}
            />
          </div>
        )}
        {/* Phase 483: Echtzeit-Countdown — Phasen-Stepper mit Sekunden-Countdown */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <BestellungEchtzeitCountdown
              status="bestätigt"
              etaIso={
                orderSuccess.orderedAt && orderSuccess.eta > 0
                  ? new Date(new Date(orderSuccess.orderedAt).getTime() + orderSuccess.eta * 60_000).toISOString()
                  : null
              }
            />
          </div>
        )}
        {/* Phase 484: Fahrer-Ankunfts-Countdown — zeigt Countdown wenn Fahrer ≤5 Min entfernt */}
        {orderSuccess.type === 'lieferung' && orderSuccess.eta > 0 && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <FahrerAnkunftsCountdown
              etaMin={orderSuccess.eta}
              status="bestätigt"
            />
          </div>
        )}
        {/* Phase 587: Bestell-ETA-Komfort-Banner v2 — Küchen- und Fahrerphase getrennt */}
        {orderSuccess.type === 'lieferung' && orderSuccess.eta > 0 && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase587BestellEtaKomfortBanner
              etaMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
              orderedAt={orderSuccess.orderedAt}
            />
          </div>
        )}
        {/* Phase 488: Bestellung teilen — WhatsApp + Native Share + Copy-Link zum Tracking */}
        {orderSuccess.bestellnummer && (
          <div className="px-4 pb-6 max-w-lg mx-auto">
            <BestellTeilenWidget
              bestellnummer={orderSuccess.bestellnummer}
              locationSlug={location.id}
            />
          </div>
        )}
      </div>
    );
  }

  /* ---------------- main ---------------- */
  return (
    <div data-storefront-theme={themeId} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-surface storefront-root">
      {/* Phase 960: Produktverfügbarkeits-Loader — silent, rendert nichts */}
      <Phase960ProduktVerfuegbarkeitsLoader
        locationId={location.id}
        itemIds={itemIds}
        onUpdate={setVerfuegbarkeitsMap}
      />

      {/* Skip to content */}
      <a
        href="#menu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-matcha-900 focus:px-4 focus:py-2 focus:text-sm focus:text-matcha-50"
      >
        Direkt zur Speisekarte
      </a>

      {/* Sprache-Switcher oben rechts (auf Hero) */}
      <div className="absolute top-4 right-4 z-40">
        <LanguageSwitcher current={locale} />
      </div>

      <Hero
        location={location}
        orderType={orderType}
        onOrderType={setOrderType}
        popularCount={popular.length}
        itemCount={items.length}
        themeId={themeId as 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora'}
        deliveryTimeMin={deliveryTimeMin}
        minOrder={minOrder}
        deliveryFee={tenantDeliveryFee}
        heroImageUrl={heroImageUrl}
        logoUrl={logoUrl}
      />

      {/* Geteilter Tracking-Link — zeigt Bestellstatus wenn ?track=ORDER_ID in URL */}
      <SharedTrackingBanner />

      {/* Aktive Bestellung — wiederkehrender Kunde sieht Live-Status-Banner */}
      <ActiveOrderBanner locationId={location.id} />
      {/* Phase 205: Fortschritt-Band — visueller Status-Progress mit Countdown */}
      <ActiveOrderProgressPanel locationId={location.id} deliveryTimeMin={deliveryTimeMin} />

      {/* Phase 582: Küchenstatus-Live-Badge — Signalisiert Küchenstatus für Kunden */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <Phase582KuechenstatusBadge locationId={location.id} />
        </div>
      )}
      {/* Phase 597: Küchen-Auslastungs-Infobanner — warnt Kunden bei hoher Küchen-Auslastung */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <Phase597KuechenauslastungsBanner locationId={location.id} />
        </div>
      )}
      {/* Wetter-Lieferverzug-Hinweis: Kundenhinweis bei schlechtem Wetter */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-3 md:px-8">
          <WetterLieferverzugHinweis locationId={location.id} />
        </div>
      )}

      {/* Phase 321: Service-Status-Banner — öffentlicher Echtzeit-Status für Kunden */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <ServiceStatusBanner locationId={location.id} />
        </div>
      )}
      {/* Phase 888: Liefer-Preis-Transparenz — Aufschlüsselung Grundgebühr + Zonen-Zuschlag + Bündelrabatt */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase888LieferPreisTransparenz locationId={location.id} isDelivery={orderType === 'lieferung'} />
        </div>
      )}
      {/* Phase 922: Bestellmengen-Empfehlung — "Andere bestellen oft auch X" Cross-Sell wenn Warenkorb befüllt */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase922BestellmengenEmpfehlung
            locationId={location.id}
            currentItemNames={cart.map(c => c.item.name ?? '').filter(Boolean)}
          />
        </div>
      )}
      {/* Phase 940: Bestellzusammenfassung-Widget — Kompakte Inline-Zusammenfassung: Artikel + Gesamtpreis + ETA vor Bestellabschluss */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase940BestellzusammenfassungWidget
            cart={cart}
            locationId={location.id}
            etaMin={deliveryTimeMin}
            isDelivery={orderType === 'lieferung'}
          />
        </div>
      )}
      {/* Phase 945: Treuepunkte-Vorschau — Wie viele Punkte sammelt der Kunde mit dieser Bestellung */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase945TreuepunkteVorschau cart={cart} locationId={location.id} />
        </div>
      )}
      {/* Phase 341: Dynamic Pricing Banner — Surge-Hinweis / Off-Peak-Rabatt für Kunden */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <DynamicPricingBanner locationId={location.id} orderType={orderType} />
      </div>
            {/* Phase 344: Zonen-Lieferzeit-Info — Aktuelle Lieferzeit für diese Zone */}
            <ZonenLieferzeitInfo locationId={location.id} orderType={orderType} />
      {/* Phase 343: Ops-Service-Kapazitätsband — Live-Lieferkapazität + ETA für Kunden */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <OpsServiceKapazitaetsBand locationId={location.id} orderType={orderType} />
      </div>
      {/* Phase 345: Storno-Schutz-Badge — Stornierungsbedingungen transparent anzeigen */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <StornoSchutzBadge locationId={location.id} orderType={orderType} />
      </div>
      {/* Phase 348: ETA-Vertrauens-Anzeige — Zuverlässigkeitsstufe der Lieferzeit für Kunden */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <EtaVertrauensAnzeige
            orderId={location.id}
            etaMinEarliest={deliveryTimeMin - 3}
            etaMinLatest={deliveryTimeMin + 5}
          />
        </div>
      )}
      {/* ETA-Konfidenz-Banner — Dynamische Lieferzeit mit Konfidenzintervall und Auslastungsanzeige */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <EtaKonfidenzBanner locationId={location.id} />
        </div>
      )}
      {/* Phase 350: Fahrer-Qualitäts-Badge — Top-Fahrer-Qualitätsindikator für Kunden */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <FahrerQualitaetsBadge locationId={location.id} orderType={orderType} />
      </div>
      {/* Phase 337: Live-Wait-Badge — kompaktes Wartezeit-Pill je Bestelltyp */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <LiveWaitBadge orderType={orderType} />
      </div>
      {/* Live-Lieferzeit-Indikator */}
      {orderType === 'lieferung' && (
        <LiveEtaBar locationId={location.id} baseEtaMin={deliveryTimeMin} />
      )}

      {/* Phase 928: Live-Wartezeit-Indikator — Echtzeit-Ampel für aktuelle Lieferwartezeit (Grün/Amber/Rot) */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase928LiveWartezeitIndikator locationId={location.id} orderType={orderType} />
      </div>
      {/* Phase 965: Bestellzahl-Countdown — Dringlichkeits-Badge wenn Tages-Kapazität fast ausgeschöpft */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <Phase965BestellzahlCountdown locationId={location.id} />
        </div>
      )}
      {/* Phase 970: Lieferzonen-Visualisierung — Interaktive Übersicht Zonen A/B/C/D mit ETA + Liefergebühr */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <Phase970LieferzonenVisualisierung locationId={location.id} />
        </div>
      )}
      {/* Warteschlangen-Indikator: zeigt aktuelle Auslastung + Wartezeit-Schätzung */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <WarteschlangenIndikator locationId={location.id} orderType="lieferung" />
        </div>
      )}
      {/* Bestellungs-ETA-Vorschau-Band — Live-ETA-Schätzung vor Bestellaufgabe mit Surge-Indikator */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <BestellungsEtaVorschauBand locationId={location.id} deliveryTimeMin={deliveryTimeMin ?? 30} />
        </div>
      )}
      {/* Phase 311: Aktuelle Lieferzeit-Widget — Live-ETA + Fahreranzahl vom Health-API */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <AktuelleLieferzeitWidget locationId={location.id} />
        </div>
      )}
      {/* Phase 313: Bestell-Pace-Indikator — Live-Status (schnell/normal/erhöhte Wartezeit) für Kunden */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <BestellPaceIndikator locationId={location.id} />
        </div>
      )}
      {/* Phase 327: Bestellungs-Klima-Indikator — Liefer-Klima-Ampel (ideal/leicht verzögert/hohe Last) */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <BestellungsKlimaIndikator locationId={location.id} />
        </div>
      )}
      {/* Phase 347: Bestell-Qualitäts-Ring — SVG-Ring Pünktlichkeitsrate + Trust-Signal für Kunden */}
      {orderType === 'lieferung' && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <BestellQualitaetsRing locationId={location.id} />
        </div>
      )}
      {/* Phase 435: Bestell-Phasen-Banner — Live-Servicequalität-Strip: Fahrer online, ETA, Pünktlichkeit, aktive Lieferungen */}
      <BestellPhasenBanner locationId={location.id} orderType={orderType} />

      {/* Quick-Jump: Kategorie-Buttons oben, damit Kunden nicht scrollen müssen */}
      <div className="bg-surface border-b border-matcha-900/5">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-8">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {popular.length > 0 && (
              <button
                onClick={() => scrollToSection('beliebt')}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-matcha-900 px-4 py-2 text-xs font-bold text-matcha-50 shadow-sm transition active:scale-95"
              >
                <span>⭐</span> Beliebt
              </button>
            )}
            {categories.map((cat) => {
              const catItems = itemsByCategory.get(cat.id) ?? [];
              if (catItems.length === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToSection(cat.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-matcha-50 px-4 py-2 text-xs font-bold text-matcha-900 transition hover:bg-matcha-100 active:scale-95"
                >
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <StickyCategoryBar
        categories={categories}
        hasPopular={popular.length > 0}
        activeId={activeSectionId}
        onJump={scrollToSection}
        totalItems={totalItems}
        totalPrice={total}
        onOpenCart={() => setCartSheetOpen(true)}
        themeId={themeId as any}
      />

      <main id="menu" className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="lg:flex lg:gap-10">
          <div className="flex-1">
            {/* Search + Filter */}
            <div className="sticky top-12 z-20 -mx-4 bg-white/95 px-4 py-2 backdrop-blur md:top-16 md:-mx-8 md:px-8">
              <div className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suche Cappuccino, Matcha, …"
                  className="h-10 w-full rounded-xl border border-matcha-900/10 bg-white px-3 pl-9 pr-4 text-[13px] sm:text-sm text-matcha-900 placeholder:text-matcha-900/40 focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-matcha-900/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                </svg>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-matcha-900/10 text-xs font-bold text-matcha-900"
                    aria-label="Suche löschen"
                  >×</button>
                )}
              </div>
              {/* Quick Filters */}
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { id: 'all',     label: 'Alle',         emoji: '🍽️' },
                  { id: 'beliebt', label: 'Beliebt',      emoji: '⭐' },
                  { id: 'vegan',   label: 'Vegan',        emoji: '🌱' },
                  { id: 'under10', label: 'Unter 10 €',  emoji: '💶' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id as any)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95',
                      activeFilter === f.id
                        ? 'bg-matcha-900 text-accent shadow-sm'
                        : 'bg-matcha-50 text-matcha-900 hover:bg-matcha-100',
                    )}
                  >
                    <span>{f.emoji}</span>
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Phase 950: Allergen-Schnellfilter — Gluten/Laktose/Nüsse/Soja/Ei aus Speisekarte ausblenden */}
              <div className="mt-1.5">
                <Phase950AllergenSchnellfilter
                  activeAllergen={allergenFilter}
                  onAllergenChange={setAllergenFilter}
                />
              </div>
            </div>

            {/* No results */}
            {filteredItems.length === 0 && (search || activeFilter !== 'all' || allergenFilter !== null) && (
              <div className="rounded-3xl bg-matcha-50 p-8 text-center">
                <div className="text-4xl mb-2">🔍</div>
                <div className="font-display text-lg font-bold text-matcha-900">Nichts gefunden</div>
                <div className="mt-1 text-sm text-matcha-900/60">
                  Andere Suche oder Filter entfernen.
                </div>
                <button
                  onClick={() => { setSearch(''); setActiveFilter('all'); setAllergenFilter(null); }}
                  className="mt-4 inline-flex h-10 items-center rounded-full bg-matcha-900 px-4 text-sm font-bold text-matcha-50"
                >
                  Alle zeigen
                </button>
              </div>
            )}

            {/* Phase 206: Letzte Bestellung — Wieder-bestellen-Shortcut */}
            {!search && activeFilter === 'all' && (
              <WiederbestellShortcut
                locationId={location.id}
                items={items}
                onAdd={addToCart}
              />
            )}

            {/* Popular */}
            {popular.length > 0 && (
              <section
                id="beliebt"
                ref={registerSection('beliebt')}
                className="scroll-mt-20"
              >
                <PopularCarousel themeId={themeId as any}
                  items={popular}
                  getCategory={getCategory}
                  getQty={getQty}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                  onOpenDetail={openDetail}
                />
              </section>
            )}

            {/* Category sections */}
            {categories.map((cat) => {
              const catItems = itemsByCategory.get(cat.id) ?? [];
              if (catItems.length === 0) return null;
              return (
                <section
                  key={cat.id}
                  id={cat.id}
                  ref={registerSection(cat.id)}
                  className="scroll-mt-20 py-8 md:py-12"
                >
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">
                        <span className="text-base leading-none">{cat.icon}</span>
                        Kategorie
                      </div>
                      <h2 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em] text-matcha-900 md:text-4xl">
                        {cat.name}
                      </h2>
                      <p className="mt-1 text-sm text-matcha-800/60">
                        {categoryDescription(cat.name)}
                      </p>
                    </div>
                    <div className="hidden text-xs text-matcha-800/50 md:block">
                      {catItems.length} {catItems.length === 1 ? 'Gericht' : 'Gerichte'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-x-4 lg:grid-cols-3">
                    {catItems.map((item) => {
                      const verfStatus = verfuegbarkeitsMap.get(item.id);
                      return (
                        <div key={item.id} className="relative">
                          {/* Phase 960: Verfügbarkeits-Badge oben links */}
                          {verfStatus && verfStatus !== 'verfuegbar' && (
                            <div className="absolute left-2 top-2 z-10">
                              <VerfuegbarkeitsBadge status={verfStatus} />
                            </div>
                          )}
                          <MenuItemCard
                            item={item}
                            category={cat}
                            qty={getQty(item.id)}
                            onAdd={() => addToCart(item)}
                            onRemove={() => removeFromCart(item.id)}
                            onOpenDetail={() => openDetail(item)}
                            themeId={themeId as any}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Footer spacer */}
            <div className="h-24 lg:h-16" />

            {/* Location footer */}
            <footer className="mb-24 rounded-3xl bg-matcha-900 p-8 text-matcha-50 md:p-12 lg:mb-16">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">Besuch uns</div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] md:text-4xl">
                {location.name}
              </h2>
              <p className="mt-3 text-matcha-200">
                {[location.adresse, location.plz, location.stadt].filter(Boolean).join(', ')}
              </p>
              {location.telefon && (
                <a
                  href={`tel:${location.telefon}`}
                  className="mt-1 inline-block font-mono text-sm text-matcha-100 underline underline-offset-4"
                >
                  {location.telefon}
                </a>
              )}

              {/* Rechtliches — Pflichtangaben */}
              <div className="mt-8 pt-6 border-t border-matcha-700 flex flex-wrap gap-x-6 gap-y-2 text-xs text-matcha-300">
                <a href={`/legal/impressum`} className="hover:text-accent underline-offset-4 hover:underline">Impressum</a>
                <a href={`/legal/datenschutz`} className="hover:text-accent underline-offset-4 hover:underline">Datenschutz</a>
                <a href={`/legal/agb`} className="hover:text-accent underline-offset-4 hover:underline">AGB & Widerruf</a>
                <a href={`/legal/allergene`} className="hover:text-accent underline-offset-4 hover:underline">Allergene & Zusatzstoffe</a>
              </div>
              <div className="mt-3 text-[10px] text-matcha-400 leading-relaxed">
                {location.name} · Alle Preise inkl. MwSt.
              </div>
            </footer>
          </div>

          {/* Desktop cart */}
          <CartSidebar
            cart={cart}
            orderType={orderType}
            totalItems={totalItems}
            subtotal={subtotal}
            total={total}
            getCategory={getCategory}
            onAdd={addById}
            onRemove={removeFromCart}
            onDelete={deleteFromCart}
            onCheckout={() => setCheckoutOpen(true)}
            onBrowse={() => scrollToSection(popular.length > 0 ? 'beliebt' : categories[0]?.id ?? '')}
            variant="desktop"
            locationId={location.id}
          />
        </div>
      </main>

      {/* Mobile FAB + sheet */}
      <CartFab
        totalItems={totalItems}
        total={total}
        visible={totalItems > 0 && !cartSheetOpen && !checkoutOpen && !detailItem}
        onClick={() => setCartSheetOpen(true)}
        themeId={themeId as any}
      />

      {/* Mobile cart bottom sheet */}
      {cartSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-matcha-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setCartSheetOpen(false)}
        >
          <div
            className={cn(
              'w-full overflow-hidden rounded-t-3xl bg-surface shadow-strong',
              'motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-300',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <CartSidebar
              cart={cart}
              orderType={orderType}
              totalItems={totalItems}
              subtotal={subtotal}
              total={total}
              getCategory={getCategory}
              onAdd={addById}
              onRemove={removeFromCart}
              onDelete={deleteFromCart}
              onCheckout={() => {
                setCartSheetOpen(false);
                setCheckoutOpen(true);
              }}
              onBrowse={() => {
                setCartSheetOpen(false);
                scrollToSection(popular.length > 0 ? 'beliebt' : categories[0]?.id ?? '');
              }}
              onClose={() => setCartSheetOpen(false)}
              variant="sheet"
              locationId={location.id}
            />
          </div>
        </div>
      )}

      {/* Upsell-Popup nach Add-to-Cart */}
      <UpsellPopup
        forItem={upsellFor}
        onClose={() => setUpsellFor(null)}
        onAdd={(item) => addToCart(item)}
      />

      {/* Detail modal mit Optionen */}
      <ItemDetailModal
        item={detailItem}
        qty={detailItem ? getQty(detailItem.id) : 0}
        onClose={closeDetail}
        onAddToCart={(qty, extras, notiz, extraPreis) => {
          if (!detailItem) return;
          addItemWithExtras(detailItem, qty, extras, notiz, extraPreis);
          closeDetail();
        }}
      />

      {/* Checkout */}
      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        orderType={orderType}
        total={total}
        loading={ordering}
        onSubmit={placeOrder}
        locationCoords={cityFallbackCoords(location.stadt)}
        defaultCity={location.stadt ?? ''}
        paymentMethods={paymentMethods}
        locationId={location.id}
        subtotal={subtotal}
        voucher={voucher}
        onVoucherChange={setVoucher}
        deliveryCredit={deliveryCredit}
        onDeliveryCreditChange={setDeliveryCredit}
        onLoyaltyChange={setLoyalty}
      />

      {/* Hidden unused import suppression (keeps lint happy when X not used elsewhere). */}
      <span className="hidden">
        <X aria-hidden />
      </span>
    </div>
  );
}

/**
 * Ohne lat/lng-Spalten auf `locations` nutzen wir Stadt-Fallback-Koordinaten
 * zum Biasing der Adress-Suche und zum Liefer-Radius-Check.
 * Sobald `locations` eigene Koordinaten hat, kommt das weg.
 */
function cityFallbackCoords(city: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  const c = city.toLowerCase();
  const map: Record<string, { lat: number; lng: number }> = {
    aachen: { lat: 50.7753, lng: 6.0839 },
    berlin: { lat: 52.5200, lng: 13.4050 },
    mannheim: { lat: 49.4875, lng: 8.4660 },
    koeln: { lat: 50.9375, lng: 6.9603 },
    köln: { lat: 50.9375, lng: 6.9603 },
    hamburg: { lat: 53.5511, lng: 9.9937 },
    muenchen: { lat: 48.1351, lng: 11.5820 },
    münchen: { lat: 48.1351, lng: 11.5820 },
    frankfurt: { lat: 50.1109, lng: 8.6821 },
  };
  for (const key of Object.keys(map)) {
    if (c.includes(key)) return map[key];
  }
  return null;
}

function categoryDescription(name: string): string {
  const n = name.toLowerCase();
  if (/heiß|heiss|hot/.test(n)) return 'Frisch aufgebrüht — unsere Handwerkskunst in der Tasse.';
  if (/kalt|iced|cold/.test(n)) return 'Mit Eis und Liebe — erfrischend für jede Jahreszeit.';
  if (/food/.test(n)) return 'Hausgemacht, ehrlich und mit den besten Zutaten.';
  if (/special/.test(n)) return 'Unsere Signatures — Limited Editions und Saisongäste.';
  return 'Unsere Auswahl, sorgfältig kuratiert.';
}

/* ------------------------------ SharedTrackingBanner ------------------------------ */

function SharedTrackingBanner() {
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [orderData, setOrderData] = React.useState<{
    status: string; bestellnummer: string; kundeNama: string | null; etaEarliest: string | null;
  } | null>(null);
  const [nowMs, setNowMs] = React.useState(Date.now());
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('track');
    if (id) setOrderId(id);
  }, []);

  React.useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/delivery/orders/${orderId}/tracking`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (cancelled) return;
        setOrderData({ status: d.status, bestellnummer: d.bestellnummer, kundeNama: d.kunde_name ?? null, etaEarliest: d.eta_earliest ?? null });
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    const tick = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(tick); };
  }, [orderId]);

  if (!orderId || dismissed || !orderData) return null;

  const secsLeft = orderData.etaEarliest
    ? Math.max(0, Math.floor((new Date(orderData.etaEarliest).getTime() - nowMs) / 1000))
    : null;
  const minsLeft = secsLeft != null ? Math.floor(secsLeft / 60) : null;

  const statusLabel: Record<string, string> = {
    neu: 'Eingegangen', bestätigt: 'Bestätigt', in_zubereitung: 'Wird zubereitet',
    fertig: 'Bereit', unterwegs: 'Unterwegs', geliefert: 'Geliefert 🎉', storniert: 'Storniert',
  };
  const isTerminal = ['geliefert', 'abgeholt', 'storniert'].includes(orderData.status);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 mt-3">
      <div className={cn(
        'rounded-xl border px-4 py-3 flex items-center gap-3',
        isTerminal ? 'bg-matcha-50 border-matcha-200' : 'bg-blue-50 border-blue-200',
      )}>
        <span className="text-xl shrink-0">{isTerminal ? '✅' : '📍'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-bold text-sm', isTerminal ? 'text-matcha-700' : 'text-blue-800')}>
              {statusLabel[orderData.status] ?? orderData.status}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground font-mono">{orderData.bestellnummer}</span>
            {!isTerminal && minsLeft != null && minsLeft > 0 && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-black tabular-nums text-blue-700">
                  <Clock className="h-2.5 w-2.5" />
                  {minsLeft} Min
                </span>
              </>
            )}
          </div>
          {orderData.kundeNama && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">für {orderData.kundeNama}</div>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-black/5 text-muted-foreground shrink-0"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ ActiveOrderProgressPanel ------------------------------ */

function ActiveOrderProgressPanel({ locationId, deliveryTimeMin = 35 }: { locationId: string; deliveryTimeMin?: number }) {
  const [order, setOrder] = React.useState<{ orderId: string; bestellnummer?: string; status: string; etaEarliest: string | null; isDelivery: boolean; placedAt: string | null; etaMin: number | null } | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(`active_order:${locationId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed.orderId) return;
      if (Date.now() - parsed.placedAt > 4 * 60 * 60_000) return;
      const etaMin = (parsed.placedAt && parsed.etaMs)
        ? Math.max(1, Math.round((parsed.etaMs - parsed.placedAt) / 60_000))
        : null;
      setOrder({
        orderId: parsed.orderId,
        bestellnummer: parsed.bestellnummer ?? undefined,
        status: parsed.status ?? 'bestätigt',
        etaEarliest: parsed.etaMs ? new Date(parsed.etaMs).toISOString() : null,
        isDelivery: parsed.isDelivery ?? false,
        placedAt: parsed.placedAt ? new Date(parsed.placedAt).toISOString() : null,
        etaMin,
      });
    } catch {}
  }, [locationId]);

  if (!order) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-2 space-y-2">
      <BestellungFortschrittBand
        orderId={order.orderId}
        initialStatus={order.status}
        etaEarliest={order.etaEarliest}
        etaLatest={null}
        isDelivery={order.isDelivery}
      />
      {/* Phase 705: Live-Lieferstatus-Emoji — Dynamische Emoji-Animation je Lieferstatus */}
      {order.status && (
        <Phase705LiveLieferstatusEmoji
          status={order.status}
          isDelivery={order.isDelivery}
          etaMinuten={order.etaMin ?? undefined}
          bestelltAt={order.placedAt ?? undefined}
        />
      )}
      {/* Phase 609: Bestellstatus-Timeline — Animierte Schritt-für-Schritt Verlaufsanzeige */}
      <Phase609BestellstatusTimeline status={order.status} isDelivery={order.isDelivery} />
      {/* Phase 700: Bestellbestätigungs-Countdown — Animierter Countdown bis Lieferzeit nach Bestellabgabe */}
      {order.placedAt && order.etaMin && !['delivered', 'cancelled'].includes(order.status ?? '') && (
        <Phase700BestellbestaetigungCountdown
          etaMinuten={order.etaMin}
          bestelltAt={order.placedAt}
          isDelivery={order.isDelivery}
        />
      )}
      {/* Phase 725: Aktions-Banner — Zeitlich begrenzte Aktion (dismissable, zählt Restzeit) */}
      <Phase725AktionsBanner locationId={locationId} />
      {/* Phase 715: Bestseller-Highlight — Top-3 Gerichte der letzten 7 Tage mit Rang-Emoji */}
      <Phase715BestsellerHighlight locationId={locationId} />
      {/* Phase 720: Warteschlangen-Anzeige — "X Bestellungen vor dir in der Küche" bei hoher Last */}
      <Phase720WarteschlangenAnzeige locationId={locationId} />
      {/* Phase 650: Kundenbewertungs-Widget — Ø-Bewertung + Anzahl als Vertrauenssignal */}
      <Phase650KundenbewertungsWidget locationId={locationId} />
      {/* Phase 658: Allergene-Warn-Banner — Allergene aus Warenkorbpositionen klar hervorgehoben */}
      {/* Phase 710: Wartezeit-Indikator mit Küchenlast — Zeigt +5/+10 Min bei hoher Küchenauslastung */}
      {order.isDelivery && <Phase710WartezeitIndikator locationId={locationId} basisEtaMinuten={deliveryTimeMin} />}
      {/* Phase 730: Liefer-Zonen-Badge — Zone, Lieferzeit und Gebühr als farbiges Badge */}
      {order.isDelivery && <Phase730LieferZonenBadge locationId={locationId} />}
      {/* Phase 900: Live ETA Tracker — Dynamische ETA + Lieferphasen-Fortschritt mit Countdown */}
      {order.isDelivery && (
        <LiveEtaTracker900
          orderId={order.orderId}
          orderStatus={order.status}
          etaMin={order.etaMin ?? null}
          locationName={(location as any)?.name ?? null}
        />
      )}
      {/* Phase 735: Feedback-Einladung nach Lieferung — Sternbewertung 3s nach Statuswechsel zu geliefert */}
      <Phase735FeedbackEinladung locationId={locationId} bestellungId={order.orderId} status={order.status} />
      {/* Phase 740: Fahrer-Nähe-Anzeige — Entfernung + ETA wenn Fahrer unterwegs zur Lieferadresse */}
      {order.isDelivery && <Phase740FahrerNaehe locationId={locationId} bestellungId={order.orderId} status={order.status} />}
      {/* Phase 745: Bestellstatus-Leiste — Visuelle Fortschrittsleiste mit Schritt-Emojis */}
      <Phase745BestellstatusLeiste status={order.status} isDelivery={order.isDelivery} />
      {/* Phase 750: Kapazitäts-Ring — SVG-Donut-Ring mit Küchen-Auslastung und Farb-Feedback */}
      <Phase750KapazitaetsRing locationId={locationId} />
      {/* Phase 755: Liefergebühr-Countdown — Zeitlich begrenzte Liefergebühr-Reduktion mit Ablauf-Timer */}
      <Phase755LiefergebuehrCountdown locationId={locationId} isDelivery={order.isDelivery} />
      {/* Phase 760: Bestellverlauf-Anzeige — Stündliches Balkendiagramm heutiger Bestellungen */}
      <Phase760BestellverlaufAnzeige locationId={locationId} />
      {/* Phase 760: Bestell-Fortschritts-Tracker — Visueller Schritt-für-Schritt Status mit Verbindungslinien */}
      <Phase760BestellFortschrittsTracker status={order.status} createdAt={order.placedAt ?? undefined} estimatedMinutes={deliveryTimeMin} />
      {/* Phase 764: ETA-Konfidenz-Widget — Präzisions-Ring grün/amber/rot mit Varianz-Angabe */}
      <Phase764EtaKonfidenzWidget locationId={locationId} />
      {/* Phase 765: Liefer-Schnelligkeits-Indikator — Heute schneller/langsamer als üblich? */}
      {order.isDelivery && <Phase765LieferSchnelligkeitsIndikator locationId={locationId} />}
      {/* Phase 769: Küchen-Vertrauen-Seal — Animiertes Bewertungs-Siegel mit Ø-Kundenbewertung */}
      <Phase769KuechenVertrauenSeal locationId={locationId} />
      {/* Phase 774: Bestell-Transparenz-Siegel — Zuverlässigkeits-Siegel mit Storno-Quote (nur wenn ≤15%) */}
      <Phase774BestellTransparenzSiegel locationId={locationId} />
      {/* Phase 784: Küchen-Wartezeit-Indikator — Live-Anzeige der aktuellen Zubereitungszeit nach Küchenauslastung */}
      <Phase784KuechenWartezeitIndikator locationId={locationId} />
      {/* Phase 794: Wartezeit-Vorhersage-Banner — Dynamische Erwartungssteuerung via Küchen-Auslastung (grün/amber/rot) */}
      <Phase794WartezeitVorhersageBanner locationId={locationId} />
      {/* Phase 799: Bestellhistorie-Schnellansicht — Letzte 3 Bestellungen aus LocalStorage */}
      <Phase799BestellhistorieSchnellansicht
        locationSlug={locationId}
        currentOrderId={order.orderId ?? null}
      />
      {/* Phase 850: Küchen-Transparenz-Timeline — Live-Fortschritt durch Küche: Warteschlange→Zubereitung→Bereit→Unterwegs→Geliefert */}
      <Phase850KuechenTransparenzTimeline orderId={order.orderId ?? null} locationId={locationId} />
      {/* Phase 851: Live ETA Kommando — Echtzeit-ETA mit Phasen-Timeline, Fahrer-Infos und Entfernungs-Anzeige */}
      <StorefrontPhase851LiveEtaKommando orderId={order.orderId ?? null} />
      {/* Phase 855: Liefer-ETA-Vertrauens-Band — Frühestes/Wahrscheinliches/Spätestes Lieferfenster mit Konfidenz + Pünktlichkeitsdaten */}
      <Phase855LieferEtaVertrauensBand orderId={order.orderId ?? null} locationId={locationId} />
      {/* Phase 860: Ankunfts-Konfetti — Canvas-Konfetti + Overlay-Banner bei status=geliefert */}
      <Phase860AnkunftsKonfetti orderId={order.orderId ?? null} status={order.status ?? null} />
      {/* Phase 975: Dynamische ETA Live-Kommando — Phasen-Timeline mit Live-Countdown + Puls-Animation je Status */}
      {order.isDelivery && (
        <StorefrontPhase975DynamischeEtaLiveKommando
          orderId={order.orderId ?? undefined}
          status={order.status ?? undefined}
          etaMinutes={order.etaMin ?? null}
          driverName={(order as any).fahrer_name ?? null}
          estimatedAt={(order as any).estimated_at ?? null}
        />
      )}
      {/* Phase 980: Live-Koch-Transparenz-Widget — Animiertes Widget zeigt aktuellen Zubereitungsschritt der Bestellung */}
      {order.isDelivery && (
        <Phase980LiveKochTransparenzWidget
          orderId={order.orderId ?? null}
          status={order.status ?? null}
        />
      )}
      {/* Phase 990: Fahrer-Annäherungs-Radar — Radar-Alert wenn Fahrer < 500m entfernt + Echtzeit-Entfernungsanzeige */}
      {order.isDelivery && (
        <Phase990FahrerAnnaeherungsRadar
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          className="mx-4 mb-4"
        />
      )}
      {/* Phase 995: Echtzeit-Küchen-Transparenz-Widget — "Ihr Essen wird zubereitet" + animiertes Koch-Icon + Batch-Fortschritt */}
      {order.isDelivery && (
        <Phase995EchtzeitKuechenTransparenzWidget
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          className="mx-4 mb-4"
        />
      )}
      {/* Phase 1006: Live-Küchen-Auslastungs-Anzeige — Echtzeit-Ampel Niedrig/Normal/Hoch/Peak + erwartete Wartezeit */}
      <StorefrontPhase1006KuechenAuslastungsAnzeige locationId={location.id} className="mx-4 mb-3" />
      {/* Phase 1000: Live-Bestellstatus-Timeline Pro — Interaktive Timeline Bestellt→Küche→Fertig→Unterwegs→Geliefert + Sekunden-Countdown */}
      {order.isDelivery && (
        <Phase1000LiveBestellstatusTimelinePro
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          etaMinutes={order.etaMin ?? null}
          driverName={(order as any).fahrer_name ?? null}
          className="mx-4 mb-4"
        />
      )}
      {/* Phase 985: Live-ETA-Tracking-Banner — Farbcodierter Phasen-Fortschritt + Sekunden-Countdown + Live-Tracking-Dot */}
      {order.isDelivery && (
        <Phase985LiveEtaTrackingBanner
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          etaMinutes={order.etaMin ?? null}
          driverName={(order as any).fahrer_name ?? null}
          className="mx-4 mb-4"
        />
      )}
      {/* Phase 864: Lieferstatus-Fortschrittsleiste — Visuelle Schritte Bestellt→Küche→Fertig→Unterwegs→Geliefert mit Echtzeit-Update */}
      {order.isDelivery && (
        <Phase864LieferstatusFortschritt orderId={order.orderId ?? null} currentStatus={order.status ?? null} />
      )}
      {/* Phase 870: Küchen-Kapazität-Banner — Dismissbares Banner bei Küchen-Auslastung ≥70% mit geschätzter Startzeit */}
      <Phase870KuechenKapazitaetBanner locationId={locationId} />
      {/* Phase 875: Bestellungs-Bestätigungs-Ticker — Animierter Eingangsticker mit Konfetti-Burst nach Bestelleingang */}
      <Phase875BestellungsBestaetigungsTicker orderId={order.orderId ?? null} orderNumber={order.bestellnummer ?? null} status={order.status ?? null} />
      {/* Phase 883: Bewertungs-Incentive-Banner — Gamification-Banner nach Lieferung: Punkte für Bewertung vergeben */}
      <Phase883BewertungsIncentiveBanner orderId={order.orderId ?? null} status={order.status ?? null} />
      {/* Phase 893: Lieferzeit-Komfort-Banner — Zeigt ETA vs. 7-Tage-Ø: schneller/langsamer als normal (dismissbar) */}
      {order.isDelivery && <Phase893LieferzeitKomfortBanner locationId={locationId} currentEtaMin={order.etaMin} />}
      {/* Phase 898: Live-Bestell-Zähler — Social-Proof-Strip "Schon X Bestellungen heute" */}
      <Phase898LiveBestellZaehler locationId={locationId} />
      {/* Phase 903: Liefer-Qualitäts-Siegel — Pünktlichkeits-% als Vertrauenssignal für Kunden */}
      <Phase903LieferQualitaetsSiegel locationId={locationId} isDelivery={order.isDelivery} />
      {/* Phase 915: Lieferanten-Transparenz-Widget — Name + Fahrzeug + Bewertung des Fahrers nach Dispatch */}
      {order.isDelivery && <Phase915LieferantenTransparenzWidget orderId={order.orderId ?? null} status={order.status ?? null} />}
      {/* Phase 916: ETA-Live-Tracking-Pro — 4-Phasen-Timeline, Sekunden-Countdown, Fahrer-Distanz */}
      {order.isDelivery && order.orderId && order.status && !['storniert', 'cancelled', 'geliefert', 'delivered'].includes(order.status) && (
        <StorefrontPhase916EtaLiveTrackingPro
          orderId={order.orderId}
          initialEtaMin={order.etaMin ?? 28}
          initialPhase={
            order.status === 'in_zubereitung' ? 'cooking'
              : order.status === 'fertig' ? 'ready'
              : order.status === 'unterwegs' || order.status === 'dispatched' || order.status === 'in_delivery' ? 'picked_up'
              : 'confirmed'
          }
        />
      )}
      {/* Phase 925: Live-Lieferung-Tracker — 4-Phasen-Fortschrittsanzeige mit ETA-Countdown und Farbkodierung für Kunden */}
      {order.isDelivery && order.orderId && order.status && !['storniert', 'cancelled', 'geliefert', 'delivered'].includes(order.status) && (
        <StorefrontPhase925LiveLieferungTracker
          orderId={order.orderId}
          status={order.status}
          initialEtaMin={order.etaMin ?? 30}
        />
      )}
      {/* Phase 935: Bestellstatus-Ampel — Kompakte Grün/Amber/Rot Ampel + pulsierendes Icon je Status (30s-Polling) */}
      <Phase935BestellstatusAmpel
        orderId={order.orderId ?? null}
        status={order.status ?? null}
        isDelivery={order.isDelivery}
      />
      {/* Phase 930: Dynamische ETA Live — Echtzeit-Phasenverlauf (Bestätigt→Zubereitung→Fertig→Unterwegs→Geliefert) mit Supabase Realtime */}
      {order.isDelivery && order.orderId && (
        <Phase930DynamischeEtaLive
          orderId={order.orderId}
          initialStatus={order.status ?? 'neu'}
          initialEtaMin={order.etaMin ?? null}
        />
      )}
      {/* EtaLiveKommando: Sticky ETA-Zeitleiste mit 5-Schritt-Progress und Live-Countdown für Kunden (Phase878-Gruppe) */}
      {order.isDelivery && order.status && !['storniert', 'cancelled'].includes(order.status) && (
        <EtaLiveKommando
          status={order.status}
          etaEarliest={order.etaEarliest ?? null}
          etaLatest={null}
          bestellnummer={order.bestellnummer}
          sticky={false}
        />
      )}
      {/* Phase 845: Nachhaltigkeits-Badge — CO2-Ersparnisse durch Touren-Bündelung (Gamification) */}
      <Phase845NachhaltigkeitsBadge locationId={locationId} />
      {/* Phase 804: Liefer-Versprechen-Siegel — Dynamisches Vertrauens-Badge (Pünktlichkeit + Bewertung letzte 7d) */}
      <Phase804LieferVersprechenSiegel locationId={locationId} />
      {/* Phase 813: Kunden-Treuepunkte — Gesammelte Punkte + Einlöse-Möglichkeit beim Checkout */}
      <Phase813KundenTreuepunkte locationId={locationId} orderId={order.orderId ?? null} />
      {/* Phase 818: Echtzeit-Küchenstatus-Badge — Grün/Amber/Rot + Schätz-Wartezeit */}
      <Phase818KuechenStatusBadge locationId={locationId} />
      {/* Phase 823: Fahrer-Profil-Card — Anonymisiertes Fahrerprofil mit Bewertung + ETA während Lieferung */}
      <Phase823FahrerProfilCard orderId={order.orderId ?? null} />
      {/* Phase 828: Live-Bewertungs-Prompt — Sofort-Bewertungs-Modal nach Lieferung abgeschlossen */}
      <Phase828LiveBewertungsPrompt orderId={order.orderId ?? null} locationId={locationId} />
      {/* Phase 833: Lieferzeit-Countdown — Großer Countdown in Minuten für laufende Lieferung + Echtzeit-Update */}
      <Phase833LieferzeitCountdown
        orderId={order.orderId ?? null}
        etaEarliest={order.etaEarliest ?? null}
        status={order.status}
        isDelivery={order.isDelivery}
      />
      {/* Phase 829: Dynamische ETA Live-Panel — Große ETA-Zahl + Konfidenz + Phasen-Timeline, 30s Polling */}
      {order.isDelivery && order.orderId && !['geliefert', 'cancelled'].includes(order.status ?? '') && (
        <StorefrontPhase829DynamischeEtaLivePanel
          orderId={order.orderId}
          bestellnummer={order.bestellnummer}
          baseEtaMin={(order as any).etaMin ?? null}
          status={order.status}
        />
      )}
      {/* Phase 830: Live-Tracking-Panel — Fahrer-Status + ETA + Fortschritts-Timeline, 20s Polling */}
      {order.isDelivery && order.orderId && !['geliefert', 'storniert'].includes(order.status ?? '') && (
        <StorefrontPhase830LiveTrackingPanel
          orderId={order.orderId}
          status={order.status}
          fahrerName={(order as any).fahrerName ?? null}
          etaMin={(order as any).etaMin ?? null}
        />
      )}
      {/* Phase 834: Lieferstatus-Transparenz — Aufschlüsselung Küche + Fahrt + Puffer + Pünktlichkeitsrate */}
      <StorefrontPhase834LieferstatusTransparenz
        orderId={order.orderId ?? null}
        locationId={locationId}
        deliveryTimeMin={deliveryTimeMin}
        status={order.status}
      />
      {/* Phase 663: Küchen-Vertrauen-Badge — Live-Qualitäts-Siegel mit Rating und Küchenauslastung */}
      <Phase663KuechenVertrauenBadge locationId={locationId} />
      {/* Phase 668: Bestell-Status-Ampel — Kompakte Echtzeit-Küchenauslastungsanzeige als Ampel */}
      <Phase668BestellStatusAmpel locationId={locationId} />
      {/* Phase 673: Zonen-Lieferzeit-Differenzierung — ETAs je Lieferzone A/B/C/D */}
      <Phase673ZonenLieferzeit locationId={locationId} />
      {/* Phase 678: Vorbestellungs-Slotauswahl — Lieferzeit 30/60/90 Min im Voraus buchen */}
      <Phase678VorbestellungSlot locationId={locationId} />
      {/* Phase 690: Lieferzeitfenster-Wähler — Kunde wählt bevorzugtes Lieferzeitfenster */}
      {order.isDelivery && <Phase690LieferzeitfensterWaehler deliveryTimeMin={deliveryTimeMin} />}
      {/* Phase 683: Liefer-Qualitäts-Versprechen — Ø Bewertung + Pünktlichkeit + Küchenstatus live */}
      <Phase683LieferQualitaetsVersprechen locationId={locationId} />
      {/* Phase 684: Dynamische ETA-Anzeige — Live-ETA mit Konfidenzband und Phasen-Indikator */}
      {order.isDelivery && order.orderId && !['delivered', 'cancelled'].includes(order.status ?? '') && (
        <Phase684DynamischeEtaAnzeige orderId={order.orderId} locationId={locationId} />
      )}
      {/* Phase 685: Live-Tracking-Commander — Kompaktes Live-Tracking mit Fahrer-Puls und ETA-Countdown */}
      {order.isDelivery && order.orderId && order.status === 'on_route' && (
        <Phase685LiveTrackingCommander orderId={order.orderId} locationId={locationId} />
      )}
      {/* Phase 694: Live-ETA-Tracking — Dynamische ETA-Anzeige mit Countdown-Ring und Bestellphasen-Timeline */}
      {order.isDelivery && order.orderId && !['storniert', 'cancelled'].includes(order.status ?? '') && (
        <StorefrontPhase694LiveEtaTracking
          orderId={order.orderId}
          status={order.status ?? ''}
          etaEarliest={order.etaEarliest ?? null}
          etaLatest={null}
        />
      )}
      {/* Phase 632: Bestellhistorie-Kurzansicht — Zeigt Anzahl vergangener Bestellungen und letzte Bestellung */}
      <Phase632BestellhistorieKurzansicht locationId={locationId} />
      {/* Phase 645: Bewertungs-Aufforderungs-Banner — erscheint nach Lieferung, lädt zur Bewertung ein */}
      {order.isDelivery && order.status === 'delivered' && (
        <Phase645BewertungsAufforderungsBanner locationId={locationId} orderId={order.orderId} />
      )}
      {/* Phase 649: Live-Lieferzeit-Indikator — Dynamische ETA mit Fahrer-Auslastung und Trend */}
      {order.isDelivery && !['delivered', 'cancelled'].includes(order.status ?? '') && (
        <Phase649LiveLieferzeitIndikator locationId={locationId} defaultEtaMin={deliveryTimeMin} />
      )}
      {/* Phase 640: Lieferzeit-Transparenz-Widget — Erklärt ETA-Berechnung (Küche + Fahrt + Puffer) */}
      {order.isDelivery && (
        <Phase640LieferzeitTransparenzWidget deliveryTimeMin={deliveryTimeMin} />
      )}
      {/* Phase 624: Echtzeit-Warteschlangen-Indikator — aktuelle Küchenauslastung als Wartezeit */}
      {order.isDelivery && <Phase624WarteschlangenIndikator locationId={locationId} />}
      {/* Phase 629: Liefer-Qualitäts-Siegel — Gold/Silber/Standard basierend auf 7-Tage SLA */}
      {order.isDelivery && <Phase629LieferQualitaetsSiegel locationId={locationId} />}
      {/* Phase 630: Dynamische ETA-Anzeige — Kreisring-Countdown mit Statusanzeige und Live-Fortschritt */}
      {order.isDelivery && (
        <Phase630DynamischeEtaAnzeige
          orderId={order.orderId}
          status={order.status}
          initialEtaMin={(order as any).etaMin ?? null}
        />
      )}
      {/* Phase 631: Live-Tracking-Widget — Fahrer GPS-Tracking mit Sonar-Puls und ETA */}
      {order.isDelivery && (
        <Phase631LiveTrackingWidget orderId={order.orderId} locationId={locationId} />
      )}
      {/* Phase 269: Kompakte Fortschritts-Karte — Schritt-für-Schritt Visualisierung */}
      {order.isDelivery && (
        <BestellungFortschrittKarte
          orderId={order.orderId}
          initialStatus={order.status}
        />
      )}
      {/* Fahrer-Nähe-Live-Anzeige: Proximity-Ring + ETA-Countdown wenn Fahrer unterwegs ist */}
      {order.isDelivery && (
        <FahrerNaeheLiveAnzeige orderId={order.orderId} />
      )}
      {/* ETA-Live-Fortschritt-Banner: Animierter Stepper + Countdown-Bar + Fahrrad-Indikator */}
      {order.isDelivery && (
        <div className="mt-3">
          <EtaLiveFortschrittBanner
            orderId={order.orderId}
            initialStatus={order.status}
            initialEtaMin={order.etaMin ?? null}
          />
        </div>
      )}
      {/* Phase 604: Fahrer-Profil-Vorschau — kurze Info über den kommenden Fahrer (Name + Ø Bewertung + ETA) */}
      {order.isDelivery && (order.status === 'fertig' || order.status === 'in_lieferung' || order.status === 'unterwegs') && (
        <div className="mt-3">
          <Phase604FahrerProfilVorschau
            orderId={order.orderId}
            locationId={locationId}
          />
        </div>
      )}
      {/* Phase 422: Fahrer-Live-Karte — Leaflet-Karte mit Fahrer-Position + ETA wenn Status fertig/unterwegs */}
      {order.isDelivery && (
        <StorefrontFahrerKarte
          orderId={order.orderId}
          className="mt-3"
        />
      )}
      {/* ETA Live Tracker V2: Erweiterte Live-ETA mit Phase-Dots, Fahrer-Status und Ankunftszeit */}
      {order.isDelivery && (
        <EtaLiveTrackerV2
          orderId={order.orderId}
          initialStatus={order.status}
          bestellnummer={order.bestellnummer}
        />
      )}
      {/* Phase 409: ETA-Fortschritts-Leiste — Schritt-für-Schritt Bestellphasen-Visualisierung mit aktivem Puls */}
      {order.isDelivery && (
        <div className="mt-4">
          <EtaFortschrittsLeiste
            currentPhase={
              order.status === 'bestätigt' || order.status === 'bestaetigt' ? 'bestellt' :
              order.status === 'in_zubereitung' ? 'zubereitung' :
              order.status === 'fertig' ? 'abholung' :
              order.status === 'in_lieferung' || order.status === 'unterwegs' ? 'unterwegs' :
              order.status === 'geliefert' ? 'geliefert' : 'bestellt'
            }
          />
        </div>
      )}
      {/* Phase 410: Bestell-Echtzeit-Ampel — Kompakte Traffic-Light-Statusanzeige mit Zeitangaben */}
      {order.isDelivery && (
        <div className="mt-2">
          <BestellEchtzeitAmpel
            orderId={order.orderId}
            status={order.status}
            bestelltAm={order.placedAt ?? undefined}
            etaMin={order.etaMin ?? undefined}
          />
        </div>
      )}
      {/* Live-Timeline: Alle Phasen von Bestellung bis Lieferung mit Zeitstempeln + ETA-Countdown */}
      {order.isDelivery && (
        <BestellungLiveTimeline
          orderId={order.orderId}
          initialStatus={order.status}
          bestelltAm={order.placedAt ?? null}
          etaEarliest={order.etaEarliest ?? null}
          etaLatest={null}
        />
      )}
      {/* Bestellungs-Reise-Timeline: Visuelle Fortschritts-Steps von Bestätigt bis Geliefert mit ETA-Countdown */}
      <OrderJourneyTimeline
        status={order.status as any}
        bestellt_am={order.placedAt ?? null}
        geschaetzte_lieferung_min={order.etaMin ?? null}
        eta_min={
          order.etaEarliest
            ? Math.max(0, Math.round((new Date(order.etaEarliest).getTime() - Date.now()) / 60_000))
            : null
        }
        className="mt-3"
      />
    </div>
  );
}

/* ------------------------------ ActiveOrderBanner ------------------------------ */

type StoredOrder = {
  bestellnummer: string;
  orderId: string;
  isDelivery: boolean;
  placedAt: number;
  etaMs: number;
};

const TERMINAL_STATUSES = new Set(['geliefert', 'abgeholt', 'abgeschlossen', 'storniert']);

function ActiveOrderBanner({ locationId }: { locationId: string }) {
  const [stored, setStored] = React.useState<StoredOrder | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [etaMs, setEtaMs] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(Date.now());

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(`active_order:${locationId}`);
      if (!raw) return;
      const parsed: StoredOrder = JSON.parse(raw);
      // Drop orders older than 4 hours
      if (Date.now() - parsed.placedAt > 4 * 60 * 60_000) {
        localStorage.removeItem(`active_order:${locationId}`);
        return;
      }
      setStored(parsed);
      setEtaMs(parsed.etaMs);
    } catch {}
  }, [locationId]);

  // Poll status every 30s while visible
  React.useEffect(() => {
    if (!stored || dismissed) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/delivery/orders/${stored.orderId}/tracking`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (cancelled) return;
        const s = d.status ?? null;
        setStatus(s);
        if (d.eta_earliest) setEtaMs(new Date(d.eta_earliest).getTime());
        // Clear localStorage once delivered
        if (s && TERMINAL_STATUSES.has(s)) {
          setTimeout(() => {
            try { localStorage.removeItem(`active_order:${locationId}`); } catch {}
          }, 8_000);
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [stored, dismissed, locationId]);

  // Second ticker for live countdown
  React.useEffect(() => {
    if (!stored || dismissed) return;
    const t = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [stored, dismissed]);

  if (!stored || dismissed) return null;
  if (status && TERMINAL_STATUSES.has(status) && nowMs - (stored.placedAt ?? 0) > 10_000) return null;

  const secsLeft = etaMs != null ? Math.max(0, Math.floor((etaMs - nowMs) / 1000)) : null;
  const minsLeft = secsLeft != null ? Math.floor(secsLeft / 60) : null;
  const isDelivered = status && TERMINAL_STATUSES.has(status);

  const statusLabel: Record<string, string> = {
    neu: 'Eingegangen',
    bestätigt: 'Bestätigt',
    in_zubereitung: 'Wird zubereitet',
    fertig: stored.isDelivery ? 'Bereit zur Abholung' : 'Abholbereit',
    unterwegs: 'Unterwegs zu dir',
    geliefert: 'Geliefert! 🎉',
    abgeholt: 'Abgeholt! 🎉',
    storniert: 'Storniert',
  };
  const currentLabel = status ? (statusLabel[status] ?? status) : 'Wird bearbeitet…';

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 mt-3">
      <div className={cn(
        'rounded-xl border px-4 py-3 flex items-center gap-3',
        isDelivered
          ? 'bg-matcha-50 border-matcha-200'
          : 'bg-amber-50 border-amber-200',
      )}>
        <span className="text-xl shrink-0">{isDelivered ? '✅' : '🛵'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'font-bold text-sm',
              isDelivered ? 'text-matcha-700' : 'text-amber-800',
            )}>
              {currentLabel}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground font-mono">{stored.bestellnummer}</span>
            {!isDelivered && secsLeft != null && secsLeft > 0 && minsLeft != null && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums border',
                  minsLeft <= 5
                    ? 'bg-matcha-100 border-matcha-300 text-matcha-700'
                    : 'bg-amber-100 border-amber-300 text-amber-800',
                )}>
                  <span className={cn(
                    'relative flex h-1.5 w-1.5 shrink-0',
                  )}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  {minsLeft > 0 ? `~${minsLeft} Min` : 'Jeden Moment!'}
                </span>
              </>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <a
              href={`/track/${stored.bestellnummer}`}
              className={cn(
                'text-xs font-semibold underline underline-offset-2',
                isDelivered ? 'text-matcha-600' : 'text-amber-700',
              )}
            >
              Bestellung verfolgen →
            </a>
          </div>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            try { localStorage.removeItem(`active_order:${locationId}`); } catch {}
          }}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-black/5 transition"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ LiveEtaBar ------------------------------ */

type EtaLoad = 'quiet' | 'normal' | 'busy';

function LiveEtaBar({ locationId, baseEtaMin }: { locationId: string; baseEtaMin: number }) {
  const [etaMin, setEtaMin] = React.useState<number>(baseEtaMin);
  const [load, setLoad] = React.useState<EtaLoad>('normal');
  const [activeCount, setActiveCount] = React.useState<number | null>(null);
  const [driversOnline, setDriversOnline] = React.useState<number | null>(null);
  const [signalMessage, setSignalMessage] = React.useState<string | null>(null);
  const [etaExtension, setEtaExtension] = React.useState<number>(0);
  const [queueSignal, setQueueSignal] = React.useState<string>('normal');
  const [loaded, setLoaded] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(Date.now());

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        setEtaMin(d.eta_min ?? baseEtaMin);
        setLoad(d.load ?? 'normal');
        if (d.active_orders != null) setActiveCount(d.active_orders);
        if (d.drivers_online != null) setDriversOnline(d.drivers_online);
        setSignalMessage(d.signal_message ?? null);
        setEtaExtension(d.eta_extension_min ?? 0);
        setQueueSignal(d.queue_signal ?? 'normal');
        setLoaded(true);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    // Sekundengenauer Countdown
    const tickIv = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(tickIv); };
  }, [locationId, baseEtaMin]);

  if (!loaded) return null;

  const meta = {
    quiet:  { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200',   label: 'Küche frei',          emoji: '✨' },
    normal: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200',   label: 'Normale Auslastung',  emoji: '👌' },
    busy:   { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50 border-red-200',       label: 'Hohe Auslastung',     emoji: '🔥' },
  }[load];

  // ETA range: +/- 5 min
  const etaFrom = Math.max(10, etaMin - 5);
  const etaTo   = etaMin + 5;

  // Load bar: map etaMin to a 0-100 scale (20min = 0%, 60min = 100%)
  const barPct = Math.min(100, Math.max(0, Math.round(((etaMin - 20) / 40) * 100)));
  const barColor =
    load === 'quiet' ? 'bg-green-400' :
    load === 'normal' ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 mt-3">
      <div className={cn('rounded-xl border px-4 py-3', meta.bg)}>
        <div className="flex items-center gap-3">
          <span className="text-lg shrink-0">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('font-bold text-sm', meta.text)}>{meta.label}</span>
              <span className="text-muted-foreground text-xs">·</span>
              <span className={cn('font-display font-black text-base tabular-nums', meta.text)}>
                {etaFrom}–{etaTo} Min
              </span>
              {activeCount != null && activeCount > 0 && (
                <>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    activeCount >= 10 ? 'bg-red-100 text-red-700' :
                    activeCount >= 5  ? 'bg-amber-100 text-amber-700' :
                    'bg-muted text-muted-foreground',
                  )}>
                    <span className="font-black tabular-nums">{activeCount}</span>
                    {activeCount === 1 ? ' Bestellung in der Küche' : ' Bestellungen in der Küche'}
                  </span>
                </>
              )}
              {driversOnline != null && driversOnline > 0 && (
                <>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    driversOnline >= 3 ? 'bg-green-100 text-green-700' :
                    driversOnline >= 1 ? 'bg-blue-50 text-blue-700' :
                    'bg-muted text-muted-foreground',
                  )}>
                    🛵 <span className="font-black tabular-nums">{driversOnline}</span>
                    {driversOnline === 1 ? ' Fahrer aktiv' : ' Fahrer aktiv'}
                  </span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              {/* Absolute delivery time window + live countdown (sekundengenau) */}
              {(() => {
                const fromMs = nowMs + etaFrom * 60_000;
                const toMs   = nowMs + etaTo   * 60_000;
                const fmt = (ms: number) =>
                  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                const cdSec = Math.max(0, Math.floor((fromMs - nowMs) / 1000));
                const cdMin = Math.floor(cdSec / 60);
                const cdS   = cdSec % 60;
                return (
                  <>
                    <span className={cn('text-xs font-semibold tabular-nums', meta.text)}>
                      Ankunft ~{fmt(fromMs)}–{fmt(toMs)} Uhr
                    </span>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums border',
                      load === 'quiet'  ? 'border-green-300 bg-green-100 text-green-700' :
                      load === 'normal' ? 'border-amber-300 bg-amber-100 text-amber-700' :
                      'border-red-300 bg-red-100 text-red-700',
                    )}>
                      <span className="relative flex h-1.5 w-1.5 mr-0.5">
                        <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', meta.dot)} />
                        <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', meta.dot)} />
                      </span>
                      {cdMin > 0 ? `${cdMin}:${String(cdS).padStart(2, '0')} Min` : `${cdSec}s`}
                    </span>
                  </>
                );
              })()}
            </div>
            {/* Queue-Signal: Lieferung pausiert */}
            {queueSignal === 'paused' && (
              <div className="mt-1 text-xs font-bold rounded-md px-2 py-1 flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700">
                <span>🚫</span>
                <span>{signalMessage ?? 'Lieferung momentan nicht möglich — bitte später versuchen'}</span>
              </div>
            )}
            {/* Queue-Signal-Meldung: manuelle Nachricht aus dem Backoffice */}
            {queueSignal !== 'paused' && signalMessage && etaExtension > 0 && (
              <div className={cn('mt-1 text-xs font-medium rounded-md px-2 py-1 flex items-center gap-1.5', meta.bg, 'border', meta.text)}>
                <span>⚠️</span>
                <span>{signalMessage}</span>
              </div>
            )}
            {/* Auslastungs-Balken */}
            <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', barColor)}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', meta.dot)} />
              <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', meta.dot)} />
            </span>
            Live
          </span>
        </div>
      </div>
    </div>
  );
}
