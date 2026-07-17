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
import { StorefrontPhase997DynamischeEtaLiveCockpit } from './phase997-dynamische-eta-live-cockpit';
import { StorefrontPhase998DynamischeEtaLiveTrackingUltra } from './phase998-dynamische-eta-live-tracking-ultra';
import { Phase999LiveTrackingEtaKommando } from './phase999-live-tracking-eta-kommando';
import { Phase1000LiveBestellstatusTimelinePro } from './phase1000-live-bestellstatus-timeline-pro';
import { StorefrontPhase1006KuechenAuslastungsAnzeige } from './phase1006-kuechen-auslastungs-anzeige';
import { StorefrontPhase1011BestellabbruchPraevention } from './phase1011-bestellabbruch-praevention';
import { EtaDynamischLiveKommando } from './phase1017-eta-dynamisch-live-kommando';
import { Phase1022BewertungsSchnellWidget } from './phase1022-bewertungs-schnell-widget';
import { BestellungsEtaVorschauBand } from './bestellungs-eta-vorschau-band';
import { LiveEtaTracker900 } from './phase900-live-eta-tracker';
import { StorefrontPhase1022EtaLiveTrackingKommando } from './phase1022-eta-live-tracking-kommando';
import { StorefrontPhase1023EtaLiveTrackingPro } from './phase1023-eta-live-tracking-pro';
import { Phase1027StammkundenBadge } from './phase1027-stammkunden-badge';
import { Phase1032LieferzeitErwartungsManager } from './phase1032-lieferzeit-erwartungs-manager';
import { StorefrontPhase1037ProduktbewertungsWidget } from './phase1037-produktbewertungs-widget';
import { Phase1042LiveEtaFahrerAnnaeherungsPanel } from './phase1042-live-eta-fahrer-annaeherungs-panel';
import { Phase1047WarenkorbUpsellWidget } from './phase1047-warenkorb-upsell-widget';
import { useMerkzettel, Phase1052MerkzettelWidget } from './phase1052-merkzettel-widget';
import { Phase1057TrendingBanner } from './phase1057-live-popularitaets-ranking';
import { Phase1067EchtzeitLieferstatusKarte } from './phase1067-echtzeit-lieferstatus-karte';
import { Phase1072BestellhistorieWidget } from './phase1072-bestellhistorie-widget';
import { Phase1077LiefergebietChecker } from './phase1077-liefergebiet-checker';
import { Phase1082PushOptInBanner } from './phase1082-push-opt-in-banner';
import { Phase1087BewertungsErinnerung } from './phase1087-bewertungs-erinnerung';
import { Phase1092GruppenBestellungsBanner } from './phase1092-gruppen-bestellungs-banner';
import { Phase1097ErstbestellungBonusBanner } from './phase1097-erstbestellung-bonus-banner';
import { Phase1102NaechsteLieferfenster } from './phase1102-naechste-lieferfenster';
import { Phase1107KategorieSchnellnavigation } from './phase1107-kategorie-schnellnavigation';
import { Phase1112WartezeitFortschrittsRing } from './phase1112-wartezeit-fortschritts-ring';
import { Phase1117HaeufigZusammenBestellt } from './phase1117-haeufig-zusammen-bestellt';
import { Phase1122AehnlicheProdukte } from './phase1122-aehnliche-produkte';
import { Phase1127BestellzeitOptimierer } from './phase1127-bestellzeit-optimierer';
import { Phase1132LiefergebietPruefer } from './phase1132-liefergebiet-pruefer';
import { LiveEtaTracker } from './live-eta-tracker';
import { Phase1133SchnellReorder, saveOrderForReorder } from './phase1133-schnell-reorder';
import { Phase1138LieferstatusBanner } from './phase1138-lieferstatus-banner';
import { Phase1143BestellwertMeilenstein } from './phase1143-bestellwert-meilenstein';
import { Phase1147KuechenAuslastungsWarnung } from './phase1147-kuechen-auslastungs-warnung';
import { Phase1153BestellhistorieSchnellzugriff, saveBestellhistorie } from './phase1153-bestellhistorie-schnellzugriff';
import { Phase1158DynamischeEtaLiveCockpit } from './phase1158-dynamische-eta-live-cockpit';
import { Phase1163DynamischeEtaLivePanel } from './phase1163-dynamische-eta-live-panel';
import { Phase1168LiveTrackingFahrerBoard } from './phase1168-live-tracking-fahrer-board';
import { Phase1173BestellstatusLiveKommando } from './phase1173-bestellstatus-live-kommando';
import { Phase1179BestellstatusKarte } from './phase1179-bestellstatus-karte';
import { Phase1183EtaKonfidenzLivePanel } from './phase1183-eta-konfidenz-live-panel';
import { Phase1184EtaLiveTrackingBoard } from './phase1184-eta-live-tracking-board';
import { Phase1192BewertungsAufforderung } from './phase1192-bewertungs-aufforderung';
import { Phase1197RabattschwellenBanner } from './phase1197-rabattschwellen-banner';
import { Phase1202WarteschlangenPosition } from './phase1202-warteschlangen-position';
import { Phase1207LiveKuechenAuslastungsIndikator } from './phase1207-live-kuechen-auslastungs-indikator';
import { StorefrontPhase1207DynamischeEtaLiveTracking } from './phase1207-dynamische-eta-live-tracking';
import { Phase1215SocialProofBanner } from './phase1215-social-proof-banner';
import { Phase1220WarenkorbSpeicherBanner } from './phase1220-warenkorb-speicher-banner';
import { Phase1225LieferfensterAuswahlWidget } from './phase1225-lieferfenster-auswahl-widget';
import { Phase1235LieferVersprechenBanner } from './phase1235-liefer-versprechen-banner';
import { Phase1250GruppenbestellungBanner } from './phase1250-gruppenbestellung-banner';
import { Phase1255BewertungsKarussell } from './phase1255-bewertungs-karussell';
import { Phase1265LieferStatusProgress } from './phase1265-liefer-status-progress';
import { Phase1270ArtikelBeliebtheitsBadge } from './phase1270-artikel-beliebtheitsbadge';
import { Phase1275MindestbestellwertProgress } from './phase1275-mindestbestellwert-progress';
import { Phase1280LiefergebietPruefung } from './phase1280-liefergebiet-pruefung';
import { Phase1303BewertungsAbgabeWidget } from './phase1303-bewertungs-abgabe-widget';
import { Phase1308WartezeitTransparenzBanner } from './phase1308-wartezeit-transparenz-banner';
import { Phase1313LieferEtaAnzeige } from './phase1313-liefer-eta-anzeige';
import { Phase1318Beliebtheitsbadge } from './phase1318-beliebtheitsbadge';
import { Phase1323BestellstatusPushBanner } from './phase1323-bestellstatus-push-banner';
import { StorefrontPhase1315DynamischeEtaLiveUltra } from './phase1315-dynamische-eta-live-ultra';
import { Phase1328LieferstatusFortschrittsLeiste } from './phase1328-lieferstatus-fortschritts-leiste';
import { StorefrontPhase1325LiveEtaTrackingUltra } from './phase1325-live-eta-tracking-ultra';
import { StorefrontPhase1355TreueBadgeWidget } from './phase1355-treue-badge-widget';
import { StorefrontPhase1360EchtzeitLieferstatusKarte } from './phase1360-echtzeit-lieferstatus-karte';
import { StorefrontPhase1365WarenkorbLieferzeitschaetzung } from './phase1365-warenkorb-lieferzeitschaetzung';
import { StorefrontPhase1370AktiveBestellungenHinweis } from './phase1370-aktive-bestellungen-hinweis';
import { StorefrontPhase1375FruehbucherPreisvorteilBanner } from './phase1375-fruehbucher-preisvorteil-banner';
import { StorefrontPhase1380DynamischeEtaLiveTrackingCockpit } from './phase1380-dynamische-eta-live-tracking-cockpit';
import { StorefrontPhase1385WetterLieferzeitHinweis } from './phase1385-wetter-lieferzeit-hinweis';
import { StorefrontPhase1389LiveTrackingEtaCockpit } from './phase1389-live-tracking-eta-cockpit';
import { StorefrontPhase1394BestellhistorieSchnellreorder } from './phase1394-bestellhistorie-schnellreorder';
import { StorefrontPhase1399BestellstatusLiveTicker } from './phase1399-bestellstatus-live-ticker';
import { StorefrontPhase1404AngebotsCountdownBanner } from './phase1404-angebots-countdown-banner';
import { StorefrontPhase1409BestUebersichtMiniatur } from './phase1409-bestell-uebersicht-miniatur';
import { StorefrontPhase1414LiveWarteschlangenIndikator } from './phase1414-live-warteschlangen-indikator';
import { StorefrontPhase1419LieferEtaVerfeinerungsBadge } from './phase1419-liefer-eta-verfeinerungs-badge';
import { StorefrontPhase1424NaechsteLieferungHinweis } from './phase1424-naechste-lieferung-hinweis';
import { StorefrontPhase1429PlzLiefercheck } from './phase1429-plz-liefercheck';
import { StorefrontPhase1434LieferzonenKarte } from './phase1434-lieferzonen-karte';
import { BestellstatusLiveKarte } from './phase1438-bestellstatus-live-karte';
import { BestellkorbTimeoutWarnung } from './phase1443-bestellkorb-timeout-warnung';
import { TreuePunkteAnzeige } from './phase1448-treue-punkte-anzeige';
import { BestellhistorieMiniWidget } from './phase1453-bestellhistorie-mini-widget';
import { BestellstatusLiveTracker } from './phase1454-bestellstatus-live-tracker';
import { StorefrontPhase1458TreueProgrammEinladung } from './phase1458-treue-programm-einladung';
import { DynamischeEtaAnzeige } from './phase1459-dynamische-eta-anzeige';
import { StorefrontPhase1464LieferVersprechenBanner } from './phase1464-liefer-versprechen-banner';
import { StorefrontPhase1469LieferTransparenzStatus } from './phase1469-liefer-transparenz-status';
import { StorefrontPhase1471DynamischeEtaAnzeige } from './phase1471-dynamische-eta-anzeige';
import { StorefrontPhase1475BenachrichtigungsOptIn } from './phase1475-benachrichtigungs-opt-in';
import { StorefrontPhase1480LieferzeitGarantieVersprechen } from './phase1480-lieferzeit-garantie-versprechen';
import { StorefrontPhase1485BestellstatusProgressRing } from './phase1485-bestellstatus-progress-ring';
import { StorefrontPhase1490MindestbestellwertBadge } from './phase1490-mindestbestellwert-badge';
import { StorefrontPhase1495DynamischeEtaKonfidenzBar } from './phase1495-dynamische-eta-konfidenz-bar';
import { StorefrontPhase1501EchtzeitFahrerAnnaeherungsIndikator } from './phase1501-echtzeit-fahrer-annaeherungs-indikator';
import { StorefrontPhase1506LiefergebietPruefungsBadge } from './phase1506-liefergebiet-pruefungs-badge';
import { StorefrontPhase1505DynamischeEtaLiveTracker } from './phase1505-dynamische-eta-live-tracker';
import { StorefrontPhase1511BestellstatusVerlaufsBadge } from './phase1511-bestellstatus-verlaufs-badge';
import { StorefrontPhase1516AktionsBannerTicker } from './phase1516-aktions-banner-ticker';
import { StorefrontPhase1521BeliebtArtikelChips } from './phase1521-beliebte-artikel-chips';
import { Phase1000DynamischeEtaLiveCockpit } from './phase1000-dynamische-eta-live-cockpit';
import { StorefrontPhase1527LiveEtaTrackingKommando } from './phase1527-live-eta-tracking-kommando';
import { StorefrontPhase1531WarenkorbErinnerungsBanner } from './phase1531-warenkorb-erinnerungs-banner';
import { StorefrontPhase1536LieferzeitCountdownBanner } from './phase1536-lieferzeit-countdown-banner';
import { StorefrontPhase1541MindestbestellwertFortschritt } from './phase1541-mindestbestellwert-fortschritt';
import { StorefrontPhase1546LieferfensterAuswahl } from './phase1546-lieferfenster-auswahl';
import { StorefrontPhase1551BewertungsTeaser } from './phase1551-bewertungs-teaser';
import { StorefrontPhase1551FahrerProfilVorschau } from './phase1551-fahrer-profil-vorschau';
import { StorefrontPhase1556LiefergebietInfoBadge } from './phase1556-liefergebiet-info-badge';
import { StorefrontPhase1561BestellbestaetiguFortschrittsleiste } from './phase1561-bestellbestaetigung-fortschrittsleiste';
import { StorefrontPhase1566EmpfohleneArtikelChips } from './phase1566-empfohlene-artikel-chips';
import { StorefrontPhase1571AktionsBadge } from './phase1571-aktions-badge';
import { StorefrontPhase1571LieferzeitEchtzeitTicker } from './phase1571-lieferzeit-echtzeit-ticker';
import { StorefrontPhase1576LieferzeitEchtzeitTicker } from './phase1576-lieferzeit-echtzeit-ticker';
import { StorefrontPhase1581LieferzeitGarantieVersprechen } from './phase1581-lieferzeit-garantie-versprechen';
import { Phase1002DynamischeEtaLiveCockpit } from './phase1002-dynamische-eta-live-cockpit';
import { StorefrontPhase1586DynamischeEtaLiveUltimate } from './phase1586-dynamische-eta-live-ultimate';
import { StorefrontPhase1591TreueprogrammFortschrittsWidget } from './phase1591-treueprogramm-fortschritts-widget';
import { StorefrontPhase1601LiefergebietLiveStatus } from './phase1601-liefergebiets-live-status';
import { StorefrontPhase1606ProduktempfehlungUpsellBanner } from './phase1606-produktempfehlung-upsell-banner';
import { StorefrontPhase1611LetzteBestellungenSchnellzugang } from './phase1611-letzte-bestellungen-schnellzugang';
import { StorefrontPhase1616MenuBeliebtheitsBadge } from './phase1616-menu-beliebtheitsbadges';
import { StorefrontPhase1621EchtzeitKuechenstatusTicker } from './phase1621-echtzeit-kuechenstatus-ticker';
import { StorefrontPhase1626WartezeitTransparenzWidget } from './phase1626-wartezeit-transparenz-widget';
import { Phase1631DynamischeEtaLiveUltima } from './phase1631-dynamische-eta-live-ultima';
import { Phase1635BestellbestaetigungKonfettiOverlay } from './phase1635-bestellbestaetigung-konfetti-overlay';
import { Phase1640AllergenHinweisModal } from './phase1640-allergen-hinweis-modal';
import { Phase1645OeffnungszeitenStatusBanner } from './phase1645-oeffnungszeiten-status-banner';
import { StorefrontPhase1650LiveLieferungStatusCockpit } from './phase1650-live-lieferung-status-cockpit';
import { StorefrontPhase1655LieferzoneVisualisierungsBanner } from './phase1655-lieferzone-visualisierungs-banner';
import { StorefrontPhase1661LieferQualitaetsSiegel } from './phase1661-liefer-qualitaets-siegel';
import { StorefrontPhase1671LieferGarantieTimer } from './phase1671-liefer-garantie-timer';
import { StorefrontPhase1671BestellStatusMiniLeiste } from './phase1671-bestell-status-mini-leiste';
import { StorefrontPhase1676KapazitaetsAmpelBadge } from './phase1676-kapazitaets-ampel-badge';
import { StorefrontPhase1680DynamicEtaLiveUltimate } from './phase1680-dynamic-eta-live-ultimate';
import { StorefrontPhase1681NachhaltigkeitsBadge } from './phase1681-nachhaltigkeits-badge';
import { StorefrontPhase1686QualitaetsScoreBanner } from './phase1686-qualitaets-score-banner';
import { StorefrontPhase1691LiveWarteschlangenAnzeige } from './phase1691-live-warteschlangen-anzeige';
import { StorefrontPhase1696BestellstatusMiniTracker } from './phase1696-bestellstatus-mini-tracker';
import { StorefrontPhase1701KundenbewertungsSnapshotStrip } from './phase1701-kundenbewertungs-snapshot-strip';
import { Phase1000LiveTrackingStatus } from './phase1000-live-tracking-status';
import { StorefrontPhase1697EtaCountdownBanner } from './phase1697-eta-countdown-banner';
import { StorefrontPhase1706LieferzeitGarantieCountdownBadge } from './phase1706-lieferzeit-garantie-countdown-badge';
import { StorefrontPhase1710DynamischeEtaLiveTrackingCockpit } from './phase1710-dynamische-eta-live-tracking-cockpit';
import { StorefrontPhase1716BeliebtsteGerichteStrip } from './phase1716-beliebteste-gerichte-strip';
import { StorefrontPhase1721LieferAmpelStatus } from './phase1721-liefer-ampel-status';
import { StorefrontPhase1726DynamischerLieferEtaBadge } from './phase1726-dynamischer-liefer-eta-badge';
import { StorefrontPhase1717EchtzeitNachfrageIndikator } from './phase1717-echtzeit-nachfrage-indikator';
import { StorefrontPhase1722DynamischeEtaLiveStatusBoard } from './phase1722-dynamische-eta-live-status-board';
import { StorefrontPhase1731LieferzeitGarantieUhr } from './phase1731-lieferzeit-garantie-uhr';
import { StorefrontPhase1736BestellbestaetigungFortschrittsleiste } from './phase1736-bestellbestaetigung-fortschrittsleiste';
import { StorefrontPhase1741LiveFahrerNaehHerungsIndikator } from './phase1741-live-fahrer-naeherungs-indikator';
import { StorefrontPhase1746BestellmusterZeitfensterHinweis } from './phase1746-bestellmuster-zeitfenster-hinweis';
import { StorefrontPhase1751LieferVertrauensScoreBadge } from './phase1751-liefer-vertrauens-score-badge';
import { StorefrontPhase1756EchtzeitKuechenStatusBadge } from './phase1756-echtzeit-kuechen-status-badge';
import { StorefrontPhase1761LieferZufriedenheitsGarantieBadge } from './phase1761-liefer-zufriedenheits-garantie-badge';
import { StorefrontPhase1765DynamischeEtaLiveTrackingRing } from './phase1765-dynamische-eta-live-tracking-ring';
import { StorefrontPhase1770NachhaltigkeitsLieferBadge } from './phase1770-nachhaltigkeits-liefer-badge';
import { StorefrontPhase1775FahrerProfilBadge } from './phase1775-fahrer-profil-badge';
import { StorefrontPhase1780EchtzeitKuechenStatusIndikator } from './phase1780-echtzeit-kuechen-status-indikator';
import { StorefrontPhase1785LieferdienstOeffnungszeitenIndikator } from './phase1785-lieferdienst-oeffnungszeiten-indikator';
import { StorefrontPhase1790DynamischeLieferzeitSchaetzung } from './phase1790-dynamische-lieferzeit-schaetzung';
import { StorefrontPhase1794LiveEtaFahrerNaeheCockpit } from './phase1794-live-eta-fahrer-naehe-cockpit';
import { StorefrontPhase1800QualitaetsVersprechenBadge } from './phase1800-qualitaets-versprechen-badge';
import { StorefrontPhase1804BestellPhasenCockpit } from './phase1804-bestell-phasen-cockpit';
import { StorefrontPhase1815DynamischeEtaLiveTrackerIntegration } from './phase1815-dynamische-eta-live-tracker-integration';
import { StorefrontPhase1820LieferzeitGarantieCountdownV2 } from './phase1820-lieferzeit-garantie-countdown-v2';
import { StorefrontPhase1825EchtzeitKuechenStatusAnzeige } from './phase1825-echtzeit-kuechenstatus-anzeige';
import { StorefrontPhase1830LiefergebietLiveKarte } from './phase1830-liefergebiet-live-karte';
import { StorefrontPhase1835LiveFahrerScoreBadge } from './phase1835-live-fahrer-score-badge';
import { StorefrontPhase1840LieferzeitSlaGarantie } from './phase1840-lieferzeit-sla-garantie';
import { StorefrontPhase1845KuechenAuslastungsBadge } from './phase1845-kuechen-auslastungs-badge';
import { StorefrontPhase1850DynamischeETALiveTrackingBoard } from './phase1850-dynamische-eta-live-tracking-board';
import { StorefrontPhase1855KuechenStatusBanner } from './phase1855-kuechen-status-banner';
import { StorefrontPhase1860FahrerOnlineZaehler } from './phase1860-fahrer-online-zaehler';
import { StorefrontPhase1870LieferzeitVertrauensbadge } from './phase1870-lieferzeit-vertrauensbadge';
import { StorefrontPhase1876ZonenVerfuegbarkeitsHinweis } from './phase1876-zonen-verfuegbarkeits-hinweis';
import { StorefrontPhase1865LiveTrackingETACockpit } from './phase1865-live-tracking-eta-cockpit';
import { StorefrontPhase1866EchtzeitLieferstatusCockpitV2 } from './phase1866-echtzeit-lieferstatus-cockpit-v2';
import { StorefrontPhase1871DynamischeEtaLiveFortschrittsleiste } from './phase1871-dynamische-eta-live-fortschrittsleiste';
import { LiveDeliveryCommand } from './components/live-delivery-command';
import { Phase1877EtaLieferfensterLive } from './phase1877-eta-lieferfenster-live';
import { StorefrontPhase1881GratisLieferungsSchwelle } from './phase1881-gratis-lieferungs-schwelle';
import { StorefrontPhase1886ZonenEtaVergleichsBanner } from './phase1886-zonen-eta-vergleichs-banner';
import { StorefrontPhase1891ZonenSonderAngebotBanner } from './phase1891-zonen-sonder-angebot-banner';
import { StorefrontPhase1892DynamischeEtaLiveTrackingUltra } from './phase1892-dynamische-eta-live-tracking-ultra';
import { StorefrontPhase1896LiefergeschwindigkeitTestimonialWidget } from './phase1896-liefergeschwindigkeit-testimonial-widget';
import { StorefrontPhase1893BestellstatusPhasenLeiste } from './phase1893-bestellstatus-phasen-leiste';
import { StorefrontPhase1901FahrerAnfahrtsEtaKarte } from './phase1901-fahrer-anfahrts-eta-karte';
import { StorefrontPhase1906FahrerProfilMiniCard } from './phase1906-fahrer-profil-mini-card';
import { StorefrontPhase1911LieferzuverlaessigkeitsWidget } from './phase1911-lieferzuverlaessigkeits-widget';
import { Phase1916FahrerQualitaetsSiegel } from './phase1916-fahrer-qualitaets-siegel';
import { Phase1921ZonenLieferzeitBadge } from './phase1921-zonen-lieferzeit-badge';
import { Phase1926LiveKuechenstatusIndikator } from './phase1926-live-kuechenstatus-indikator';
import { Phase1931BestellverfolgungFortschrittsring } from './phase1931-bestellverfolgung-fortschrittsring';
import { Phase1936BewertungsSocialProofBanner } from './phase1936-bewertungs-social-proof-banner';
import { Phase1941NachhaltigkeitBadge } from './phase1941-nachhaltigkeit-badge';
import Phase1946BestellzahlHeuteBadge from './phase1946-bestellzahl-heute-badge';
import Phase1951EchtzeitWartezeitIndikator from './phase1951-echtzeit-wartezeit-indikator';
import { Phase1952EchtzeitEtaAnzeigePro } from './phase1952-echtzeit-eta-anzeige-pro';
import { StorefrontPhase2000LiveLieferungsKommandant } from './phase2000-live-lieferungs-kommandant';
import { StorefrontPhase2001VertrauensLieferzeitBadge } from './phase2001-vertrauens-lieferzeit-badge';
import { StorefrontPhase2005LiveVertrauensBalken } from './phase2005-live-vertrauens-balken';
import { StorefrontPhase2010LieferzeitKonfidenzBadge } from './phase2010-lieferzeit-konfidenz-badge';
import { StorefrontPhase2011DynamischeEtaCountdownBoard } from './phase2011-dynamische-eta-countdown-board';
import { StorefrontPhase2012LiveTrackingStatusKarte } from './phase2012-live-tracking-status-karte';
import { StorefrontPhase2013FahrerAnkunftLiveWidget } from './phase2013-fahrer-ankunft-live-widget';
import { StorefrontPhase2018LiefereffizienzSiegel } from './phase2018-liefereffizienz-siegel';
import { StorefrontPhase2023LieferkapazitaetsIndikator } from './phase2023-lieferkapazitaets-indikator';
import { StorefrontPhase2028LieferzeitVersprechenBadge } from './phase2028-lieferzeit-versprechen-badge';
import { StorefrontPhase2034LieferzuverlaessigkeitsGarantieBadge } from './phase2034-lieferzuverlaessigkeits-garantie-badge';
import { StorefrontPhase2039KundenbewertungsVertrauensBadge } from './phase2039-kundenbewertungs-vertrauens-badge';
import { StorefrontPhase2044PuenktlichkeitsBadge } from './phase2044-puenktlichkeits-badge';
import { StorefrontPhase2052StammkundenBegruessung } from './phase2052-stammkunden-begruessung';
import { StorefrontPhase2058BlitzschnellBadge } from './phase2058-blitzschnell-badge';
import { StorefrontPhase2060DynamischeEtaLiveTracking } from './phase2060-dynamische-eta-live-tracking';
import { StorefrontPhase2063FrischeGarantieBadge } from './phase2063-frische-garantie-badge';
import { StorefrontPhase2068NachhaltigkeitsBadge } from './phase2068-nachhaltigkeits-badge';
import { StorefrontPhase2074LiefergebietBadge } from './phase2074-liefergebiet-badge';
import { StorefrontPhase2079LieferzeitGarantieBanner } from './phase2079-lieferzeit-garantie-banner';
import { StorefrontPhase2090BeliebtBestellzeitBadge } from './phase2090-beliebte-bestellzeit-badge';
import { StorefrontPhase2095QualitaetsVertrauenBadge } from './phase2095-qualitaets-vertrauen-badge';
import { Phase1000EtaLiveTrackingUltraPro } from './phase1000-eta-live-tracking-ultra-pro';
import { Phase2200SmartEtaTrackingHub } from './phase2200-smart-eta-tracking-hub';
import { StorefrontPhase2100LiefergeschwindigkeitsBadge } from './phase2100-liefergeschwindigkeits-badge';
import { StorefrontPhase2106FahrerBewertungsBadge } from './phase2106-fahrer-bewertungs-badge';
import { StorefrontPhase2111TourZuverlaessigkeitsBadge } from './phase2111-tour-zuverlaessigkeits-badge';
import { StorefrontPhase2116LieferzoneStatusPill } from './phase2116-lieferzone-status-pill';
import { StorefrontPhase2121PuenktlichkeitsBadge } from './phase2121-puenktlichkeits-badge';

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
  const [allergenItem, setAllergenItem] = React.useState<MenuItem | null>(null);
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
  // Phase 1052: Merkzettel — localStorage-persistente Wunschliste
  const merkzettel = useMerkzettel();
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
  // PLZ aus Checkout für Liefergebiet-Badge (Phase 1506)
  const [deliveryPlz, setDeliveryPlz] = React.useState<string>('');
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

  const restoreCart = React.useCallback((items: CartItem[]) => {
    setCart(items);
  }, []);

  const [selectedDeliverySlot, setSelectedDeliverySlot] = React.useState<string | null>(null);

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
      // Phase 1133: Schnell-Reorder — letzte Bestellung für 1-Klick-Wiederbestellung speichern
      saveOrderForReorder(cart as any, location.id);
      // Phase 1153: Bestellhistorie-Schnellzugriff — Bestellung in localStorage persistieren
      saveBestellhistorie({
        id: order.id,
        datum: new Date().toISOString(),
        artikel: cart.map(c => c.item.name ?? '').filter(Boolean),
        gesamtpreis: cart.reduce((s, c) => s + c.item.preis * c.qty, 0),
        items: cart as any,
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
  const activeOrderId = orderSuccess?.orderId ?? null;
  const successEtaMinuten = orderSuccess?.eta ?? null;
  const successBestelltAm = orderSuccess?.orderedAt ?? null;
  const successType = orderSuccess?.type ?? null;
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
        {/* Phase 997: Dynamische-ETA-Live-Cockpit — Phasen-Fortschrittsbalken + 1s-Countdown + Fahrer-Annäherung + Stop-Dots */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <StorefrontPhase997DynamischeEtaLiveCockpit
              orderId={orderSuccess.orderId}
              locationId={location.id}
              initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : 30}
            />
          </div>
        )}
        {/* Phase 1877: ETA-Lieferfenster-Live — Dynamisches 10-Minuten Lieferzeitfenster mit Live-Countdown + Konfidenz-Indikator */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <Phase1877EtaLieferfensterLive
              locationId={location.id}
              orderedAt={orderSuccess.orderedAt}
              initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : 30}
            />
          </div>
        )}
        {/* Phase 998: Dynamische-ETA-Live-Tracking-Ultra — 4-Stufen-Step-Tracker (Eingegangen/Zubereitung/Unterwegs/Geliefert) + Sekunden-Countdown + Fahrer-Info + Live-Pulse */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <StorefrontPhase998DynamischeEtaLiveTrackingUltra
              orderId={orderSuccess.orderId}
              locationSlug={location.id}
            />
          </div>
        )}
        {/* Phase 999: Live-Tracking-ETA-Kommando — Phasen-Steps + Sekunden-Countdown-Uhr + Fahrer-Info + Prep-Fortschrittsbalken + Live-Pulse */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase999LiveTrackingEtaKommando
              orderId={orderSuccess.orderId}
              locationId={location.id}
              initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : 30}
              bestellnummer={orderSuccess.orderId?.slice(-6)}
            />
          </div>
        )}
        {/* Phase 1000: Dynamische ETA Live-Cockpit — 4-Phasen-Timeline + Fahrer-Karte + Countdown */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1000DynamischeEtaLiveCockpit
              orderId={orderSuccess.orderId}
              initialData={{ etaMin: orderSuccess.eta > 0 ? orderSuccess.eta : null, status: 'delivering' }}
            />
          </div>
        )}
        {/* Phase 1002: Dynamische-ETA-Live-Cockpit — SVG-Arc-Fortschritts-Anzeige + 1s-Countdown + 4-Phasen-Fortschrittsbalken + Fahrername */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1002DynamischeEtaLiveCockpit
              orderId={orderSuccess.orderId}
              estimatedMinutes={orderSuccess.eta > 0 ? orderSuccess.eta : null}
              status="in_zubereitung"
              createdAt={orderSuccess.orderedAt}
            />
          </div>
        )}
        {/* Phase 1680: Dynamic ETA Live Ultimate — Echtzeit-ETA-Countdown mit Fahrer-Nähe, Phasen-Fortschrittsleiste (4 Schritte), 30-Sek-Polling */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <StorefrontPhase1680DynamicEtaLiveUltimate
              orderId={orderSuccess.orderId}
              locationId={location.id}
              orderedAt={orderSuccess.orderedAt}
            />
          </div>
        )}
        {/* Phase 1671: Liefer-Garantie-Timer — Countdown bis Max-ETA 45 Min + Rabatt-Badge bei Überschreitung; Hydration-safe */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-2 max-w-lg mx-auto">
            <StorefrontPhase1671LieferGarantieTimer orderedAt={orderSuccess.orderedAt} />
          </div>
        )}
        {/* Phase 1138: Lieferstatus-Live-Banner — Fixierter Bottom-Banner: 4-Stufen-Timeline mit 20s-Polling */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <Phase1138LieferstatusBanner
            orderId={orderSuccess.orderId}
            bestellnummer={orderSuccess.bestellnummer}
            orderedAt={orderSuccess.orderedAt}
            etaMinutes={orderSuccess.eta > 0 ? orderSuccess.eta : 30}
            locationId={location.id}
          />
        )}
        {/* Phase 1112: Wartezeit-Fortschritts-Ring — Kreisring 0–100% zeigt wie weit die Lieferung fortgeschritten ist */}
        {orderSuccess.type === 'lieferung' && orderSuccess.eta > 0 && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1112WartezeitFortschrittsRing
              orderId={orderSuccess.orderId}
              orderedAt={orderSuccess.orderedAt}
              etaMinutes={orderSuccess.eta}
              locationId={location.id}
            />
          </div>
        )}
        {/* Phase 1067: Echtzeit-Lieferstatus-Karte — Visuelle Karte mit Fahrer-Position + ETA-Countdown */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1067EchtzeitLieferstatusKarte orderId={orderSuccess.orderId} status="dispatched" />
          </div>
        )}
        {/* Phase 1082: Push-Opt-In-Banner — Browser-Push-Benachrichtigungen bei Statusänderungen */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-2 max-w-lg mx-auto">
            <Phase1082PushOptInBanner orderId={orderSuccess.orderId} status="confirmed" />
          </div>
        )}
        {/* Phase 1087: Bewertungs-Erinnerung — Overlay 2h nach Bestellaufgabe mit 1-Klick-Sterne-Bewertung */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <Phase1087BewertungsErinnerung orderId={orderSuccess.orderId} orderedAt={orderSuccess.orderedAt} />
        )}
        {/* Phase 955: Live-ETA Fahrer-Tracking — Dynamischer Countdown-Ring + Fahrer-Name + Tour-Phase + Nähe-Puls */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase955LiveEtaFahrerTracking orderId={orderSuccess.orderId} initialEtaMin={orderSuccess.eta > 0 ? orderSuccess.eta : 25} />
          </div>
        )}
        {/* Phase 1158: Dynamische-ETA-Live-Cockpit — Phasen-Timeline mit Echtzeit-Countdown, Fortschrittsleiste und Fahrer-Annäherung */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1158DynamischeEtaLiveCockpit
              orderId={orderSuccess.orderId}
              bestelltAt={orderSuccess.orderedAt}
              etaLatest={orderSuccess.eta > 0 ? new Date(Date.now() + orderSuccess.eta * 60_000).toISOString() : null}
            />
          </div>
        )}
        {/* Phase 1163: Dynamische-ETA-Live-Panel — ETA-Ring + Phasen-Fortschritt + Live-Update alle 60s */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1163DynamischeEtaLivePanel orderId={orderSuccess.orderId} locationId={location.id} />
          </div>
        )}
        {/* Phase 1168: Live-Tracking-Fahrer-Board — Fahrer-Annäherung mit ETA-Ring + Distanzbalken */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1168LiveTrackingFahrerBoard orderId={orderSuccess.orderId} />
          </div>
        )}
        {/* Phase 1173: Bestellstatus-Live-Kommando — Küchenphase + Fahrer-ETA + Gesamtfortschritt */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1173BestellstatusLiveKommando orderId={orderSuccess.orderId} />
          </div>
        )}
        {/* Phase 1179: Echtzeit-Bestellstatus-Karte — Animierte Schritt-Karte Bestätigt→Zubereitung→Unterwegs→Geliefert */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1179BestellstatusKarte orderId={orderSuccess.orderId} />
          </div>
        )}
        {/* Phase 1183: ETA-Konfidenz-Live-Panel — Konfidenz-Ring + Zeitfenster Earliest/Latest + Zuverlässigkeitslevel */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1183EtaKonfidenzLivePanel orderId={orderSuccess.orderId} locationId={location.id} />
          </div>
        )}
        {/* Phase 1184: ETA Live-Tracking Board — Dynamische ETA + Fahrer-Tracking-Status + Phasen-Fortschritt */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1184EtaLiveTrackingBoard orderId={orderSuccess.orderId} locationId={location.id} />
          </div>
        )}
        {/* Phase 1202: Echtzeit-Warteschlangen-Position — "Du bist Bestellung #3 in der Warteschlange" wenn Küche ausgelastet */}
        {orderSuccess.orderId && (
          <div className="px-4 pb-2 max-w-lg mx-auto">
            <Phase1202WarteschlangenPosition orderId={orderSuccess.orderId} locationId={location.id} />
          </div>
        )}
        {/* Phase 1207: Dynamische ETA + Live-Tracking — 5-Phasen-Timeline mit Echtzeit-Updates & Surge-Warnung */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-2 max-w-lg mx-auto">
            <StorefrontPhase1207DynamischeEtaLiveTracking orderId={orderSuccess.orderId} locationId={location.id} initialEtaMin={30} />
          </div>
        )}
        {/* Phase 1265: Liefer-Status-Progress — Mehrstufiger farbkodierter Fortschrittsbalken mit ETA */}
        {orderSuccess.type === 'lieferung' && (
          <div className="px-4 pb-2 max-w-lg mx-auto">
            <Phase1265LieferStatusProgress
              status="confirmed"
              etaMin={orderSuccess.eta > 0 ? orderSuccess.eta : null}
              placedAt={orderSuccess.orderedAt}
            />
          </div>
        )}
        {/* Phase 1192: Bewertungs-Aufforderung — Auto-Panel nach Lieferung mit 5-Sterne-Bewertung + Kommentar */}
        {orderSuccess.type === 'lieferung' && orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1192BewertungsAufforderung orderId={orderSuccess.orderId} locationId={location.id} />
          </div>
        )}
        {/* Phase 1303: Bewertungs-Abgabe-Widget — Sterne (1–5) + Kommentar + POST nach Bestellabschluss */}
        {orderSuccess.orderId && (
          <div className="px-4 pb-4 max-w-lg mx-auto">
            <Phase1303BewertungsAbgabeWidget orderId={orderSuccess.orderId} locationId={location.id} />
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
        {/* Phase 1464: Liefer-Versprechen-Banner — ETA > 40 Min: 5% Rabatt-Banner (SCHNELL5) */}
        {orderSuccess.type === 'lieferung' && (
          <StorefrontPhase1464LieferVersprechenBanner
            locationId={location.id}
            etaMinuten={orderSuccess.eta > 0 ? orderSuccess.eta : null}
          />
        )}
        {/* Phase 1480: Lieferzeit-Garantie-Versprechen — ETA > 45 Min: Rabatt-Widget PÜNKTLICH5 */}
        {orderSuccess.type === 'lieferung' && (
          <StorefrontPhase1480LieferzeitGarantieVersprechen
            locationId={location.id}
            etaMinuten={orderSuccess.eta > 0 ? orderSuccess.eta : null}
          />
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
      {/* Phase 1072: Bestellhistorie-Widget — Letzte 3 Bestellungen des Nutzers in kompakter Timeline + Wiederholen-Button */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase1072BestellhistorieWidget locationSlug={location.id} />
      </div>
      {/* Phase 1077: Liefergebiet-Checker — PLZ eingeben → grün/rot Lieferbarkeit + ETA-Schätzung */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase1077LiefergebietChecker locationSlug={location.id} />
      </div>
      {/* Phase 1280: Liefergebiet-Prüfung — PLZ + "Noch X km außerhalb" + Abhol-Empfehlung */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase1280LiefergebietPruefung
          locationSlug={location.id}
          locationId={location.id}
          locationAdresse={[location.adresse, location.plz, location.stadt].filter(Boolean).join(', ')}
        />
      </div>
      {/* Phase 1308: Wartezeit-Transparenz-Banner — Live-Auslastung Küche als Kundenanzeige mit ETA; 5-Min-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase1308WartezeitTransparenzBanner locationId={location.id} />
      </div>
      {/* Phase 1313: Liefer-ETA-Anzeige — Live-ETA aus liefer-prognose API + Ampel-Indikator; 5-Min-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase1313LieferEtaAnzeige locationId={location.id} />
      </div>
      {/* Phase 1318: Beliebtheits-Badge — Top-3-Gerichte der letzten Stunde + Trending-Label + Bestellzähler; 10-Min-Polling */}
      <Phase1318Beliebtheitsbadge locationId={location.id} />
      {/* Phase 1323: Bestellstatus-Push-Banner — Live-Banner "Unterwegs 🚴" + ETA-Countdown; 30-Sek-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase1323BestellstatusPushBanner locationId={location.id} orderId={activeOrderId} />
      </div>
      {/* Phase 1328: Lieferstatus-Fortschritts-Leiste — 4-Stufen-Leiste (Bestellt→Zubereitung→Bereit→Unterwegs) + animierter Fortschritt */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <Phase1328LieferstatusFortschrittsLeiste locationId={location.id} orderId={activeOrderId} />
      </div>
      {/* Phase 1315: Dynamische ETA Live Ultra — Countdown + Phasen-Timeline + Konfidenz-Badge; 30-Sek-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1315DynamischeEtaLiveUltra
          locationId={location.id}
          orderId={activeOrderId}
        />
      </div>
      {/* Phase 1325: Live-ETA-Tracking-Ultra — 5-Phasen-Timeline + Countdown + Fahrer-Annäherung + Bewertungs-Flow; 30-Sek-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1325LiveEtaTrackingUltra
          locationId={location.id}
          orderId={activeOrderId}
        />
      </div>
      {/* Phase 1355: Treue-Badge-Widget — Stammkunden-Badge (Bronze/Silber/Gold/Platin) + "Noch X bis nächste Stufe" + Rabattcode */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1355TreueBadgeWidget locationId={location.id} customerEmail={null} />
      </div>
      {/* Phase 1360: Echtzeit-Lieferstatus-Karte — ETA-Countdown + Fahrer-Name + 4-Stufen-Statusleiste; 30-Sek-Polling */}
      {activeOrderId && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <StorefrontPhase1360EchtzeitLieferstatusKarte orderId={activeOrderId} locationId={location.id} />
        </div>
      )}
      {/* Phase 1365: Warenkorb-Lieferzeitschätzung — Live-ETA "Lieferung in ca. X Min." basierend auf Küchen-Auslastung */}
      {totalItems > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <StorefrontPhase1365WarenkorbLieferzeitschaetzung locationId={location.id} cartItemCount={totalItems} />
        </div>
      )}
      {/* Phase 1370: Aktive-Bestellungen-Hinweis — "X Bestellungen aktiv" + Fahrer-Anzahl + Küche-beschäftigt-Badge; 5-Min-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1370AktiveBestellungenHinweis locationId={location.id} />
      </div>
      {/* Phase 1375: Frühbucher-Preisvorteil-Banner — Vor 11:00 oder nach 20:30: 5% Rabatt-Banner + Countdown bis Aktions-Ende */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1375FruehbucherPreisvorteilBanner locationId={location.id} />
      </div>
      {/* Phase 1380: Dynamische ETA Live-Tracking Cockpit — Echtzeit-ETA + Phasen-Ampel + Fahrer-Annäherung; 20-Sek-Polling */}
      {activeOrderId && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <StorefrontPhase1380DynamischeEtaLiveTrackingCockpit locationId={location.id} orderId={activeOrderId} />
        </div>
      )}
      {/* Phase 1385: Wetter-Lieferzeit-Hinweis — Bei Regen/Sturm: +5–10 Min Lieferzeit Banner; dismissbar; 15-Min-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1385WetterLieferzeitHinweis locationId={location.id} />
      </div>
      {/* Phase 1389: Live-Tracking ETA-Cockpit — Phasen-Timeline + Sekunden-Countdown + Fahrer-Näherungs-Anzeige + 30s-Polling */}
      {activeOrderId && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <StorefrontPhase1389LiveTrackingEtaCockpit
            orderId={activeOrderId}
            locationId={location.id}
            initialEtaMin={30}
            initialStatus="neu"
          />
        </div>
      )}
      {/* Phase 1394: Bestellhistorie-Schnellreorder — Letzte 3 Bestellungen mit 1-Tap-Reorder-Button */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1394BestellhistorieSchnellreorder
          locationId={location.id}
          onReorder={(reorderItems) => {
            for (const ci of reorderItems) {
              const menuItem = items.find((i) => i.id === ci.item.id);
              if (menuItem) { for (let q = 0; q < ci.qty; q++) addToCart(menuItem); }
            }
          }}
        />
      </div>
      {/* Phase 1399: Bestellstatus-Live-Ticker — 4-Phasen-Progress-Strip + Sekunden-Countdown; verschwindet nach Lieferung; 30s-Polling */}
      {activeOrderId && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <StorefrontPhase1399BestellstatusLiveTicker
            orderId={activeOrderId}
            locationId={location.id}
            initialStatus="neu"
            initialEtaMin={undefined}
          />
        </div>
      )}
      {/* Phase 1404: Angebots-Countdown-Banner — Lunch-Special 11-14h (−10%) + Abend-Deal 18-21h (−8%) + Countdown-Ticker; schließbar */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <StorefrontPhase1404AngebotsCountdownBanner />
      </div>
      {/* Phase 1409: Bestell-Übersicht-Miniatur — Kompakte aktive-Bestellung-Karte (Status + ETA); schließbar */}
      {activeOrderId && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <StorefrontPhase1409BestUebersichtMiniatur locationId={location.id} orderId={activeOrderId} />
        </div>
      )}
      {/* Phase 1414: Live-Warteschlangen-Indikator — "X Bestellungen vor dir" + Wartezeit-Zusatz; 2-Min-Polling */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <StorefrontPhase1414LiveWarteschlangenIndikator locationId={location.id} />
        </div>
      )}
      {/* Phase 1419: Liefer-ETA-Verfeinerungs-Badge — verfeinerte ETA-Anzeige (Wetter/Queue/Fahrer) als Inline-Pill; 5-Min-Polling */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <StorefrontPhase1419LieferEtaVerfeinerungsBadge locationId={location.id} />
      </div>
      {/* Phase 1424: Nächste-Lieferung-Hinweis — schließbares Banner "Nächste Lieferung in ~X Min"; 5-Min-Polling; nur wenn eta<20 */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <StorefrontPhase1424NaechsteLieferungHinweis locationId={location.id} />
      </div>
      {/* Phase 1429: PLZ-Liefer-Check — Kunden-Eingabe Postleitzahl + Sofort-Feedback ob Liefergebiet; PLZ-Liste ausklappbar */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <StorefrontPhase1429PlzLiefercheck locationId={location.id} />
      </div>
      {/* Phase 1434: Lieferzonen-Karte — SVG-Darstellung Zonen A/B/C/D mit Farbkodierung + Ø-Lieferzeiten-Legende */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <StorefrontPhase1434LieferzonenKarte locationId={location.id} />
      </div>
      {/* Phase 1438: Bestellstatus-Live-Karte — 5-Phasen-Stepper mit animierten Icons, ETA-Anzeige und Fahrer-Info */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <BestellstatusLiveKarte locationSlug={location.id} />
      </div>
      {/* Phase 1448: Treue-Punkte-Anzeige — Earned-Points-Badge (X Punkte = Y€ Rabatt) im Header */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8 flex justify-end">
        <TreuePunkteAnzeige locationId={location.id} />
      </div>
      {/* Phase 1454: Bestellstatus-Live-Tracker — Animierter Phasen-Tracker mit Countdown */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <BestellstatusLiveTracker locationId={location.id} estimatedMinutes={30} />
      </div>
      {/* Phase 1459: Dynamische ETA-Anzeige — Live-Lieferzeit mit Countdown-Ring, Fahrer-Näherungs-Indikator und 60s-Updates */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <DynamischeEtaAnzeige locationId={location.id} estimatedMinutes={30} />
      </div>
      {/* Phase 1453: Bestellhistorie-Mini-Widget — Letzte 3 Bestellungen des Kunden */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
        <BestellhistorieMiniWidget locationId={location.id} />
      </div>
      {/* Phase 1458: Treue-Programm-Einladung — Nach 3. Bestellung Banner mit 10% Rabatt */}
      <StorefrontPhase1458TreueProgrammEinladung locationId={location.id} />
      {/* Phase 1464: Liefer-Versprechen-Banner — ETA > 40 Min: 5% Rabatt-Banner */}
      <StorefrontPhase1464LieferVersprechenBanner locationId={location.id} etaMinuten={null} />
      {/* Phase 1469: Liefer-Transparenz-Status-Karte — Fortschritts-Leiste Bestellt→Zubereitung→Fertig→Unterwegs→Geliefert */}
      <StorefrontPhase1469LieferTransparenzStatus locationId={location.id} orderStatus={orderSuccess ? 'pending' : null} />
      {/* Phase 1471: Dynamische ETA-Anzeige — Live-Lieferzeit mit Farbkodierung (grün < 30 / gelb < 45 / orange < 60 / rot ≥ 60) */}
      <StorefrontPhase1471DynamischeEtaAnzeige locationId={location.id} />
      {/* Phase 1475: Bestellstatus-Benachrichtigungs-Opt-In — Kundeneinwilligung Push-/Email-Benachrichtigung; localStorage-Guard 30 Tage */}
      <StorefrontPhase1475BenachrichtigungsOptIn locationId={location.id} orderId={activeOrderId} />
      {/* Phase 1485: Bestellstatus-Progress-Ring — Kompakter SVG-Ring (0–4 Schritte) mit Puls-Animation; Hydration-safe */}
      <StorefrontPhase1485BestellstatusProgressRing locationId={location.id} orderStatus={orderSuccess ? 'in_zubereitung' : null} />
      {/* Phase 1490: Mindestbestellwert-Fortschritts-Badge — Live-Fortschrittsbalken wenn Warenkorb < MOV; Echtzeit-Update */}
      {cart.length > 0 && subtotal < minOrder && (
        <StorefrontPhase1490MindestbestellwertBadge subtotal={subtotal} minOrder={minOrder} deliveryFee={tenantDeliveryFee} />
      )}
      {/* Phase 1495: Dynamische ETA-Konfidenz-Bar — Animierte Konfidenzanzeige für Lieferzeit-Schätzung mit Live-Updates alle 30s */}
      <StorefrontPhase1495DynamischeEtaKonfidenzBar locationId={location.id} orderPlaced={orderSuccess !== null} />
      {/* Phase 1501: Echtzeit-Fahrer-Annäherungs-Indikator — "Fahrer ist X Min entfernt" mit Live-Countdown; 30s-Polling; Hydration-safe */}
      <StorefrontPhase1501EchtzeitFahrerAnnaeherungsIndikator locationId={location.id} orderPlaced={orderSuccess !== null} />
      {/* Phase 1506: Liefergebiet-Prüfungs-Badge — Live-PLZ-Check; Inline-Badge grün/rot/orange; debounced; nach Phase1501 */}
      <StorefrontPhase1506LiefergebietPruefungsBadge locationId={location.id} plz={deliveryPlz} />
      {/* Phase 1511: Bestellstatus-Verlaufs-Badge — Kompakter Inline-Badge der letzten Bestellung; localStorage-basiert; Hydration-safe */}
      <StorefrontPhase1511BestellstatusVerlaufsBadge locationId={location.id} />
      {/* Phase 1516: Aktions-Banner-Ticker — Schließbarer Ticker mit aktuellen Angeboten/Rabattcodes; localStorage-Guard 1 Tag; Hydration-safe */}
      <StorefrontPhase1516AktionsBannerTicker locationId={location.id} />
      {/* Phase 1521: Beliebte-Artikel-Chips — Horizontal scrollbare Chip-Leiste Top-5 Artikel heute; localStorage-cached; Hydration-safe */}
      <StorefrontPhase1521BeliebtArtikelChips locationId={location.id} />
      {/* Phase 1536: Lieferzeit-Countdown-Banner — "Jetzt bestellen — ETA X Min"; 5-Min-Guard; Hydration-safe */}
      <StorefrontPhase1536LieferzeitCountdownBanner etaMinutes={30} locationSlug={location.id} visible={cart.length === 0} />
      {/* Phase 1541: Mindestbestellwert-Fortschrittsbalken — Zeigt verbleibenden Betrag bis Mindestbestellwert; Hydration-safe */}
      {cart.length > 0 && subtotal < minOrder && (
        <div className="px-4 pb-2">
          <StorefrontPhase1541MindestbestellwertFortschritt
            cartTotalCents={Math.round(subtotal * 100)}
            minOrderCents={Math.round(minOrder * 100)}
            locationSlug={location.id}
          />
        </div>
      )}
      {/* Phase 1546: Lieferfenster-Auswahl — +30/+60/+90 Min; Guard ETA > 30 Min; localStorage; Hydration-safe */}
      <StorefrontPhase1546LieferfensterAuswahl etaMinutes={30} locationSlug={location.id} />
      {/* Phase 1556: Liefergebiet-Info-Badge — Liefergebiet + Mindestbestellwert + Lieferzeit-Versprechen; Props-basiert; Hydration-safe */}
      <StorefrontPhase1556LiefergebietInfoBadge locationId={location.id} />
      {/* Phase 1561: Bestellbestätigungs-Fortschrittsleiste — 4-Stufen-Fortschritt (Bestätigt→Zubereitung→Unterwegs→Geliefert); localStorage-dismiss */}
      <StorefrontPhase1561BestellbestaetiguFortschrittsleiste orderPlaced={orderSuccess !== null} orderStatus={orderSuccess ? 'neu' : null} />
      {/* Phase 1566: Empfohlene-Artikel-Chips — 3-5 meistbestellte Artikel als horizontale Chip-Leiste; localStorage-cached; Hydration-safe */}
      <StorefrontPhase1566EmpfohleneArtikelChips locationSlug={location.id} />
      {/* Phase 1571: Aktions-Badge — Aktuelle Aktion/Rabatt als Pill-Badge; 5-Min-Polling; schließbar */}
      <StorefrontPhase1571AktionsBadge locationId={location.id} />
      {/* Phase 1571b: Lieferzeit-Echtzeit-Ticker — Status-Ticker nach Bestellabschluss (Zubereitung→Unterwegs→Geliefert) + ETA; 60-Sek-Polling */}
      <StorefrontPhase1571LieferzeitEchtzeitTicker locationId={location.id} orderPlaced={orderSuccess !== null} orderStatus={orderSuccess ? 'pending' : null} />
      {/* Phase 1576: Lieferzeit-Echtzeit-Ticker — Statusnachrichten nach Bestellabschluss; 60-Sek-Polling; Hydration-safe */}
      <StorefrontPhase1576LieferzeitEchtzeitTicker orderId={activeOrderId} locationId={location.id} />
      {/* Phase 1581: Lieferzeit-Garantie-Versprechen — ETA > 45 Min: Rabatt-Banner PUENKTLICH5 + visuelles Versprechen; localStorage-dismiss */}
      <StorefrontPhase1581LieferzeitGarantieVersprechen locationId={location.id} etaMinuten={null} />
      {/* Phase 1586: Dynamische-ETA-Live-Ultimate — Phasen-Stepper (Angenommen/Zubereitung/Unterwegs/Fast da/Geliefert) + Echtzeit-Countdown + Fahrer-Info */}
      <StorefrontPhase1586DynamischeEtaLiveUltimate
        estimatedMin={28}
        currentStatus={activeOrderId ? 'unterwegs' : undefined}
      />
      {/* Phase 1591: Treueprogramm-Fortschritts-Widget — Punkte-Fortschrittsbalken bis nächste Prämie + Meilenstein-Chips; localStorage-cached; Hydration-safe */}
      <StorefrontPhase1591TreueprogrammFortschrittsWidget locationId={location.id} />
      {/* Phase 1601: Liefergebiets-Live-Status — Überlastetes Zone-Banner + alternativem Zeitfenster + ETA-Anpassung; localStorage-cached 5Min; Hydration-safe */}
      <StorefrontPhase1601LiefergebietLiveStatus locationId={location.id} />
      {/* Phase 1606: Produktempfehlung-Upsell-Banner — Warenkorb < 15 EUR: empfohlene Artikel als horizontaler Scroller; localStorage-cached 10Min; Hydration-safe */}
      <StorefrontPhase1606ProduktempfehlungUpsellBanner locationId={location.id} cartTotal={subtotal} />
      {/* Phase 1611: Letzte-Bestellungen-Schnellzugang — Letzte 3 Bestellungen als Chips für Schnell-Reorder; localStorage-based; Hydration-safe */}
      <StorefrontPhase1611LetzteBestellungenSchnellzugang locationId={location.id} />
      {/* Phase 1621: Echtzeit-Küchenstatus-Ticker — Live-Ticker „X Bestellungen in Zubereitung · Küche läuft auf Hochtouren/normal/ruhig"; localStorage-cached 2Min; Hydration-safe */}
      <StorefrontPhase1621EchtzeitKuechenstatusTicker locationId={location.id} />
      {/* Phase 1626: Wartezeit-Transparenz-Widget — Live ETA + Fortschrittsbalken (Bestellt→Zubereitung→Unterwegs→Geliefert) + Küchenstatus; localStorage-cached 1Min; Hydration-safe */}
      <StorefrontPhase1626WartezeitTransparenzWidget locationId={location.id} />
      {/* Phase 1631: Dynamische ETA Live Ultima — Phasen-Timeline (Bestellt→Küche→Unterwegs→Fast da!) mit animiertem Sekunden-Countdown, Fahrer-Info, Küchen-Auslastungs-Hinweis; 30s-Polling */}
      <Phase1631DynamischeEtaLiveUltima locationId={location.id} />
      {/* Phase 1635: Bestellbestätigungs-Konfetti-Overlay — CSS-only Konfetti + Dankesnachricht + Folgebestellung-CTA; sessionStorage-based; Hydration-safe */}
      <Phase1635BestellbestaetigungKonfettiOverlay orderPlaced={false} locationSlug={location.id} />
      {/* Phase 1645: Öffnungszeiten-Status-Banner — Heute geöffnet/geschlossen + nächste Öffnungszeit; Countdown bis Öffnung/Schließung; locationId-Prop; Hydration-safe */}
      <Phase1645OeffnungszeitenStatusBanner locationId={location.id} />
      {/* Phase 1650: Live-Lieferung-Status-Cockpit — Echtzeit-Lieferstatus für Kunden: Küche→Fahrer→Geliefert, dynamische ETA, Fahrer-Nähe-Indikator; 30s-Polling */}
      <StorefrontPhase1650LiveLieferungStatusCockpit orderId={null} />
      {/* Phase 1655: Lieferzone-Visualisierungs-Banner — Zeigt Lieferzonen A/B/C/D mit ETA-Hinweisen; konzentrische Ringe; Hydration-safe */}
      <StorefrontPhase1655LieferzoneVisualisierungsBanner locationId={location.id} />
      {/* Phase 1661: Liefer-Qualitäts-Siegel — Vertrauensbadge: pünktlich-%, ★ Bewertung, Ø Lieferzeit; 60-Min-Polling; Hydration-safe */}
      <StorefrontPhase1661LieferQualitaetsSiegel locationId={location.id} />
      {/* Phase 1671: Liefer-Garantie-Timer — nur nach Bestellung sichtbar, hier immer null */}
      <StorefrontPhase1671LieferGarantieTimer orderedAt={null} />
      {/* Phase 1671b: Bestell-Status-Mini-Leiste — Kompakter 5-Stufen-Status-Strip (Bestätigt/Zubereitung/Bereit/Unterwegs/Geliefert) inline ohne Overlay; Props orderStatus */}
      <StorefrontPhase1671BestellStatusMiniLeiste orderStatus={null} />
      {/* Phase 1676: Kapazitäts-Ampel-Badge — Live-Badge: Küche/Fahrer-Kapazität (voll/normal/niedrig) + angepasste ETA-Warnung; 3-Min-Polling; Hydration-safe */}
      <StorefrontPhase1676KapazitaetsAmpelBadge locationId={location.id} />
      {/* Phase 1681: Nachhaltigkeits-Badge — Grüne Lieferung: CO2-Ersparnis durch Bündelung + Bäume-Äquivalent; 10-Min-Polling; Hydration-safe */}
      <StorefrontPhase1681NachhaltigkeitsBadge locationId={location.id} />
      {/* Phase 1686: Qualitäts-Score-Banner — Ø Bewertung letzter 7 Tage + Liefer-Pünktlichkeits-%; grüner Banner wenn Score >4.5; 30-Min-Polling */}
      <StorefrontPhase1686QualitaetsScoreBanner locationId={location.id} />
      {/* Phase 1691: Live-Warteschlangen-Anzeige — Aktuelle Bestellanzahl + geschätzte Verzögerung; gelber Banner wenn Queue >5; 5-Min-Polling */}
      <StorefrontPhase1691LiveWarteschlangenAnzeige locationId={location.id} />
      {/* Phase 1696: Bestellstatus-Mini-Tracker — 5-Stufen-Leiste nach Bestellung; 30s-Polling; Hydration-safe */}
      <StorefrontPhase1696BestellstatusMiniTracker orderId={activeOrderId} initialStatus={null} locationId={location.id} />
      {/* Phase 1701: Kundenbewertungs-Snapshot-Strip — Letzte 3 Bewertungen + Sterne + Kurztext; 60-Min-Polling; Hydration-safe */}
      <StorefrontPhase1701KundenbewertungsSnapshotStrip locationId={location.id} />
      {/* Phase 1706: Lieferzeit-Garantie-Countdown-Badge — Countdown bis 45-Min-Garantie ab Bestelleingang; rot bei <10 Min; Hydration-safe */}
      <StorefrontPhase1706LieferzeitGarantieCountdownBadge orderedAt={null} />
      {/* Phase 1710: Dynamische ETA Live-Tracking-Cockpit — 5-Phasen-Timeline (eingegangen→geliefert) + ETA-Countdown + Live-Pulse; 30s-Polling nach Bestelleingang */}
      <StorefrontPhase1710DynamischeEtaLiveTrackingCockpit locationId={location.id} orderPlaced={orderSuccess !== null} orderId={activeOrderId} />
      {/* Phase 1716: Beliebteste-Gerichte-Strip — Top-3 Gerichte heute; Mini-Cards; 30-Min-Polling; Hydration-safe */}
      <StorefrontPhase1716BeliebtsteGerichteStrip locationId={location.id} className="px-4" />
      {/* Phase 1721: Liefer-Ampel-Status — Kompakte Ampel (grün/gelb/rot) basierend auf Systemlast; 5-Min-Polling; Hydration-safe */}
      <StorefrontPhase1721LieferAmpelStatus locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1726: Dynamischer Liefer-ETA-Badge — ETA-Minuten nach Zone + Auslastung; 3-Min-Polling; Hydration-safe */}
      <StorefrontPhase1726DynamischerLieferEtaBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 1736: Bestellbestätigungs-Fortschrittsleiste — 4-Schritt-Leiste (Bestellt→Zubereitung→Unterwegs→Geliefert); Props-basiert; Hydration-safe */}
      <StorefrontPhase1736BestellbestaetigungFortschrittsleiste
        status={activeOrderId ? 'bestellt' : null}
        className="mx-4 mt-2"
      />
      {/* Phase 1751: Liefer-Vertrauens-Score-Badge — X% positives Feedback letzte 30 Bewertungen; 60-Min-Polling; schließbar */}
      <StorefrontPhase1751LieferVertrauensScoreBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1756: Echtzeit-Küchen-Status-Badge — frei/normal/beschaeftigt/sehr_beschaeftigt; 5-Min-Polling; schließbar */}
      <StorefrontPhase1756EchtzeitKuechenStatusBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1761: Liefer-Zufriedenheits-Garantie-Badge — aktiv wenn Pünktlichkeit + Feedback ≥90%; 60-Min-Polling; schließbar */}
      <StorefrontPhase1761LieferZufriedenheitsGarantieBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1765: Dynamische ETA Live-Tracking-Ring — SVG-Fortschrittsring (0–100%) mit ETA-Countdown für aktive Bestellung; 4 Phasen; 30s-Polling */}
      <StorefrontPhase1765DynamischeEtaLiveTrackingRing orderId={activeOrderId} locationId={location.id} />
      {/* Phase 1770: Nachhaltigkeits-Liefer-Badge — 'Klimaoptimierte Lieferung' wenn Tour-Auslastung >=80%; 60-Min-Polling; Hydration-safe; schließbar */}
      <StorefrontPhase1770NachhaltigkeitsLieferBadge locationId={location.id} className='mx-4 mt-2' />
      {/* Phase 1775: Fahrer-Profil-Badge — Name + Avatar-Initials + Bewertung des zugewiesenen Fahrers; Hydration-safe; nur wenn Fahrer zugewiesen */}
      <StorefrontPhase1775FahrerProfilBadge locationId={location.id} orderId={activeOrderId} className='mx-4 mt-2' />
      {/* Phase 1780: Echtzeit-Küchen-Status-Indikator — beschäftigt/normal/entspannt basierend auf Bestelllast; Hydration-safe; 5-Min-Polling */}
      <StorefrontPhase1780EchtzeitKuechenStatusIndikator locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1790: Dynamische Lieferzeit-Schätzung — Ø Lieferzeit heute + Trend + Auslastungslabel; Hydration-safe; 5-Min-Polling */}
      <StorefrontPhase1790DynamischeLieferzeitSchaetzung locationId={location.id} />
      {/* Phase 1794: Live-ETA-Fahrer-Nähe-Cockpit — Echtzeit-ETA + Fahrer-Annäherungsindikator; 5-Stufen-Ampel; 60s-Polling; Hydration-safe */}
      <StorefrontPhase1794LiveEtaFahrerNaeheCockpit orderId={activeOrderId} locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1804: Bestell-Phasen-Cockpit — 3-stufiger Phasen-Tracker Küche/Unterwegs/Fast-da; animierter Indikator; ETA-Badge; 60s-Polling */}
      <StorefrontPhase1804BestellPhasenCockpit orderId={activeOrderId} locationId={location.id} />
      {/* Phase 1815: DynamischeEtaLiveTracker — 4-Phasen-Timeline (eingegangen/zubereitung/unterwegs/zugestellt) + Countdown; Hydration-safe; 30s-Polling */}
      <StorefrontPhase1815DynamischeEtaLiveTrackerIntegration
        orderId={activeOrderId}
        locationId={location.id}
        etaMinuten={successEtaMinuten}
        bestelltAm={successBestelltAm}
        className="mx-4 mt-2"
      />
      {/* Phase 1825: Echtzeit-Küchen-Status-Anzeige — "Küche aktiv" / "Kurze Wartezeit" / "Hohe Auslastung"; Hydration-safe; schließbar */}
      <StorefrontPhase1825EchtzeitKuechenStatusAnzeige locationId={location.id} />
      {/* Phase 1830: Liefergebiet-Live-Karte — Lieferzone + ETA-Schätzung + MBW + Gebühr; Hydration-safe; schließbar */}
      <StorefrontPhase1830LiefergebietLiveKarte locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1835: Live-Fahrer-Score-Badge — Fahrer-Bewertungs-Badge (★) wenn Fahrer zugewiesen; Hydration-safe; schließbar */}
      <StorefrontPhase1835LiveFahrerScoreBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1840: Lieferzeit-SLA-Garantie — ≤30 Min grün; 30–45 Min gelb; >45 Min 10%-Rabatt-Angebot; Hydration-safe; schließbar */}
      <StorefrontPhase1840LieferzeitSlaGarantie locationId={location.id} etaMinuten={deliveryTimeMin ?? 30} className="mx-4 mt-2" />
      {/* Phase 1845: Küchen-Auslastungs-Badge — Aktuelle Küchenauslastung (entspannt/normal/beschäftigt/sehr ausgelastet); Hydration-safe; 5-Min-Polling */}
      <StorefrontPhase1845KuechenAuslastungsBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1850: Dynamische ETA Live-Tracking Board — 4-Phasen-Stepper (Bestätigt→Zubereitung→Abholung→Unterwegs); Fahrer-Annäherungs-Balken; dynamische ETA; 30-Sek-Polling */}
      {activeOrderId && (
        <StorefrontPhase1850DynamischeETALiveTrackingBoard
          bestellId={activeOrderId}
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 1855: Küchenstatus-Banner — Kapazitätsstatus der Küche grün/gelb/rot; Fahrer-Info; Hydration-safe; schließbar; 5-Min-Polling */}
      <StorefrontPhase1855KuechenStatusBanner locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1860: Fahrer-online-Zähler — "X Fahrer jetzt in deiner Nähe"; aktive Fahrer; Hydration-safe; schließbar; 5-Min-Polling */}
      <StorefrontPhase1860FahrerOnlineZaehler locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1870: Lieferzeit-Vertrauensbadge — "In deiner Zone Ø XX Min"; Ampelfarbe; Hydration-safe; 10-Min-Polling */}
      <StorefrontPhase1870LieferzeitVertrauensbadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1876: Zonen-Verfügbarkeits-Hinweis — Lieferzeiten je Zone A/B/C/D + Ampel; nur ohne aktive Bestellung; Hydration-safe; 10-Min-Polling */}
      <StorefrontPhase1876ZonenVerfuegbarkeitsHinweis locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1881: Gratis-Lieferungs-Schwellen-Anzeige — Fortschrittsbalken bis kostenlose Lieferung; Hydration-safe; aus delivery_zones-Konfiguration */}
      {cart.length > 0 && (
        <StorefrontPhase1881GratisLieferungsSchwelle locationId={location.id} subtotal={subtotal} className="mx-4 mt-2" />
      )}
      {/* Phase 1886: Zonen-ETA-Vergleichs-Banner — ETA-Unterschied Zone A vs. B/C als Entscheidungshilfe; Hydration-safe; 10-Min-Polling */}
      <StorefrontPhase1886ZonenEtaVergleichsBanner locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1891: Zonen-Sonder-Angebot-Banner — Kostenlose Lieferung in Zone X bis HH:MM; Countdown; Hydration-safe; schließbar; 10-Min-Polling */}
      <StorefrontPhase1891ZonenSonderAngebotBanner locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1896: Liefergeschwindigkeit-Testimonial-Widget — "Zuletzt in deiner Zone in XX Min geliefert"; Social-Proof; schließbar; Hydration-safe; 30-Min-Polling */}
      <StorefrontPhase1896LiefergeschwindigkeitTestimonialWidget locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1901: Fahrer-Anfahrts-ETA-Karte — "Dein Fahrer ist ~X Min entfernt"; Fahrzeug-Icon; nur wenn dispatched; 30-Sek-Polling; schließbar */}
      <StorefrontPhase1901FahrerAnfahrtsEtaKarte locationId={location.id} orderId={activeOrderId ?? null} />
      {/* Phase 1906: Fahrer-Profil-Mini-Card — Fahrername + Bewertungs-Sterne + Foto-Placeholder + Zuverlässigkeits-Badge; nur wenn dispatched; schließbar */}
      <StorefrontPhase1906FahrerProfilMiniCard locationId={location.id} orderId={activeOrderId ?? null} />
      {/* Phase 1911: Lieferzuverlässigkeits-Widget — Social-Proof-Kachel Pünktlichkeit%; schließbar; 1-Std-Polling */}
      <StorefrontPhase1911LieferzuverlaessigkeitsWidget locationId={location.id} />
      {/* Phase 1916: Fahrer-Qualitäts-Siegel — "Geprüfter Qualitätsfahrer"-Badge wenn Ø-Score >80; schließbar; 1-Std-Polling */}
      <Phase1916FahrerQualitaetsSiegel locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1921: Zonen-Lieferzeit-Badge — "In deiner Zone ~Xmin" dynamisch je PLZ; schließbar; Hydration-safe; 30-Min-Polling */}
      <Phase1921ZonenLieferzeitBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1926: Live-Küchenstatus-Indikator — Hochtouren/Normal/Ruhig je offene Bestellungen; schließbar; Hydration-safe; 5-Min-Polling */}
      <Phase1926LiveKuechenstatusIndikator locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1931: Bestellverfolgung-Fortschrittsring — 4-Phasen-Kreisring + Step-Liste; animiert; SSR-safe; schließbar; 20-Sek-Polling */}
      <Phase1931BestellverfolgungFortschrittsring locationId={location.id} orderId={activeOrderId ?? null} className="mx-4 mt-2" />
      {/* Phase 1936: Bewertungs-Social-Proof-Banner — "XX% Top-Bewertungen" + animierte Sterne; schließbar; Hydration-safe; 1-Std-Polling */}
      <Phase1936BewertungsSocialProofBanner locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1941: Nachhaltigkeit-Badge — "Heute X km per Fahrrad · CO₂ gespart"; grünes Badge; schließbar; Hydration-safe; 1-Std-Polling */}
      <Phase1941NachhaltigkeitBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1946: Bestellzahl-Heute-Badge — "Heute X Bestellungen verarbeitet"; Live-Ticker; schließbar; Hydration-safe; 5-Min-Polling */}
      <Phase1946BestellzahlHeuteBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1951: Echtzeit-Wartezeit-Indikator — "Aktuell ca. X Min Wartezeit" + Ampelfarbe; schließbar; Hydration-safe; 3-Min-Polling */}
      <Phase1951EchtzeitWartezeitIndikator locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1952: Echtzeit-ETA-Anzeige-Pro — SVG-Arc-Konfidenz-Ring + 4-Phasen-Step-Tracker + Live-Pulse; 30-Sek-Polling */}
      {successType === 'lieferung' && activeOrderId && (
        <div className="px-4 mt-2 max-w-lg mx-auto">
          <Phase1952EchtzeitEtaAnzeigePro
            orderId={activeOrderId}
            locationId={location.id}
          />
        </div>
      )}
      {/* Phase 2005: Live-Vertrauens-Balken — Fortschrittsleiste X% pünktliche Lieferungen aus Prognose-Score; 1-Std-Polling */}
      <StorefrontPhase2005LiveVertrauensBalken locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2010: Lieferzeit-Konfidenz-Badge — "Wir sind in X–Y Min bei dir (Konfidenz XX%)"; schließbar; 3-Min-Polling */}
      <StorefrontPhase2010LieferzeitKonfidenzBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2001: Vertrauens-Lieferzeit-Badge — Ankunftszeit-Uhr + Konfidenz + Fortschrittsleiste; 30-Sek-Aktualisierung */}
      {orderSuccess && (
        <StorefrontPhase2001VertrauensLieferzeitBadge
          etaMinutes={(successEtaMinuten ?? 0) > 0 ? (successEtaMinuten ?? 30) : 30}
          orderStatus="confirmed"
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 2000: Live-Liefer-Kommandant — ETA-Countdown + 4-Phasen-Timeline + Fahrer-Puls-Annäherung; 15-Sek-Polling */}
      {activeOrderId && (
        <StorefrontPhase2000LiveLieferungsKommandant
          orderId={activeOrderId}
          locationSlug={location.id}
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 2011: Dynamische-ETA-Countdown-Board — Animierter SVG-Countdown; 4-Phasen-Steps; 30s Polling */}
      {activeOrderId && <StorefrontPhase2011DynamischeEtaCountdownBoard orderId={activeOrderId} locationSlug={location.id} className="mx-4 mt-2" />}
      {/* Phase 2012: Live-Tracking-Status-Karte — Step-Indicator + Fahrer-Info-Chip + Fortschrittsbalken; 30s Polling */}
      {activeOrderId && <StorefrontPhase2012LiveTrackingStatusKarte orderId={activeOrderId} locationSlug={location.id} className="mx-4 mt-2" />}
      {/* Phase 2013: Fahrer-Ankunfts-Live-Widget — Nur wenn on_route; animierter Fahrername + ETA; 15s Polling */}
      {activeOrderId && <StorefrontPhase2013FahrerAnkunftLiveWidget orderId={activeOrderId} locationSlug={location.id} className="mx-4 mt-2" />}
      {/* Phase 2018: Liefereffizienz-Siegel — Wenn Effizienz >75; schließbar; Hydration-safe */}
      <StorefrontPhase2018LiefereffizienzSiegel locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2023: Lieferkapazitäts-Indikator — Hohe Nachfrage wenn Auslastung >80%; schließbar */}
      <StorefrontPhase2023LieferkapazitaetsIndikator locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2028: Lieferzeit-Versprechen-Badge — "Lieferung in X–Y Min" aus Effizienz + Auslastung; Hydration-safe */}
      <StorefrontPhase2028LieferzeitVersprechenBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2034: Lieferzuverlässigkeits-Garantie-Badge — "XX% erfolgreiche Lieferungen"; nur wenn ≥90%; ShieldCheck-Pill */}
      <StorefrontPhase2034LieferzuverlaessigkeitsGarantieBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2039: Kundenbewertungs-Vertrauens-Badge — "X+ begeisterte Kunden" wenn Team-Ø >4.0; Star-Pill */}
      <StorefrontPhase2039KundenbewertungsVertrauensBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2044: Pünktlichkeits-Badge — "X% pünktliche Lieferungen" wenn Team-Ø ≥90%; Clock-Pill */}
      <StorefrontPhase2044PuenktlichkeitsBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2052: Stammkunden-Begrüssungs-Banner — "Willkommen zurück, [Name]!" wenn Bestellhistorie ≥3; schließbar; Hydration-safe */}
      <StorefrontPhase2052StammkundenBegruessung locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2058: Blitzschnell-Badge — "Ø X Min Reaktion" wenn Team-Ø ≤5 Min; Zap-Pill gelb; 1-Std-Polling; Hydration-safe */}
      <StorefrontPhase2058BlitzschnellBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 2063: Frische-Garantie-Badge — "Frisch zubereitet in X Min"; Ø Kochzeit; Hydration-safe; 30-Min-Polling */}
      <StorefrontPhase2063FrischeGarantieBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2068: Nachhaltigkeits-Badge — "Kurze Lieferwege · Ø X km"; aus Routen-API; Hydration-safe */}
      <StorefrontPhase2068NachhaltigkeitsBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2074: Liefergebiet-Badge — "Wir liefern in deine Zone in Ø X Min"; Zonen-API; Hydration-safe; 1-Std-Polling */}
      <StorefrontPhase2074LiefergebietBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2079: Lieferzeit-Garantie-Banner — "Heute Lieferung bis X Uhr möglich"; aus Schicht-Daten; Hydration-safe */}
      <StorefrontPhase2079LieferzeitGarantieBanner locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2090: Beliebteste Bestellzeit-Badge — "Beliebt: X–Y Uhr · viele bestellen jetzt"; Hydration-safe; 30-Min-Polling */}
      <StorefrontPhase2090BeliebtBestellzeitBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2095: Qualitäts-Vertrauen-Badge — Team-Score + bester Fahrer; Hydration-safe; 30-Min-Polling */}
      <StorefrontPhase2095QualitaetsVertrauenBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2100: Liefergeschwindigkeits-Badge — "Ø X Min Lieferzeit heute"; Hydration-safe; 30-Min-Polling */}
      <StorefrontPhase2100LiefergeschwindigkeitsBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2106: Fahrer-Bewertungs-Badge — "Unsere Fahrer: ★ X,X"; nur Score ≥4,5; Hydration-safe; 1-Std-Polling */}
      <StorefrontPhase2106FahrerBewertungsBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2111: Tour-Zuverlässigkeits-Badge — "X% Lieferungen heute pünktlich"; nur wenn ≥90%; Hydration-safe; 1-Std-Polling */}
      <StorefrontPhase2111TourZuverlaessigkeitsBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2116: Lieferzone-Status-Pill — "Deine Zone: X Bestellungen · normal/voll"; Hydration-safe; 30-Min-Polling */}
      <StorefrontPhase2116LieferzoneStatusPill locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 2121: Pünktlichkeits-Badge — "X% pünktlich heute"; nur wenn ≥90%; Hydration-safe; 1-Std-Polling */}
      <StorefrontPhase2121PuenktlichkeitsBadge locationId={location.id} className="mx-4 mt-1" />
      {/* Phase 1000: ETA-Live-Tracking-Ultra-Pro — 4-Stufen-Fortschrittsleiste; Sekunden-Countdown; Fahrer-Info; 30s-Polling */}
      {activeOrderId && successType === 'lieferung' && (
        <div className="mx-4 mt-2">
          <Phase1000EtaLiveTrackingUltraPro
            orderId={activeOrderId}
            locationId={location.id}
            initialEtaMin={successEtaMinuten ?? null}
          />
        </div>
      )}
      {/* Phase 2200: Smart ETA Tracking Hub — 4-Phasen-Fortschrittsleiste + Dynamische ETA + Fahrer-Nähe + Küchen-Countdown */}
      {activeOrderId && successType === 'lieferung' && (
        <div className="mx-4 mt-2">
          <Phase2200SmartEtaTrackingHub
            orderId={activeOrderId}
            initialStatus="received"
            initialEtaMin={successEtaMinuten ?? null}
          />
        </div>
      )}
      {/* Phase 2060: Dynamische ETA & Live-Tracking — Bestellung→Küche→Fahrer→Lieferung; Fahrername; Countdown; 30s-Polling */}
      {activeOrderId && (
        <StorefrontPhase2060DynamischeEtaLiveTracking
          orderId={activeOrderId}
          locationSlug={location.id}
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 1892: Dynamische-ETA-Live-Tracking-Ultra — Phasen-Zeitleiste + ETA-Countdown + Fahrername + 15-Sek-Polling; SSR-safe */}
      {activeOrderId && (
        <StorefrontPhase1892DynamischeEtaLiveTrackingUltra
          orderId={activeOrderId}
          locationSlug={location.id}
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 1893: Bestellstatus-Phasen-Leiste — 4-Phasen-Fortschrittsleiste + ETA-Countdown + Fahrername; SSR-safe; 20-Sek-Polling */}
      {activeOrderId && (
        <StorefrontPhase1893BestellstatusPhasenLeiste
          orderId={activeOrderId}
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 1865: Live-Tracking-ETA-Cockpit — 4-Phasen-Stepper + Live-Countdown + Fahrer-Proximity-Ringe + ETA-Anzeige; 30-Sek-Polling */}
      {activeOrderId && (
        <StorefrontPhase1865LiveTrackingETACockpit bestellId={activeOrderId} className="mx-4 mt-2" />
      )}
      {/* Phase 1866: Echtzeit-Lieferstatus-Cockpit v2 — Animierter Stepper + ETA-Konfidenz + Fahrer-Näherungs-Puls + Guter-Appetit-Flow; 30-Sek-Polling */}
      {activeOrderId && (
        <StorefrontPhase1866EchtzeitLieferstatusCockpitV2
          orderId={activeOrderId}
          locationSlug={location.id}
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 1871: Dynamische-ETA-Live-Fortschrittsleiste — 4-Phasen-Band mit Countdown + Konfidenz-Label + Puls-Animation bei Fahrer-Nähe; 30-Sek-Polling */}
      {activeOrderId && (
        <StorefrontPhase1871DynamischeEtaLiveFortschrittsleiste
          orderId={activeOrderId}
          className="mx-4 mt-2"
        />
      )}
      {/* Phase 1820: Lieferzeit-Garantie-Countdown-V2 — Countdown bis Lieferzusage; Entschädigungs-Hinweis; Hydration-safe; schließbar */}
      <StorefrontPhase1820LieferzeitGarantieCountdownV2
        locationId={location.id}
        etaMinuten={successEtaMinuten ?? 35}
        bestelltAm={successBestelltAm}
      />
      {/* Phase 1785: Lieferdienst-Öffnungszeiten-Indikator — Lieferung möglich + nächster Slot; Hydration-safe; schließbar */}
      <StorefrontPhase1785LieferdienstOeffnungszeitenIndikator locationId={location.id} />
      {/* Phase 1800: Qualitäts-Versprechen-Badge — "Top-bewerteter Fahrer" wenn Score >= 4.8 + Initials + Sterne; Hydration-safe; 30-Min-Polling; schließbar */}
      <StorefrontPhase1800QualitaetsVersprechenBadge locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1746: Bestellmuster-Zeitfenster-Hinweis — Hinweis wenn aktuelle Stunde historisch Hochlastzeit; Hydration-safe */}
      <StorefrontPhase1746BestellmusterZeitfensterHinweis locationId={location.id} className="mx-4 mt-2" />
      {/* Phase 1741: Live-Fahrer-Näherungs-Indikator — Näherungs-Banner wenn Fahrer <500m; 30s-Polling; Hydration-safe */}
      <StorefrontPhase1741LiveFahrerNaehHerungsIndikator
        orderId={activeOrderId}
        locationId={location.id}
        className="mx-4 mt-2"
      />
      {/* Phase 1740 Storefront: Live-Delivery-Command — 4-Phasen-ETA-Tracking (Küche→Bereit→Fahrer→Geliefert); 30s-Polling; nur wenn aktive Bestellung */}
      {activeOrderId && (
        <div className="mx-4 mt-2">
          <LiveDeliveryCommand orderId={activeOrderId} locationId={location.id} />
        </div>
      )}
      {/* Phase 1731: Lieferzeit-Garantie-Uhr — Countdown bis ETA; Entschädigungs-Hinweis bei Überschreitung; schließbar */}
      <StorefrontPhase1731LieferzeitGarantieUhr
        orderPlaced={null}
        etaMinuten={45}
        className="mx-4 mt-2"
      />
      {/* Phase 1717: Echtzeit-Nachfrage-Indikator — Bestellungen letzte Stunde + Beliebtheitsstufe (ruhig/normal/belebt/sehr_belebt); 5-Min-Polling */}
      <StorefrontPhase1717EchtzeitNachfrageIndikator locationId={location.id} className="px-4" />
      {/* Phase 1722: Dynamische-ETA-Live-Status-Board — 4-Phasen-Timeline (Angenommen→Zubereitung→Unterwegs→Geliefert) + ETA-Countdown; 30s-Polling nach Bestelleingang */}
      <StorefrontPhase1722DynamischeEtaLiveStatusBoard locationId={location.id} orderPlaced={orderSuccess !== null} orderId={activeOrderId} className="mx-4 mt-2" />
      {/* Phase 1551: Bewertungs-Teaser — Ø Bewertung + Anzahl; localStorage-cached 5 Min; API-Fallback */}
      <StorefrontPhase1551BewertungsTeaser locationId={location.id} />
      {/* Phase 1551b: Fahrer-Profil-Vorschau — Name + Avatar-Initialen + Ø-Bewertung; Guard orderPlaced; Hydration-safe */}
      <StorefrontPhase1551FahrerProfilVorschau orderPlaced={false} locationSlug={location.id} />
      {/* Phase 1531: Warenkorb-Erinnerungs-Banner — 30-Min-Idle-Guard, schließbar, localStorage 24h */}
      <StorefrontPhase1531WarenkorbErinnerungsBanner cartItemCount={totalItems} locationSlug={location.id} />
      {/* Phase 1527: Live-ETA-Tracking-Kommando — Dynamische ETA + Fahrer-Annäherungs-Ampel + Bestellstatus-Phasen-Leiste; 30s-Polling */}
      <StorefrontPhase1527LiveEtaTrackingKommando locationId={location.id} orderPlaced={orderSuccess !== null} />
      {/* Phase 1505: Dynamische ETA Live Tracker — Countdown + ETA-Konfidenz-Balken + Fahrer-Annäherung + Status-Anzeige; 45s-Polling */}
      <StorefrontPhase1505DynamischeEtaLiveTracker locationId={location.id} orderPlaced={orderSuccess !== null} />
      {/* Phase 1443: Bestellkorb-Timeout-Warnung — Banner wenn Korb >20 Min inaktiv mit Verlängern-Button */}
      <BestellkorbTimeoutWarnung
        cartItemCount={totalItems}
        onCartExtend={() => {}}
        onCartClear={() => setCart([])}
      />
      {/* Phase 1057: Live-Popularitäts-Ranking — Trending-jetzt-Banner mit meistbestellten Artikeln der letzten 2h */}
      <Phase1057TrendingBanner locationId={location.id} />
      {/* Phase 1052: Warenkorb-Merkzettel-Widget — Artikel auf Merkzettel setzen + per Klick in Warenkorb übernehmen */}
      <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8 flex justify-end">
        <Phase1052MerkzettelWidget
          merkzettel={merkzettel}
          onAddToCart={(merkItem) => {
            const menuItem = items.find((i) => i.id === merkItem.id);
            if (menuItem) addToCart(menuItem);
          }}
        />
      </div>
      {/* Phase 1047: Warenkorb-Upsell-Widget — Empfiehlt Zusatzartikel wenn Warenkorb < Mindestbestellwert + 20% */}
      {cart.length > 0 && subtotal < minOrder * 1.2 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1047WarenkorbUpsellWidget
            subtotal={subtotal}
            minOrder={minOrder}
            locationId={location.id}
          />
        </div>
      )}
      {/* Phase 1197: Rabatt-Schwellen-Banner — Banner wenn Warenkorb unter nächster Rabattschwelle (z.B. 10% ab 30€) */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1197RabattschwellenBanner cartTotal={subtotal} locationId={location.id} />
        </div>
      )}
      {/* Phase 1207: Live-Küchen-Auslastungs-Indikator — Ampel + Wartezeit-Schätzung für Kunden */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1207LiveKuechenAuslastungsIndikator locationId={location.id} />
        </div>
      )}
      {/* Phase 1215: Social-Proof-Banner — Live Bestellungen heute + aktive Kunden + Beliebt-Artikel */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <Phase1215SocialProofBanner locationId={location.id} cartEmpty={cart.length === 0} />
      </div>
      {/* Phase 1235: Liefer-Versprechen-Banner — "In X Min oder Y€ Gutschrift" Transparenz-Banner */}
      {cart.length === 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1235LieferVersprechenBanner etaMin={deliveryTimeMin ?? 30} locationId={location.id} />
        </div>
      )}
      {/* Phase 1250: Gruppenbestellung-Hinweis-Banner — ab 50€ gemeinsam bestellen + Link-Teilen */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <Phase1250GruppenbestellungBanner
          cart={cart as any}
          locationId={location.id}
          cartEmpty={cart.length === 0}
        />
      </div>
      {/* Phase 1255: Bewertungs-Karussell — letzte 6 Kundenbewertungen auto-scrollend */}
      {cart.length === 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <Phase1255BewertungsKarussell locationId={location.id} />
        </div>
      )}
      {/* Phase 1220: Warenkorb-Speicher-Banner — Auto-save nach 30s Inaktivität + Wiederherstellungs-Button */}
      <Phase1220WarenkorbSpeicherBanner cart={cart} onRestoreCart={restoreCart} />
      {/* Phase 1225: Lieferfenster-Auswahl-Widget — 30-Min-Slots basierend auf Auslastung */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1225LieferfensterAuswahlWidget
            locationId={location.id}
            selectedSlot={selectedDeliverySlot}
            onSelectSlot={setSelectedDeliverySlot}
          />
        </div>
      )}
      {/* Phase 1275: Mindestbestellwert-Progress-Bar — farbiger Fortschrittsbalken bis Mindestbestellwert + Freischalts-Animation */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1275MindestbestellwertProgress subtotal={subtotal} minOrder={minOrder} />
        </div>
      )}
      {/* Phase 1143: Bestellwert-Meilenstein — Fortschrittsbalken "Noch X€ bis kostenlose Lieferung" */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1143BestellwertMeilenstein
            subtotal={subtotal}
            minOrder={minOrder}
            deliveryFee={tenantDeliveryFee}
          />
        </div>
      )}
      {/* Phase 1147: Küchen-Auslastungs-Warnung — Transparenz-Banner bei hoher Auslastung mit verlängerter ETA-Info */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <Phase1147KuechenAuslastungsWarnung
          locationSlug={location.id}
          currentEtaMin={deliveryTimeMin}
        />
      </div>
      {/* Phase 1153: Bestellhistorie-Schnellzugriff — Letzte 3 Bestellungen kompakt mit Wiederholen-Button */}
      {cart.length === 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <Phase1153BestellhistorieSchnellzugriff
            cart={cart as any}
            onAddItems={(newItems) => { for (const ci of newItems) { for (let q = 0; q < ci.qty; q++) { addToCart(ci.item as any); } } }}
          />
        </div>
      )}
      {/* Phase 1133: Schnell-Reorder — 1-Klick-Wiederbestellung der letzten Bestellung mit Warenkorb-Vorausfüllung */}
      {cart.length === 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-2 md:px-8">
          <Phase1133SchnellReorder
            locationId={location.id}
            onAddItems={(newItems) => { for (const ci of newItems) { for (let q = 0; q < ci.qty; q++) { addToCart(ci.item as any); } } }}
          />
        </div>
      )}
      {/* Phase 1117: Häufig-Zusammen-Bestellt — Top-3 Ergänzungsartikel basierend auf beliebtesten Kombinationen */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1117HaeufigZusammenBestellt
            locationId={location.id}
            cart={cart as any}
            allItems={items as any}
            onAddItem={addToCart as any}
          />
        </div>
      )}
      {/* Phase 1122: Ähnliche Produkte — 3 ähnliche Artikel nach Auswahl (gleiche Kategorie + Preisnähe) als Swipe-Chips */}
      {cart.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1122AehnlicheProdukte
            cart={cart as any}
            allItems={items as any}
            onAddItem={addToCart as any}
          />
        </div>
      )}
      {/* Phase 1127: Bestellzeit-Optimierer — "Jetzt bestellen für schnellste Lieferung" + Peak-Warnung */}
      {cart.length === 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
          <Phase1127BestellzeitOptimierer locationId={location.id} cartEmpty={cart.length === 0} />
        </div>
      )}
      {/* Phase 1132: Liefergebiet-Prüfer — Adresseingabe + Lieferbarkeit + ETA + Gebühr */}
      <div className="mx-auto max-w-6xl px-4 pt-1 md:px-8">
        <Phase1132LiefergebietPruefer locationId={location.id} />
      </div>
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
                          {/* Phase 1270: Artikel-Beliebtheitsbadge — "X× in 2h bestellt" für Top-3 Artikel */}
                          <div className="mt-1 px-1">
                            <Phase1270ArtikelBeliebtheitsBadge locationId={location.id} artikelName={item.name ?? ''} />
                          </div>
                          {/* Phase 1616: Menü-Beliebtheitsbadges — Top-3 meistbestellte Artikel erhalten „Beliebt"-Badge; localStorage-cached 30Min; Hydration-safe */}
                          <div className="mt-1 px-1">
                            <StorefrontPhase1616MenuBeliebtheitsBadge locationId={location.id} itemName={item.name ?? ''} />
                          </div>
                          {/* Phase 1640: Allergen-Hinweis-Schaltfläche — zeigt Allergen-Modal bei Klick; nur wenn Allergene vorhanden */}
                          {(item.allergene?.length ?? 0) > 0 && (
                            <div className="mt-1 px-1">
                              <button
                                className="text-[10px] text-amber-600 underline underline-offset-2 hover:text-amber-800 transition-colors"
                                onClick={() => setAllergenItem(item)}
                              >
                                ⚠️ Allergene ansehen
                              </button>
                            </div>
                          )}
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

      {/* Phase 1640: Allergen-Hinweis-Modal — Allergen-Icons + Bezeichnung beim Klick auf Produkt; Produkt-Props; keine API */}
      <Phase1640AllergenHinweisModal item={allergenItem} onClose={() => setAllergenItem(null)} />

      {/* Phase 1092: Gruppen-Bestellungs-Banner — Hinweis bei ≥3 Artikeln im Warenkorb + Rabattcode-Hinweis */}
      <div className="fixed bottom-[env(safe-area-inset-bottom,0px)] left-0 right-0 z-[55] px-4 mb-[5.5rem]">
        <Phase1092GruppenBestellungsBanner cart={cart as any} />
      </div>

      {/* Phase 1097: Erst-Bestellung-Bonus-Banner — Sonderangebot Neukunden mit 5€-Rabatt + Countdown + Code */}
      <Phase1097ErstbestellungBonusBanner locationId={location.id} />

      {/* Phase 1102: Nächste-Lieferfenster-Anzeige — Zeigt nächste 3 Lieferzeitfenster zur Orientierung */}
      <div className="px-4 py-2">
        <Phase1102NaechsteLieferfenster locationId={location.id} />
      </div>

      {/* Phase 1107: Kategorie-Schnellnavigation — Floating Grid-Overlay aller Kategorien mit Icon + Artikelanzahl + Smooth-Scroll */}
      <Phase1107KategorieSchnellnavigation
        categories={categories}
        items={items}
        onJump={scrollToSection}
        hasPopular={popular.length > 0}
        themeId={themeId as 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora'}
      />

      {/* Phase 1011: Bestellabbruch-Prävention-Banner — erscheint nach >3 Min im Checkout ohne Abschluss */}
      <StorefrontPhase1011BestellabbruchPraevention
        checkoutOpen={checkoutOpen}
        etaMinuten={deliveryTimeMin ?? 30}
      />

      {/* Phase 1032: Lieferzeit-Erwartungs-Manager — Realistische ETA-Range vor Bestellabschluss basierend auf aktueller Auslastung */}
      {checkoutOpen && (
        <Phase1032LieferzeitErwartungsManager
          locationId={location.id}
          isDelivery={orderType === 'lieferung'}
          className="fixed bottom-[env(safe-area-inset-bottom,0px)] left-0 right-0 z-[60] mx-4 mb-2"
        />
      )}

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
        onPlzChange={setDeliveryPlz}
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
      {/* Phase 1126: Live-ETA-Tracker — Echtzeit-Countdown + Phasen-Timeline mit Surge-Hinweis */}
      {order.isDelivery && (
        <LiveEtaTracker
          bestellnummer={order.orderId}
          locationId={locationId}
          initialEtaMin={order.etaMin ?? 30}
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
      {/* Phase 1017: Dynamische ETA-Live-Kommando — Konfidenz-Ampel + Phasen-Timeline + Fahrer-Annäherung + Countdown */}
      {order.isDelivery && order.orderId && !['geliefert', 'delivered', 'storniert', 'cancelled'].includes(order.status ?? '') && (
        <EtaDynamischLiveKommando
          orderId={order.orderId}
          locationId={locationId}
          className="mx-4 mb-4"
        />
      )}
      {/* Phase 1022: ETA-Live-Tracking-Kommando — Sekunden-Countdown + Phasen-Fortschritt + Fahrer-Name + ETA-Konfidenz */}
      {order.isDelivery && (
        <StorefrontPhase1022EtaLiveTrackingKommando
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          etaMinutes={order.etaMin ?? null}
          driverName={(order as any).fahrer_name ?? null}
          className="mx-4 mb-3"
        />
      )}
      {/* Phase 1023: ETA-Live-Tracking Pro — Dynamische ETA + Phasen-Timeline + Fahrer-Annäherung + Sekunden-Countdown */}
      {order.isDelivery && (
        <StorefrontPhase1023EtaLiveTrackingPro
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          etaMinutes={order.etaMin ?? null}
          driverName={(order as any).fahrer_name ?? null}
          className="mx-4 mb-3"
        />
      )}
      {/* Phase 1697: ETA-Countdown-Banner — Kompakter Phasen-Fortschritt + Sekundengenauer Countdown; immer sichtbar */}
      {order.isDelivery && (
        <StorefrontPhase1697EtaCountdownBanner
          status={order.status ?? null}
          etaMinutes={order.etaMin ?? null}
          orderedAt={(order as any).bestellt_am ?? null}
          className="mx-4 mb-3"
        />
      )}
      {/* Phase 1000: Live-Tracking-Status — 5-Schritt-Timeline mit Echtzeit-Polling + animiertem Indikator */}
      {order.isDelivery && order.orderId && (
        <Phase1000LiveTrackingStatus
          orderId={order.orderId}
          initialStatus={(order.status as any) ?? 'eingegangen'}
          locationId={locationId ?? null}
        />
      )}
      {/* Phase 1006: Live-Küchen-Auslastungs-Anzeige — Echtzeit-Ampel Niedrig/Normal/Hoch/Peak + erwartete Wartezeit */}
      <StorefrontPhase1006KuechenAuslastungsAnzeige locationId={locationId} className="mx-4 mb-3" />
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
      {/* Phase 1022: Bewertungs-Schnell-Widget — Kompakte 1–5-Sterne-Bewertung direkt nach Lieferung */}
      {order.isDelivery && (
        <Phase1022BewertungsSchnellWidget
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          className="mx-4 mb-4"
        />
      )}
      {/* Phase 1037: Produktbewertungs-Widget — 1–5-Sterne-Bewertung je Artikel nach Lieferung + Kommentar */}
      {order.isDelivery && (
        <StorefrontPhase1037ProduktbewertungsWidget
          orderId={order.orderId ?? null}
          status={order.status ?? null}
          className="mx-4 mb-4"
        />
      )}
      {/* Phase 1042: Live-ETA-Fahrer-Annäherungs-Panel — Phasen-Timeline + ETA-Ring + Proximity-Dot */}
      {order.isDelivery && order.orderId && order.status && !['geliefert', 'delivered', 'storniert', 'cancelled'].includes(order.status) && (
        <Phase1042LiveEtaFahrerAnnaeherungsPanel
          orderId={order.orderId}
          locationId={locationId}
        />
      )}
      {/* Phase 1027: Kunden-Stammkunden-Badge — "Willkommen zurück!" Banner mit letzter Bestellung + Treuepunkte */}
      <Phase1027StammkundenBadge locationId={locationId} className="mx-4 mb-4" />
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
