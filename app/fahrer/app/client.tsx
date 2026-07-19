'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Banknote, Bike, Calendar, Check, Car, CheckCircle2, ChevronDown, ChevronUp, Clock, FileText, Footprints,
  History, Loader2, LogOut, Map as MapIcon, MapPin, Navigation, Package, Phone, Power, Receipt, Route, ShoppingBag,
  TrendingUp, Trophy, Zap, ListOrdered,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { PickDialog } from './pick-dialog';
import { DeliveryView } from './delivery-view';
import { AlarmRinger } from './alarm-ringer';
import { PushRegister } from './push-register';
import { UpdateBanner } from './update-banner';
import { PermissionsGate } from './permissions-gate';
import { SchichtEffizienzMeter } from './schicht-effizienz';
import { TourProgressRing } from './tour-ring';
import { TourStopsPanel } from './tour-stops-panel';
import { TourGPSNavigator } from './tour-gps-navigator';
import { TourWazeNav } from './tour-waze-nav';
import { TourKpiSummary } from './tour-kpi-summary';
import { FahrerNaviStrip } from './fahrer-navi-strip';
import { NaviAppWahl } from './navi-app-wahl';
import { EarningsProgressBar } from './earnings-progress-bar';
import { TourMiniMap } from './tour-mini-map';
import { SchichtPuls } from './schicht-puls';
import { TourSpeedTracker } from './tour-speed-tracker';
import { OpenBatchMap } from './open-batch-map';
import { OfflineNetworkBanner } from './offline-network-banner';
import { TagesabschlussBadge, type TagesabschlussData } from './tagesabschluss-badge';
import { CashflowTracker } from './cashflow-tracker';
import { TourAbschlussRechner } from './tour-abschluss-rechner';
import { SchichtKpiLive } from './schicht-kpi-live';
import { StopNavCard } from './stop-nav-card';
import { EtaAmpel } from './eta-ampel';
import { FahrerTagesZusammenfassung } from './tages-zusammenfassung';
import { KundenHistorieKarte } from './kunden-historie-karte';
import { TourStatusHeader } from './tour-status-header';
import { FahrerStickyBar } from './fahrer-sticky-bar';
import { NextStopCta } from './next-stop-cta';
import { TourAbschlussPrognose } from './tour-abschluss-prognose';
import { NaviWidget } from './navi-widget';
import { SchichtEinnahmenRing } from './schicht-einnahmen-ring';
import { TourEffizienzScore } from './tour-effizienz-score';
import { FahrerRatingHistorie } from './rating-historie';
import { TourEfficiencyTicker } from './tour-efficiency-ticker';
import { StopTimerRing } from './stop-timer-ring';
import { SchichtPauseReminder } from './schicht-pause-reminder';
import { StreakBadge } from './streak-badge';
import { MeilensteinToast } from './meilenstein-toast';
import { TourOptBadge } from './tour-opt-badge';
import { FahrerWetterWarnBanner } from './wetter-warn-banner';
import { FahrerSchichtEinnahmenChart } from './schicht-einnahmen-chart';
import { FahrerTagesBewertungKarte } from './tages-bewertung-karte';
import { SchichtBedarfChip } from './schicht-bedarf-chip';
import { FahrzeitPrognose } from './fahrzeit-prognose';
import { StopSchnellPanel } from './stop-schnell-panel';
import { SmartStopNavigator } from './smart-stop-navigator';
import { NaechsterStoppCountdown } from './naechster-stopp-countdown';
import { FahrerIncentiveLiveStrip } from './incentive-live-strip';
import { FahrerComebackBonusHinweis } from './comeback-bonus-hinweis';
import { FahrerRouteQualitaet } from './route-qualitaet';
import { DriverHotspotTip } from './driver-hotspot-tip';
import { TourStopEtaPredictor } from './tour-stop-eta-predictor';
import { ProximityStopAlert } from './proximity-stop-alert';
import { TourFortschrittsCockpit } from './tour-fortschritts-cockpit';
import { TourEffizienzLive } from './tour-efficiency-live';
import { TourEffizienzAnalyse } from './tour-effizienz-analyse';
import { TourFeedbackSchnell } from './tour-feedback-schnell';
import { SchichtKilometerTracker } from './schicht-kilometer-tracker';
import { KassenUebersicht } from './kassen-uebersicht';
import { SchichtBonusBooster } from './schicht-bonus-booster';
import { FahrerAnkunftsSignal } from './ankunfts-signal';
import { FahrerRampUpFortschritt } from './ramp-up-fortschritt';
import { FahrerRichtungsAnzeige } from './richtungs-anzeige';
import { TourFertigPrognose } from './tour-fertig-prognose';
import { TourStopNavigator } from './tour-stop-navigator';
import { TourNavigationsCockpit } from './tour-navigations-cockpit';
import { FahrerKundenNotizKarte } from './kunden-notiz-karte';
import { TourZeitplanFahrer } from './tour-zeitplan-fahrer';
import { TourNaviHUD } from './tour-navi-hud';
import { TourPunktlichkeitsCoach } from './tour-punktlichkeits-coach';
import { TourStopsDetailPanel, type TourStop } from './tour-stop-detail-card';
import { TourStoppAktionen } from './tour-stopp-aktionen';
import { TourFortschrittsRing } from './tour-fortschritts-ring';
import { TourZielpunktKarte } from './tour-zielpunkt-karte';
import { TourStoppZeitlinie } from './tour-stopp-zeitlinie';
import { TourRueckkehrAnzeige } from './tour-rueckkehr-anzeige';
import { SchichtZusammenfassungLive } from './schicht-zusammenfassung-live';
import { FahrerProblemMeldung } from './fahrer-problem-meldung';
import { LieferungCheckliste } from './lieferung-checkliste';
import { FahrerPushStatusKarte } from './push-status-karte';
import { TourStoppUebersicht } from './tour-stopp-uebersicht';
import { KundenStopInfo } from './kunden-stop-info';
import { FahrerStopVerificationPanel } from './stop-verification-panel';
import { FahrerDispatchNachrichten } from './dispatch-nachrichten';
import { EchtzeitLeistungsAnzeige } from './echtzeit-leistungs-anzeige';
import { SchichtUmsatzVelocity } from './schicht-umsatz-velocity';
import { StopSmartCountdown } from './stop-smart-countdown';
import { FahrerDelayAlertHinweis } from './delay-alert-hinweis';
import { FahrerAnalyticsWochenuebersicht } from './analytics-wochenuebersicht';
import { FahrerSchichtAusblick } from './schicht-ausblick';
import { TourKostenErtrag } from './tour-kosten-ertrag';
import { FahrerWochenRangKarte } from './wochen-rang-karte';
import { TourSchichtBilanz } from './tour-schicht-bilanz';
import { TourNaechsterStoppInfo } from './tour-naechster-stopp-info';
import { TourAbschlussSchnellPanel } from './tour-abschluss-schnell-panel';
import FahrerSchichtPuls from './fahrer-schicht-puls';
import { TourRouteTiming } from './tour-route-timing';
import { TourStoppEtaMatrix } from './tour-stopp-eta-matrix';
import { FahrerGebuehrenInfo } from './gebuehren-info';
import { FahrerSchichtVerdienstLive } from './schicht-verdienst-live';
import { FahrerTagesEinnahmenKarte } from './tages-einnahmen-karte';
import { FahrerStornoInfoBanner } from './storno-info-banner';
import { FahrerSchichtEnergieCheck } from './schicht-energie-check';
import { HeatmapTipp } from './heatmap-tipp';
import { FahrerStandortHealthBadge } from './standort-health-badge';
import { TourRewardProgress } from './tour-reward-progress';
import { FahrerMeinEngagement } from './mein-engagement';
import { FahrerTourNavigatorPro } from './tour-navigator-pro';
import { FahrerTrinkgeldLiveTracker } from './trinkgeld-live-tracker';
import { FahrerTourAbschlussBewertung } from './tour-abschluss-bewertung';
import { TourStartFeedbackReminder } from './tour-start-feedback-reminder';
import { FahrerMeineScoreKarte } from './meine-score-karte';
import { FahrerScoreVerlaufChart } from './score-verlauf-chart';
import { FahrerPeakTagHinweis } from './peak-tag-hinweis';
import { FahrerFeedbackMonatsbericht } from './feedback-monatsbericht';
import { FahrerTourEffizienzKarte } from './tour-effizienz-karte';
import { SmartStopActionCard } from './smart-stop-action-card';
import { TourAktuellerStopFokus } from './tour-aktueller-stop-fokus';
import { TourStoppNavV2 } from './tour-stopp-nav-v2';
import { FahrerStoppErinnerungsPanel } from './stop-erinnerungs-panel';
import { NaechsterStoppVorschau } from './naechster-stopp-vorschau';
import { FahrerStopRhythmusMeter } from './stop-rhythmus-meter';
import { TourStopNavigationBoard } from './tour-stop-navigation-board';
import { FahrerSchichtFortschrittsRing } from './schicht-fortschritts-ring';
import { FahrerStoppZaehlerStrip } from './stopp-zaehler-strip';
import { FahrerPausenEmpfehlung } from './pausen-empfehlung';
import { FahrerTourZeitplanLive } from './tour-zeitplan-live';
import { FahrerSchichtDauerLive } from './schicht-dauer-live';
import { TourStoppListe } from './tour-stopp-liste';
import { TourStopCheckliste } from './tour-stop-checkliste';
import { FahrerSchichtPacingGuide } from './schicht-pacing-guide';
import { StopDistanzInfo } from './stop-distanz-info';
import { NaechsterStopFokus } from './naechster-stop-fokus';
import { FahrerNavHub } from './fahrer-nav-hub';
import { TourStoppCountdownRing } from './tour-stopp-countdown-ring';
import { TourKassenRadar } from './tour-kassen-radar';
import { KundenKontaktSchnell } from './kunden-kontakt-schnell';
import { FahrerPhase915TourStoppNavigatorPro } from './phase915-tour-stopp-navigator-pro';
import { FahrerTagesScoreKarte } from './tages-score-karte';
import { FahrerWochenScoreVerlauf } from './wochen-score-verlauf';
import { FahrerTourNaechsterStoppKarte } from './tour-naechster-stopp-karte';
import { TourVerdiensteZielTracker } from './tour-verdienst-ziel-tracker';
import { SchichtPaceLive } from './schicht-pace-live';
import { FahrerAktuellerStoppCard } from './aktueller-stopp-card';
import { FahrerTourZeitfensterKarte } from './tour-zeitfenster-karte';
import { TourNavigationsKompass } from './tour-navigations-kompass';
import { TourStoppSequenzBoard } from './tour-stopp-sequenz-board';
import { TourZeitfensterAmpel } from './tour-zeitfenster-ampel';
import { TourSequenzNavigatorPro } from './tour-sequenz-navigator-pro';
import { FahrerStoppSchnellKommando } from './stopp-schnell-kommando';
import { FahrerStopZielkompass } from './stop-zielkompass';
import { TourStopSchnellQuittierung } from './tour-stop-schnell-quittierung';
import { TourStopQuickActions } from './tour-stop-quick-actions';
import { TourStopImpulseKarte } from './tour-stop-impulse-karte';
import { SchichtEndSummary } from './schicht-end-summary';
import { FahrerTourVerdienstVerlauf } from './tour-verdienst-verlauf';
import { FahrerBatterieAnzeige } from './batterie-anzeige';
import { SchichtStornoHinweis } from './schicht-storno-hinweis';
import { FahrerPrognoseBadge } from './fahrer-prognose-badge';
import { FahrerBewertungsWidget } from './fahrer-bewertungs-widget';
import { FahrerWartezeitTipp } from './fahrer-wartezeit-tipp';
import { StoppAbschlussAmpel } from './stopp-abschluss-ampel';
import { QuickNavKommando } from './quick-nav-kommando';
import { ZonenHotChip } from './zonen-hot-chip';
import { StopArrivalProximity } from './stop-arrival-proximity';
import { TourCompletionScreen } from './tour-completion';
import { LieferungBestaetigung } from './lieferung-bestaetigung';
import { TourLieferquote } from './tour-lieferquote';
import { SchichtBriefingCard } from './schicht-briefing-card';
import { SchichtAbschlussBericht } from './schicht-abschluss-bericht';
import { FahrerIncentiveWidget } from './fahrer-incentive-widget';
import { FahrerZeugnisCard } from './fahrer-zeugnis-card';
import { QualitaetsTrendKarte } from './qualitaets-trend-karte';
import { StopCompass } from './stop-compass';
import { TourStoppFortschrittsLeiste } from './tour-stopp-fortschritts-leiste';
import { FahrerStoppTempoAnzeige } from './stopp-tempo-anzeige';
import { TourKompaktKommando } from './tour-kompakt-kommando';
import { TourKompletierungsPrognose } from './tour-kompletierungs-prognose';
import { TourStoppPrioritaetsNavigator } from './tour-stopp-prioritaets-navigator';
import { TourStoppNavigationsHub } from './tour-stopp-navigations-hub';
import { FahrerSchichtStatusStrip } from './fahrer-schicht-status-strip';
import { TourStoppFokusHub } from './tour-stopp-fokus-hub';
import { TourHeimkehrCountdown } from './tour-heimkehr-countdown';
import { StopAbschlussSchnellPanel } from './stop-abschluss-schnell-panel';
import { FahrerSelbstBewertung } from './fahrer-selbst-bewertung';
import { FahrerCoachingWidget } from './fahrer-coaching-widget';
import { NaechsterStoppEtaRing } from './naechster-stopp-eta-ring';
import { FahrerStopAktionsPanel } from './fahrer-stop-aktions-panel';
import { FahrerErholungsTracker } from './erholungs-tracker';
import { FahrerOfflineSyncBanner } from './offline-sync-banner';
import { OfflineSyncManager } from './offline-sync-manager';
import { TourStoppSequenzPro } from './tour-stopp-sequenz-pro';
import { TourStoppOptimierung } from './tour-stopp-optimierung';
import { TourStopKommando } from './tour-stop-kommando';
import { FahrerTrinkgeldPrognose } from './fahrer-trinkgeld-prognose';
import { TourLiveSchrittCockpit } from './tour-live-schritt-cockpit';
import { TourStoppSofortKommando } from './tour-stopp-sofort-kommando';
import { TourNavFokusKarte } from './tour-nav-fokus-karte';
import { FahrerPhase500NaechsterStoppNav } from './phase500-naechster-stopp-nav';
import { FahrerPhase501LiveVerdienst } from './phase501-live-verdienst';
import { FahrerPhase502TourStoppNavigator } from './phase502-tour-stopp-navigator';
import { FahrerPhase503StoppDetailsKommando } from './phase503-stopp-details-kommando';
import { FahrerSchichtErtragsMeter } from './schicht-ertrag-meter';
import { TourStoppSchnellNav } from './tour-stopp-schnell-nav';
import { FahrerPhase551AktuellerStoppFokus } from './phase551-aktueller-stopp-fokus';
import { FahrerPhase552SchichtTempoAmpel } from './phase552-schicht-tempo-ampel';
import { FahrerPhase565TourHeimkehrInfo } from './phase565-tour-heimkehr-info';
import { FahrerPhase570TourAktivKommando } from './phase570-tour-aktiv-kommando';
import { FahrerPhase575SchichtEffizienzCockpit } from './phase575-schicht-effizienz-cockpit';
import { FahrerPhase581SchichtZielFortschrittsring } from './phase581-schicht-ziel-fortschrittsring';
import { FahrerPhase586StoppNavigatorKarte } from './phase586-stopp-navigator-karte';
import { FahrerPhase591TourStoppLiveNav } from './phase591-tour-stopp-live-nav';
import { FahrerPhase596SchichtNavHub } from './phase596-schicht-nav-hub';
import { FahrerPhase603SchichtAbschlussZusammenfassung } from './phase603-schicht-abschluss-zusammenfassung';
import { FahrerPhase608TrinkgeldTrendWidget } from './phase608-trinkgeld-trend-widget';
import { FahrerPhase613LetzteBewertungenWidget } from './phase613-letzte-bewertungen-widget';
import { FahrerPhase618TagesEinnahmenDifferenz } from './phase618-tages-einnahmen-differenz';
import { FahrerPhase623PauseEmpfehlung } from './phase623-pause-empfehlung';
import { FahrerPhase628KmTageslog } from './phase628-km-tageslog';
import { FahrerPhase629TourStoppNavigatorPro } from './phase629-tour-stopp-navigator-pro';
import { FahrerPhase630NavigationLiveCockpit } from './phase630-navigation-live-cockpit';
import { FahrerPhase631TourNachbereitungDialog } from './phase631-tour-nachbereitung-dialog';
import { FahrerPhase639SchichtBilanzVorschau } from './phase639-schicht-bilanz-vorschau';
import { FahrerPhase644NaechsterStopEntfernung } from './phase644-naechster-stop-entfernung';
import { FahrerPhase648TourStoppLiveKommando } from './phase648-tour-stopp-live-kommando';
import { FahrerPhase653SchichtStornoWarnung } from './phase653-schicht-storno-warnung';
import { FahrerPhase657FahrzeugCheckWidget } from './phase657-fahrzeug-check-widget';
import { FahrerPhase662TourpauseEmpfehlungPro } from './phase662-tourpause-empfehlung-pro';
import { FahrerPhase667TagesEinnahmenPrognose } from './phase667-tages-einnahmen-prognose';
import { FahrerPhase672TourQualitaetsScore } from './phase672-tour-qualitaets-score';
import { FahrerPhase677SchichtAbschlussScreen } from './phase677-schicht-abschluss-screen';
import { FahrerPhase682WochenZielFortschrittsring } from './phase682-wochenziel-fortschrittsring';
import { FahrerPhase683TourStoppNavigatorLive } from './phase683-tour-stopp-navigator-live';
import { FahrerPhase684NavigationLiveCockpit } from './phase684-navigation-live-cockpit';
import { FahrerPhase689KmStandFreigabe } from './phase689-km-stand-freigabe';
import { FahrerPhase693TourStoppNavigator } from './phase693-tour-stopp-navigator';
import { FahrerPhase694WochenEinnahmenCockpit } from './phase694-wochen-einnahmen-cockpit';
import { FahrerPhase699PauseTimerWidget } from './phase699-pause-timer-widget';
import { FahrerPhase704NaechsteTourVorabInfo } from './phase704-naechste-tour-vorab-info';
import { FahrerPhase709TagesBilanzZusammenfassung } from './phase709-tages-bilanz-zusammenfassung';
import { FahrerPhase714NaechsterStopCountdown } from './phase714-naechster-stop-countdown';
import { FahrerPhase719GpsGenauigkeitsWarnung } from './phase719-gps-genauigkeits-warnung';
import { FahrerPhase724SchichtEndeBestaetigung } from './phase724-schicht-ende-bestaetigung';
import { FahrerPhase729FahrtenChronik } from './phase729-fahrten-chronik';
import { FahrerPhase734StreakAnzeige } from './phase734-streak-anzeige';
import { FahrerPhase739TrinkgeldRangliste } from './phase739-trinkgeld-rangliste';
import { FahrerPhase744SchichtUeberstundenWarnung } from './phase744-schicht-ueberstunden-warnung';
import { FahrerPhase749KmTagesTracker } from './phase749-km-tages-tracker';
import { FahrerPhase754SlaAlarmWidget } from './phase754-sla-alarm-widget';
import { FahrerPhase759TagesEinnahmenCockpit } from './phase759-tages-einnahmen-cockpit';
import { FahrerPhase759LiveEinnahmenTicker } from './phase759-live-einnahmen-ticker';
import { FahrerPhase763LiveStoppFortschritt } from './phase763-live-stopp-fortschritt';
import { FahrerPhase764StundenVerdienstMuster } from './phase764-stunden-verdienst-muster';
import { FahrerPhase768EigeneBewertung } from './phase768-eigene-bewertung';
import { FahrerPhase773TagesHighlightsWidget } from './phase773-tages-highlights-widget';
import { Phase776TourStoppSequenzLive } from './phase776-tour-stopp-sequenz-live';
import { FahrerPhase783SchichtZielFortschrittsRing } from './phase783-schicht-ziel-fortschritts-ring';
import { FahrerPhase787TourStoppLiveKompass } from './phase787-tour-stopp-live-kompass';
import { FahrerPhase793SchichtCoachTipp } from './phase793-schicht-coach-tipp';
import { FahrerPhase798EigeneStornoBilanz } from './phase798-eigene-storno-bilanz';
import { FahrerPhase803WetterAuswirkungsHinweis } from './phase803-wetter-auswirkungs-hinweis';
import { FahrerPhase808TourStoppNavigatorUltimate } from './phase808-tour-stopp-navigator-ultimate';
import { FahrerPhase812TagesVerdienstHochrechnung } from './phase812-tages-verdienst-hochrechnung';
import { FahrerPhase813TourStopsHub } from './phase813-tour-stops-hub';
import { FahrerPhase817NavigationsEffizienz } from './phase817-navigations-effizienz';
import { FahrerPhase822SchichtScoreCockpit } from './phase822-schicht-score-cockpit';
import { FahrerPhase827TagesEinnahmenBreakdown } from './phase827-tages-einnahmen-breakdown';
import { FahrerPhase828TourStoppNavigatorHub } from './phase828-tour-stopp-navigator-hub';
import { FahrerPhase829NavigationLiveCockpit } from './phase829-navigation-live-cockpit';
import { FahrerPhase832KundenzufriedenheitsTrend } from './phase832-kundenzufriedenheits-trend';
import { FahrerPhase833TourEffizienzLive } from './phase833-tour-effizienz-live';
import { FahrerPhase834TourLiveKommando } from './phase834-tour-live-kommando';
import { FahrerPhase835SchichtBilanzCockpit } from './phase835-schicht-bilanz-cockpit';
import { FahrerPhase844SchichtZusammenfassung } from './phase844-schicht-zusammenfassung';
import { FahrerPhase849StreckenEffizienzFeedback } from './phase849-strecken-effizienz-feedback';
import { FahrerPhase850TourStoppNavPro } from './phase850-tour-stopp-nav-pro';
import { FahrerPhase854SchichtEnergieCoach } from './phase854-schicht-energie-coach';
import { FahrerPhase859NaviEtaVergleich } from './phase859-navi-eta-vergleich';
import { FahrerPhase863SchichtStoppStatistik } from './phase863-schicht-stopp-statistik';
import { FahrerPhase869FahrTippsCoach } from './phase869-fahr-tipps-coach';
import { FahrerPhase874TourenKartenMinimap } from './phase874-touren-karten-minimap';
import { TourStoppLiveNavigator } from './tour-stopp-live-navigator';
import { FahrerPhase876TourNaechsterStoppUltra } from './phase876-tour-naechster-stopp-ultra';
import { FahrerPhase877TourStoppNavigatorLive, type TourStoppLive } from './phase877-tour-stopp-navigator-live';
import { FahrerPhase882SchichtEnergieplan } from './phase882-schicht-energieplan';
import { FahrerPhase887TrinkgeldTagestrend } from './phase887-trinkgeld-tagestrend';
import { FahrerPhase892TrinkgeldVerlaufWidget } from './phase892-trinkgeld-verlauf-widget';
import { FahrerPhase897SchichtScoreCockpit } from './phase897-schicht-score-cockpit';
import { FahrerPhase900TourStopsPrioritaet } from './phase900-tour-stops-prioritaet';
import { FahrerPhase902ZielFortschrittBar } from './phase902-fahrer-ziel-fortschritt-bar';
import { FahrerPhase914SchichtAbschlussHighlight } from './phase914-schicht-abschluss-highlight';
import { FahrerPhase921MonatsRangliste } from './phase921-monats-rangliste';
import { FahrerPhase925TourStoppNavigationsCockpit } from './phase925-tour-stopp-navigations-cockpit';
import { FahrerPhase927KraftstoffTracker } from './phase927-kraftstoff-tracker';
import { FahrerPhase930TourStoppNavigatorUltimate } from './phase930-tour-stopp-navigator-ultimate';
import { FahrerPhase934TourLernkurve } from './phase934-tour-lernkurve';
import { FahrerPhase935TourLiveKommando } from './phase935-tour-live-kommando';
import { FahrerPhase939KundenzufriedenheitsVerlauf } from './phase939-kundenzufriedenheits-verlauf';
import { FahrerPhase944SchichtEnergieRing } from './phase944-schicht-energie-ring';
import { FahrerPhase949TourStoppLiveNavigator } from './phase949-tour-stopp-live-navigator';
import { FahrerPhase959SchichtAbschlussProtokoll } from './phase959-schicht-abschluss-protokoll';
import { FahrerPhase961SchichtGewinnHochrechnung } from './phase961-schicht-gewinn-hochrechnung';
import { FahrerPhase964TourReihenfolgeVorschlag } from './phase964-tour-reihenfolge-vorschlag';
import { FahrerPhase969KundenkommentarVorschau } from './phase969-kundenkommentar-vorschau';
import { FahrerPhase974NaechsterStoppUltraNavigator } from './phase974-naechster-stopp-ultra-navigator';
import { FahrerPhase979SchichtEnergiePrognose } from './phase979-schicht-energie-prognose';
import { FahrerPhase984TourStoppNavigationLive } from './phase984-tour-stopp-navigation-live';
import { FahrerPhase989SchichtZielFortschrittsRing } from './phase989-schicht-ziel-fortschritts-ring';
import { FahrerPhase994KundenKontaktSchnellPanel } from './phase994-kunden-kontakt-schnell-panel';
import { FahrerPhase999SchichtAbschlussHighlightScreen } from './phase999-schicht-abschluss-highlight-screen';
import { FahrerPhase1001TourStoppNavigatorFinal } from './phase1001-tour-stopp-navigator-final';
import { FahrerPhase1005VerdienstZielTracker } from './phase1005-verdienst-ziel-tracker';
import { FahrerPhase1002GpsNaviKommando } from './phase1002-gps-navi-kommando';
import { FahrerPhase1010PausenEmpfehlung } from './phase1010-pausen-empfehlung';
import { FahrerPhase1015TourStopsNavigationsHub } from './phase1015-tour-stops-navigations-hub';
import { FahrerPhase1021SchichtStartAssistent } from './phase1021-schicht-start-assistent';
import { FahrerPhase1026WetterEinflussAnzeige } from './phase1026-wetter-einfluss-anzeige';
import { FahrerPhase1018SmartTourNavigationsHub } from './phase1018-smart-tour-navigations-hub';
import { FahrerPhase1031EinnahmenPrognoseAssistent } from './phase1031-einnahmen-prognose-assistent';
import { FahrerPhase1036StreckenKilometerstandLog } from './phase1036-strecken-kilometerstand-log';
import { FahrerPhase1040NaechsterStoppUltraKommando } from './phase1040-naechster-stopp-ultra-kommando';
import { FahrerPhase1046KundenbewertungsLiveTicker } from './phase1046-kundenbewertungs-live-ticker';
import { FahrerPhase1051RoutenEffizienzFeedback } from './phase1051-routen-effizienz-feedback';
import { FahrerPhase1056SchichtMotivationsCoach } from './phase1056-schicht-motivations-coach';
import { FahrerPhase1066TrinkgeldAnalyseDashboard } from './phase1066-trinkgeld-analyse-dashboard';
import { FahrerPhase1071KundenKontaktSchnellPanelV2 } from './phase1071-kunden-kontakt-schnell-panel-v2';
import { FahrerPhase1076LiveTourKartenMinimap } from './phase1076-live-tour-karten-minimap';
import { FahrerPhase1081SchichtAbschlussStatistikScreen } from './phase1081-schicht-abschluss-statistik-screen';
import { FahrerPhase1086NaechsterStoppNavigationCard } from './phase1086-naechster-stopp-navigation-card';
import { FahrerPhase1087TourStoppSmartNavigatorHub } from './phase1087-tour-stopp-smart-navigator-hub';
import { FahrerPhase1090StoppNavigatorCockpit } from './phase1090-stopp-navigator-cockpit';
import { FahrerPhase1091TourAbschlussSelfieCheck } from './phase1091-tour-abschluss-selfie-check';
import { FahrerPhase1096KilometerstandQuittung } from './phase1096-kilometerstand-quittung';
import { FahrerPhase1101LiveKundenbewertung } from './phase1101-live-kundenbewertung';
import { FahrerPhase1106TrinkgeldWochenUebersicht } from './phase1106-trinkgeld-wochen-uebersicht';
import { FahrerPhase1111KundenFeedbackChronik } from './phase1111-kunden-feedback-chronik';
import { FahrerPhase1116SchichtMeilensteinTracker } from './phase1116-schicht-meilenstein-tracker';
import { FahrerPhase1121TagesZielFortschrittsRing } from './phase1121-tages-ziel-fortschritts-ring';
import { FahrerPhase1126KombiTourVorschau } from './phase1126-kombi-tour-vorschau';
import { FahrerPhase1125TourStoppNavigationsHub } from './phase1125-tour-stopp-navigations-hub';
import { FahrerPhase1131SchichtAbschlussZusammenfassung } from './phase1131-schicht-abschluss-zusammenfassung';
import { FahrerPhase1132EinnahmenWochenuebersicht } from './phase1132-einnahmen-wochenuebersicht';
import { FahrerPhase1137SchichtKpiAbschluss } from './phase1137-schicht-kpi-abschluss';
import { FahrerPhase1142NaechsteSchichtVorschau } from './phase1142-naechste-schicht-vorschau';
import { FahrerPhase1146StoppQualitaetsCheck } from './phase1146-stopp-qualitaets-check';
import { FahrerPhase1152SchichtEnergieCockpit } from './phase1152-schicht-energie-cockpit';
import { FahrerPhase1157TourStoppKommandoUltra } from './phase1157-tour-stopp-kommando-ultra';
import { FahrerPhase1162TourStoppLiveKommando } from './phase1162-tour-stopp-live-kommando';
import { FahrerPhase1167SmartTourNavigatorPro } from './phase1167-smart-tour-navigator-pro';
import { FahrerPhase1172TourStoppNaviHub } from './phase1172-tour-stopp-navi-hub';
import { FahrerPhase1178TourZusammenfassung } from './phase1178-tour-zusammenfassung';
import { FahrerPhase1182SchichtMomentumTracker } from './phase1182-schicht-momentum-tracker';
import { FahrerPhase1187TourStoppNavigationsCockpit } from './phase1187-tour-stopp-navigations-cockpit';
import { FahrerPhase1191SchichtTrinkgeldTracker } from './phase1191-schicht-trinkgeld-tracker';
import { FahrerPhase1196RoutenEffizienzBadge } from './phase1196-routen-effizienz-badge';
import { FahrerPhase1201TagesKmLiveTracker } from './phase1201-tages-km-live-tracker';
import { FahrerPhase1206ZonenVertrautheitsScore } from './phase1206-zonen-vertrautheits-score';
import { FahrerPhase1206TourStoppNavigationLiveKommando } from './phase1206-tour-stopp-navigation-live-kommando';
import { FahrerPhase1214BonusStatusTracker } from './phase1214-bonus-status-tracker';
import { FahrerPhase1219KundenAnrufLog } from './phase1219-kunden-anruf-log';
import { FahrerPhase1224SchichtEndeEnergieCheck } from './phase1224-schicht-ende-energie-check';
import { FahrerPhase1229EnergieVerlauf } from './phase1229-energie-verlauf';
import { FahrerPhase1234TourQualitaetsAbzeichen } from './phase1234-tour-qualitaets-abzeichen';
import { FahrerPhase1239EinnahmenPrognoseWidget } from './phase1239-einnahmen-prognose-widget';
import { FahrerPhase1244SchichtBilanzPreview } from './phase1244-schicht-bilanz-preview';
import { FahrerPhase1249SchichtStimmungsTracker } from './phase1249-schicht-stimmungs-tracker';
import { FahrerPhase1254NaviZusammenfassungWidget } from './phase1254-navi-zusammenfassung-widget';
import { FahrerPhase1259TagesRangliste } from './phase1259-tages-rangliste';
import { FahrerPhase1264SchichtSnapshotWidget } from './phase1264-schicht-snapshot-widget';
import { FahrerPhase1004SmartNavigationHubUltra } from './phase1004-smart-navigation-hub-ultra';
import { FahrerPhase1269TrinkgeldWochenuebersicht } from './phase1269-trinkgeld-wochenuebersicht';
import { FahrerPhase1274KraftstoffAkkuTracker } from './phase1274-kraftstoff-akku-tracker';
import { FahrerPhase1279KundenzufriedenheitsSchnellPoll } from './phase1279-kundenzufriedenheits-schnell-poll';
import { FahrerPhase1284TourStopNavigationDashboard } from './phase1284-tour-stop-navigation-dashboard';
import { FahrerPhase1288SchichtStartCheckliste } from './phase1288-schicht-start-checkliste';
import { FahrerPhase1292SchichtEndeBestaetigung } from './phase1292-schicht-ende-bestaetigung';
import { FahrerPhase1297TourEndeFotoUpload } from './phase1297-tour-ende-foto-upload';
import { FahrerPhase1302SchichtStatistikKarte } from './phase1302-schicht-statistik-karte';
import { FahrerPhase1307SchichtPauseEmpfehlung } from './phase1307-schicht-pause-empfehlung';
import { FahrerPhase1312TagesZielFortschritt } from './phase1312-tages-ziel-fortschritt';
import { FahrerPhase1310LiveStoppNavigator } from './phase1310-live-stopp-navigator';
import { FahrerPhase1317SchichtEinnahmenTracker } from './phase1317-schicht-einnahmen-tracker';
import { FahrerPhase1322TrinkgeldSchnellEingabe } from './phase1322-trinkgeld-schnell-eingabe';
import { FahrerPhase1313SmartTourNavigatorUltra } from './phase1313-smart-tour-navigator-ultra';
import { FahrerPhase1345TourStoppNavigatorUltimate } from './phase1345-tour-stopp-navigator-ultimate';
import { FahrerPhase1327OfflineModusIndikator } from './phase1327-offline-modus-indikator';
import { FahrerPhase1350TourStoppNavigatorPlus } from './phase1350-tour-stopp-navigator-plus';
import { FahrerPhase1354NavigationsFavoriten } from './phase1354-navigations-favoriten';
import { FahrerPhase1359SchichtZielZusammenfassung } from './phase1359-schicht-ziel-zusammenfassung';
import { FahrerPhase1364TourAbschlussZusammenfassung } from './phase1364-tour-abschluss-zusammenfassung';
import { FahrerPhase1369KundenZufriedenheitsAmpel } from './phase1369-kunden-zufriedenheits-ampel';
import { FahrerPhase1374SchichtBilanzOverlay } from './phase1374-schicht-bilanz-overlay';
import { FahrerPhase1379TourStoppNavigationLiveCockpit } from './phase1379-tour-stopp-navigation-live-cockpit';
import { FahrerPhase1384LiveEinnahmenTicker } from './phase1384-live-einnahmen-ticker';
import { FahrerPhase1388TourStoppNaviUltimate } from './phase1388-tour-stopp-navi-ultimate';
import { FahrerPhase1393SchichtPauseTimer } from './phase1393-schicht-pause-timer';
import { FahrerPhase1398KilometerstandQuittung } from './phase1398-kilometerstand-quittung';
import { FahrerPhase1403SchichtNotiz } from './phase1403-schicht-notiz';
import { FahrerPhase1408SchichtEnergieCheck } from './phase1408-schicht-energie-check';
import { FahrerPhase1413KundenBewertungsVorschau } from './phase1413-kunden-bewertungs-vorschau';
import { FahrerPhase1410SmartHeimkehrNavigator } from './phase1410-smart-heimkehr-navigator';
import { FahrerPhase1418SchichtWetterCheck } from './phase1418-schicht-wetter-check';
import { FahrerPhase1423TagesEinnahmenUebersicht } from './phase1423-tages-einnahmen-uebersicht';
import { FahrerPhase1428TourSicherheitsCheck } from './phase1428-tour-sicherheits-check';
import { FahrerPhase1433SmartStoppNavigatorUltra } from './phase1433-smart-stopp-navigator-ultra';
import { FahrerPhase1433PostTourFeedback } from './phase1433-post-tour-feedback';
import { FahrerTourStoppAnalyseCard } from './phase1437-tour-stopp-analyse-card';
import { FahrerPhase1442HeimwegAssistent } from './phase1442-heimweg-assistent';
import { FahrerPhase1447PersoenlicheBonusKarte } from './phase1447-persoenliche-bonus-karte';
import { FahrerPhase1452LieferStreakAnzeige } from './phase1452-liefer-streak-anzeige';
import { FahrerPhase1450TourStoppNavigationsFinal } from './phase1450-tour-stopp-navigations-final';
import { FahrerPhase1454SchichtGewinnRingCockpit } from './phase1454-schicht-gewinn-ring-cockpit';
import { FahrerPhase1457WochenRueckblickWidget } from './phase1457-wochen-rueckblick-widget';
import { FahrerPhase1459TourNavigationKommando } from './phase1459-tour-navigation-kommando';
import { FahrerPhase1463PersoenlicheSchichtZusammenfassung } from './phase1463-persoenliche-schicht-zusammenfassung';
import { FahrerPhase1462TourStoppNavigationsKommando } from './phase1462-tour-stopp-navigations-kommando';
import { FahrerPhase1468TageszielFortschrittsRing } from './phase1468-tagesziel-fortschritts-ring';
import { FahrerPhase1469SmartNaviZielCockpit } from './phase1469-smart-navi-ziel-cockpit';
import { FahrerPhase1470VerdienstPrognoseLive } from './phase1470-verdienst-prognose-live';
import { FahrerPhase1471TourStoppSmartNavigator } from './phase1471-tour-stopp-smart-navigator';
import { FahrerPhase1474SchichtEndeCountdown } from './phase1474-schicht-ende-countdown';
import { FahrerPhase1479SchichtCountdownTimerV2 } from './phase1479-schicht-countdown-timer-v2';
import { FahrerPhase1484StreckenEffizienzScore } from './phase1484-strecken-effizienz-score';
import { FahrerPhase1489RoutenEffizienzKarte } from './phase1489-routen-effizienz-karte';
import { FahrerPhase1494SmartStoppCountdown } from './phase1494-smart-stopp-countdown';
import { FahrerPhase1500TourAbschlussZusammenfassung } from './phase1500-tour-abschluss-zusammenfassung';
import { FahrerPhase1501StoppNavKommando } from './phase1501-stopp-nav-kommando';
import { FahrerPhase1505SchichtVergleichsKarte } from './phase1505-schicht-vergleichs-karte';
import { FahrerPhase1505SmartTourCockpit } from './phase1505-smart-tour-cockpit';
import { FahrerPhase1510KilometerstandTracker } from './phase1510-kilometerstand-tracker';
import { FahrerPhase1515NaechsteTourVorbereitung } from './phase1515-naechste-tour-vorbereitung';
import { FahrerPhase1520SchichtPausenEmpfehlung } from './phase1520-schicht-pausen-empfehlung';
import { FahrerPhase1526SmartTourStoppCockpit } from './phase1526-smart-tour-stop-cockpit';
import { FahrerPhase1530TagesabschlussBerichtsKarte } from './phase1530-tagesabschluss-berichts-karte';
import { FahrerPhase1535TrinkgeldTracker } from './phase1535-trinkgeld-tracker';
import { FahrerPhase1540ZonenTippKarte } from './phase1540-zonen-tipp-karte';
import { FahrerPhase1545TourStopsFinalHub } from './phase1545-tour-stops-final-hub';
import { FahrerPhase1545SchichtAnmeldeWidget } from './phase1545-schicht-anmelde-widget';
import { FahrerPhase1550LiveSchichtBilanz } from './phase1550-live-schicht-bilanz';
import { FahrerPhase1550KundenbewertungsFeedbackKarte } from './phase1550-kundenbewertungs-feedback-karte';
import { FahrerPhase1555BonusChancenWidget } from './phase1555-bonus-chancen-widget';
import { FahrerPhase1560SchichtEffizienzRing } from './phase1560-schicht-effizienz-ring';
import { FahrerPhase1565KundenZufriedenheitsAmpel } from './phase1565-kunden-zufriedenheits-ampel';
import { FahrerPhase1570TageseinnahmenVerlauf } from './phase1570-tageseinnahmen-verlauf';
import { FahrerPhase1570NaechsteSchichtErinnerungsKarte } from './phase1570-naechste-schicht-erinnerungs-karte';
import { FahrerPhase1575NaechsteSchichtErinnerungsKarte } from './phase1575-naechste-schicht-erinnerungs-karte';
import { FahrerPhase1580SchichtCountdownTimer } from './phase1580-schicht-countdown-timer';
import { FahrerPhase1585TourStopsNavigationUltimate } from './phase1585-tour-stops-navigation-ultimate';
import { FahrerPhase1590EinnahmenZusammenfassungKarte } from './phase1590-einnahmen-zusammenfassung-karte';
import { FahrerPhase1595SmartTourStoppNavigator } from './phase1595-smart-tour-stopp-navigator';
import { FahrerPhase1600SchichtEnergieCoach } from './phase1600-schicht-energie-coach';
import { FahrerPhase1605TourRueckblickKarte } from './phase1605-tour-rueckblick-karte';
import { FahrerPhase1610TrinkgeldWochenzielTracker } from './phase1610-trinkgeld-wochenziel-tracker';
import { FahrerPhase1615TourStoppNavigationsUltraHub } from './phase1615-tour-stopp-navigations-ultra-hub';
import { FahrerPhase1620TagesKpiScoreboard } from './phase1620-tages-kpi-scoreboard';
import { FahrerPhase1625RoutenEffizienzKarte } from './phase1625-routen-effizienz-karte';
import { FahrerPhase1630TourStoppLiveNaviCockpit } from './phase1630-tour-stopp-live-navi-cockpit';
import { FahrerPhase1634NaechsteSchichtVorbereitungCard } from './phase1634-naechste-schicht-vorbereitung-card';
import { FahrerPhase1639FeierabendZusammenfassungCard } from './phase1639-feierabend-zusammenfassung-card';
import { FahrerPhase1644TourQualitaetsScoreKarte } from './phase1644-tour-qualitaets-score-karte';
import { FahrerPhase1649SmartTourStoppNavigatorPro } from './phase1649-smart-tour-stopp-navigator-pro';
import { FahrerPhase1654SchichtEnergieRadar } from './phase1654-schicht-energie-radar';
import { FahrerPhase1660LernTippKarte } from './phase1660-lern-tipp-karte';
import { FahrerPhase1665TourStopsNavKommando } from './phase1665-tour-stops-nav-kommando';
import { FahrerPhase1670MeineEffizienzScoreKarte } from './phase1670-meine-effizienz-score-karte';
import { FahrerPhase1670SchichtEndeCountdownTimer } from './phase1670-schicht-ende-countdown-timer';
import { FahrerPhase1675MeineZoneKarte } from './phase1675-meine-zone-karte';
import { FahrerPhase1680SmartTourNavigatorHub } from './phase1680-smart-tour-navigator-hub';
import { FahrerPhase1685PausenzeitErinnerung } from './phase1685-pausenzeit-erinnerung';
import { FahrerPhase1690TourAbschlussSchnellbewertung } from './phase1690-tour-abschluss-schnellbewertung';
import { FahrerPhase1695SchichtRanglisteVorschau } from './phase1695-schicht-rangliste-vorschau';
import { Phase1700TourStoppNavigatorMaster } from './phase1700-tour-stopp-navigator-master';
import { FahrerPhase1700TagesUmsatzBeitragKarte } from './phase1700-tages-umsatz-beitrag-karte';
import { FahrerPhase1701LiveSchichtPerformanceScore } from './phase1701-live-schicht-performance-score';
import { FahrerPhase1705MeinBewertungsVerlauf } from './phase1705-mein-bewertungs-verlauf';
import { FahrerPhase1709SmartTourStoppLiveNav } from './phase1709-smart-tour-stopp-live-nav';
import { FahrerPhase1715TagesZielKurzuebersicht } from './phase1715-tages-ziel-kurzuebersicht';
import { FahrerPhase1720SchichtSchnellstartCockpit } from './phase1720-schicht-schnellstart-cockpit';
import { FahrerPhase1725EinnahmenHochrechnungKarte } from './phase1725-einnahmen-hochrechnung-karte';
import { FahrerPhase1710SmartTourStoppNavigationUltra } from './phase1710-smart-tour-stopp-navigation-ultra';
import { FahrerPhase1716SchichtVerdienstHochrechnung } from './phase1716-schicht-verdienst-hochrechnung';
import { FahrerPhase1724SmartTourStoppNavigatorFinal } from './phase1724-smart-tour-stopp-navigator-final';
import { FahrerPhase1730ZonenTippKarte } from './phase1730-zonen-tipp-karte';
import { FahrerPhase1735PauseReminder } from './phase1735-pause-reminder';
import { FahrerPhase1737TourStoppUltraFinalNavigator } from './phase1737-tour-stopp-ultra-final-navigator';
import { FahrerPhase1740SmartTourNavCommand } from './phase1740-smart-tour-nav-command';
import { FahrerPhase1740ZielEreichtAnimation } from './phase1740-ziel-erreicht-animation';
import { FahrerPhase1745EigeneReaktionstanzAnzeige } from './phase1745-eigene-reaktionszeit-anzeige';
import { FahrerPhase1750EigenerEffizienzTrend } from './phase1750-eigener-effizienz-trend';
import { FahrerPhase1755EigenePuenktlichkeitsQuote } from './phase1755-eigene-puenktlichkeits-quote';
import { FahrerPhase1760EigeneTourenBilanz } from './phase1760-eigene-touren-bilanz';
import { FahrerPhase1764SmartStoppNavigatorMitKartenLink } from './phase1764-smart-stopp-navigator-mit-karten-link';
import { FahrerPhase1769ZonenVerdienstVergleich } from './phase1769-zonen-verdienst-vergleich';
import { FahrerPhase1774MeinSchichtEinnahmenZaehler } from './phase1774-mein-schicht-einnahmen-zaehler';
import { FahrerPhase1779MeineSchichtBilanzKarte } from './phase1779-meine-schicht-bilanz-karte';
import { FahrerPhase1784EigenePauseErinnerung } from './phase1784-eigene-pause-erinnerung';
import { FahrerPhase1789NaechsterStoppNavigator } from './phase1789-naechster-stopp-navigator';
import { FahrerPhase1793TourStoppFortschrittsNavigator } from './phase1793-tour-stopp-fortschritts-navigator';
import { FahrerPhase1799MeinQualitaetsScoreVerlauf } from './phase1799-mein-qualitaets-score-verlauf';
import { FahrerPhase1803StoppSchnellBestaetigung } from './phase1803-stopp-schnell-bestaetigung';
import { FahrerPhase1809TourStoppNavigationsHub } from './phase1809-tour-stopp-navigations-hub';
import { FahrerPhase1814SchichtZuverlaessigkeitsBadge } from './phase1814-schicht-zuverlaessigkeits-badge';
import { FahrerPhase1819SchichtEffizienzKarte } from './phase1819-schicht-effizienz-karte';
import { FahrerPhase1820SmartTourStopHub } from './phase1820-smart-tour-stop-hub';
import { FahrerPhase1824LiveEinnahmenTracker } from './phase1824-live-einnahmen-tracker';
import { FahrerPhase1829KundenBewertungsFeed } from './phase1829-kunden-bewertungs-feed';
import { FahrerPhase1834PuenktlichkeitsCockpit } from './phase1834-puenktlichkeits-cockpit';
import { FahrerPhase1839TagesAbschlussSummary } from './phase1839-tages-abschluss-summary';
import { FahrerPhase1844EigeneTourBilanz } from './phase1844-eigene-tour-bilanz';
import { FahrerPhase1849SmartTourStoppNavigationsHubUltra } from './phase1849-smart-tour-stopp-navigations-hub-ultra';
import { FahrerPhase1854LiefertreueCockpit } from './phase1854-liefertreue-cockpit';
import { FahrerPhase1859EigeneGpsStatusleiste } from './phase1859-eigene-gps-statusleiste';
import { FahrerPhase1864GpsAusfallSelbstdiagnose } from './phase1864-gps-ausfall-selbstdiagnose';
import { FahrerPhase1865SchichtVerdienstPrognose } from './phase1865-schicht-verdienst-prognose-cockpit';
import { FahrerPhase1869EigeneWartezeitStatistik } from './phase1869-eigene-wartezeit-statistik';
import { FahrerPhase1875MeineZonenAffinitaet } from './phase1875-meine-zonen-affinitaet';
import { FahrerPhase1880ZonenTippDesTages } from './phase1880-zonen-tipp-des-tages';
import { FahrerPhase1885SchichtZonenBilanz } from './phase1885-schicht-zonen-bilanz';
import { FahrerPhase1890TopVerdienstSchichtRecap } from './phase1890-top-verdienst-schicht-recap';
import { FahrerPhase1895PersoenlichenMonatsRekordBanner } from './phase1895-persoenlicher-monats-rekord-banner';
import { FahrerPhase1891SchichtRoutenEffizienzScore } from './phase1891-schicht-routen-effizienz-score';
import { FahrerPhase1900SchichtZielFortschritt } from './phase1900-schicht-ziel-fortschritt';
import { FahrerPhase1905MeinBonusFortschritt } from './phase1905-mein-bonus-fortschritt';
import { FahrerPhase1910MeinePuenktlichkeitsKurve } from './phase1910-meine-puenktlichkeits-kurve';
import { FahrerPhase1915MeinQualitaetsScore } from './phase1915-mein-qualitaets-score';
import { FahrerPhase1920MeineZonenStatistik } from './phase1920-meine-zonen-statistik';
import { FahrerPhase1925MeineEffizienzKPIs } from './phase1925-meine-effizienz-kpis';
import { FahrerPhase1930MeineSchichtBilanz } from './phase1930-meine-schicht-bilanz';
import { FahrerPhase1935MeineKundenbewertungen } from './phase1935-meine-kundenbewertungen';
import { FahrerPhase1940MeineStreckenUebersicht } from './phase1940-meine-strecken-uebersicht';
import FahrerPhase1945MeineSchichtPlanung from './phase1945-meine-schicht-planung';
import FahrerPhase1950MeinePausenPlanung from './phase1950-meine-pausen-planung';
import { FahrerPhase1951TourStoppNavigatorUltra } from './phase1951-tour-stopp-navigator-ultra';
import { FahrerPhase1952TourFortschrittsRing } from './phase1952-tour-fortschritts-ring';
import { FahrerPhase1953NaechsterStoppEtaCockpit } from './phase1953-naechster-stopp-eta-cockpit';
import { FahrerPhase1870TourStoppSmartSequenzNav } from './phase1870-tour-stopp-smart-sequenz-nav';
import { SmartTourNavigatorV2 } from './smart-tour-navigator-v2';
import { FahrerPhase1851SmartTourStoppFinalKommando } from './phase1851-smart-tour-stopp-final-kommando';
import { TourStoppNaviPanel } from './tour-stopp-navi-panel';
import { Phase1876SmartStoppNavCockpitFinal } from './phase1876-smart-stopp-nav-cockpit-final';
import { FahrerPhase1880SmartTourStopCockpit } from './phase1880-smart-tour-stop-cockpit';
import { FahrerPhase2000SmartTourStopKommandant } from './phase2000-smart-tour-stop-kommandant';
import { FahrerPhase2000SmartTourNavHub } from './phase2000-smart-tour-nav-hub';
import { FahrerPhase2001SchichtAbschlussAssistent } from './phase2001-schicht-abschluss-assistent';
import { FahrerPhase2004MeineEtaGenauigkeit } from './phase2004-meine-eta-genauigkeit';
import { FahrerPhase2009MeinSchichtForecast } from './phase2009-mein-schicht-forecast';
import { FahrerPhase2010TourStoppNavigationUltra } from './phase2010-tour-stopp-navigation-ultra';
import { FahrerPhase2011LiveTourStoppUebersicht } from './phase2011-live-tour-stopp-uebersicht';
import { FahrerPhase2012SmartNavigationsCockpit } from './phase2012-smart-navigations-cockpit';
import { FahrerPhase2017MeineTourEffizienz } from './phase2017-meine-tour-effizienz';
import { FahrerPhase2022MeineSchichtAuslastung } from './phase2022-meine-schicht-auslastung';
import { FahrerPhase2027MeinePausenzeitAnalyse } from './phase2027-meine-pausenzeit-analyse';
import { FahrerPhase2028SmartTourStoppAbschlussNavigator } from './phase2028-smart-tour-stopp-abschluss-navigator';
import { FahrerPhase2033MeineTourAbschlussBilanz } from './phase2033-meine-tour-abschluss-bilanz';
import { FahrerPhase2038MeineBewertungsEntwicklung } from './phase2038-meine-bewertungs-entwicklung';
import { FahrerPhase2043MeinePuenktlichkeitsStatistik } from './phase2043-meine-puenktlichkeits-statistik';
import { FahrerPhase2051MeineStammkundenTouren } from './phase2051-meine-stammkunden-touren';
import { FahrerPhase2052TourStoppNavigationsPro } from './phase2052-tour-stopp-navigations-pro';
import { FahrerPhase2057MeineReaktionsteitStatistik } from './phase2057-meine-reaktionszeit-statistik';
import { FahrerPhase2060TourStopsNavigationLive } from './phase2060-tour-stops-navigation-live';
import { FahrerPhase2062MeineEffizienzBilanz } from './phase2062-meine-effizienz-bilanz';
import { FahrerPhase2067MeineTourenStrecke } from './phase2067-meine-touren-strecke';
import { FahrerPhase2073MeineLieblingszone } from './phase2073-meine-lieblingszone';
import { FahrerPhase2078MeineSchichtDauer } from './phase2078-meine-schicht-dauer';
import { Phase2100TourStopNavigatorMaster } from './phase2100-tour-stop-navigator-master';
import { FahrerPhase2105SmartTourStoppLiveKommandoUltra } from './phase2105-smart-tour-stopp-live-kommando-ultra';
import { FahrerPhase2110TourStoppEchtzeitNavigator } from './phase2110-tour-stopp-echtzeit-navigator';
import { FahrerPhase2111TourStoppSmartGpsHub } from './phase2111-tour-stopp-smart-gps-hub';
import { FahrerPhase2089MeineStundenBilanz } from './phase2089-meine-stunden-bilanz';
import { FahrerPhase2094MeinTagesQualitaetsScore } from './phase2094-mein-tages-qualitaets-score';
import { FahrerPhase2099MeineReaktionszeit } from './phase2099-meine-reaktionszeit';
import { FahrerPhase2105MeineKundenbewertung } from './phase2105-meine-kundenbewertung';
import { FahrerPhase2110MeinTourBonus } from './phase2110-mein-tour-bonus';
import { FahrerPhase2115MeineZonenAuslastung } from './phase2115-meine-zonen-auslastung';
import { FahrerPhase2120MeinePuenktlichkeit } from './phase2120-meine-puenktlichkeit';
import { FahrerPhase2125MeinWellbeingScore } from './phase2125-mein-wellbeing-score';
import { FahrerPhase2130MeineAbschlussquote } from './phase2130-meine-abschlussquote';
import { FahrerPhase2131TourStoppsNavigationsKommando } from './phase2131-tour-stopps-navigations-kommando';
import { FahrerPhase2135MeineTourenVollstaendigkeit } from './phase2135-meine-touren-vollstaendigkeit';
import { FahrerPhase2140MeineSchichtEffizienz } from './phase2140-meine-schicht-effizienz';
import { FahrerPhase2145MeinFeedbackScore } from './phase2145-mein-feedback-score';
import { FahrerPhase2150MeineReaktionszeit } from './phase2150-meine-reaktionszeit';
import { FahrerPhase2155MeineKmEffizienz } from './phase2155-meine-km-effizienz';
import { FahrerPhase2155MeineTageskilometer } from './phase2155-meine-tageskilometer';
import { FahrerPhase2160MeineKonsistenz } from './phase2160-meine-konsistenz';
import { FahrerPhase2165MeineSpitzenzeitBilanz } from './phase2165-meine-spitzenzeit-bilanz';
import { FahrerPhase2170MeineWartezeit } from './phase2170-meine-wartezeit';
import { FahrerPhase2175TourStoppEchtzeitNavigator } from './phase2175-tour-stopp-echtzeit-navigator';
import { FahrerPhase2180MeinEinsatzScore } from './phase2180-mein-einsatz-score';
import { FahrerPhase2180SchichtEinnahmenPrognoseLive } from './phase2180-schicht-einnahmen-prognose-live';
import { FahrerPhase2185MeineStornoBilanz } from './phase2185-meine-storno-bilanz';
import { FahrerPhase2190MeinKundenfeedback } from './phase2190-mein-kundenfeedback';
import { FahrerPhase2195MeinVerdienstHeute } from './phase2195-mein-verdienst-heute';
import { FahrerPhase2203MeinSchichtAbschluss } from './phase2203-mein-schicht-abschluss';
import { FahrerPhase2208MeinSchichtVergleich } from './phase2208-mein-schicht-vergleich';
import { FahrerPhase2213MeinBestzeitRekord } from './phase2213-mein-bestzeit-rekord';
import { FahrerPhase2218MeinZuverlaessigkeitsScore } from './phase2218-mein-zuverlaessigkeits-score';
import { FahrerPhase2223MeineWartezeitBilanz } from './phase2223-meine-wartezeit-bilanz';
import { FahrerPhase2228MeinEnergieLevel } from './phase2228-mein-energie-level';
import { FahrerPhase2233TourStopSmartNav } from './phase2233-tour-stop-smart-nav';
import { FahrerPhase2237MeineSchichtBilanz } from './phase2237-meine-schicht-bilanz';
import { FahrerPhase2241MeineRoutenEffizienz } from './phase2241-meine-routen-effizienz';
import { FahrerPhase2246MeineReaktionszeit } from './phase2246-meine-reaktionszeit';
import { FahrerPhase2251MeinePuenktlichkeit } from './phase2251-meine-puenktlichkeit';
import { FahrerPhase2256MeineKundenbewertung } from './phase2256-meine-kundenbewertung';
import { FahrerPhase2261MeinKilometerstand } from './phase2261-mein-kilometerstand';
import { FahrerPhase2266MeineAbholwartezeit } from './phase2266-meine-abholwartezeit';
import { FahrerPhase2271MeineTourEffizienz } from './phase2271-meine-tour-effizienz';
import { FahrerPhase2276MeinLieferfenster } from './phase2276-mein-lieferfenster';
import { FahrerPhase2285SmartTourStopNavigatorUltra } from './phase2285-smart-tour-stop-navigator-ultra';
import { FahrerPhase2290TourStoppNaviKommando } from './phase2290-tour-stopp-navi-kommando';
import { FahrerPhase2293MeinDurchsatz } from './phase2293-mein-durchsatz';
import { FahrerPhase2295TourStoppNavigationCockpit } from './phase2295-tour-stopp-navigation-cockpit';
import { FahrerPhase2298MeineSchichtBilanz } from './phase2298-meine-schicht-bilanz';
import { FahrerPhase2200SmartStoppNaviCockpit } from './phase2200-smart-stopp-navi-cockpit';
import { FahrerPhase2300SmartTourNavPro } from './phase2300-smart-tour-nav-pro';
import { FahrerPhase2303MeinePausen } from './phase2303-meine-pausen';
import { FahrerPhase2309MeineDistanz } from './phase2309-meine-distanz';
import { FahrerPhase2313MeineKm } from './phase2313-meine-km';
import { FahrerPhase2318MeinTempo } from './phase2318-mein-tempo';
import { FahrerPhase2323MeineWartezeit } from './phase2323-meine-wartezeit';
import { FahrerPhase2328SmartTourStopsNavigation } from './phase2328-smart-tour-stops-navigation';
import { FahrerPhase2332MeineStornoRate } from './phase2332-meine-storno-rate';
import { FahrerPhase2336MeinQualitaetsScore } from './phase2336-mein-qualitaets-score';
import { FahrerPhase2340TourStopsNavigationsPro } from './phase2340-tour-stops-navigations-pro';
import { FahrerPhase2346MeineSchichtEffizienz } from './phase2346-meine-schicht-effizienz';
import { FahrerPhase2350MeinLiefergebiet } from './phase2350-mein-liefergebiet';
import { FahrerPhase2355MeineBewertungen } from './phase2355-meine-bewertungen';
import { FahrerPhase2360MeinePuenktlichkeit } from './phase2360-meine-puenktlichkeit';
import { FahrerPhase2365MeinTrinkgeld } from './phase2365-mein-trinkgeld';
import { FahrerPhase2370MeineLieferzeit } from './phase2370-meine-lieferzeit';
import { FahrerPhase2375MeineAuslastung } from './phase2375-meine-auslastung';
import { FahrerPhase2380MeineReaktionszeit } from './phase2380-meine-reaktionszeit';
import { FahrerPhase2380TourStoppNavigatorUltra } from './phase2380-tour-stopp-navigator-ultra';
import { FahrerPhase2385MeineAbbruchquote } from './phase2385-meine-abbruchquote';
import { FahrerPhase2390MeineKilometer } from './phase2390-meine-kilometer';
import { FahrerPhase2395MeinePausenzeit } from './phase2395-meine-pausenzeit';
import { FahrerPhase2400MeineTourenAnzahl } from './phase2400-meine-touren-anzahl';
import { FahrerPhase2405MeinEffizienzScore } from './phase2405-mein-effizienz-score';
import { FahrerPhase2410MeineSchichtBilanz } from './phase2410-meine-schicht-bilanz';
import { FahrerPhase2415MeinUmsatzProStunde } from './phase2415-mein-umsatz-pro-stunde';
import { FahrerPhase2420MeineTrinkgeldQuote } from './phase2420-meine-trinkgeld-quote';
import { FahrerPhase2425TourStopsNaviHub } from './phase2425-tour-stops-navi-hub';
import { FahrerPhase2427MeineBewertung } from './phase2427-meine-bewertung';
import { FahrerPhase2428TourStoppNavigatorUltra } from './phase2428-tour-stopp-navigator-ultra';
import { FahrerPhase2432MeinePuenktlichkeit } from './phase2432-meine-puenktlichkeit';
import { FahrerPhase2433MeineUeberstunden } from './phase2433-meine-ueberstunden';
import { FahrerPhase2438MeineNachtschicht } from './phase2438-meine-nachtschicht';
import { FahrerPhase2443MeineWochenendSchicht } from './phase2443-meine-wochenend-schicht';
import { FahrerPhase2448MeineFeiertagsschicht } from './phase2448-meine-feiertagsschicht';
import { FahrerPhase2453MeinSchichtBalanceScore } from './phase2453-mein-schicht-balance-score';
import { FahrerPhase2458MeinEffizienzIndex } from './phase2458-mein-effizienz-index';
import { FahrerPhase2463MeinKapazitaetScore } from './phase2463-mein-kapazitaet-score';
import { FahrerPhase2469MeineRueckkehrDepotEta } from './phase2469-meine-rueckkehr-depot-eta';
import { FahrerPhase2474MeineLieferzeitEffizienz } from './phase2474-meine-lieferzeit-effizienz';
import { FahrerPhase2479MeineStoppzeit } from './phase2479-meine-stoppzeit';
import { FahrerPhase2484MeineKmEffizienz } from './phase2484-meine-km-effizienz';
import { FahrerPhase2489MeineTourenAnzahl } from './phase2489-meine-touren-anzahl';
import { FahrerPhase2494MeinePausenCompliance } from './phase2494-meine-pausen-compliance';
import { FahrerPhase2499MeineLiefertreue } from './phase2499-meine-liefertreue';
import { FahrerPhase2504MeinDurchsatz } from './phase2504-mein-durchsatz';
import { FahrerPhase2509MeinUmsatz } from './phase2509-mein-umsatz';
import { FahrerPhase2519MeinTrinkgeld } from './phase2519-mein-trinkgeld';
import { FahrerPhase2526MeineAkzeptanzrate } from './phase2526-meine-akzeptanzrate';
import { FahrerPhase2531MeineWartezeitDepot } from './phase2531-meine-wartezeit-depot';
import { FahrerPhase2523TourStoppSmartNaviPro } from './phase2523-tour-stopp-smart-navi-pro';
import { FahrerPhase2600SmartTourStoppNavigatorFinal } from './phase2600-smart-tour-stopp-navigator-final';
import { FahrerPhase2467TourStopsNavigationLiveKommando } from './phase2467-tour-stops-navigation-live-kommando';
import { FahrerPhase2437MeineReaktionszeit } from './phase2437-meine-reaktionszeit';
import { FahrerPhase2442MeineStornoQuote } from './phase2442-meine-storno-quote';
import { FahrerPhase2447MeineUeberstunden } from './phase2447-meine-ueberstunden';
import { FahrerPhase1001TourStoppSmartNavFinal } from './phase1001-tour-stopp-smart-nav-final';
import { FahrerPhase2510TourStoppNavigationsHub } from './phase2510-tour-stopp-navigations-hub';

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  tenant_id: string;
  location_id: string | null;
  fahrzeug_praeferenz: string | null;
};

type Status = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string | null;
  aktueller_batch_id: string | null;
  online_seit: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_update: string | null;
};

type OpenBatch = {
  batch_id: string;
  tenant_id: string;
  location_id: string;
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  geschaetzte_lieferung_min: number | null;
  location_name: string;
  location_lat: number | null;
  location_lng: number | null;
  source_system: 'legacy' | 'mise' | null;
  zahlungsart?: string | null;
  bezahlt?: boolean | null;
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  total_distance_km?: number | null;
  stops: {
    id: string;
    batch_id: string;
    order_id: string;
    reihenfolge: number;
    angekommen_am: string | null;
    geliefert_am: string | null;
    distanz_zum_vorgaenger_m?: number | null;
    order: {
      id: string;
      bestellnummer: string;
      kunde_name: string;
      kunde_adresse: string | null;
      kunde_plz: string | null;
      kunde_lat: number | null;
      kunde_lng: number | null;
      gesamtbetrag: number;
      kunde_notiz?: string | null;
      kunde_lieferhinweis?: string | null;
      kunde_telefon?: string | null;
    };
  }[];
};

export function FahrerApp({
  driver, initialStatus, initialOpenBatches, initialActiveBatch,
}: {
  driver: Driver;
  initialStatus: Status | null;
  initialOpenBatches: OpenBatch[];
  initialActiveBatch: ActiveBatch | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [openBatches, setOpenBatches] = useState(initialOpenBatches);
  const [activeBatch, setActiveBatch] = useState(initialActiveBatch);
  const [lastCompletedBatchId, setLastCompletedBatchId] = useState<string | null>(initialActiveBatch?.id ?? null);
  const prevBatchIdRef = React.useRef<string | null>(initialActiveBatch?.id ?? null);
  const [pending, startTransition] = useTransition();

  const isOnline = status?.ist_online ?? false;

  // Live-Tick: sorgt dafür, dass ETA-Countdowns in Stopp-Liste jede Sekunde neu berechnet werden
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLiveTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (prevBatchIdRef.current && !activeBatch?.id) {
      setLastCompletedBatchId(prevBatchIdRef.current);
    }
    prevBatchIdRef.current = activeBatch?.id ?? null;
  }, [activeBatch?.id]);

  const gpsWatchRef = useRef<number | null>(null);
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickItems, setPickItems] = useState<any[]>([]);
  const [showShiftEnd, setShowShiftEnd] = useState(false);
  const [shiftSnapshot, setShiftSnapshot] = useState<{
    deliveries: number; tours: number; distKm: number; betrag: number; onlineMin: number;
  } | null>(null);

  // Tagesabschluss-Badge: persistente Schicht-Zusammenfassung nach Schichtende
  const [tagesabschlussData, setTagesabschlussData] = useState<TagesabschlussData | null>(null);

  // Heutige Schicht: Lieferungen + Schätzung
  const [todayStats, setTodayStats] = useState<{ deliveries: number; estEarnings: number } | null>(null);

  // Wochen-Performance: Rang + 7-Tage-Trend
  type RankData = { rank: number; total: number; history: { date: string; stopsCompleted: number; onTimeRate: number | null }[] };
  const [rankData, setRankData] = useState<RankData | null>(null);

  // Betriebsnachrichten vom Dispatch
  const [broadcasts, setBroadcasts] = useState<{ id: string; message: string; priority: string; sentByName: string | null; createdAt: string }[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Nächste geplante Schichten (aus offline-bundle)
  const [upcomingShifts, setUpcomingShifts] = useState<{ id: string; planned_start: string; planned_end: string; status: string }[]>([]);

  // Peak-Zeit-Erkennung: pollt eta/live zur Erkennung von Surge/Stoßzeiten
  const [peakSignal, setPeakSignal] = useState<{ signal: string; load: string; etaExtension: number } | null>(null);
  const [showLieferCheckliste, setShowLieferCheckliste] = useState(false);
  const [showLieferungBestaetigung, setShowLieferungBestaetigung] = useState<string | null>(null);
  const [showTourCompletion, setShowTourCompletion] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch('/api/delivery/driver/messages')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.messages)) setBroadcasts(d.messages); })
        .catch(() => {});
    };
    if (isOnline) {
      load();
      const iv = setInterval(load, 60_000);
      return () => clearInterval(iv);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    fetch('/api/delivery/driver/offline-bundle', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.upcomingShifts)) setUpcomingShifts(d.upcomingShifts); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOnline || !driver.location_id) return;
    const poll = () => {
      fetch(`/api/delivery/eta/live?location_id=${driver.location_id}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.queue_signal) setPeakSignal({ signal: d.queue_signal, load: d.load ?? 'normal', etaExtension: d.eta_extension_min ?? 0 }); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 90_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driver.location_id]);

  useEffect(() => {
    if (!isOnline) return;
    fetch('/api/delivery/driver/my-performance?period=week&days=7')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.rank != null && d?.total != null) {
          setRankData({ rank: d.rank, total: d.total, history: Array.isArray(d.history) ? d.history : [] });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const load = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select('id, total_distance_km')
        .eq('fahrer_id', driver.id)
        .gte('created_at', today.toISOString());
      if (!batches?.length) { setTodayStats({ deliveries: 0, estEarnings: 0 }); return; }
      const { data: stops } = await supabase
        .from('delivery_batch_stops')
        .select('id, distanz_zum_vorgaenger_m')
        .in('batch_id', (batches as any[]).map((b: any) => b.id))
        .not('geliefert_am', 'is', null);
      const deliveries = (stops as any[])?.length ?? 0;
      const distKm = ((batches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
      const estEarnings = deliveries * 1.50 + distKm * 0.20;
      setTodayStats({ deliveries, estEarnings });
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [isOnline, driver.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissBroadcast(id: string) {
    setDismissedIds(prev => new Set([...prev, id]));
    fetch('/api/delivery/driver/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ broadcast_id: id }),
    }).catch(() => {});
  }

  const visibleBroadcasts = broadcasts.filter(b => !dismissedIds.has(b.id));

  // Küchenstatus für Pickup-Phase: welche Bestellungen sind schon fertig?
  const [kitchenStatuses, setKitchenStatuses] = useState<Map<string, string>>(new Map());
  // fertig_am je Order: zum Anzeigen wie lange eine Bestellung schon wartet
  const [kitchenFertigAt, setKitchenFertigAt] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!activeBatch || activeBatch.status === 'unterwegs') return;
    const orderIds = activeBatch.stops.map((s) => s.order_id).filter(Boolean);
    if (orderIds.length === 0) return;

    // Initial fetch
    supabase.from('customer_orders')
      .select('id, status, fertig_am')
      .in('id', orderIds)
      .then(({ data }: { data: { id: string; status: string; fertig_am: string | null }[] | null }) => {
        if (!data) return;
        setKitchenStatuses(new Map(data.map((r) => [r.id, r.status])));
        setKitchenFertigAt(new Map(data.filter(r => r.fertig_am).map((r) => [r.id, r.fertig_am!])));
      });

    // Realtime subscription
    const ch = supabase
      .channel(`kitchen-status-${activeBatch.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=in.(${orderIds.join(',')})`,
      }, (payload: { new: { id: string; status: string; fertig_am?: string | null } }) => {
        const { id, status: newStatus, fertig_am } = payload.new;
        setKitchenStatuses((prev) => new Map(prev).set(id, newStatus));
        if (fertig_am) setKitchenFertigAt((prev) => new Map(prev).set(id, fertig_am));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatch?.id, activeBatch?.status]);

  // Fetch Items wenn Pick-Dialog geöffnet wird
  useEffect(() => {
    if (!pickOpen || !activeBatch) return;
    (async () => {
      const orderIds = activeBatch.stops.map((s) => s.order_id);
      const { data } = await supabase.from('order_items')
        .select('id, order_id, name, menge, notiz, pick_confirmed_at, pick_missing')
        .in('order_id', orderIds);
      setPickItems((data as any[]) ?? []);
    })();
  }, [pickOpen, activeBatch, supabase]);

  /* Phase 91: Offline-Bundle beim App-Start prefetchen → SW cached es für Offline-Betrieb */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: 'PREFETCH_OFFLINE_BUNDLE' });
    }).catch(() => {});
    // Alle 5 Min erneut prefetchen damit Bundle frisch bleibt
    const prefetchIv = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'PREFETCH_OFFLINE_BUNDLE' });
      }).catch(() => {});
    }, 5 * 60_000);
    return () => clearInterval(prefetchIv);
  }, []);

  /* SW-Auto-Update-Check: alle 60s Polling; UpdateBanner zeigt sich wenn neue Version */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const iv = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
    }, 60_000);
    const vis = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  /* Beim Zurueckkommen in die App (z.B. nach CallKit-Anruf) frisch laden -> neue Tour erscheint */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !activeBatch && !pickOpen) {
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [activeBatch, pickOpen]);

  /* GPS-Tracking: bei Online-Status watchPosition starten, Updates alle ~15s */
  useEffect(() => {
    if (!isOnline) {
      if (gpsWatchRef.current != null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      return;
    }
    if (!('geolocation' in navigator)) { setGpsOk(false); return; }

    let lastPush = 0;
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOk(true);
        if (pos.coords.speed != null) setGpsSpeed(Math.round(pos.coords.speed * 3.6));
        setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        const now = Date.now();
        if (now - lastPush < 15000) return;   // max alle 15s
        lastPush = now;
        supabase.from('driver_status').update({
          last_lat: pos.coords.latitude,
          last_lng: pos.coords.longitude,
          last_heading: pos.coords.heading ?? null,
          last_speed_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          last_update: new Date().toISOString(),
        }).eq('employee_id', driver.id).then(() => {});
      },
      () => setGpsOk(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (gpsWatchRef.current != null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  /* Push-Subscribe beim ersten Online-Gehen */
  useEffect(() => {
    if (!isOnline) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;
        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapid) return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid).buffer as ArrayBuffer,
        });
        await fetch('/api/drivers/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch {}
    })();
  }, [isOnline]);

  /* Realtime: refresh bei Änderungen in Legacy- UND Mise-Tabellen */
  useEffect(() => {
    const ch = supabase
      .channel('fahrer-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status', filter: `employee_id=eq.${driver.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    router.refresh();
  }

  async function goOffline() {
    setShowShiftEnd(false);
    startTransition(async () => {
      await supabase.from('driver_status').upsert({
        employee_id: driver.id, ist_online: false, fahrzeug: driver.fahrzeug_praeferenz, online_seit: null,
      });
      setStatus((s) => ({ ...(s ?? { employee_id: driver.id, fahrzeug: driver.fahrzeug_praeferenz, aktueller_batch_id: null, online_seit: null, last_lat: null, last_lng: null, last_update: null }), ist_online: false, online_seit: null }));
    });
  }

  async function toggleOnline() {
    const next = !isOnline;
    if (!next) {
      // Going offline — check if there are deliveries to show summary
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select('id, total_distance_km')
        .eq('fahrer_id', driver.id)
        .gte('created_at', today.toISOString());
      if (batches && (batches as any[]).length > 0) {
        const { data: stops } = await supabase
          .from('delivery_batch_stops')
          .select('id, order:customer_orders(gesamtbetrag)')
          .in('batch_id', (batches as any[]).map((b: any) => b.id))
          .not('geliefert_am', 'is', null);
        const deliveries = (stops as any[])?.length ?? 0;
        if (deliveries > 0) {
          const betrag = ((stops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
          const distKm = ((batches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
          const onlineMin = status?.online_seit
            ? Math.floor((Date.now() - new Date(status.online_seit as string).getTime()) / 60_000)
            : 0;
          const snap = { deliveries, tours: (batches as any[]).length, distKm, betrag, onlineMin };
          setShiftSnapshot(snap);
          setTagesabschlussData({ ...snap, date: new Date().toISOString().slice(0, 10) });
          setShowShiftEnd(true);
          return;
        }
      }
      await goOffline();
      return;
    }
    // Going online
    startTransition(async () => {
      await supabase.from('driver_status').upsert({
        employee_id: driver.id, ist_online: true, fahrzeug: driver.fahrzeug_praeferenz,
        online_seit: new Date().toISOString(),
      });
      setStatus((s) => ({ ...(s ?? { employee_id: driver.id, fahrzeug: driver.fahrzeug_praeferenz, aktueller_batch_id: null, online_seit: null, last_lat: null, last_lng: null, last_update: null }), ist_online: true, online_seit: new Date().toISOString() }));
    });
  }

  async function claimBatch(batchId: string) {
    const batch = openBatches.find((b) => b.batch_id === batchId);
    const isMise = batch?.source_system === 'mise';
    startTransition(async () => {
      const { data } = isMise
        ? await supabase.rpc('claim_mise_delivery_batch', { p_batch_id: batchId, p_employee_id: driver.id })
        : await supabase.rpc('claim_delivery_batch', { p_batch_id: batchId });
      if ((data as any)?.ok) {
        if (isMise) {
          await supabase.from('driver_status')
            .update({ aktueller_batch_id: batchId })
            .eq('employee_id', driver.id);
        }
        window.location.reload();
      } else {
        alert((data as any)?.error ?? 'Konnte Tour nicht annehmen');
      }
    });
  }

  async function markDelivered(stopId: string) {
    startTransition(async () => {
      const now = new Date().toISOString();

      // Legacy-Stop updaten
      await supabase.from('delivery_batch_stops')
        .update({ geliefert_am: now })
        .eq('id', stopId);

      // Mise-Stop updaten (falls dieser Stop aus dem Mise-System stammt)
      await supabase.from('mise_delivery_batch_stops')
        .update({ completed_at: now })
        .eq('id', stopId);

      const stop = activeBatch?.stops.find((s) => s.id === stopId);
      if (stop) {
        await supabase.from('customer_orders')
          .update({ status: 'geliefert', geliefert_am: now })
          .eq('id', stop.order_id);
      }

      router.refresh();
    });
  }

  async function markArrived(stopId: string) {
    startTransition(async () => {
      const now = new Date().toISOString();
      await supabase.from('delivery_batch_stops')
        .update({ angekommen_am: now })
        .eq('id', stopId);
      await supabase.from('mise_delivery_batch_stops')
        .update({ angekommen_am: now })
        .eq('id', stopId);
      router.refresh();
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/fahrer');
  }

  const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

  return (
    <>
    {/* Sticky bottom navigation bar — zeigt immer den nächsten Stop */}
    {activeBatch && (
      <FahrerStickyBar
        stops={activeBatch.stops as any}
        batchStatus={activeBatch.status}
      />
    )}
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-br from-matcha-900 to-matcha-700 px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-11 w-11 rounded-2xl flex items-center justify-center',
            isOnline ? 'bg-accent text-matcha-900' : 'bg-white/10',
          )}>
            <Bike size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-200">Fahrer</div>
            <div className="font-display font-bold truncate">{driver.vorname} {driver.nachname}</div>
          </div>
          <button
            onClick={logout}
            className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Abmelden"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-5">
        {/* Batterie-Anzeige: Warnung bei niedrigem Akkustand + Strom-Sparmodus */}
        <FahrerBatterieAnzeige />
        {/* Phase 416: Storno-Hinweis — Awareness wenn aktuelle Stunde ein bekannter Hotspot ist */}
        {isOnline && driver.location_id && (
          <SchichtStornoHinweis locationId={driver.location_id} />
        )}
        {/* Phase 417: Fahrer-Prognose-Badge — Eigener Performance-Score + 4 Sub-Scores */}
        {isOnline && driver.location_id && (
          <FahrerPrognoseBadge driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 418: Fahrer-Bewertungs-Widget — Eigene Kundenbewertung (Ø-Sterne, Trend, Positiv/Negativ) */}
        {isOnline && driver.location_id && (
          <FahrerBewertungsWidget driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 419: Fahrer-Wartezeit-Tipp — Küchen-Wartezeit + Hinweis zur Abholoptimierung */}
        {isOnline && driver.location_id && (
          <FahrerWartezeitTipp driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 429: Schicht-Briefing — personalisiertes Pre-Shift-Briefing */}
        {driver.location_id && (
          <SchichtBriefingCard driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 430: Schicht-Abschluss — Post-Shift-Bericht (Score, Lieferungen, Verdienst, Tipps) */}
        {driver.location_id && (
          <SchichtAbschlussBericht driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 431: Fahrer-Incentive-Ziele — Bonus-Fortschritt je Zieltyp */}
        {driver.location_id && (
          <FahrerIncentiveWidget driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 432: Fahrer-Leistungszeugnis — Monatliche Bewertung (Grade, Score, KPIs, Trend) */}
        {driver.location_id && (
          <FahrerZeugnisCard driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 433: Liefer-Qualitäts-Trend — Letzte 30 Touren Score-Chart (Pünktlichkeit/Vollständigkeit/Zufriedenheit) */}
        {driver.location_id && (
          <QualitaetsTrendKarte driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 464: Fahrer-Selbst-Bewertung — Tagesschicht 1–5 Sterne + Stimmung + Kommentar */}
        {driver.location_id && (
          <FahrerSelbstBewertung driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 466: Fahrer-Pünktlichkeits-Coach — Automatische Coaching-Hinweise bei Pünktlichkeit < 80% */}
        {driver.location_id && (
          <FahrerCoachingWidget driverId={driver.id} locationId={driver.location_id} />
        )}
        {/* Phase 474: Offline-Sync-Banner — Zeigt Offline-Status + ausstehende Aktionen + Auto-Replay */}
        <FahrerOfflineSyncBanner />
        {/* Phase 474b: Offline-Sync-Manager — Lokale Queue + Auto-Sync + Retry-Logik */}
        <OfflineSyncManager />
        {/* Tour-Stopp-Live-Navigator: Kompakter Live-Navigator für aktuellen Stop mit Navi + Anruf */}
        {activeBatch && (
          <TourStoppLiveNavigator
            stops={activeBatch.stops as any}
            currentStopIndex={activeBatch.stops.findIndex((s: any) => !s.geliefert_am)}
          />
        )}
        {/* Tour-Nav-Fokus-Karte: Übersichtliche Navigations-Karte mit Nächstem Stopp, Distanz und 1-Tap Links */}
        {activeBatch && (
          <TourNavFokusKarte
            stops={activeBatch.stops as any}
            driverLat={driverPos?.lat ?? null}
            driverLng={driverPos?.lng ?? null}
            batchStartedAt={activeBatch.started_at}
          />
        )}
        {/* Tour-Stopp-Sofort-Kommando: Fokus-Karte für den aktuellen Stopp mit 1-Tap Navigation und Anruf */}
        {activeBatch && (
          <TourStoppSofortKommando batch={activeBatch} />
        )}
        {/* Phase 474c: Tour-Stopp-Sequenz-Pro — Geordnete Stopp-Liste mit Navigation + Abschluss-Aktionen */}
        <TourStoppSequenzPro />
        {/* Phase 476: Tour-Stopp-Optimierung — Optimierte Stopp-Reihenfolge nach Proximity mit ETA je Stopp */}
        {activeBatch && (
          <TourStoppOptimierung
            stops={activeBatch.stops as any}
            driverLat={driverPos?.lat ?? null}
            driverLng={driverPos?.lng ?? null}
          />
        )}

        {/* Betriebsnachrichten vom Dispatch */}
        {visibleBroadcasts.map(b => (
          <div
            key={b.id}
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-4 py-3 animate-in slide-in-from-top-2 duration-200',
              b.priority === 'urgent'
                ? 'border-red-400 bg-red-950/30 text-red-100'
                : 'border-blue-400/50 bg-blue-950/30 text-blue-100',
            )}
          >
            <span className="text-lg shrink-0">{b.priority === 'urgent' ? '🚨' : '📢'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{b.message}</p>
              {b.sentByName && (
                <p className="text-[10px] opacity-60 mt-0.5">{b.sentByName}</p>
              )}
            </div>
            <button
              onClick={() => dismissBroadcast(b.id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition p-1"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
        ))}

        {/* Online Toggle */}
        {!activeBatch && (
          <section>
            <button
              onClick={toggleOnline}
              disabled={pending}
              className={cn(
                'w-full rounded-3xl p-5 font-display font-bold text-lg flex items-center gap-4 transition active:scale-[0.98]',
                isOnline
                  ? 'bg-accent text-matcha-900 shadow-lg'
                  : 'bg-white/5 border-2 border-white/10 text-matcha-100',
              )}
            >
              <div className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0',
                isOnline ? 'bg-matcha-900 text-accent' : 'bg-white/10',
              )}>
                <Power size={26} />
              </div>
              <div className="text-left flex-1">
                <div className="text-xl">{isOnline ? 'Du bist online' : 'Los geht&apos;s'}</div>
                <div className={cn('text-sm font-normal mt-0.5', isOnline ? 'text-matcha-900/70' : 'text-matcha-300')}>
                  {isOnline ? 'Tippe hier zum Offline-Gehen' : 'Tippe um online zu gehen'}
                </div>
              </div>
            </button>
            {isOnline && !activeBatch && (
              <>

                {/* GPS-Status */}
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  {gpsOk === false && <span className="text-red-300">⚠️ GPS blockiert — in Safari/Chrome Standort erlauben</span>}
                  {gpsOk === true && <span className="text-accent">📍 GPS aktiv</span>}
                  {gpsOk === null && <span className="text-matcha-300">📍 Warte auf GPS-Signal…</span>}
                </div>

                {/* Peak-Zeit Banner: zeigt Bonus-Stunden dem Fahrer */}
                {peakSignal && (peakSignal.signal === 'surge' || peakSignal.load === 'busy') && (
                  <div className={cn(
                    'mt-3 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold',
                    peakSignal.signal === 'surge'
                      ? 'bg-red-500/20 border border-red-400/40 text-red-200'
                      : 'bg-amber-500/15 border border-amber-400/30 text-amber-200',
                  )}>
                    <Zap className="h-4 w-4 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div>{peakSignal.signal === 'surge' ? '⚡ Surge-Zeit aktiv' : '🔥 Stoßzeit'}</div>
                      <div className="text-[10px] font-normal opacity-80 mt-0.5">
                        {peakSignal.signal === 'surge'
                          ? `ETA +${peakSignal.etaExtension} Min — höchste Nachfrage`
                          : 'Viele Bestellungen — jetzt online bleiben!'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase 371: Pausen-Empfehlung — Hinweis nach 3+ Stunden Schicht ohne aktive Tour */}
                <div className="mt-3">
                  <FahrerPausenEmpfehlung
                    onlineSeit={status?.online_seit ?? null}
                    hasActiveBatch={!!activeBatch}
                  />
                </div>
                {/* Phase 527: Erholungs-Tracker — Aktivzeit vs. Pausen, Ermüdungsindikator */}
                <div className="mt-3">
                  <FahrerErholungsTracker
                    driverId={driver.id}
                    locationId={driver.location_id ?? null}
                    onlineSeit={status?.online_seit ?? null}
                  />
                </div>
                {/* Phase 374: Schicht-Dauer-Live — Schichtdauer + Stopps/h Rate mit Intensitäts-Farbkodierung */}
                {status?.online_seit && (
                  <div className="mt-3">
                    <FahrerSchichtDauerLive
                      onlineSeit={status.online_seit}
                      stopsHeute={todayStats?.deliveries ?? 0}
                    />
                  </div>
                )}

                {/* Nächste Schichten — aus offline-bundle */}
                {upcomingShifts.length > 0 && (
                  <div className="mt-3 rounded-xl border border-matcha-600/40 bg-matcha-800/50 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-400 mb-2 flex items-center gap-1.5">
                      <Calendar size={10} />
                      Nächste Schicht
                    </div>
                    {upcomingShifts.slice(0, 2).map((shift, i) => {
                      const start = new Date(shift.planned_start);
                      const end = new Date(shift.planned_end);
                      const msUntil = start.getTime() - Date.now();
                      const isToday = start.toDateString() === new Date().toDateString();
                      const hoursUntil = Math.floor(msUntil / 3_600_000);
                      const minsUntil = Math.floor((msUntil % 3_600_000) / 60_000);
                      const countdown = msUntil > 0
                        ? hoursUntil > 0 ? `in ${hoursUntil}h ${minsUntil}m` : `in ${minsUntil}m`
                        : null;
                      return (
                        <div key={shift.id} className={cn('flex items-center gap-3 py-1.5', i > 0 && 'border-t border-matcha-700/50 mt-1.5')}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">
                              {isToday ? 'Heute' : start.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </div>
                            <div className="text-[11px] text-matcha-300 tabular-nums">
                              {start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                            </div>
                          </div>
                          {countdown && (
                            <span className="text-[11px] font-bold text-accent bg-accent/10 rounded-full px-2.5 py-0.5 tabular-nums shrink-0">
                              {countdown}
                            </span>
                          )}
                          {shift.status === 'active' && (
                            <span className="text-[10px] font-bold text-matcha-100 bg-matcha-600 rounded-full px-2 py-0.5 shrink-0">Aktiv</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Heutige Schicht — Statistik-Widget */}
                {todayStats && todayStats.deliveries > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-matcha-700/40 border border-matcha-600/30 px-3 py-2.5 text-center">
                      <div className="font-display font-black text-2xl text-accent">{todayStats.deliveries}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300 mt-0.5">Lieferungen heute</div>
                    </div>
                    <div className="rounded-xl bg-accent/15 border border-accent/30 px-3 py-2.5 text-center">
                      <div className="font-display font-black text-2xl text-accent">{todayStats.estEarnings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300 mt-0.5">Geschätzte Vergütung</div>
                    </div>
                  </div>
                )}

                {/* Wochen-Rang — 7-Tage-Sparkline mit Rang-Badge */}
                {rankData && (
                  <div className={cn(
                    'mt-3 rounded-xl border px-3 py-2.5',
                    rankData.rank <= 3 ? 'bg-yellow-500/10 border-yellow-500/25' : 'bg-white/5 border-white/10',
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {rankData.rank <= 3 && <span className="text-sm">🏆</span>}
                          <span className={cn(
                            'font-display font-black text-lg leading-none',
                            rankData.rank <= 3 ? 'text-yellow-300' : 'text-accent',
                          )}>
                            #{rankData.rank}
                          </span>
                          <span className="text-[10px] text-matcha-400">von {rankData.total} · diese Woche</span>
                        </div>
                        {(() => {
                          const last = rankData.history.at(-1)?.onTimeRate;
                          if (last == null) return null;
                          return (
                            <div className={cn(
                              'text-[10px] mt-0.5 font-bold',
                              last >= 0.9 ? 'text-accent' : last >= 0.7 ? 'text-amber-300' : 'text-red-400',
                            )}>
                              {Math.round(last * 100)}% pünktlich
                            </div>
                          );
                        })()}
                      </div>
                      {/* 7-Tage Stops-Sparkline */}
                      {rankData.history.length > 0 && (() => {
                        const hist = rankData.history.slice(-7);
                        const mx = Math.max(1, ...hist.map(h => h.stopsCompleted));
                        return (
                          <div className="flex items-end gap-[3px] h-8 shrink-0">
                            {hist.map((p, i) => {
                              const h = Math.max(4, Math.round((p.stopsCompleted / mx) * 28));
                              const isLatest = i === hist.length - 1;
                              return (
                                <div
                                  key={p.date}
                                  style={{ height: `${h}px` }}
                                  className={cn('w-2.5 rounded-sm', isLatest ? 'bg-accent' : 'bg-white/25')}
                                  title={`${new Date(p.date).toLocaleDateString('de-DE', { weekday: 'short' })}: ${p.stopsCompleted}`}
                                />
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Schicht-Puls: Live-Tempo-Ring mit Wochenvergleich */}
                {todayStats && status?.online_seit && (
                  <SchichtPuls
                    onlineSinceIso={status.online_seit}
                    totalDeliveries={todayStats.deliveries}
                    weekHistory={rankData?.history ?? []}
                  />
                )}
                {/* Phase 337: Fahrer-Schicht-Puls — Stopps erledigt/verbleibend + Schichtdauer */}
                <FahrerSchichtPuls />
                {/* Phase 369: Schicht-Fortschritts-Ring — SVG-Ring Schichtzeit-Nutzung + Einnahmen-Rate */}
                {status?.online_seit && (
                  <FahrerSchichtFortschrittsRing
                    driverName={`${driver.vorname} ${driver.nachname}`}
                    onlineSeit={status.online_seit}
                    activeBatch={activeBatch}
                  />
                )}

                {/* Schicht-Effizienz: Liefertempo vs. Ziel */}
                {todayStats && status?.online_seit && (
                  <SchichtEffizienzMeter
                    deliveries={todayStats.deliveries}
                    onlineMin={Math.floor((Date.now() - new Date(status.online_seit).getTime()) / 60_000)}
                    estEarnings={todayStats.estEarnings}
                  />
                )}

                {/* Tagesverdienst-Fortschrittsbalken: Einnahmen + Stopps + Ø-Zeit */}
                {todayStats && (
                  <EarningsProgressBar
                    completedBatches={0}
                    totalDeliveries={todayStats.deliveries}
                    cashCollected={todayStats.estEarnings}
                    onlineSinceIso={status?.online_seit ?? null}
                    activeBatch={activeBatch}
                    dailyTargetEur={80}
                  />
                )}

                {/* Phase 184: Schicht-Einnahmen-Ring — Visueller Donut-Ring für tägliches Einnahmenziel */}
                {todayStats && todayStats.deliveries > 0 && (
                  <SchichtEinnahmenRing
                    deliveries={todayStats.deliveries}
                    estEarnings={todayStats.estEarnings}
                    goalEur={80}
                  />
                )}

                {/* Phase 251: Ramp-Up-Fortschritt — Eigener Onboarding-Score für neue Fahrer */}
                <FahrerRampUpFortschritt driverId={driver.id} />
                {/* Phase 386: Tages-Score-Karte — Persönlicher Score, Note, 7-Faktoren-Breakdown */}
                {driver.location_id && (
                  <FahrerTagesScoreKarte driverId={driver.id} locationId={driver.location_id} />
                )}
                {/* Phase 387: Wochen-Score-Verlauf — 8-Wochen Bar-Chart eigener Score mit Motivation */}
                {driver.location_id && (
                  <FahrerWochenScoreVerlauf driverId={driver.id} locationId={driver.location_id} />
                )}

                {/* Phase 205: Schicht-Einnahmen-Chart — stündlicher Einnahmenverlauf */}
                <FahrerSchichtEinnahmenChart driverId={driver.id} />

                {/* Phase 206: Tages-Bewertungskarte — Ø Kundenbewertung letzte 7 Tage */}
                <FahrerTagesBewertungKarte driverId={driver.id} />

                {/* Pause-Widget — Phase 84 */}
                <FahrerPauseWidget />
                {/* Phase 193: Schicht-Pause-Erinnerung — Pflichtpause-Hinweis nach 2,5h / 4,5h */}
                <SchichtPauseReminder onlineSince={status?.online_seit ?? null} />
                {/* Phase 194: Streak-Badge — zeigt Pünktlichkeits-Serie + Multiplikator */}
                {driver.location_id && <StreakBadge driverId={driver.id} locationId={driver.location_id} />}
                {/* Phase 195: Meilenstein-Toast — Benachrichtigung bei neuen Streak-Meilensteinen */}
                <MeilensteinToast driverId={driver.id} />
                {/* Phase 207: Schicht-Bedarf-Chip — zeigt Fahrermangel-Stunden heute */}
                {driver.location_id && <SchichtBedarfChip locationId={driver.location_id} />}
                {/* Phase 269: Pünktlichkeits-Coach — Score + Coaching-Hinweise aus 14-Tage-Analyse */}
                <TourPunktlichkeitsCoach driverId={driver.id} />
              </>
            )}
          </section>
        )}

        {/* Phase 452: Tour-Stopp-Prioritäts-Navigator — Alle Stops in Reihenfolge mit Next-Stop hervorgehoben, Navigation-Button + ETA-Countdown */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <TourStoppPrioritaetsNavigator activeBatch={activeBatch as any} />
        )}
        {/* Phase 425: Tour-Stopp-Fortschritts-Leiste — Horizontale Stop-Kette mit Live-Status und Aktions-Buttons */}
        {activeBatch && (
          <div className="px-4">
            <TourStoppFortschrittsLeiste stops={activeBatch.stops as any} onMarkDelivered={markDelivered} onMarkArrived={markArrived} />
          </div>
        )}
        {/* Phase 458: Tour-Stopp-Fokus-Hub — Hero-Kachel für aktuellen Stop mit Navigation + alle Stops im Strip */}
        {activeBatch && activeBatch.status === 'unterwegs' && (() => {
          const pendingStops = activeBatch.stops.filter(s => !s.geliefert_am);
          const currentStopIndex = activeBatch.stops.findIndex(s => !s.geliefert_am);
          const mappedStops = activeBatch.stops.map(s => ({
            id: s.id,
            sequence: s.reihenfolge,
            status: s.geliefert_am ? 'delivered' as const : s.angekommen_am ? 'arrived' as const : 'pending' as const,
            address: [s.order.kunde_adresse, s.order.kunde_plz].filter(Boolean).join(', '),
            customer_name: s.order.kunde_name,
            order_id: s.order_id,
            bestellnummer: s.order.bestellnummer,
            lat: s.order.kunde_lat,
            lng: s.order.kunde_lng,
          }));
          if (pendingStops.length === 0) return null;
          return (
            <div className="px-4">
              <TourStoppFokusHub
                stops={mappedStops}
                currentStopIndex={currentStopIndex >= 0 ? currentStopIndex : 0}
                onMarkDelivered={markDelivered}
              />
            </div>
          );
        })()}
        {/* Phase 435: Stopp-Tempo-Anzeige — Live-Ring: Stopps/Stunde Ist vs. Soll mit Farbampel */}
        {activeBatch && (
          <div className="px-4">
            <FahrerStoppTempoAnzeige stops={activeBatch.stops as any} startedAt={activeBatch.started_at ?? null} />
          </div>
        )}
        {/* Phase 461: Heimkehr-Countdown — Verbleibende Zeit bis Tourende mit Fortschrittsbalken */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <div className="px-4">
            <TourHeimkehrCountdown
              stops={activeBatch.stops}
              startedAt={activeBatch.started_at ?? null}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          </div>
        )}
        {/* Phase 462: Stop-Abschluss-Schnell-Panel — Aktueller Stop mit Navi + Anruf + 2-Tap Zugestellt */}
        {activeBatch && activeBatch.status === 'unterwegs' && (() => {
          const currentStop = activeBatch.stops.find(s => !s.geliefert_am);
          if (!currentStop) return null;
          return (
            <div className="px-4">
              <StopAbschlussSchnellPanel
                stop={{
                  id: currentStop.id,
                  sequence: currentStop.reihenfolge,
                  address: [currentStop.order.kunde_adresse, currentStop.order.kunde_plz].filter(Boolean).join(', '),
                  customer_name: currentStop.order.kunde_name,
                  order_id: currentStop.order_id,
                  bestellnummer: currentStop.order.bestellnummer,
                  lat: currentStop.order.kunde_lat,
                  lng: currentStop.order.kunde_lng,
                  customer_phone: (currentStop.order as any).kunde_telefon ?? null,
                }}
                onMarkDelivered={markDelivered}
              />
            </div>
          );
        })()}

        {/* Phase 463: Nächster-Stopp-ETA-Ring — Countdown-Ring + Adresse für den nächsten Stopp */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <div className="px-4">
            <NaechsterStoppEtaRing
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                kunde_name: s.order.kunde_name,
                kunde_adresse: [s.order.kunde_adresse, s.order.kunde_plz].filter(Boolean).join(', ') || null,
                geliefert_am: s.geliefert_am,
                sequence: s.reihenfolge,
              }))}
            />
          </div>
        )}

        {/* Active Batch — NEUE Delivery-View wenn unterwegs */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <>
            {/* Tour-Status-Kopf: Fortschrittsbalken + KPIs (Stopps, Elapsed, ETA, Ø/Stopp) */}
            <TourStatusHeader activeBatch={activeBatch} />
            {/* Tour-Fortschritts-Kopfleiste — mit Live-Sekunden-Countdown */}
            <TourLiveProgressHeader batch={activeBatch as any} />
            {/* Tour-Fortschritts-Ring: visuelle Übersicht Stopps + ETA */}
            <TourProgressRing
              totalStops={activeBatch.stops.length}
              completedStops={activeBatch.stops.filter((s) => s.geliefert_am != null).length}
              distanceKm={(activeBatch as any).total_distance_km ?? null}
              startedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          {/* Tour-Fortschritts-Cockpit: SVG-Fortschrittsring + Verdienst + Elapsed-Zeit */}
          <div className="px-4">
            <TourFortschrittsCockpit
              stops={activeBatch.stops.map(s => ({
                geliefert_am: s.geliefert_am,
                reihenfolge: s.reihenfolge,
                order: {
                  bestellnummer: (s.order as any)?.bestellnummer ?? '',
                  gesamtbetrag: (s.order as any)?.gesamtbetrag ?? 0,
                },
              }))}
              startedAt={activeBatch.started_at}
              totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
            />
          </div>
          {/* Phase 233: Effizienz-Analyse — Stops/Std vs. persönlicher Durchschnitt + Score */}
          <div className="px-4">
            <TourEffizienzAnalyse
              tour={{
                stops: activeBatch.stops.length,
                completedStops: activeBatch.stops.filter(s => s.geliefert_am).length,
                startedAt: activeBatch.started_at,
                totalEarnings: (activeBatch as any).total_earnings_eur ?? undefined,
                distanceKm: (activeBatch as any).total_distance_km ?? undefined,
              }}
            />
          </div>

          {/* Tour-Effizienz-Live: Live-Vergleich Fortschritt vs. Zeit — Vorsprung/Rückstand */}
          <div className="px-4">
            <TourEffizienzLive
              batch={{
                id: activeBatch.id,
                status: activeBatch.status ?? 'on_route',
                started_at: activeBatch.started_at,
                total_eta_min: activeBatch.total_eta_min ?? null,
                total_distance_km: (activeBatch as any).total_distance_km ?? null,
              }}
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                angekommen_am: s.angekommen_am ?? null,
                geliefert_am: s.geliefert_am,
              }))}
            />
          </div>
          {/* Kassen-Übersicht: Bargeld-Stops mit Gesamtbetrag — aufklappbar */}
          <KassenUebersicht stops={activeBatch.stops as any} />
          {/* Phase 247: Nächster-Stopp-Countdown — ETA-Fenster + Distanz + Aktions-Buttons */}
          <NaechsterStoppCountdown
            stops={activeBatch.stops as any}
            currentLat={driverPos?.lat ?? null}
            currentLng={driverPos?.lng ?? null}
          />
          {/* Stop-Kompass — Richtungsanzeige zum nächsten Stop mit Distanz, Kundeninfo und One-Tap-Aktionen */}
          {(() => {
            const pendingStops = activeBatch.stops.filter(s => !s.geliefert_am);
            const current = pendingStops[0] ?? null;
            const next = pendingStops[1] ?? null;
            return (
              <div className="px-4">
                <StopCompass
                  currentStop={current as any}
                  nextStop={next as any}
                  driverLat={driverPos?.lat}
                  driverLng={driverPos?.lng}
                  onComplete={current ? () => markArrived(current.id) : undefined}
                />
              </div>
            );
          })()}
          {/* Phase 218: Smart-Stop-Navigator — nächster Stop mit Navigation + Kundeninfo */}
          <SmartStopNavigator
            stops={activeBatch.stops as any}
            batchStartedAt={activeBatch.started_at}
            totalEtaMin={activeBatch.total_eta_min ?? null}
          />
          {/* Phase 400: Aktueller-Stopp-Fokus — Stop-fokussiertes Panel mit Kundeninfo, Navigation und One-Tap-Aktionen */}
          <TourAktuellerStopFokus
            stops={activeBatch.stops as any}
            batchStartedAt={activeBatch.started_at}
            onMarkDelivered={markDelivered}
            onMarkArrived={markArrived}
          />
          {/* Phase 358: Tour-Stopp-Navigation V2 — Übersichtliche Stoppnavigation mit Google/Waze/Apple Maps + Nächster-Stopp-Vorschau */}
          <div className="px-4">
            <TourStoppNavV2
              stops={activeBatch.stops as any}
              startedAt={activeBatch.started_at}
            />
          </div>
          {/* Phase 390: Verdienst-Ziel-Tracker — Live-Fortschritt zu Schichtziel + nächster Bonus-Schwelle */}
          <div className="px-4">
            <TourVerdiensteZielTracker driverId={driver.id} />
          </div>
          {/* Phase 410: Tour-Verdienst-Verlauf — Kumulativer Sparkline-Verlauf der Schichtverdienste */}
          <div className="px-4">
            <FahrerTourVerdienstVerlauf stops={activeBatch.stops} />
          </div>
          {/* Phase 391: Schicht-Pace-Live — Aktuelle Pace vs. Ziel-Pace, onTrack/Rückstand-Indikator, Motivationshinweis */}
          <div className="px-4">
            <SchichtPaceLive driverId={driver.id} />
          </div>
          {/* Phase 393: Aktueller-Stopp-Karte — Großformatige Stop-Karte mit Adresse, Kasse, Navi-CTA und Bestätigungs-Button */}
          {(() => {
            const currentStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!currentStop) return null;
            return (
              <div className="px-4">
                <FahrerAktuellerStoppCard
                  stop={{
                    reihenfolge: currentStop.reihenfolge,
                    order: currentStop.order ? {
                      bestellnummer: (currentStop.order as any).bestellnummer ?? '',
                      kunde_name: (currentStop.order as any).kunde_name ?? '',
                      kunde_adresse: (currentStop.order as any).kunde_adresse ?? null,
                      kunde_plz: (currentStop.order as any).kunde_plz ?? null,
                      kunde_telefon: (currentStop.order as any).kunde_telefon ?? null,
                      gesamtbetrag: (currentStop.order as any).gesamtbetrag ?? 0,
                      bezahlt: (currentStop.order as any).bezahlt ?? false,
                      zahlungsart: (currentStop.order as any).zahlungsart ?? 'bar',
                      kunde_notiz: (currentStop.order as any).kunde_notiz ?? null,
                    } : null,
                  }}
                  totalStops={activeBatch.stops.length}
                  onComplete={() => markDelivered(currentStop.id)}
                />
              </div>
            );
          })()}
          {/* Phase 388: Nächster-Stopp-Karte — Große Adressanzeige, Navigations-CTA, Zahlungsart-Badge, Stop-Zähler */}
          <div className="px-4">
            <FahrerTourNaechsterStoppKarte
              driverId={driver.id}
              activeTourId={activeBatch.id}
            />
          </div>
          {/* Phase 363: Nächster-Stopp-Vorschau — Kompaktkarte mit ETA, Navigation, Zahlungsart und Kundendaten */}
          <div className="px-4">
            <NaechsterStoppVorschau
              stops={activeBatch.stops as any}
              driverLat={driverPos?.lat}
              driverLng={driverPos?.lng}
            />
          </div>
          {/* Phase 469: Stop-Aktions-Panel — Navigation + Kundenkontakt + Nächster-Stopp-Vorschau für aktuellen Stopp */}
          <div className="px-4">
            <FahrerStopAktionsPanel
              activeBatch={activeBatch as any}
              driverLat={driverPos?.lat}
              driverLng={driverPos?.lng}
            />
          </div>
          {/* Phase 364: Stop-Rhythmus-Meter — Ø Minuten/Stopp für aktuelle Tour mit Tourende-ETA */}
          <div className="px-4">
            <FahrerStopRhythmusMeter
              stops={activeBatch.stops as any}
              startedAt={activeBatch.started_at ?? null}
            />
          </div>
          {/* Phase 370: Stopp-Zähler-Strip — Dot-Fortschrittsleiste mit aktuellem Stopp-Index + Zähler */}
          <div className="px-4">
            <FahrerStoppZaehlerStrip stops={activeBatch.stops} />
          </div>
          {/* Phase 372: Tour-Zeitplan-Live — Soll/Ist-Vergleich für Tourverlauf: Stopp- und Zeitfortschritt */}
          <div className="px-4 mt-3">
            <FahrerTourZeitplanLive
              stops={activeBatch.stops as any}
              startedAt={activeBatch.started_at ?? null}
              totalEtaMin={(activeBatch as any).total_eta_min ?? null}
            />
          </div>
          {/* Phase 423: Tour-Stop-Checkliste — Mobile-first Checkliste mit Navigations-Button + Schnell-Abschluss */}
          <div className="px-4 mt-3">
            <TourStopCheckliste
              stops={activeBatch.stops as any}
              totalEtaMin={(activeBatch as any).total_eta_min ?? null}
              batchStartedAt={activeBatch.started_at ?? null}
            />
          </div>
          {/* Tour-Stop-Kommando: Vollständige Stopp-Kommando-Zentrale mit Checkliste + Navi + Fertig-Button */}
          {(() => {
            const nextStop = activeBatch.stops.find((s) => !s.geliefert_am);
            if (!nextStop) return null;
            const o = nextStop.order as any;
            if (!o) return null;
            const doneCount = activeBatch.stops.filter((s) => !!s.geliefert_am).length;
            return (
              <div className="px-4 mt-3">
                <TourStopKommando
                  stop={{
                    stopNr: doneCount + 1,
                    totalStops: activeBatch.stops.length,
                    kundeName: o.kunde_name ?? 'Kunde',
                    adresse: o.kunde_adresse ?? null,
                    plz: o.kunde_plz ?? null,
                    lat: o.kunde_lat ?? null,
                    lng: o.kunde_lng ?? null,
                    gesamtbetrag: o.gesamtbetrag ?? 0,
                    zahlungsart: o.zahlungsart ?? null,
                    bezahlt: o.bezahlt ?? null,
                    kundeNotiz: o.kunde_notiz ?? null,
                    kundeHinweis: o.kunde_lieferhinweis ?? null,
                    telefon: o.kunde_telefon ?? null,
                    etaLabel: o.eta_latest
                      ? `ETA ${new Date(o.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                      : null,
                  }}
                />
              </div>
            );
          })()}
          {/* Phase 492: Tour-Live-Schritt-Cockpit — Aktueller Stopp mit Navi/Anruf/Bestätigen-Buttons + Stopp-Sequenz */}
          <div className="px-4 mt-3">
            <TourLiveSchrittCockpit
              stops={(activeBatch.stops as any[]).map((s: any, idx: number) => ({
                id: s.id,
                sequence: s.reihenfolge ?? idx + 1,
                status: s.geliefert_am ? 'completed' : idx === 0 ? 'current' : 'pending',
                address: s.order?.kunde_adresse ?? s.kunde_adresse ?? '–',
                customerName: s.order?.kunde_name ?? s.kunde_name ?? '–',
                customerPhone: s.order?.kunde_telefon ?? s.kunde_telefon ?? null,
                orderValue: s.order?.gesamtbetrag ?? s.gesamtbetrag ?? 0,
                paymentMethod: s.order?.zahlungsart ?? s.zahlungsart ?? 'karte',
                notes: s.order?.kunde_lieferhinweis ?? s.kunde_lieferhinweis ?? null,
                etaMin: null,
              }))}
              tourStartedAt={activeBatch.started_at}
              totalStops={activeBatch.stops.length}
              onNavigate={(address) => {
                const encoded = encodeURIComponent(address);
                window.open(`https://maps.google.com/?q=${encoded}`, '_blank');
              }}
              onCall={(phone) => { window.location.href = `tel:${phone}`; }}
            />
          </div>
          {/* Phase 378: Tour-Stopp-Liste — Geordnete Stoppliste mit Status-Ampel, Navigation-CTA und Kundendaten */}
          <div className="px-4 mt-3">
            <TourStoppListe stops={activeBatch.stops as any} />
          </div>
          {/* Phase 487: Trinkgeld-Prognose — Geschätzte Trinkgelder dieser Tour (abgeschl. + verbleib. Stops × Ø-Rate) */}
          <FahrerTrinkgeldPrognose
            completedStops={activeBatch.stops.filter((s) => !!s.geliefert_am).length}
            remainingStops={activeBatch.stops.filter((s) => !s.geliefert_am).length}
          />
          {/* Phase 380: Schicht-Pacing-Guide — Tempo-Anzeige: Voraus/Im Plan/Rückstand basierend auf Stopps/h */}
          <div className="px-4 mt-3">
            <FahrerSchichtPacingGuide
              stops={activeBatch.stops}
              startedAt={activeBatch.started_at}
              totalStops={activeBatch.stops.length}
            />
          </div>
          {/* Phase 382: Stop-Distanz-Info — GPS-basierte Entfernung + ETA zum nächsten Stopp mit Navi-Button */}
          <div className="px-4 mt-3">
            <StopDistanzInfo stops={activeBatch.stops as any} />
          </div>
          {/* Phase 361: Stopp-Erinnerungs-Panel — Checkliste für aktuellen Stop mit Kundeninfos + Anruf-Button */}
          <div className="px-4">
            <FahrerStoppErinnerungsPanel activeBatch={activeBatch as any} />
          </div>
          {/* Näherungs-Alert: Vibration + Overlay wenn Fahrer <250m vom nächsten Stop */}
          {(() => {
            const nextStop = activeBatch.stops.find((s) => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <ProximityStopAlert
                nextStopLat={(nextStop.order as any)?.kunde_lat ?? null}
                nextStopLng={(nextStop.order as any)?.kunde_lng ?? null}
                nextStopName={(nextStop.order as any)?.kunde_name ?? `Stop ${nextStop.reihenfolge}`}
                nextStopAddress={(nextStop.order as any)?.kunde_adresse ?? null}
              />
            );
          })()}
          {/* Phase 425: Stop-Ankunfts-Näherung — GPS-Distanz + Ankunftsbestätigung zum nächsten Stopp */}
          {(() => {
            const nextStop = activeBatch.stops.find((s) => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <StopArrivalProximity
                lat={(nextStop.order as any)?.kunde_lat ?? null}
                lng={(nextStop.order as any)?.kunde_lng ?? null}
                address={(nextStop.order as any)?.kunde_adresse ?? null}
                stopNumber={nextStop.reihenfolge}
                onConfirmArrival={() => markArrived(nextStop.id)}
              />
            );
          })()}
          {/* ETA-Ampel: Schnellstatus ob aktuelle Tour pünktlich ist */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <EtaAmpel
                etaLatest={(activeBatch.stops.find(s => !s.geliefert_am)?.order as any)?.eta_latest ?? null}
                etaEarliest={(activeBatch.stops.find(s => !s.geliefert_am)?.order as any)?.eta_earliest ?? null}
                batchStartedAt={activeBatch.started_at}
                totalEtaMin={activeBatch.total_eta_min ?? null}
                stopsTotal={activeBatch.stops.length}
                stopsCompleted={activeBatch.stops.filter(s => s.geliefert_am).length}
              />
            </div>
          )}
          {/* Nächster Stop — prominente Navigationskarte mit ETA + Betrag */}
          {activeBatch.stops.some(s => !s.geliefert_am) && (
            <div className="px-4">
              <StopNavCard
                stops={activeBatch.stops as any}
              />
            </div>
          )}
          {/* Phase 191: Stop-Timer-Ring — zeigt wie lange Fahrer bereits am aktuellen Stop ist */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am && s.angekommen_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <StopTimerRing
                  arrivedAt={nextStop.angekommen_am}
                  expectedDwellSec={90}
                  stopLabel={nextStop.order.kunde_adresse ?? `Stop ${nextStop.reihenfolge}`}
                />
              </div>
            );
          })()}
          {/* Phase 308: Stop-Verification-Panel — Zustellung bestätigen oder Fehlversuch melden wenn angekommen */}
          {(() => {
            const arrivedStop = activeBatch.stops.find(s => !s.geliefert_am && s.angekommen_am);
            if (!arrivedStop) return null;
            const idx = activeBatch.stops.filter(s => s.reihenfolge < arrivedStop.reihenfolge).length;
            return (
              <div className="px-4">
                <FahrerStopVerificationPanel
                  stop={arrivedStop as any}
                  stopIndex={idx}
                  totalStops={activeBatch.stops.length}
                  onDelivered={async (stopId) => { await markDelivered(stopId); }}
                  onFailedAttempt={async (stopId, reason) => {
                    const failedStop = activeBatch.stops.find((s) => s.id === stopId);
                    await fetch(`/api/delivery/tours/${activeBatch.id}/failed-attempt`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ stop_id: stopId, order_id: failedStop?.order_id, reason }),
                    }).catch(() => {});
                    router.refresh();
                  }}
                />
              </div>
            );
          })()}
          {/* Phase 425: Lieferungs-Bestätigung — Multi-Schritt Bestätigung: Übersicht → Zahlung → Bestätigt */}
          {(() => {
            const arrivedStop = activeBatch.stops.find(s => !s.geliefert_am && s.angekommen_am);
            if (!arrivedStop) return null;
            return (
              <div className="px-4">
                {showLieferungBestaetigung === arrivedStop.id ? (
                  <LieferungBestaetigung
                    stop={{
                      id: arrivedStop.id,
                      order_id: arrivedStop.order_id,
                      reihenfolge: arrivedStop.reihenfolge,
                      geliefert_am: arrivedStop.geliefert_am,
                      order: {
                        bestellnummer: arrivedStop.order.bestellnummer,
                        kunde_name: arrivedStop.order.kunde_name,
                        kunde_adresse: arrivedStop.order.kunde_adresse ?? null,
                        kunde_plz: arrivedStop.order.kunde_plz ?? null,
                        gesamtbetrag: arrivedStop.order.gesamtbetrag,
                        zahlungsart: (arrivedStop.order as any).zahlungsart ?? null,
                        bezahlt: (arrivedStop.order as any).bezahlt ?? null,
                        kunde_telefon: arrivedStop.order.kunde_telefon ?? null,
                        kunde_notiz: (arrivedStop.order as any).kunde_notiz ?? null,
                        kunde_lieferhinweis: (arrivedStop.order as any).kunde_lieferhinweis ?? null,
                      },
                    }}
                    batchId={activeBatch.id}
                    onConfirmed={() => { setShowLieferungBestaetigung(null); markDelivered(arrivedStop.id); }}
                  />
                ) : (
                  <button
                    onClick={() => setShowLieferungBestaetigung(arrivedStop.id)}
                    className="w-full py-3 rounded-xl bg-matcha-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                  >
                    <span>✓</span> Lieferung bestätigen
                  </button>
                )}
              </div>
            );
          })()}
          {/* Next-Stop Navigation CTA — großer daumenfreundlicher Maps-Button */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <NextStopCta
                  address={nextStop.order.kunde_adresse ?? null}
                  lat={nextStop.order.kunde_lat ?? null}
                  lng={nextStop.order.kunde_lng ?? null}
                  stopNumber={nextStop.reihenfolge}
                  isCurrentStop={true}
                />
              </div>
            );
          })()}
          {/* Smart-Stop-Action-Card: Navi-Kurzwahlen + Kundendaten + große Aktions-Buttons */}
          {(() => {
            const currentStop = activeBatch.stops
              .filter(s => !s.geliefert_am)
              .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];
            if (!currentStop?.order) return null;
            const completedCount = activeBatch.stops.filter(s => s.geliefert_am).length;
            return (
              <div className="px-4">
                <SmartStopActionCard
                  stop={currentStop as any}
                  stopIndex={completedCount + 1}
                  totalStops={activeBatch.stops.length}
                  driverLat={driverPos?.lat ?? null}
                  driverLng={driverPos?.lng ?? null}
                  onMarkArrived={markArrived}
                  onMarkDelivered={markDelivered}
                />
              </div>
            );
          })()}
          {/* Quick-Nav-Kommando: Große Tasten für Navigation + Anrufen + Zugestellt */}
          {(() => {
            const currentStop = activeBatch.stops
              .filter(s => !s.geliefert_am)
              .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];
            if (!currentStop?.order) return null;
            const o = currentStop.order as any;
            return (
              <div className="px-4 mt-2">
                <QuickNavKommando
                  stop={{
                    adresse: o.kunde_adresse ?? null,
                    plz: o.kunde_plz ?? null,
                    klingelname: o.klingelname ?? null,
                    etage: o.etage ?? null,
                    notiz: o.kunde_lieferhinweis ?? o.kunde_notiz ?? null,
                    telefon: o.kunde_telefon ?? null,
                    bestellnummer: o.bestellnummer ?? '',
                    kundeName: o.kunde_name ?? 'Kunde',
                  }}
                  onDelivered={() => markDelivered(currentStop.id)}
                  onProblem={() => {}}
                />
              </div>
            );
          })()}
          {/* NaviWidget: Turn-by-Turn Navigation zum nächsten Stopp */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            const lat = nextStop.order.kunde_lat;
            const lng = nextStop.order.kunde_lng;
            if (!lat || !lng || !driverPos) return null;
            const vehicleRaw = status?.fahrzeug ?? driver.fahrzeug_praeferenz ?? '';
            const vehicle: 'car' | 'bike' = /fahrrad|bike|rad|velo/i.test(vehicleRaw) ? 'bike' : 'car';
            return (
              <div className="px-4">
                <NaviWidget
                  batchId={activeBatch.id}
                  stopIndex={nextStop.reihenfolge}
                  toLat={lat}
                  toLng={lng}
                  vehicle={vehicle}
                  driverLat={driverPos.lat}
                  driverLng={driverPos.lng}
                />
              </div>
            );
          })()}
          {/* Phase 255: Richtungs-Anzeige — Kompass-Pfeil + Luftlinien-Distanz zum nächsten Stopp */}
          {driverPos && (
            <div className="px-4">
              <FahrerRichtungsAnzeige
                stops={activeBatch.stops as any}
                driverLat={driverPos.lat}
                driverLng={driverPos.lng}
              />
            </div>
          )}
          {/* Phase 421: Stopp-Abschluss-Ampel — ETA-Zeitfenster-Ampel für aktuellen Stopp */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            const o = nextStop.order as any;
            if (!o?.eta_latest) return null;
            return (
              <div className="px-4">
                <StoppAbschlussAmpel
                  etaLatest={o.eta_latest}
                  etaEarliest={o.eta_earliest ?? null}
                  stoppeAdresse={o.kunde_adresse ?? null}
                  onDelivered={() => markDelivered(nextStop.id)}
                />
              </div>
            );
          })()}
          {/* Phase 249: Ankunfts-Signal — Kunden mit einem Tap über Ankunft informieren */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <FahrerAnkunftsSignal
                  orderId={nextStop.order_id}
                  kundeVorname={(nextStop.order as any)?.kunde_name?.split(' ')[0] ?? 'Kunde'}
                  kundeTelefon={(nextStop.order as any)?.kunde_telefon ?? null}
                />
              </div>
            );
          })()}
          {/* Kunden-Historie: Stammkunde vs. Neukunde, Bestellanzahl, Ø Wert */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <KundenHistorieKarte
                  orderId={nextStop.order_id}
                  locationId={driver.location_id}
                />
              </div>
            );
          })()}
          {/* Phase 210: Fahrzeit-Prognose — verbleibende Zeit + Stopp-Countdown */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrzeitPrognose
                stops={activeBatch.stops.map(s => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  kunde_name: (s.order as any)?.kunde_name ?? undefined,
                  kunde_adresse: (s.order as any)?.kunde_adresse ?? null,
                  angekommen_am: s.angekommen_am,
                  geliefert_am: s.geliefert_am,
                }))}
                startedAt={activeBatch.started_at}
                totalEtaMin={activeBatch.total_eta_min ?? null}
              />
            </div>
          )}
          {/* Ankunftszeit-Prognose: GPS-basierte ETA für jeden Stopp */}
          {activeBatch.stops.filter((s: any) => !s.geliefert_am).length > 0 && (
            <div className="px-4">
              <TourStopEtaPredictor
                stops={activeBatch.stops as any}
                currentSpeed={gpsSpeed}
                started_at={activeBatch.started_at}
              />
            </div>
          )}
          {/* Tour-KPI-Summary: kompakte Leistungskennzahlen für die aktuelle Tour */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourKpiSummary
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at}
                totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              />
            </div>
          )}
          {/* Tour-Navigation-HUD: Nächster Stopp mit Countdown, Distanz, Navigations-Button */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourNaviHUD
                stops={activeBatch.stops as any}
                totalEtaMin={(activeBatch as any).total_eta_min ?? null}
                totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              />
            </div>
          )}
          {/* Phase 339: Tour-Route-Timing — Vollständige Routen-Übersicht mit ETA je Stopp + Nav */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourRouteTiming
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at}
                totalEtaMin={(activeBatch as any).total_eta_min ?? null}
              />
            </div>
          )}
          {/* Phase 340: Stopp-ETA-Matrix — Timeline aller Stopps mit Countdown, Distanz + Fortschrittsanzeige */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourStoppEtaMatrix
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at}
                totalEtaMin={(activeBatch as any).total_eta_min ?? null}
              />
            </div>
          )}
          {/* Phase 351: Tour-Navigator Pro — Nächster Stopp mit ETA-Countdown, Distanz, Navigation */}
          {activeBatch.stops.length > 0 && (() => {
            const nextStop = activeBatch.stops.find((s: any) => !s.geliefert_am && !s.angekommen_am) ?? activeBatch.stops[0];
            return (
              <div className="px-4">
                <FahrerTourNavigatorPro
                  stop={nextStop ? {
                    id: nextStop.id,
                    order: {
                      ...nextStop.order,
                      eta_earliest: (nextStop.order as any).eta_earliest ?? null,
                      eta_latest: (nextStop.order as any).eta_latest ?? null,
                      zahlungsart: (nextStop.order as any).zahlungsart ?? null,
                      bezahlt: (nextStop.order as any).bezahlt ?? null,
                    },
                    reihenfolge: nextStop.reihenfolge,
                    distanz_zum_vorgaenger_m: nextStop.distanz_zum_vorgaenger_m ?? null,
                  } : null}
                  totalStops={activeBatch.stops.length}
                />
              </div>
            );
          })()}
          {/* GPS-Navigator: zeigt Distanz + Richtung zum nächsten Stopp */}
          <TourGPSNavigator stops={activeBatch.stops as any} driverPos={driverPos} />
          {/* Erweiterter Nav-Hub: Stop-Liste + Kompass + ETA-Countdown + Navigations-Buttons */}
          <div className="px-4">
            <FahrerNavHub stops={activeBatch.stops as any} driverPos={driverPos} />
          </div>
          {/* Nächster-Stop-Fokus: Ultra-fokussierte Karte mit ETA-Countdown + Navigation */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <NaechsterStopFokus
                stops={activeBatch.stops as any}
                totalStops={activeBatch.stops.length}
              />
            </div>
          )}
          {/* Phase 395: Navigations-Kompass — Smart nächster Stopp mit Navigation, Countdown, Fortschrittsanzeige */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourNavigationsKompass
                batchId={activeBatch.id}
                driverId={driver.id}
              />
            </div>
          )}
          {/* Phase 876: Tour Nächster Stopp Ultra — Ultra-kompakte Next-Stop Karte mit Navigation + ETA */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerPhase876TourNaechsterStoppUltra stops={activeBatch.stops as any} />
            </div>
          )}
          {/* Phase 877: Tour-Stopp-Navigator Live — Vollständige Stopp-Liste mit Navigation, Fortschrittsbalken + Zugestellt-Button */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerPhase877TourStoppNavigatorLive
                stops={(activeBatch.stops as unknown as TourStoppLive[])}
              />
            </div>
          )}
          {/* Phase 500: Nächster-Stopp-Navigator — One-Tap Navigation + Countdown + Kundendaten + ETA */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerPhase500NaechsterStoppNav stops={activeBatch.stops as any} />
            </div>
          )}
          {/* Phase 1876: Smart-Stopp-Nav-Cockpit-Final — Kompaktes Stop-Cockpit mit Navi-Link, Ankunfts-/Lieferungs-Confirm, nächster-Stop-Vorschau */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <Phase1876SmartStoppNavCockpitFinal
                stops={activeBatch.stops.map((s: any) => ({
                  id: s.id,
                  sequence: s.reihenfolge ?? 1,
                  address: s.order?.kunde_adresse ?? s.address ?? '',
                  lat: s.lat ?? null,
                  lng: s.lng ?? null,
                  order: s.order ? {
                    bestellnummer: s.order.bestellnummer,
                    status: s.order.status,
                    delivery_zone: s.order.delivery_zone ?? null,
                    eta_earliest: s.order.eta_earliest ?? null,
                  } : null,
                  angekommen_am: s.angekommen_am ?? null,
                  geliefert_am: s.geliefert_am ?? null,
                  customer_name: s.order?.kunde_name ?? null,
                  customer_phone: s.order?.kunde_telefon ?? null,
                  notes: s.order?.kunde_lieferhinweis ?? null,
                }))}
              />
            </div>
          )}
          {/* Tour-Stopp-Liste mit Navigation + ETA-Countdowns */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourStopsPanel
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at}
                totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              />
            </div>
          )}
          {/* Smart Tour Navigator v2 — Übersichtlicher Stopp-Navigator mit 1-Tap Navi & Quittierung */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <SmartTourNavigatorV2
                stops={activeBatch.stops.map((s: any, i: number) => ({
                  id: s.id,
                  index: (s.reihenfolge ?? i) + 1,
                  address: s.order?.kunde_adresse ?? s.kunde_adresse ?? s.address ?? '',
                  customer_name: s.order?.kunde_name ?? s.kunde_name ?? null,
                  customer_phone: s.order?.kunde_telefon ?? s.kunde_telefon ?? null,
                  status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
                  eta_min: s.eta_min ?? null,
                  distance_km: s.distance_km ?? null,
                  order_id: s.order_id ?? null,
                  bestellnummer: s.order?.bestellnummer ?? s.bestellnummer ?? null,
                  betrag: s.order?.gesamtbetrag ?? s.gesamtbetrag ?? null,
                  payment_method: s.order?.zahlungsart ?? s.zahlungsart ?? 'online',
                  notes: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? null,
                }))}
                tourId={activeBatch.id}
              />
            </div>
          )}
          {/* Phase 1313: Smart-Tour-Navigator-Ultra — Mobil-optimierter Tour-Stopp-Navigator mit Echtzeit-ETA + Navigations-CTA */}
          {activeBatch && (
            <div className="px-4">
              <FahrerPhase1313SmartTourNavigatorUltra
                stops={(activeBatch.stops ?? []).map((s: any, i: number) => ({
                  id: s.id,
                  order_id: s.order_id,
                  address: s.kunde_adresse ?? s.address ?? '',
                  lat: s.lat ?? null,
                  lng: s.lng ?? null,
                  status: s.geliefert_am ? 'done' : s.angekommen_am ? 'arrived' : 'pending',
                  sequence: s.reihenfolge ?? i,
                  customer_name: s.kunde_name ?? null,
                  eta_min: s.eta_min ?? null,
                }))}
                currentStopIndex={(activeBatch.stops ?? []).findIndex((s: any) => !s.geliefert_am)}
                driverPos={driverPos}
              />
            </div>
          )}
          {/* Phase 900: Tour-Stops-Priorität — Kompakte Sequenz-Karte aller Stops mit Navigation + ETA */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerPhase900TourStopsPrioritaet
                stops={activeBatch.stops.map((s, idx) => ({
                  id: s.id,
                  sequence: s.reihenfolge ?? idx + 1,
                  address: s.order.kunde_adresse ?? '',
                  customer_name: s.order.kunde_name,
                  order_number: s.order.bestellnummer,
                  done: s.geliefert_am != null,
                  notes: s.order.kunde_lieferhinweis ?? s.order.kunde_notiz ?? null,
                  lat: s.order.kunde_lat,
                  lng: s.order.kunde_lng,
                  eta_min: activeBatch.started_at && activeBatch.total_eta_min != null
                    ? Math.max(0, Math.round(
                        activeBatch.total_eta_min
                        - (Date.now() - new Date(activeBatch.started_at).getTime()) / 60000
                        + idx * 5
                      ))
                    : null,
                }))}
              />
            </div>
          )}
          {/* Phase 910: Tour-Stopp-Countdown-Ring — SVG-Ring-Countdown-Timer mit Sekundengenauem ETA je Stopp */}
          {activeBatch.stops.length > 0 && (() => {
            const nextStop = activeBatch.stops.find((s: any) => s.geliefert_am == null);
            if (!nextStop) return null;
            const stopIndex = activeBatch.stops.indexOf(nextStop);
            const etaMin = activeBatch.started_at && (activeBatch as any).total_eta_min != null
              ? Math.max(0, Math.round(
                  (activeBatch as any).total_eta_min
                  - (Date.now() - new Date(activeBatch.started_at).getTime()) / 60000
                  + stopIndex * 4
                ))
              : null;
            return (
              <div className="px-4">
                <TourStoppCountdownRing
                  etaMin={etaMin}
                  stopNummer={nextStop.reihenfolge ?? stopIndex + 1}
                  gesamtStops={activeBatch.stops.length}
                  adresse={nextStop.order?.kunde_adresse ?? ''}
                  kundeVorname={nextStop.order?.kunde_name?.split(' ')[0] ?? 'Kunde'}
                  distanzKm={nextStop.distanz_zum_vorgaenger_m ? nextStop.distanz_zum_vorgaenger_m / 1000 : null}
                  onNavigate={() => {
                    const addr = encodeURIComponent(nextStop.order?.kunde_adresse ?? '');
                    window.open(`https://maps.google.com/?q=${addr}`, '_blank');
                  }}
                />
              </div>
            );
          })()}
          {/* Phase 911: Tour-Kassen-Radar — Bargeld-Übersicht je Stopp mit Kassier-Fortschritt und Restbetrag */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourKassenRadar
                stops={activeBatch.stops.map((s: any) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge ?? null,
                  geliefert_am: s.geliefert_am ?? null,
                  order: s.order ? {
                    bestellnummer: s.order.bestellnummer,
                    kunde_name: s.order.kunde_name,
                    gesamtbetrag: s.order.gesamtbetrag ?? 0,
                    zahlungsart: s.order.zahlungsart ?? null,
                    bezahlt: s.order.bezahlt ?? null,
                  } : null,
                }))}
              />
            </div>
          )}
          {/* Phase 1071: Kunden-Kontakt-Schnell-Panel v2 — 1-Tap Anruf + Nachricht + Klingeln + Nicht-Erreicht-Meldung */}
          {activeBatch.stops.filter((s: any) => !s.geliefert_am).length > 0 && (() => {
            const nextS = activeBatch.stops.find((s: any) => !s.geliefert_am);
            const idx = activeBatch.stops.indexOf(nextS as any) + 1;
            return (
              <div className="px-4">
                <FahrerPhase1071KundenKontaktSchnellPanelV2
                  kundenName={(nextS as any)?.order?.kunde_name ?? null}
                  kundenTelefon={(nextS as any)?.order?.kunde_telefon ?? null}
                  stoppNr={idx}
                />
              </div>
            );
          })()}
          {/* Phase 1076: Live-Tour-Karten-Minimap — Kompakte SVG-Karte mit Stopp-Markierungen + Fahrer-Position */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerPhase1076LiveTourKartenMinimap
                stopps={activeBatch.stops.map((s: any) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge ?? null,
                  geliefert_am: s.geliefert_am ?? null,
                  adresse: s.order?.kunde_adresse ?? null,
                  lat: s.order?.lieferung_lat ?? null,
                  lng: s.order?.lieferung_lng ?? null,
                }))}
              />
            </div>
          )}
          {/* Phase 915: Kunden-Kontakt-Schnell — 1-Tap Anruf + 4 SMS-Vorlagen für den nächsten Kunden */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <KundenKontaktSchnell
                stops={activeBatch.stops.map((s: any) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge ?? null,
                  geliefert_am: s.geliefert_am ?? null,
                  order: s.order ? {
                    kunde_name: s.order.kunde_name,
                    kunde_telefon: s.order.kunde_telefon ?? null,
                    kunde_adresse: s.order.kunde_adresse ?? null,
                  } : null,
                }))}
              />
            </div>
          )}
          {/* Phase 915 Pro: Tour-Stopp-Navigator-Pro — Stop-Karten, Fortschrittsbalken, Schnellzugriff Navigation/Anruf */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerPhase915TourStoppNavigatorPro
                stops={activeBatch.stops
                  .filter((s: any) => s.order)
                  .map((s: any, i: number) => ({
                    id: s.id,
                    order_number: s.order?.bestellnummer ?? `#${s.id.slice(-4)}`,
                    address: s.order?.kunde_adresse ?? '',
                    customer_name: s.order?.kunde_name ?? undefined,
                    customer_phone: s.order?.kunde_telefon ?? undefined,
                    eta_min: 5 + i * 7,
                    status: s.geliefert_am ? 'completed' : i === activeBatch.stops.filter((x: any) => !x.geliefert_am).indexOf(s) && !s.geliefert_am ? 'current' : 'pending',
                    position: s.reihenfolge ?? i + 1,
                    notes: s.order?.notiz ?? undefined,
                  }))}
              />
            </div>
          )}
          {/* Phase 427: Tour-Lieferquote — Pünktlichkeitsquote + Fortschrittsbalken der aktuellen Tour */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourLieferquote activeBatch={activeBatch} />
            </div>
          )}
          {/* Phase 402: Sequenz-Navigator-Pro — Übersichtliche Schritt-für-Schritt Navigation */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourSequenzNavigatorPro
                stops={activeBatch.stops as any}
                tourStartedAt={activeBatch.started_at}
                totalEtaMin={activeBatch.total_eta_min ?? null}
              />
            </div>
          )}
          {/* Phase 366: Tour-Stop-Navigation-Board — Alle Stopps mit Nav-Button, Payment-Info, ETA */}
          {activeBatch && (
            <TourStopNavigationBoard
              stops={activeBatch.stops}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          )}
          {/* Zeitfenster-Karte — Lieferzeitfenster aller Stopps mit Farbkodierung und Countdown */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerTourZeitfensterKarte stops={activeBatch.stops as any} />
            </div>
          )}
          {/* Navi-App-Auswahl: Google Maps, Waze, Apple Maps — Single + Multi-Stop */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourWazeNav
                stops={activeBatch.stops.map((s: any) => ({
                  kunde_lat: s.order?.kunde_lat ?? null,
                  kunde_lng: s.order?.kunde_lng ?? null,
                  kunde_adresse: s.order?.kunde_adresse ?? null,
                  kunde_plz: s.order?.kunde_plz ?? null,
                  geliefert_am: s.geliefert_am ?? null,
                  reihenfolge: s.reihenfolge ?? 0,
                }))}
              />
            </div>
          )}
          {/* Phase 403: Stopp-Schnell-Kommando — Schnell-Aktions-Karte für aktuellen Stopp */}
          {activeBatch.stops.length > 0 && (() => {
            const nextStop = activeBatch.stops.find((s: any) => s.geliefert_am == null);
            if (!nextStop) return null;
            const stopIndex = activeBatch.stops.indexOf(nextStop);
            return (
              <div className="px-4">
                <FahrerStoppSchnellKommando
                  stop={{
                    id: nextStop.id,
                    bestellnummer: nextStop.order?.bestellnummer ?? '?',
                    kunde_name: nextStop.order?.kunde_name ?? 'Kunde',
                    kunde_adresse: nextStop.order?.kunde_adresse ?? null,
                    kunde_lat: nextStop.order?.kunde_lat ?? null,
                    kunde_lng: nextStop.order?.kunde_lng ?? null,
                    kunde_telefon: nextStop.order?.kunde_telefon ?? null,
                    gesamtbetrag: nextStop.order?.gesamtbetrag ?? 0,
                    zahlungsart: (nextStop.order as any)?.zahlungsart ?? null,
                    bezahlt: (nextStop.order as any)?.bezahlt ?? null,
                    kunde_notiz: nextStop.order?.kunde_notiz ?? null,
                    kunde_lieferhinweis: nextStop.order?.kunde_lieferhinweis ?? null,
                  }}
                  stopNumber={stopIndex + 1}
                  totalStops={activeBatch.stops.length}
                  onComplete={() => markDelivered(nextStop.id)}
                  onProblem={() => {}}
                  disabled={pending}
                />
              </div>
            );
          })()}
          {/* Phase 405: Stop-Zielkompass — Richtung, Entfernung, Kundennotiz + Nav-Links für aktuellen Stopp */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerStopZielkompass
                stops={activeBatch.stops as any}
                driverPos={driverPos}
                vehicle={status?.fahrzeug ?? null}
              />
            </div>
          )}
          {/* Stop-Navigator: Nächster Stopp mit Navigation, Anruf, Geliefert + Fortschrittsbalken */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourStopNavigator
                stops={activeBatch.stops as any}
                onMarkDelivered={markDelivered}
                pending={pending}
                kitchenStatuses={kitchenStatuses}
              />
            </div>
          )}
          {/* Tour-Kompakt-Kommando — nächste 3 Stops, urgency-sortiert, 1-Tap Navi + Fertig */}
          {activeBatch.stops.filter((s: any) => !s.geliefert_am).length > 0 && (
            <div className="px-4">
              <TourKompaktKommando
                stops={activeBatch.stops.map((s: any) => ({
                  id: s.id,
                  order_id: s.order_id,
                  reihenfolge: s.reihenfolge ?? 0,
                  geliefert_am: s.geliefert_am ?? null,
                  order: s.order ? {
                    bestellnummer: s.order.bestellnummer,
                    kunde_name: s.order.kunde_name,
                    kunde_adresse: s.order.kunde_adresse ?? null,
                    kunde_plz: s.order.kunde_plz ?? null,
                    kunde_stadt: s.order.kunde_stadt ?? null,
                    kunde_lat: s.order.kunde_lat ?? null,
                    kunde_lng: s.order.kunde_lng ?? null,
                    eta_latest: s.order.eta_latest ?? null,
                    zahlungsart: s.order.zahlungsart ?? null,
                    gesamtbetrag: s.order.gesamtbetrag ?? null,
                  } : null,
                }))}
                onDeliver={(stopId) => markDelivered(stopId)}
                deliverLoading={pending ? activeBatch.stops.find((s: any) => !s.geliefert_am)?.id ?? null : null}
              />
            </div>
          )}
          {/* Phase 260: Tour-Navigations-Cockpit — Stop-Liste mit Expand, Anruf, Navigation, ETA */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourNavigationsCockpit driverId={driver.id} batchId={(activeBatch as any).id ?? null} />
            </div>
          )}
          {/* Phase 263: Kunden-Notiz-Karte — Lieferhinweise + Sonderanweisungen pro Stop hervorgehoben */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerKundenNotizKarte
                stops={activeBatch.stops as any}
                currentStopId={activeBatch.stops.find((s: any) => s.geliefert_am == null)?.id ?? null}
              />
            </div>
          )}
          {/* Phase 271: Tour-Stop-Detail-Karten — expandierbare Kunden-Info + Aktions-Buttons je Stop */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourStopsDetailPanel
                stops={activeBatch.stops.map((s, i): TourStop => ({
                  id: s.id,
                  stopNumber: s.reihenfolge ?? i + 1,
                  customerName: s.order?.kunde_name ?? 'Kunde',
                  address: [s.order?.kunde_adresse, s.order?.kunde_plz].filter(Boolean).join(', ') || 'Adresse unbekannt',
                  phone: s.order?.kunde_telefon ?? undefined,
                  notes: s.order?.kunde_notiz ?? s.order?.kunde_lieferhinweis ?? undefined,
                  itemCount: 1,
                  status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
                  distanceKm: s.distanz_zum_vorgaenger_m ? s.distanz_zum_vorgaenger_m / 1000 : undefined,
                }))}
                activeStopId={activeBatch.stops.find((s) => !s.geliefert_am)?.id}
                onNavigate={(stop) => {
                  const q = encodeURIComponent(stop.address);
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
                }}
                onCall={(phone) => { window.open(`tel:${phone}`, '_self'); }}
              />
            </div>
          )}
          {/* Stopp-Übersicht: Alle Stopps expandierbar mit Fortschrittsbalken + Navigation */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourStoppUebersicht
                stops={activeBatch.stops as any}
                currentStopId={activeBatch.stops.find((s: any) => !s.geliefert_am)?.id ?? null}
              />
            </div>
          )}
          {/* Phase 1701: Live-Schicht-Performance-Score — Score-Ring + Lieferungen + Pünktlichkeit + Einnahmen in Echtzeit */}
          <div className="px-4">
            <FahrerPhase1701LiveSchichtPerformanceScore driverId={driver.id} locationId={driver.location_id ?? null} />
          </div>
          {/* Phase 1700: Tour-Stopp-Navigator Master — Aktueller Stopp mit Google Maps/Waze-Buttons + Nächste-Stopp-Vorschau + Alle-Stopps-Liste */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <Phase1700TourStoppNavigatorMaster
                stops={activeBatch.stops.map((s: any) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge ?? 1,
                  adresse: s.order?.kunde_adresse ?? s.adresse ?? 'Adresse unbekannt',
                  name: s.order?.kunde_name ?? null,
                  telefon: s.order?.kunde_telefon ?? null,
                  lat: s.order?.kunde_lat ?? null,
                  lng: s.order?.kunde_lng ?? null,
                  eta_min: s.eta_min ?? null,
                  status: s.geliefert_am ? 'erledigt' : 'offen' as 'offen'|'erledigt',
                  notiz: s.order?.kunde_notiz ?? null,
                }))}
              />
            </div>
          )}
          {/* Phase 397: Tour-Stopp-Sequenz-Board — Visueller Stopp-Fortschritt mit Timeline, ETA-Fenster und Navigation */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourStoppSequenzBoard
                stops={activeBatch.stops as any}
                currentStopIndex={activeBatch.stops.findIndex((s: any) => !s.geliefert_am)}
              />
            </div>
          )}
          {/* Phase 394: Tour-Zeitfenster-Ampel — Verkehrsampel ob Fahrer im Zeitplan liegt */}
          {(activeBatch as any).total_eta_min && activeBatch.started_at && (
            <div className="px-4">
              <TourZeitfensterAmpel
                batchId={activeBatch.id}
                totalEtaMin={(activeBatch as any).total_eta_min ?? 60}
                startedAt={activeBatch.started_at}
              />
            </div>
          )}
          {/* Kunden-Stop-Info: Detaillierte Kundeninfos je Stop — Notizen, Zugang, Zahlung, Navigation */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <KundenStopInfo
                stops={activeBatch.stops as any}
                currentStopId={activeBatch.stops.find((s: any) => !s.geliefert_am)?.id ?? null}
              />
            </div>
          )}
          {/* Phase 334: Nächster-Stopp-Info — Adresse, Betrag, Notizen, Navigations-Button */}
          {activeBatch.stops?.length > 0 && (
            <div className="px-4">
              <TourNaechsterStoppInfo
                stops={activeBatch.stops as any}
                locationLat={null}
                locationLng={null}
              />
            </div>
          )}
          {/* Phase 332: Tour-Schicht-Bilanz — Schicht-KPIs + Tour-Fortschritt kompakt */}
          <div className="px-4">
            <TourSchichtBilanz
              activeBatch={activeBatch}
              todayEarnings={todayStats?.estEarnings ?? 0}
              todayDeliveries={todayStats?.deliveries ?? 0}
              onlineMinutes={status?.online_seit ? Math.floor((Date.now() - new Date(status.online_seit).getTime()) / 60_000) : 0}
            />
          </div>
          {/* Phase 326: Tour-Kosten-Ertrag — Echtzeit-Einnahmen der aktuellen Tour je Stopp */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourKostenErtrag
                stops={activeBatch.stops.map((s: any) => ({
                  id: s.id,
                  status: s.geliefert_am ? 'completed' : s.angekommen_am ? 'pending' : 'pending',
                  trinkgeld: s.order?.trinkgeld ?? 0,
                  bestellwert: s.order?.gesamtbetrag ?? 0,
                }))}
              />
            </div>
          )}
          {/* Phase 300: Problem-Meldung — Fahrer kann Lieferprobleme schnell an Dispatch melden */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop || !nextStop.angekommen_am) return null;
            return (
              <div className="px-4">
                <FahrerProblemMeldung
                  orderId={nextStop.order_id}
                  stopId={nextStop.id}
                  kundeVorname={(nextStop.order as any)?.kunde_name?.split(' ')[0] ?? 'Kunde'}
                  kundeTelefon={(nextStop.order as any)?.kunde_telefon ?? null}
                />
              </div>
            );
          })()}

          {/* Tour-Fortschritts-Ring: Visueller SVG-Ring mit Stopp-Fortschritt + ETA */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourFortschrittsRing
                stops={activeBatch.stops.map(s => ({
                  id: s.id,
                  geliefert_am: s.geliefert_am,
                  reihenfolge: s.reihenfolge,
                }))}
                batchStartedAt={activeBatch.started_at}
                totalEtaMin={activeBatch.total_eta_min ?? null}
              />
            </div>
          )}
          {/* Phase 275: Rückkehr-Prognose — KI-Vorhersage wann Fahrer wieder an der Basis ist */}
          {driver.location_id && (
            <div className="px-4">
              <TourRueckkehrAnzeige driverId={driver.id} locationId={driver.location_id} />
            </div>
          )}
          {/* Phase 280: Schicht-Zusammenfassung Live — Einnahmen, Lieferungen, Pünktlichkeit, Prognose */}
          <div className="px-4">
            <SchichtZusammenfassungLive driverId={driver.id} onlineSince={status?.online_seit ?? null} />
          </div>
          {/* Phase 305: Push-Status-Karte — Push-Benachrichtigungs-Verlauf für aktive Tour */}
          {activeBatch.stops.length > 0 && (() => {
            const firstStop = activeBatch.stops[0];
            if (!firstStop) return null;
            return (
              <div className="px-4">
                <FahrerPushStatusKarte
                  orderId={firstStop.order_id}
                  orderStatus={activeBatch.status}
                  fahrerId={driver.id}
                />
              </div>
            );
          })()}
          {/* Phase 319: Delay-Alert-Hinweis — Fahrer wird informiert wenn Kunden Delay-Alert erhalten haben */}
          <FahrerDelayAlertHinweis batchHasCriticalOrder={activeBatch.stops.length > 0} />
          {/* Phase 341: Gebühren-Info — Dynamic Pricing Status für Fahrer (Surge vs. Normaltarif) */}
          {driver.location_id && (
            <div className="px-4">
              <FahrerGebuehrenInfo locationSlug={driver.location_id} />
            </div>
          )}
          {/* Phase 345: Storno-Info-Banner — Info wenn Stop während Tour storniert wurde */}
          {activeBatch && (
            <div className="px-4">
              <FahrerStornoInfoBanner activeBatch={activeBatch} />
            </div>
          )}
          {/* Phase 346: Heatmap-Tipp — Meistangefahrene Zone der Woche */}
          {driver?.location_id && (
            <div className="px-4">
              <HeatmapTipp locationId={driver.location_id} />
            </div>
          )}
          {/* Phase 423: Zonen-Hot-Chip — Welche Zonen morgen besonders viele Bestellungen erwarten */}
          {driver?.location_id && (
            <div className="px-4">
              <ZonenHotChip locationId={driver.location_id} />
            </div>
          )}
          {/* Phase 347: Standort-Gesundheits-Badge — Motivierendes Note-Badge für den Fahrer */}
          <div className="px-4">
            <FahrerStandortHealthBadge locationId={driver?.location_id ?? null} />
          </div>
          {/* Phase 348: Prämien-Fortschritt — Meilensteine + Live-Progress bis nächstem Bonus */}
          <div className="px-4">
            <TourRewardProgress
              driverId={driver?.id ?? null}
              sessionDeliveries={todayStats?.deliveries ?? 0}
              sessionRating={null}
              streakDays={0}
              sessionRevenueEur={todayStats?.estEarnings ?? 0}
            />
          </div>
          {/* Phase 343: Schicht-Verdienst-Live — EUR/Stopp, EUR/Std, Schicht-Fortschritt */}
          {todayStats && todayStats.estEarnings > 0 && (
            <div className="px-4">
              <FahrerSchichtVerdienstLive
                earningsEur={todayStats.estEarnings}
                locationId={driver.location_id ?? null}
              />
            </div>
          )}
          {/* Phase 521: Tageseinnahmen-Karte — Basis/Trinkgeld/Bonus + stündliche Balken + Delta zu gestern */}
          <div className="px-4">
            <FahrerTagesEinnahmenKarte driverId={driver.id} />
          </div>
          {/* Phase 350: Mein Engagement — Punkte, Abzeichen, Wochenrang */}
          <FahrerMeinEngagement driverId={driver?.id ?? null} locationId={driver?.location_id ?? null} />
          {/* Phase 352: Trinkgeld-Live-Tracker — Heute gesammelte Tips, Ø pro Tour, Trinkgeld-Rate */}
          <div className="px-4">
            <FahrerTrinkgeldLiveTracker />
          </div>
          {/* Phase 321: Analytics-Wochenübersicht — persönliche Wochen-Performance, Rang, Score-Trend */}
          <div className="px-4">
            <FahrerAnalyticsWochenuebersicht />
          </div>
          {/* Phase 344: Schicht-Energie-Check — Erschöpfungsindikator + Pausenempfehlung */}
          <div className="px-4">
            <FahrerSchichtEnergieCheck
              onlineSeit={status?.online_seit ?? null}
              stopsErledigt={todayStats?.deliveries ?? 0}
            />
          </div>
          {/* Phase 330: Wochen-Rang-Karte — Wochenranking: Rang, Score, Grade, Einnahmen, Prämie */}
          <div className="px-4">
            <FahrerWochenRangKarte />
          </div>
          {/* Phase 323: Schicht-Ausblick — Einnahmen-Prognose, Effizienz-Indikator, Restzeit */}
          <div className="px-4">
            <FahrerSchichtAusblick
              bisherige_einnahmen={todayStats?.estEarnings}
              stops_erledigt={todayStats?.deliveries}
              schicht_start={status?.online_seit ?? undefined}
            />
          </div>
          {/* Phase 301: Lieferungs-Checkliste — Vor-Ankunft-Prüfung: Artikel, Adresse, Zahlung */}
          {(() => {
            const cs = activeBatch.stops.find(s => !s.geliefert_am);
            if (!cs) return null;
            return (
              <div className="px-4">
                <button
                  onClick={() => setShowLieferCheckliste(true)}
                  className="w-full py-2.5 rounded-xl bg-matcha-900/40 border border-matcha-700/50 text-matcha-300 text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                >
                  <span>✓</span> Vor-Ankunft-Checkliste
                </button>
                {showLieferCheckliste && (
                  <LieferungCheckliste
                    orderId={cs.order_id}
                    bestellnummer={cs.order.bestellnummer}
                    zahlungsart={(cs.order as any).zahlungsart ?? 'online'}
                    gesamtbetrag={cs.order.gesamtbetrag}
                    onConfirm={() => setShowLieferCheckliste(false)}
                    onDismiss={() => setShowLieferCheckliste(false)}
                  />
                )}
              </div>
            );
          })()}
          {/* Tour-Stopp-Aktionen: Aktionsbuttons für aktuellen Stopp — Angekommen, Geliefert, Anruf, Navigation */}
          {activeBatch.stops.length > 0 && (() => {
            const currentStop = activeBatch.stops.find((s) => !s.geliefert_am);
            if (!currentStop) return null;
            return (
              <div className="px-4">
                <TourStoppAktionen
                  stop={{
                    id: currentStop.id,
                    reihenfolge: currentStop.reihenfolge,
                    order: {
                      bestellnummer: currentStop.order.bestellnummer,
                      kunde_name: currentStop.order.kunde_name,
                      kunde_adresse: currentStop.order.kunde_adresse,
                      kunde_plz: currentStop.order.kunde_plz,
                      kunde_telefon: currentStop.order.kunde_telefon ?? null,
                      gesamtbetrag: currentStop.order.gesamtbetrag,
                      zahlungsart: (currentStop.order as any).zahlungsart ?? null,
                      bezahlt: (currentStop.order as any).bezahlt ?? null,
                      kunde_notiz: (currentStop.order as any).kunde_notiz ?? null,
                      kunde_lieferhinweis: (currentStop.order as any).kunde_lieferhinweis ?? null,
                    },
                    geliefert_am: currentStop.geliefert_am,
                    angekommen_am: (currentStop as any).angekommen_am ?? null,
                  }}
                  onMarkDelivered={markDelivered}
                  onMarkArrived={markArrived}
                  pending={pending}
                />
              </div>
            );
          })()}
          {/* Tour-Zielpunkt-Karte: Nächster Stopp mit Adresse, ETA + Ein-Tap-Navigation */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourZielpunktKarte
                stops={activeBatch.stops.map(s => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  geliefert_am: s.geliefert_am,
                  order: s.order
                    ? {
                        kunde_name: s.order.kunde_name,
                        kunde_adresse: s.order.kunde_adresse,
                        kunde_lat: s.order.kunde_lat,
                        kunde_lng: s.order.kunde_lng,
                      }
                    : null,
                }))}
              />
            </div>
          )}
          {/* Tour-Stopp-Zeitlinie: Alle Stopps als vertikale Zeitlinie mit Status + Uhrzeit */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourStoppZeitlinie
                stops={activeBatch.stops.map(s => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  geliefert_am: s.geliefert_am,
                  order: s.order
                    ? {
                        id: s.order.id,
                        bestellnummer: s.order.bestellnummer,
                        kunde_name: s.order.kunde_name,
                        kunde_adresse: s.order.kunde_adresse,
                        gesamtbetrag: s.order.gesamtbetrag,
                      }
                    : null,
                }))}
              />
            </div>
          )}
          {/* Phase 440: Tour-Kompletierungs-Prognose — präzise ETA aller verbleibenden Stopps mit Ø-Stopp-Zeit */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourKompletierungsPrognose
                stops={activeBatch.stops.map(s => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  geliefert_am: s.geliefert_am,
                  eta_min: (s as any).eta_min ?? null,
                  order: s.order
                    ? { id: s.order.id, bestellnummer: s.order.bestellnummer, kunde_name: s.order.kunde_name }
                    : null,
                }))}
                tourStart={activeBatch.started_at ?? null}
              />
            </div>
          )}
          {/* Phase 257: Tour-Fertig-Prognose — wann endet die Tour + Schicht-Vergleich */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourFertigPrognose
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at ?? null}
                shiftEndAt={null}
              />
            </div>
          )}
          {/* Phase 265: Tour-Zeitplan — chronologische Stop-Übersicht mit ETA-Uhrzeiten */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourZeitplanFahrer
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at ?? null}
              />
            </div>
          )}
          {/* Fahrer-Navi-Strip: Nächster Stop mit Navigation + Telefon */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerNaviStrip stops={activeBatch.stops as any} currentStopIdx={0} />
            </div>
          )}
          {/* Phase 422: Multi-App Navigation — Google Maps, Waze, Apple Maps, HERE */}
          {activeBatch.stops.length > 0 && (() => {
            const nextStop = (activeBatch.stops as any[])
              .sort((a: any, b: any) => a.reihenfolge - b.reihenfolge)
              .find((s: any) => !s.geliefert_am);
            if (!nextStop?.order) return null;
            return (
              <div className="px-4">
                <NaviAppWahl
                  lat={nextStop.order.kunde_lat ?? null}
                  lng={nextStop.order.kunde_lng ?? null}
                  adresse={nextStop.order.kunde_adresse ?? null}
                  compact={false}
                />
              </div>
            );
          })()}
          {/* Phase 213: Stopp-Schnell-Panel — kompakter Schnellzugriff mit Navigation + Anruf je Stopp */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <StopSchnellPanel
                stops={activeBatch.stops as any}
                driverLat={driverPos?.lat ?? null}
                driverLng={driverPos?.lng ?? null}
              />
            </div>
          )}
          {/* Wetter-Warn-Banner: Warnung bei gefährlichen oder schwierigen Bedingungen */}
          {driver.location_id && (
            <div className="px-4">
              <FahrerWetterWarnBanner locationId={driver.location_id} />
            </div>
          )}
          {/* Routen-Qualität: Pünktlichkeit, Distanz, Ø Zeit/Stop */}
          <div className="px-4">
            <FahrerRouteQualitaet
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
              totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
            />
          </div>
          {/* Tour-Opt-Badge: zeigt ob Route optimiert wurde + km-Ersparnis */}
          <div className="px-4">
            <TourOptBadge batchId={activeBatch.id} />
          </div>
          {/* Tour-Abschluss-Prognose: Tourende-Schätzung + Verbleibende Stopps mit ETA */}
          <div className="px-4">
            <TourAbschlussPrognose
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          </div>
          {/* Tour-Tempo-Tracker: aktueller Pace vs. benötigtes Tempo für pünktliche Lieferung */}
          <div className="px-4">
            <TourSpeedTracker
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                geliefert_am: s.geliefert_am,
                angekommen_am: (s as any).angekommen_am ?? null,
              }))}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          </div>
          {/* Tour-Effizienz-Ticker: Live-KPI-Streifen — Pünktlichkeit, Ø Stopp-Zeit, Prognose */}
          <div className="px-4">
            <TourEfficiencyTicker
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                angekommen_am: (s as any).angekommen_am ?? null,
                geliefert_am: s.geliefert_am,
                order: s.order ? {
                  eta_earliest: (s.order as any).eta_earliest ?? null,
                  gesamtbetrag: s.order.gesamtbetrag,
                } : null,
              }))}
              batchStartedAt={activeBatch.started_at}
            />
          </div>
          <TourBriefingCard batch={activeBatch as any} />
          {/* Route-Karte während aktiver Lieferung — zeigt verbleibende Stopps + Fahrerposition */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourMiniMap
                stops={activeBatch.stops.map((s) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  geliefert_am: s.geliefert_am,
                  order: {
                    kunde_name: s.order.kunde_name,
                    kunde_lat: s.order.kunde_lat ?? null,
                    kunde_lng: s.order.kunde_lng ?? null,
                    bestellnummer: s.order.bestellnummer,
                  },
                }))}
                driverLat={driverPos?.lat ?? null}
                driverLng={driverPos?.lng ?? null}
                className="mb-3"
              />
            </div>
          )}
          {/* Phase 185: Tour-Effizienz-Score — ETA-Genauigkeit des letzten abgeschlossenen Stops */}
          {(() => {
            const lastDelivered = [...activeBatch.stops]
              .filter(s => s.geliefert_am)
              .sort((a, b) => new Date(b.geliefert_am!).getTime() - new Date(a.geliefert_am!).getTime())[0] ?? null;
            return (
              <div className="px-4">
                <TourEffizienzScore
                  recentlyDeliveredStop={lastDelivered as any}
                  tourStartedAt={activeBatch.started_at}
                />
              </div>
            );
          })()}
          {/* Bargeld-Stops: zeigt welche Stops Bargeld erfordern + Gesamtbetrag */}
          <CashflowTracker stops={activeBatch.stops as any} />
          {/* Tour-Abschluss-Bilanz: Statistiken + Verdienst-Schätzung nach Tour-Ende */}
          <div className="px-4">
            <TourAbschlussRechner
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              vehicle={(activeBatch as any).vehicle ?? null}
            />
          </div>
          {/* Phase 238: Schicht-Kilometer-Tracker — Gefahrene Kilometer + CO₂-Vergleich */}
          <SchichtKilometerTracker fahrzeug={status?.fahrzeug ?? null} />
          {/* Phase 243: Schicht-Bonus-Booster — Live-Fortschritt zum nächsten Meilenstein-Bonus */}
          <SchichtBonusBooster />
          {/* Phase 236: Tour-Feedback-Schnell — Stimmung + Rating nach Tour */}
          {activeBatch.stops.every(s => s.geliefert_am) && (
            <TourFeedbackSchnell
              tourId={activeBatch.id}
              driverId={driver?.id ?? null}
            />
          )}
          {/* Phase 357: Meine Score-Karte — eigener wöchentlicher Composite-Score und Rang */}
          <FahrerMeineScoreKarte />
          {/* Phase 359: Score-Verlauf-Chart — 8-Wochen persönlicher Score-Verlauf */}
          <FahrerScoreVerlaufChart />
          {/* Phase 360: Feedback-Monatsbericht — persönliche Kunden-Feedback-Zusammenfassung */}
          {driver.location_id && (
            <FahrerFeedbackMonatsbericht driverId={driver.id} locationId={driver.location_id} />
          )}
          {/* Phase 362: Tour-Effizienz-Karte — persönlicher EUR/Stopp vs. P75-Benchmark */}
          {driver.location_id && (
            <FahrerTourEffizienzKarte driverId={driver.id} locationId={driver.location_id} />
          )}
          {/* Phase 358: Peak-Tag-Hinweis — Vorschau nächster Spitzentage mit Einnahmen-Tipp */}
          <FahrerPeakTagHinweis />
          {/* Phase 356: Tour-Start-Feedback-Reminder — Erinnerung am Tourstart, Feedback zu geben */}
          <TourStartFeedbackReminder
            batchId={activeBatch.id}
            batchState={activeBatch.status}
          />
          {/* Phase 355: Tour-Abschluss-Bewertung — Strukturiertes Fahrer-Feedback nach Tour */}
          <FahrerTourAbschlussBewertung
            batchId={activeBatch.id}
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            batchState={activeBatch.status}
          />
          {/* Tour-Abschluss-Schnell-Panel: kompakte Tour-Zusammenfassung wenn alle Stopps geliefert */}
          {activeBatch.stops.every(s => s.geliefert_am) && (
            <div className="px-4">
              <TourAbschlussSchnellPanel tourId={activeBatch.id} />
            </div>
          )}
          {/* Phase 425: Tour-Abschluss-Animation — Konfetti + Statistiken wenn alle Stopps zugestellt */}
          {activeBatch.stops.every(s => s.geliefert_am) && showTourCompletion && (
            <TourCompletionScreen
              stats={{
                stopsCompleted: activeBatch.stops.length,
                totalBetrag: activeBatch.stops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0),
                elapsedMin: activeBatch.started_at
                  ? Math.floor((Date.now() - new Date(activeBatch.started_at).getTime()) / 60_000)
                  : 0,
                distanceKm: (activeBatch as any).total_distance_km ?? null,
                estEarnings: todayStats?.estEarnings,
              }}
              onContinue={() => setShowTourCompletion(false)}
            />
          )}
          {activeBatch.stops.every(s => s.geliefert_am) && !showTourCompletion && (
            <div className="px-4">
              <button
                onClick={() => setShowTourCompletion(true)}
                className="w-full py-2 rounded-xl bg-matcha-800/60 border border-matcha-600/40 text-matcha-300 text-xs font-semibold flex items-center justify-center gap-2 active:opacity-80"
              >
                🎉 Tour abschließen
              </button>
            </div>
          )}
          <DeliveryView
            batchId={activeBatch.id}
            stops={activeBatch.stops as any}
            batchStartedAt={activeBatch.started_at}
            totalEtaMin={activeBatch.total_eta_min ?? null}
            gpsSpeed={gpsSpeed}
            driverLat={driverPos?.lat ?? null}
            driverLng={driverPos?.lng ?? null}
            onAllDone={() => router.refresh()}
          />
          </>
        )}

        {/* Active Batch — Pick-Phase: groß + zentral, kein ablenkender Kram */}
        {activeBatch && activeBatch.status !== 'unterwegs' && (
          <section>
            <div className="flex items-center justify-between mb-3 text-accent">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Tour #{activeBatch.stops[0]?.order.bestellnummer.slice(-4)}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-matcha-300">{activeBatch.stops.length} {activeBatch.stops.length === 1 ? 'Stopp' : 'Stopps'}</span>
                {/* Live Tour-ETA: nächster frühester Kundentermin */}
                {(() => {
                  const nextEta = activeBatch.stops
                    .map((s) => (s.order as any).eta_earliest as string | null)
                    .filter(Boolean)
                    .map((d) => new Date(d!).getTime())
                    .sort((a, b) => a - b)[0] ?? null;
                  if (!nextEta) return null;
                  const secLeft = Math.floor((nextEta - Date.now()) / 1000);
                  const isOverdue = secLeft < 0;
                  const mm = Math.abs(Math.floor(secLeft / 60));
                  const ss = Math.abs(secLeft % 60);
                  return (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums',
                      isOverdue ? 'bg-red-500/30 text-red-200 animate-pulse' : secLeft < 600 ? 'bg-orange-500/30 text-orange-200' : 'bg-accent/20 text-accent',
                    )}>
                      ⏰ {isOverdue ? '-' : ''}{mm}:{String(ss).padStart(2, '0')}
                    </span>
                  );
                })()}
                <span className="font-display font-bold text-accent">
                  {euro(activeBatch.stops.reduce((s, st) => s + st.order.gesamtbetrag, 0))}
                </span>
              </div>
            </div>

            {/* Küchen-Bereitschafts-Fortschritt: X von Y Bestellungen fertig */}
            {(() => {
              const total = activeBatch.stops.length;
              if (total === 0) return null;
              const readyCount = activeBatch.stops.filter((s) => {
                const ks = kitchenStatuses.get(s.order_id);
                return ks === 'fertig' || ks === 'unterwegs';
              }).length;
              const cookingCount = activeBatch.stops.filter((s) => kitchenStatuses.get(s.order_id) === 'in_zubereitung').length;
              const allReady = readyCount === total;
              const pct = Math.round((readyCount / total) * 100);
              return (
                <div className={cn(
                  'rounded-xl border px-4 py-3 mb-3',
                  allReady
                    ? 'bg-accent/15 border-accent/40'
                    : cookingCount > 0
                    ? 'bg-orange-500/10 border-orange-400/30'
                    : 'bg-white/5 border-white/10',
                )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn(
                      'text-[11px] font-bold uppercase tracking-wider',
                      allReady ? 'text-accent' : 'text-matcha-300',
                    )}>
                      {allReady ? '✓ Alle bereit zum Abholen' : `Küche: ${readyCount} von ${total} fertig`}
                    </span>
                    {cookingCount > 0 && (
                      <span className="text-[10px] font-bold text-orange-300 animate-pulse">
                        {cookingCount} kocht noch
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        allReady ? 'bg-accent' : pct >= 50 ? 'bg-orange-400' : 'bg-matcha-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Cash-to-collect Banner */}
            {(() => {
              const cashStops = activeBatch.stops.filter((s) => {
                const o = s.order as any;
                return o.zahlungsart === 'bar' || o.bezahlt === false;
              });
              const totalCash = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
              if (totalCash <= 0) return null;
              return (
                <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-4 py-3 mb-3 flex items-center gap-3">
                  <Banknote className="h-5 w-5 text-amber-300 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Bar kassieren</div>
                    <div className="font-display font-black text-amber-200 text-xl">{euro(totalCash)}</div>
                  </div>
                  <div className="text-[10px] text-amber-400">{cashStops.length} {cashStops.length === 1 ? 'Zahlung' : 'Zahlungen'}</div>
                </div>
              );
            })()}

            {/* Geschätzte Fahrervergütung für diese Tour */}
            {(() => {
              const stopCount = activeBatch.stops.length;
              const distKm = (activeBatch as any).total_distance_km as number | null ?? 0;
              const estEarnings = stopCount * 1.50 + distKm * 0.20;
              if (estEarnings <= 0) return null;
              return (
                <div className="rounded-xl bg-matcha-700/30 border border-matcha-500/30 px-4 py-3 mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Geschätzte Vergütung</div>
                    <div className="text-[9px] text-matcha-400 mt-0.5">
                      {stopCount}× €1.50
                      {distKm > 0 ? ` + ${distKm.toFixed(1)} km × €0.20` : ''}
                    </div>
                  </div>
                  <div className="font-display font-black text-accent text-xl">{euro(estEarnings)}</div>
                </div>
              );
            })()}

            {/* Gesamte Route in Navi öffnen — alle Stopps als Wegpunkte */}
            {(() => {
              const stopsWithCoords = activeBatch.stops
                .slice()
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .filter(s => s.order.kunde_lat && s.order.kunde_lng);
              if (stopsWithCoords.length < 2) return null;
              const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
              let routeUrl: string;
              if (isIos) {
                const last = stopsWithCoords[stopsWithCoords.length - 1];
                const waypoints = stopsWithCoords
                  .slice(0, -1)
                  .map(s => `${s.order.kunde_lat},${s.order.kunde_lng}`)
                  .join('/');
                routeUrl = `maps://maps.apple.com/?daddr=${last.order.kunde_lat},${last.order.kunde_lng}&dirflg=d`;
                if (waypoints) routeUrl += `&via=${encodeURIComponent(waypoints)}`;
              } else {
                const waypoints = stopsWithCoords
                  .slice(1, -1)
                  .map(s => `${s.order.kunde_lat},${s.order.kunde_lng}`)
                  .join('|');
                const last = stopsWithCoords[stopsWithCoords.length - 1];
                routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${last.order.kunde_lat},${last.order.kunde_lng}&travelmode=driving`;
                if (waypoints) routeUrl += `&waypoints=${encodeURIComponent(waypoints)}`;
              }
              return (
                <a
                  href={routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-blue-600/20 border border-blue-400/40 px-4 py-2.5 text-blue-200 text-[12px] font-bold transition active:scale-[0.98]"
                >
                  <Route size={14} />
                  Gesamte Route navigieren ({stopsWithCoords.length} Stopps)
                </a>
              );
            })()}

            {/* Tour-Karte: Mini-Map mit allen Stopps farbkodiert */}
            {activeBatch.stops.length > 1 && (
              <TourMiniMap
                stops={activeBatch.stops.map((s) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  geliefert_am: s.geliefert_am,
                  order: {
                    kunde_name: s.order.kunde_name,
                    kunde_lat: s.order.kunde_lat,
                    kunde_lng: s.order.kunde_lng,
                    bestellnummer: s.order.bestellnummer,
                  },
                }))}
                driverLat={driverPos?.lat ?? null}
                driverLng={driverPos?.lng ?? null}
                className="mb-3"
              />
            )}

            {/* Tour-Stopp-Übersicht: jede Lieferadresse mit individuellem Nav-Link */}
            <div className="space-y-2 mb-4">
              {activeBatch.stops
                .slice()
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .map((stop, idx, arr) => {
                  const o = stop.order as any;
                  const isCash = o.zahlungsart === 'bar' || o.bezahlt === false;
                  const kStatus = kitchenStatuses.get(stop.order_id) ?? null;
                  const kitchenReady = kStatus === 'fertig' || kStatus === 'unterwegs';
                  const kitchenCooking = kStatus === 'in_zubereitung';
                  const isLast = idx === arr.length - 1;

                  // Individual stop nav URL — Apple Maps auf iOS, sonst Google Maps
                  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const stopNavUrl = stop.order.kunde_lat && stop.order.kunde_lng
                    ? isIos
                      ? `maps://maps.apple.com/?daddr=${stop.order.kunde_lat},${stop.order.kunde_lng}&dirflg=d`
                      : `https://www.google.com/maps/dir/?api=1&destination=${stop.order.kunde_lat},${stop.order.kunde_lng}&travelmode=driving`
                    : stop.order.kunde_adresse
                    ? isIos
                      ? `maps://maps.apple.com/?q=${encodeURIComponent(stop.order.kunde_adresse)}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.order.kunde_adresse)}`
                    : null;

                  // Distanz-Chip
                  const distM = (stop as any).distanz_zum_vorgaenger_m as number | null;

                  return (
                    <div key={stop.id} className="relative">
                      {/* Vertical connector line between stops */}
                      {!isLast && (
                        <div className="absolute left-[15px] top-[52px] bottom-[-8px] w-0.5 bg-white/10 z-0" />
                      )}
                      <div className={cn(
                        'relative z-10 rounded-xl border p-3 flex items-center gap-3 transition',
                        kitchenReady ? 'bg-matcha-700/40 border-accent/40' :
                        isCash ? 'bg-amber-500/10 border-amber-400/30' : 'bg-white/5 border-white/10',
                      )}>
                        <div className={cn(
                          'h-8 w-8 rounded-lg grid place-items-center font-display font-black shrink-0',
                          kitchenReady ? 'bg-accent text-matcha-900' : 'bg-accent/20 text-accent',
                        )}>{kitchenReady ? '✓' : stop.reihenfolge}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-display font-bold truncate">{stop.order.kunde_name}</div>
                            {kitchenReady && (
                              <>
                                <span className="shrink-0 rounded-full bg-accent/20 text-accent px-1.5 py-0.5 text-[9px] font-black uppercase">Fertig!</span>
                                {kitchenFertigAt.get(stop.order_id) && (() => {
                                  const fertigMs = Date.now() - new Date(kitchenFertigAt.get(stop.order_id)!).getTime();
                                  const fertigMin = Math.floor(fertigMs / 60_000);
                                  if (fertigMin < 1) return null;
                                  const cls = fertigMin >= 10 ? 'bg-red-500/25 text-red-300' : fertigMin >= 5 ? 'bg-orange-500/25 text-orange-300' : 'bg-white/10 text-matcha-300';
                                  return (
                                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums', cls)}>
                                      {fertigMin >= 10 ? '⚠️ ' : ''}{fertigMin} Min warten
                                    </span>
                                  );
                                })()}
                              </>
                            )}
                            {kitchenCooking && (
                              <span className="shrink-0 rounded-full bg-orange-500/20 text-orange-300 px-1.5 py-0.5 text-[9px] font-black animate-pulse">🍳 Kocht</span>
                            )}
                            {kStatus === 'bestätigt' && (
                              <span className="shrink-0 rounded-full bg-blue-500/20 text-blue-300 px-1.5 py-0.5 text-[9px] font-black">Angenommen</span>
                            )}
                          </div>
                          <div className="text-xs text-matcha-300 truncate">{stop.order.kunde_adresse}</div>
                          {/* Distanz + ETA */}
                          <div className="flex items-center gap-2 mt-0.5">
                            {distM != null && distM > 0 && (
                              <span className="text-[9px] text-matcha-400 tabular-nums">
                                {distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`}
                              </span>
                            )}
                            {o.eta_earliest ? (() => {
                              const etaMs = new Date(o.eta_earliest).getTime();
                              const etaStr = new Date(o.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                              const minLeft = Math.round((etaMs - Date.now()) / 60_000);
                              const isOverdue = etaMs < Date.now();
                              return (
                                <span className={cn(
                                  'text-[9px] font-bold tabular-nums rounded-full px-1.5 py-0.5',
                                  isOverdue ? 'bg-red-500/20 text-red-300' : minLeft <= 10 ? 'bg-orange-500/20 text-orange-300' : 'bg-accent/15 text-accent/80',
                                )}>
                                  ⏰ {isOverdue ? `${Math.abs(minLeft)}m verspätet` : `~${minLeft} Min`} ({etaStr})
                                </span>
                              );
                            })() : (activeBatch as any).total_eta_min && arr.length > 0 ? (() => {
                              const estMs = Date.now() + ((idx + 1) / arr.length) * (activeBatch as any).total_eta_min * 60_000;
                              const estTime = new Date(estMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                              const estMin = Math.round(((idx + 1) / arr.length) * (activeBatch as any).total_eta_min);
                              return (
                                <span className="text-[9px] font-bold text-matcha-300 tabular-nums rounded-full bg-white/5 px-1.5 py-0.5">
                                  ⏰ ~{estMin} Min ({estTime})
                                </span>
                              );
                            })() : null}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className={cn('font-display font-bold', isCash ? 'text-amber-300' : 'text-accent')}>
                            {euro(stop.order.gesamtbetrag)}
                          </div>
                          {isCash && <div className="text-[9px] font-bold text-amber-400 uppercase">Bar</div>}
                          {/* Individual Navigation Button */}
                          {stopNavUrl && (
                            <a
                              href={stopNavUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-accent/20 text-accent px-2 py-1 text-[9px] font-bold hover:bg-accent/30 transition"
                              title="Diesen Stopp in Maps öffnen"
                            >
                              <Navigation className="h-3 w-3" />
                              Nav
                            </a>
                          )}
                          {/* Anruf-Button — Kundennummer direkt wählen */}
                          {o.kunde_telefon && (
                            <a
                              href={`tel:${o.kunde_telefon}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/10 text-matcha-200 px-2 py-1 text-[9px] font-bold hover:bg-white/20 transition"
                              title={`Anrufen: ${o.kunde_telefon}`}
                            >
                              <Phone className="h-3 w-3" />
                              Anruf
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
              })}
            </div>

            {/* Alle-Fertig-Banner wenn alle Bestellungen bereit sind */}
            {activeBatch.stops.length > 0 && activeBatch.stops.every((s) => {
              const ks = kitchenStatuses.get(s.order_id);
              return ks === 'fertig' || ks === 'unterwegs';
            }) && (
              <div className="mb-3 rounded-xl bg-accent/15 border-2 border-accent/50 px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <div className="font-display font-bold text-accent">Alle Bestellungen bereit!</div>
                  <div className="text-[11px] text-matcha-300">Packen & starten</div>
                </div>
              </div>
            )}

            {/* Route-Vorschau in Maps (Apple Maps auf iOS, Google Maps sonst) */}
            {activeBatch.stops.length > 0 && (() => {
              const withCoords = activeBatch.stops
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .filter((s) => s.order.kunde_lat && s.order.kunde_lng);
              if (withCoords.length === 0) return null;
              const dest = `${withCoords[withCoords.length - 1].order.kunde_lat},${withCoords[withCoords.length - 1].order.kunde_lng}`;
              const waypoints = withCoords.slice(0, -1).map((s) => `${s.order.kunde_lat},${s.order.kunde_lng}`).join('|');
              const isIosDevice = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
              const mapsUrl = isIosDevice
                ? `maps://maps.apple.com/?daddr=${dest}${withCoords.slice(0, -1).map((s) => `&waypoint=${s.order.kunde_lat},${s.order.kunde_lng}`).join('')}&dirflg=d`
                : waypoints
                  ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`
                  : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
              return (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold text-matcha-200 inline-flex items-center justify-center gap-2 mb-3 transition"
                >
                  <MapIcon className="h-4 w-4" />
                  {isIosDevice ? '🍎' : '🗺️'} Route in {isIosDevice ? 'Apple Maps' : 'Google Maps'} ({withCoords.length} {withCoords.length === 1 ? 'Stopp' : 'Stopps'})
                </a>
              );
            })()}

            {/* Großer Pick-Starten Button */}
            <button
              onClick={() => setPickOpen(true)}
              className="w-full h-16 rounded-2xl bg-accent text-matcha-900 font-display text-xl font-black inline-flex items-center justify-center gap-3 active:scale-[0.98] shadow-xl shadow-accent/30"
            >
              <ShoppingBag className="h-6 w-6" />
              Jetzt Packen & Kontrollieren
            </button>

            <div className="mt-3 text-xs text-matcha-300 text-center leading-relaxed">
              Tippe „Packen" → geh jedes Item durch („ist dabei" / „fehlt"). Danach wird die schnellste Route berechnet.
            </div>
          </section>
        )}

        {/* Open Batches — Pickup Inbox */}
        {!activeBatch && isOnline && (
          <OpenBatchSection
            openBatches={openBatches}
            pending={pending}
            onClaim={claimBatch}
            driverPos={driverPos}
          />
        )}

        {/* Warte-Anzeige: kein Batch, online, keine offenen Touren */}
        {!activeBatch && isOnline && openBatches.length === 0 && (
          <FahrerWarteAnzeige driverId={driver.id} locationId={driver.location_id} />
        )}

        {/* Phase 539: Schicht-Ertrag-Meter — Einnahmen-Bogen mit Ziel-Fortschritt + Projektions-Prognose */}
        {isOnline && (
          <div className="px-4">
            <FahrerSchichtErtragsMeter driverId={driver.id} goalEur={80} />
          </div>
        )}
        {/* Phase 501: Live-Verdienst-Tracker — Tagesverdienst, Trinkgeld, Schichtziel-Fortschrittsbalken */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase501LiveVerdienst driverId={driver.id} />
          </div>
        )}
        {/* Phase 502: Tour-Stopp-Navigator — Alle Stopps mit Navigation, ETA-Ampel, Kundendaten + Sofort-Aktionen */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase502TourStoppNavigator
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                order_id: s.order_id,
                reihenfolge: s.reihenfolge,
                angekommen_am: s.angekommen_am,
                geliefert_am: s.geliefert_am,
                order: s.order ? {
                  bestellnummer: s.order.bestellnummer,
                  kunde_name: s.order.kunde_name,
                  kunde_adresse: s.order.kunde_adresse,
                  kunde_telefon: s.order.kunde_telefon ?? null,
                  kunde_notiz: s.order.kunde_notiz ?? null,
                  kunde_lieferhinweis: s.order.kunde_lieferhinweis ?? null,
                  gesamtbetrag: s.order.gesamtbetrag,
                  zahlungsart: 'karte',
                  eta_earliest: null,
                  eta_latest: null,
                } : null,
              }))}
            />
          </div>
        )}
        {/* Phase 518 (503): Stopp-Details-Kommando — Ultra-fokussierte Stopp-Karte mit Navigation, Zahlung, ETA, Notizen */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase503StoppDetailsKommando
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                geliefert_am: s.geliefert_am,
                angekommen_am: s.angekommen_am,
                distanz_zum_vorgaenger_m: (s as any).distanz_zum_vorgaenger_m ?? null,
                order: s.order ? {
                  id: s.order_id,
                  bestellnummer: s.order.bestellnummer,
                  kunde_name: s.order.kunde_name,
                  kunde_adresse: s.order.kunde_adresse,
                  kunde_plz: (s.order as any).kunde_plz ?? null,
                  kunde_stadt: (s.order as any).kunde_stadt ?? null,
                  kunde_telefon: (s.order as any).kunde_telefon ?? null,
                  kunde_notiz: (s.order as any).kunde_notiz ?? null,
                  kunde_lieferhinweis: (s.order as any).kunde_lieferhinweis ?? null,
                  gesamtbetrag: s.order.gesamtbetrag,
                  zahlungsart: (s.order as any).zahlungsart ?? 'karte',
                  bezahlt: (s.order as any).bezahlt ?? true,
                  eta_earliest: (s.order as any).eta_earliest ?? null,
                  eta_latest: (s.order as any).eta_latest ?? null,
                } : null,
              }))}
              totalStops={activeBatch.stops.length}
            />
          </div>
        )}
        {/* Phase 551: Aktueller-Stopp-Fokus — Fokussierte Karte mit Adresse, Zahlung, Navigation, Abschluss */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase551AktuellerStoppFokus
              activeBatch={activeBatch as any}
              onMarkDelivered={async (stopId) => {
                await markDelivered(stopId);
              }}
            />
          </div>
        )}
        {/* Phase 552: Schicht-Tempo-Ampel — Pace-Tracking vs. Einnahmen-Ziel mit Farbampel */}
        {status?.ist_online && (
          <div className="px-4">
            <FahrerPhase552SchichtTempoAmpel
              activeBatch={activeBatch as any}
              schichtStart={status?.online_seit ?? null}
            />
          </div>
        )}
        {/* Phase 550: Tour-Stopp-Schnell-Nav — Alle Stopps mit Status, ETA, Navigation, Bestätigung */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <TourStoppSchnellNav
              stops={activeBatch.stops.map((s, i) => ({
                id: s.id,
                position: s.reihenfolge ?? i + 1,
                adresse: s.order?.kunde_adresse ?? '',
                plz: (s.order as any)?.kunde_plz ?? null,
                bestellnummer: s.order?.bestellnummer ?? '',
                kunde_name: s.order?.kunde_name ?? 'Kunde',
                kunde_telefon: (s.order as any)?.kunde_telefon ?? null,
                gesamtbetrag: s.order?.gesamtbetrag ?? undefined,
                zahlungsart: (s.order as any)?.zahlungsart ?? undefined,
                geliefert_am: s.geliefert_am ?? null,
                notiz: (s.order as any)?.kunde_notiz ?? null,
              }))}
              onNavigate={(stop) => {
                const addr = encodeURIComponent(stop.adresse + (stop.plz ? ` ${stop.plz}` : ''));
                window.open(`https://maps.google.com/maps?q=${addr}`, '_blank');
              }}
              onCallCustomer={(phone) => window.open(`tel:${phone}`)}
            />
          </div>
        )}
        {/* Phase 565: Tour-Heimkehr-Info — Abschluss-Karte mit Rückfahrt-Navigation wenn alle Stopps geliefert */}
        {activeBatch && (
          <FahrerPhase565TourHeimkehrInfo
            activeBatch={activeBatch as any}
            driver={driver as any}
          />
        )}
        {/* Phase 570: Tour-Aktiv-Kommando — Stopp-Sequenz + Navigation + ETA in einem Kommando-Panel */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <div className="px-4">
            <FahrerPhase570TourAktivKommando activeBatch={activeBatch as any} />
          </div>
        )}
        {/* Schicht-KPI-Live: Stops, Effizienz, km, Ziel — nur wenn online und kein aktiver Batch */}
        {!activeBatch && isOnline && (
          <div className="px-4">
            <SchichtKpiLive driverId={driver.id} onlineSeit={status?.online_seit ?? null} />
          </div>
        )}
        {/* Phase 575: Schicht-Effizienz-Cockpit — Lieferrate/h, Ø Stopp-Zeit, Pünktlichkeit vs. Ziel */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase575SchichtEffizienzCockpit
              currentShiftStart={status?.online_seit ?? null}
            />
          </div>
        )}
        {/* Phase 581: Schicht-Zielerreichungs-Fortschrittsring — Animierter Ring für Tagesziel */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase581SchichtZielFortschrittsring
              currentShiftStart={status?.online_seit ?? null}
            />
          </div>
        )}

        {/* Phase 586: Einzel-Stopp-Navigator-Karte — Kartenansicht nächster Stopp mit Adresse */}
        {isOnline && activeBatch && (
          <div className="px-4">
            <FahrerPhase586StoppNavigatorKarte stops={activeBatch.stops as any} />
          </div>
        )}

        {/* Phase 591: Tour-Stopp-Live-Nav — Nächster Stopp prominent mit Google-Maps-Link + Stopp-Liste */}
        {isOnline && activeBatch && (
          <div className="px-4">
            <FahrerPhase591TourStoppLiveNav
              stops={activeBatch.stops as any}
              batchStatus={activeBatch.status}
            />
          </div>
        )}

        {/* Phase 596: Schicht-Nav-Hub — Fortschrittsring + ETA-Anzeige + Tour-Status */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase596SchichtNavHub
              driverId={driver.id}
              activeBatch={activeBatch as any}
            />
          </div>
        )}

        {/* Phase 603: Schicht-Abschluss-Zusammenfassung — Touren, km, Lieferungen, Trinkgeld, Ø Bewertung */}
        {isOnline && !activeBatch && (
          <div className="px-4">
            <FahrerPhase603SchichtAbschlussZusammenfassung driverId={driver.id} />
          </div>
        )}
        {/* Phase 608: Trinkgeld-Trend-Widget — Trinkgeld heute vs. gestern vs. 7-Tage-Ø mit Trendpfeil */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase608TrinkgeldTrendWidget driverId={driver.id} />
          </div>
        )}
        {/* Phase 613: Letzte-Bewertungen-Widget — Letzte 3 Kundenbewertungen mit Sternen und Kommentar */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase613LetzteBewertungenWidget driverId={driver.id} />
          </div>
        )}
        {/* Phase 618: Tages-Einnahmen-Differenz — Heute vs. letzten Dienstag mit Trend-Indikator */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase618TagesEinnahmenDifferenz driverId={driver.id} />
          </div>
        )}
        {/* Phase 623: Schicht-Pause-Empfehlung — optimalen Pausenzeitpunkt basierend auf Auftragsfluss */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase623PauseEmpfehlung driverId={driver.id} locationId={null} />
          </div>
        )}

        {/* Phase 628: km-Tageslog — gefahrene km je Tour + Vergleich Vortag */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase628KmTageslog driverId={driver.id} />
          </div>
        )}

        {/* Phase 629: Tour-Stopp-Navigator Pro — Stopp-für-Stopp Übersicht mit nächstem Stop-Fokus */}
        {isOnline && activeBatch && (
          <div className="px-4">
            <FahrerPhase629TourStoppNavigatorPro driverId={driver.id} batchId={activeBatch.id} />
          </div>
        )}

        {/* Phase 630: Navigation Live-Cockpit — Google Maps / Waze Direktlink + ETA-Anzeige */}
        {isOnline && activeBatch && (() => {
          const ns630 = activeBatch.stops.find((s: any) => !s.geliefert_am);
          if (!ns630) return null;
          return (
            <div className="px-4">
              <FahrerPhase630NavigationLiveCockpit
                driverId={driver.id}
                nextStopAddress={(ns630.order as any)?.kunde_adresse ?? null}
                etaMin={null}
              />
            </div>
          );
        })()}

        {/* Phase 631: Tour-Nachbereitung-Dialog — km eingeben, Feedback, Bonus nach Tour */}
        {isOnline && !activeBatch && (
          <div className="px-4">
            <FahrerPhase631TourNachbereitungDialog batchId="last" driverId={driver.id} />
          </div>
        )}

        {/* Phase 639: Schicht-Bilanz-Vorschau — Hochrechnung Verdienst bis Schichtende */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase639SchichtBilanzVorschau driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}

        {/* Phase 644: Nächster-Stop-Entfernungsanzeige — Luftlinie km + Maps-Link */}
        {isOnline && activeBatch && (
          <div className="px-4">
            <FahrerPhase644NaechsterStopEntfernung driverId={driver.id} />
          </div>
        )}

        {/* Phase 648: Tour-Stopp-Live-Kommando — Aktueller Stopp mit Navigation + Stopp-Bestätigung */}
        {isOnline && activeBatch && (
          <div className="px-4">
            <FahrerPhase648TourStoppLiveKommando driverId={driver.id} />
          </div>
        )}

        {/* Phase 653: Schicht-Storno-Warnung — Alert wenn Storno-Rate heute überdurchschnittlich */}
        {isOnline && driver.location_id && (
          <div className="px-4">
            <FahrerPhase653SchichtStornoWarnung locationId={driver.location_id} />
          </div>
        )}

        {/* Phase 657: Fahrzeug-Check-Widget — Täglicher Fahrzeugzustand (Reifen, Licht, Gepäck) */}
        <div className="px-4">
          <FahrerPhase657FahrzeugCheckWidget driverId={driver.id} />
        </div>

        {/* Phase 662: Tourpause-Empfehlung-Pro — Smarte Pausenempfehlung mit Hotspot-Tipp */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase662TourpauseEmpfehlungPro driverId={driver.id} />
          </div>
        )}

        {/* Phase 667: Tages-Einnahmen-Prognose — Hochrechnung Tagesverdienst basierend auf aktuellem Tempo */}
        {isOnline && driver.location_id && (
          <div className="px-4">
            <FahrerPhase667TagesEinnahmenPrognose driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 672: Tour-Qualitäts-Score — Effizienz + Kundenbewertung kombiniert */}
        {isOnline && driver.location_id && (
          <div className="px-4">
            <FahrerPhase672TourQualitaetsScore driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 677: Schicht-Abschluss-Screen — Zusammenfassung Score + Einnahmen + Touren beim Schichtende */}
        {!isOnline && driver.location_id && (
          <div className="px-4">
            <FahrerPhase677SchichtAbschlussScreen driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 682: Wochenziel-Fortschrittsring — Wöchentliches Lieferziel mit SVG-Fortschrittsring */}
        {driver.location_id && (
          <div className="px-4">
            <FahrerPhase682WochenZielFortschrittsring driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 683: Tour-Stopp-Navigator Live — Alle Stopps der laufenden Tour mit Status + Navi-Button */}
        {activeBatch && driver.location_id && (
          <div className="px-4">
            <FahrerPhase683TourStoppNavigatorLive driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 684: Navigation Live Cockpit — Nächster Stopp mit Adresse, ETA-Countdown + Navi-App-Buttons */}
        {activeBatch && driver.location_id && (
          <div className="px-4">
            <FahrerPhase684NavigationLiveCockpit driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}

        {/* Phase 689: Kilometerstand-Freigabe — Fahrer gibt am Schichtende km-Stand frei */}
        <div className="px-4">
          <FahrerPhase689KmStandFreigabe driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 693: Tour-Stopp-Navigator — Alle Tour-Stops mit Adressen, ETA und Navigation-Buttons */}
        {activeBatch && activeBatch.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase693TourStoppNavigator stops={activeBatch.stops as any} />
          </div>
        )}

        {/* Phase 694: Wochen-Einnahmen-Cockpit — Aktuelle Woche vs. Vorwoche (Einnahmen, Touren, Trinkgeld) */}
        <div className="px-4">
          <FahrerPhase694WochenEinnahmenCockpit driverId={driver.id} />
        </div>

        {/* Phase 699: Pause-Timer-Widget — Pause starten mit 15-Min-Countdown und Überziehs-Alarm */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase699PauseTimerWidget driverId={driver.id} />
          </div>
        )}
        {/* Phase 704: Nächste-Tour-Vorab-Info — Kommende Stops und Route vor Rückkehr anzeigen */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase704NaechsteTourVorabInfo driverId={driver.id} isOnline={isOnline} />
          </div>
        )}
        {/* Phase 709: Tages-Bilanz-Zusammenfassung — Touren/km/Einnahmen/Trinkgeld der heutigen Schicht */}
        <div className="px-4">
          <FahrerPhase709TagesBilanzZusammenfassung driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 714: Nächster-Stop-Countdown — Live-ETA zum nächsten Stop mit Navigations-Button */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase714NaechsterStopCountdown driverId={driver.id} isOnline={isOnline} />
          </div>
        )}
        {/* Phase 719: GPS-Genauigkeits-Warnung — Warnt wenn GPS schwach (>50m) oder veraltet (>60s) */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase719GpsGenauigkeitsWarnung isOnline={isOnline} />
          </div>
        )}
        {/* Phase 724: Schicht-Ende-Bestätigung — Fahrer gibt Km-Stand und bestätigt Schichtende */}
        <div className="px-4">
          <FahrerPhase724SchichtEndeBestaetigung driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 729: Fahrten-Chronik — Letzte 10 abgeschlossene Touren mit Zeit, km, Stops, Einnahmen */}
        <div className="px-4">
          <FahrerPhase729FahrtenChronik driverId={driver.id} />
        </div>
        {/* Phase 734: Streak-Anzeige — Aufeinanderfolgende Tage + Touren-Meilensteine */}
        <div className="px-4">
          <FahrerPhase734StreakAnzeige driverId={driver.id} />
        </div>
        {/* Phase 739: Trinkgeld-Rangliste — Top-Fahrer nach Trinkgeld heute */}
        <div className="px-4">
          <FahrerPhase739TrinkgeldRangliste driverId={driver.id} locationId={driver.location_id} />
        </div>
        {/* Phase 744: Schicht-Überstunden-Warnung — Amber-Banner wenn Schicht >8h */}
        <div className="px-4">
          <FahrerPhase744SchichtUeberstundenWarnung driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 749: km-Tages-Tracker — Fortschrittsbar km-Heute vs. 80km-Ziel + Ø km/Tour */}
        <div className="px-4">
          <FahrerPhase749KmTagesTracker driverId={driver.id} />
        </div>
        {/* Phase 754: SLA-Alarm-Widget — Roter Alarm wenn aktive Tour >45 Min SLA überschreitet */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase754SlaAlarmWidget driverId={driver.id} isOnline={isOnline} />
          </div>
        )}
        {/* Phase 759: Tages-Einnahmen-Cockpit — Touren-€ + Trinkgeld + Prognose + Ziel-Fortschrittsbar */}
        <div className="px-4">
          <FahrerPhase759TagesEinnahmenCockpit driverId={driver.id} />
        </div>
        {/* Phase 759: Live-Einnahmen-Ticker — Ø Tageseinnahmen aus 30d + SVG-Ring Zielfortschritt */}
        {driver.location_id && (
          <div className="px-4">
            <FahrerPhase759LiveEinnahmenTicker driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 763: Live-Stopp-Fortschritt — Aktueller Stopp: Adresse, Entfernung, ETA + Navigations-Button */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase763LiveStoppFortschritt driverId={driver.id} isOnline={isOnline} />
          </div>
        )}
        {/* Phase 764: Stunden-Verdienst-Muster — Wann verdiene ich am meisten? Balken je Stunde */}
        {/* Phase 764: Stunden-Verdienst-Muster — Wann verdiene ich am meisten? Balken je Stunde 7d */}
        {driver.location_id && (
          <div className="px-4">
            <FahrerPhase764StundenVerdienstMuster driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 768: Eigene-Bewertung — Ø-Rating, Sterne, Tagesverlauf der letzten 14 Tage */}
        <div className="px-4">
          <FahrerPhase768EigeneBewertung driverId={driver.id} />
        </div>
        {/* Phase 773: Tages-Highlights-Widget — schnellste Tour, Trinkgeld, km, Touren heute */}
        <div className="px-4">
          <FahrerPhase773TagesHighlightsWidget driverId={driver.id} locationId={driver.location_id ?? ''} />
        </div>
        {/* Phase 783: Schicht-Ziel-Fortschritts-Ring — SVG-Ringe für Touren/Stunden/Einnahmen-Ziel heute */}
        {driver.location_id && (
          <div className="px-4">
            <FahrerPhase783SchichtZielFortschrittsRing driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 793: Schicht-Coach-Tipp — Tagesbasierter Coaching-Hinweis (beste Stunde, Top-Zone, Trinkgeld-Tipp) */}
        {driver.location_id && (
          <div className="px-4">
            <FahrerPhase793SchichtCoachTipp driverId={driver.id} locationId={driver.location_id} />
          </div>
        )}
        {/* Phase 798: Eigene-Storno-Bilanz — Stornos dieser Schicht + Vergleich mit Schicht-Ø */}
        <div className="px-4">
          <FahrerPhase798EigeneStornoBilanz driverId={driver.id} locationId={driver.location_id} />
        </div>
        {/* Phase 803: Wetter-Auswirkungs-Hinweis — Aktuelle Wetterbedingung + Einfluss auf ETA */}
        <div className="px-4">
          <FahrerPhase803WetterAuswirkungsHinweis locationId={driver.location_id} />
        </div>

        {/* Phase 808: Tour-Stopp-Navigator Ultimate — Vollständige Tour-Navigation mit aktivem Stopp-Hero */}
        <div className="px-4">
          <FahrerPhase808TourStoppNavigatorUltimate locationId={driver.location_id} driverId={driver.id} />
        </div>
        {/* Phase 813: Tour Stops Hub — Übersicht aller Stopp mit Farbstatus und Navigations-Schnellzugriff */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase813TourStopsHub
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                angekommen_am: s.angekommen_am,
                geliefert_am: s.geliefert_am,
                order: {
                  bestellnummer: s.order.bestellnummer,
                  kunde_name: s.order.kunde_name,
                  kunde_adresse: s.order.kunde_adresse,
                  eta_earliest: (s.order as any).eta_earliest ?? null,
                  eta_latest: (s.order as any).eta_latest ?? null,
                },
              }))}
              driverLat={driverPos?.lat ?? null}
              driverLng={driverPos?.lng ?? null}
            />
          </div>
        )}
        {/* Phase 812: Tages-Verdienst-Hochrechnung — Aktueller Verdienst + Prognose bis Schichtende */}
        <div className="px-4">
          <FahrerPhase812TagesVerdienstHochrechnung driverId={driver.id} locationId={driver.location_id} />
        </div>

        {/* Phase 817: Navigations-Effizienz-Score — GPS-Direktweg vs. tatsächlich gefahrene km */}
        <div className="px-4">
          <FahrerPhase817NavigationsEffizienz driverId={driver.id} locationId={driver.location_id ?? null} />
        </div>

        {/* Phase 822: Schicht-Score-Cockpit — Live Score Pünktlichkeit/Bewertung/Volumen mit Ring-Visualisierung */}
        <div className="px-4">
          <FahrerPhase822SchichtScoreCockpit driverId={driver.id} locationId={driver.location_id ?? null} />
        </div>

        {/* Phase 827: Tages-Einnahmen-Breakdown — Auflistung je Tour: Grundbetrag + Trinkgeld + Bonus */}
        <div className="px-4">
          <FahrerPhase827TagesEinnahmenBreakdown driverId={driver.id} />
        </div>

        {/* Phase 832: Kundenzufriedenheits-Trend — Letzte 10 Bewertungen als Mini-Sparkline + Ø + Trend-Pfeil */}
        <div className="px-4">
          <FahrerPhase832KundenzufriedenheitsTrend driverId={driver.id} locationId={driver.location_id ?? null} />
        </div>

        {/* Phase 828: Tour-Stopp-Navigator Hub — Alle Stopps mit Status, Adresse, ETA + Navigationsbutton */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase828TourStoppNavigatorHub
              stops={activeBatch.stops.map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                order_id: s.order_id,
                angekommen_am: s.angekommen_am ?? null,
                geliefert_am: s.geliefert_am ?? null,
                kunde_name: s.order?.kunde_name ?? null,
                kunde_adresse: s.order?.kunde_adresse ?? null,
                eta_min: null,
              }))}
            />
          </div>
        )}

        {/* Phase 829: Navigation Live Cockpit — ETA, Tempo, Distanz zum nächsten Stopp */}
        {activeBatch && (() => {
          const nextStop = activeBatch.stops.find((s: any) => !s.geliefert_am);
          const completedCount = activeBatch.stops.filter((s: any) => !!s.geliefert_am).length;
          return (
            <div className="px-4">
              <FahrerPhase829NavigationLiveCockpit
                currentStop={nextStop ? {
                  id: nextStop.id,
                  reihenfolge: nextStop.reihenfolge,
                  kunde_adresse: (nextStop as any).order?.kunde_adresse ?? null,
                  eta_min: null,
                } : null}
                totalStops={activeBatch.stops.length}
                completedStops={completedCount}
              />
            </div>
          );
        })()}

        {/* Phase 833: Tour-Effizienz Live — Echtzeit-Score: Stopps/h, km/Stopp, Trinkgeld-Rate, Vergleich Vortag */}
        <div className="px-4">
          <FahrerPhase833TourEffizienzLive driverId={driver.id} locationId={driver.location_id ?? null} />
        </div>

        {/* Phase 834: Tour-Live-Kommando — Alle Stopps mit Farb-ETA, Navi-Button, Countdown, Pünktlichkeitsampel */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase834TourLiveKommando
              stops={activeBatch.stops.map((s: any) => ({
                id: s.id,
                stopp_nr: s.stopp_nr ?? 0,
                adresse: s.adresse ?? s.address ?? '',
                kunde_name: s.kunde_name ?? null,
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                geliefert_am: s.geliefert_am ?? null,
                geschaetzte_ankunft: s.geschaetzte_ankunft ?? null,
                soll_ankunft: s.soll_ankunft ?? null,
              }))}
              driverLat={null}
              driverLng={null}
            />
          </div>
        )}

        {/* Phase 835: Schicht-Bilanz-Cockpit — Verdienst/Ziel-Fortschritt, Prognose, Trinkgeld, Stundensatz */}
        <div className="px-4">
          <FahrerPhase835SchichtBilanzCockpit driverId={driver.id} locationId={driver.location_id ?? null} />
        </div>

        {/* Phase 849: Strecken-Effizienz-Feedback — letzte Tour: Optimal vs. Gefahren, Score 0-100, Tipp */}
        <div className="px-4">
          <FahrerPhase849StreckenEffizienzFeedback driverId={driver.id} locationId={driver.location_id ?? null} />
        </div>

        {/* Phase 854: Schicht-Energie-Coach — Pausenempfehlung + Wasser + Bonus-Sprint basierend auf Schichtdauer + Tempo */}
        <div className="px-4">
          <FahrerPhase854SchichtEnergieCoach driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 859: Navi-ETA-Vergleich — Mise-ETA vs. Navi-ETA, Delta bei >5 Min Abweichung */}
        <FahrerPhase859NaviEtaVergleich driverId={driver.id} isOnline={isOnline} />

        {/* Phase 863: Schicht-Stopp-Statistik — Stopp-Anzahl, Ø-Zeit/Stopp, Effizienz-Balken heute */}
        <FahrerPhase863SchichtStoppStatistik driverId={driver.id} />
        {/* Phase 869: Fahr-Tipps-Coach — Adaptive Schicht-Tipps je nach Auftragslage (Pause, Zone, Effizienz, Sicherheit) */}
        <FahrerPhase869FahrTippsCoach driverId={driver.id} locationId={driver.location_id ?? null} />
        {/* Phase 874: Touren-Karten-Minimap — SVG-Visualisierung aller heutigen Lieferstopps auf vereinfachter Karte */}
        <FahrerPhase874TourenKartenMinimap driverId={driver.id} locationId={driver.location_id ?? null} />
        {/* Phase 882: Schicht-Energieplan — Empfohlene Pausenzeiten + Energie-Anzeige basierend auf Schichtlänge + Stopps */}
        <FahrerPhase882SchichtEnergieplan driverId={driver.id} isOnline={isOnline} />
        {/* Phase 887: Trinkgeld-Tagestrend — Stündliche Trinkgeld-Timeline + Bestzeit-Highlight + Wochentag-Vergleich */}
        <FahrerPhase887TrinkgeldTagestrend driverId={driver.id} isOnline={isOnline} />
        {/* Phase 892: Trinkgeld-Verlauf-Widget — Mini-Balken-Chart letzter 7 Touren mit Ø + Trend-Indikator */}
        <FahrerPhase892TrinkgeldVerlaufWidget driverId={driver.id} isOnline={isOnline} />
        {/* Phase 897: Schicht-Score-Cockpit — Gesamtscore 0–100 aus Pünktlichkeit + Stopps/h + Bewertung + Tages-Trend */}
        <FahrerPhase897SchichtScoreCockpit driverId={driver.id} isOnline={isOnline} />
        {/* Phase 902: Fahrer-Ziel-Fortschritt-Bar — Täglicher Fortschritt: Touren/Ziel + Km/Ziel + Einkommen/Ziel */}
        <FahrerPhase902ZielFortschrittBar driverId={driver.id} isOnline={isOnline} />
        {/* Phase 914: Schicht-Abschluss-Highlight — Score-Reveal + Top-3-Momente (Schnellste Tour, Bestes Trinkgeld, Pünktlichkeit) */}
        <FahrerPhase914SchichtAbschlussHighlight driverId={driver.id} isOnline={isOnline} />
        {/* Phase 921: Monats-Rangliste — Fahrers Rang im Monatsvergleich + Top-3-Fahrer */}
        <FahrerPhase921MonatsRangliste driverId={driver.id} isOnline={isOnline} />
        {/* Phase 925: Tour-Stopp-Navigations-Cockpit — Alle Stopps mit Status-Ampel, ETA, 1-Klick Navi-Button */}
        <FahrerPhase925TourStoppNavigationsCockpit driverId={driver.id} isOnline={isOnline} />
        {/* Phase 927: Kraftstoff-Tracker — Tägliches km-Log + Kraftstoffkosten je Schicht (7-Tage-Verlauf) */}
        <FahrerPhase927KraftstoffTracker driverId={driver.id} isOnline={isOnline} />
        {/* Phase 930: Tour-Stopp-Navigator Ultimate — Alle Tour-Stops mit Navi-Button, Telefon-Direktwahl, Fortschrittsbalken, Notiz-Alerts */}
        <FahrerPhase930TourStoppNavigatorUltimate activeBatch={activeBatch} driverPos={driverPos} />
        {/* Phase 934: Tour-Lernkurve — Effizienz-Wachstum 4 Wochen: Stopps/h + Pünktlichkeit + Level (Einsteiger→Experte) */}
        <FahrerPhase934TourLernkurve driverId={driver.id} isOnline={isOnline} />
        {/* Phase 935: Tour-Live-Kommando — Stopp-by-Stopp Kommandozentrale: Aktueller Stopp-Fokus, 1-Tap Navigation, Anruf, Geliefert-Button + Expandable Stop-Liste */}
        <FahrerPhase935TourLiveKommando activeBatch={activeBatch} driverPos={driverPos} />
        {/* Phase 939: Kundenzufriedenheits-Verlauf — Letzte 10 Kundenbewertungen als Timeline mit Sterne + Kommentar-Snippet */}
        <FahrerPhase939KundenzufriedenheitsVerlauf driverId={driver.id} isOnline={isOnline} />
        {/* Phase 944: Schicht-Energie-Ring — SVG-Ring der verbleibenden Schichtenergie basierend auf Stopps + Dauer + Pausen */}
        <FahrerPhase944SchichtEnergieRing driverId={driver.id} isOnline={isOnline} />
        {/* Phase 949: Tour-Stopp-Live-Navigator — Alle Tour-Stops mit Status, ETA, Navigation-Deeplink und Kunden-Telefon */}
        <FahrerPhase949TourStoppLiveNavigator driverId={driver.id} isOnline={isOnline} />
        {/* Phase 964: Tour-Reihenfolge-Vorschlag — Nearest-Neighbor-Optimierung der aktiven Tour-Stopps mit Prio-Sortierung */}
        <FahrerPhase964TourReihenfolgeVorschlag driverId={driver.id} isOnline={isOnline} />
        {/* Phase 969: Kundenkommentar-Vorschau — Letzte 3 Kunden-Kommentare der Schicht als Motivations-Widget */}
        <FahrerPhase969KundenkommentarVorschau driverId={driver.id} isOnline={isOnline} />
        {/* Phase 974: Nächster-Stopp-Ultra-Navigator — Prominente Stopp-Karte mit Navigation + Abliefern-Button */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase974NaechsterStoppUltraNavigator
              stops={activeBatch.stops as any}
              currentStopIndex={activeBatch.stops.findIndex((s: any) => !['geliefert','abgeholt','abgeschlossen'].includes(s.status ?? ''))}
            />
          </div>
        )}
        {/* Phase 959: Schicht-Abschluss-Protokoll — Zusammenfassung Touren + Einnahmen + Bewertungen bei Schichtende */}
        <FahrerPhase959SchichtAbschlussProtokoll driverId={driver.id} isOnline={isOnline} />
        {/* Phase 961: Schicht-Gewinn-Hochrechnung — Live-Prognose Schicht-Verdienst + Trinkgeld-Schätzung + Stunden-Verlauf */}
        <FahrerPhase961SchichtGewinnHochrechnung driverId={driver.id} isOnline={isOnline} />
        {/* Phase 979: Schicht-Energie-Prognose — Energie-Level + Pausen-Empfehlung basierend auf Intensität + Schichtdauer */}
        <FahrerPhase979SchichtEnergiePrognose driverId={driver.id} isOnline={isOnline} />
        {/* Phase 984: Tour-Stopp-Navigation-Live — Nächster Stopp mit ETA-Ring, Navigation-Launch (Maps/Waze), Stopp-Liste + Bestätigen */}
        <FahrerPhase984TourStoppNavigationLive driverId={driver.id} isOnline={isOnline} />
        {/* Phase 989: Schicht-Ziel-Fortschritts-Ring — SVG-Ring Touren/Km/Einkommen vs. Tagesziel */}
        <FahrerPhase989SchichtZielFortschrittsRing driverId={driver.id} isOnline={isOnline} />
        {/* Phase 994: Kunden-Kontakt-Schnell-Panel — 1-Tap Anruf/SMS/Klingeln + Notiz-Anzeige je aktivem Stopp */}
        {isOnline && <FahrerPhase994KundenKontaktSchnellPanel />}
        {/* Phase 999: Schicht-Abschluss-Highlight-Screen — Animierter Abschluss mit Tages-Score + Top-Stat + Streak-Badge */}
        <FahrerPhase999SchichtAbschlussHighlightScreen driverId={driver.id} isOnline={isOnline} />
        {/* Phase 1001: Tour-Stopp-Navigator Final — Sequenzierte Stopp-Liste mit Google Maps/Waze + Ablieferungs-Button */}
        {isOnline && <FahrerPhase1001TourStoppNavigatorFinal stopps={[]} />}
        {/* Phase 1005: Verdienst-Ziel-Tracker — SVG-Fortschrittsbalken Tagesverdienst vs. Schichtziel (120€) */}
        <FahrerPhase1005VerdienstZielTracker driverId={driver.id} isOnline={isOnline} />
        {/* Phase 1010: Pausen-Empfehlung-Optimierer — Optimale Pausenzeit basierend auf Schichtdauer + Energie-Score */}
        <FahrerPhase1010PausenEmpfehlung
          schichtDauerMin={status?.online_seit ? Math.floor((Date.now() - new Date(status.online_seit).getTime()) / 60_000) : 0}
          stoppsHeute={todayStats?.deliveries ?? 0}
          isOnline={isOnline}
        />
        {/* Phase 1021: Schicht-Start-Assistent — Vorbereitungs-Checkliste + Bestellprognose (nur wenn offline) */}
        <FahrerPhase1021SchichtStartAssistent driverId={driver.id} isOnline={isOnline} locationId={driver.location_id ?? null} />
        {/* Phase 1026: Wetter-Einfluss-Anzeige — Aktuelles Wetter + ETA-Aufschlag + Sicherheits-Tipps */}
        <FahrerPhase1026WetterEinflussAnzeige driverId={driver.id} isOnline={isOnline} locationId={driver.location_id ?? null} />
        {/* Phase 1031: Einnahmen-Prognose-Assistent — Prognose Tageseinnahmen basierend auf Schicht + Wochentag + Bestelldichte */}
        <FahrerPhase1031EinnahmenPrognoseAssistent driverId={driver.id} isOnline={isOnline} />
        {/* Phase 1036: Strecken-Kilometerstand-Log — Tagesprotokoll km je Tour + Gesamt + Kostenabrechnung */}
        <FahrerPhase1036StreckenKilometerstandLog driverId={driver.id} isOnline={isOnline} />
        {/* Phase 1066: Trinkgeld-Analyse-Dashboard — Trinkgeld je Tour, Ø, Trend */}
        <div className="px-4">
          <FahrerPhase1066TrinkgeldAnalyseDashboard driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1056: Schicht-Motivations-Coach — Personalisierter Motivationstext je nach Score-Entwicklung steigend/stabil/fallend */}
        <div className="px-4">
          <FahrerPhase1056SchichtMotivationsCoach driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1051: Routen-Effizienz-Feedback — Echtzeit-Score Effizienz aktuelle Tour vs. Optimum + eingesparte km + CO₂-Bilanz */}
        {isOnline && activeBatch && (
          <div className="px-4">
            <FahrerPhase1051RoutenEffizienzFeedback driverId={driver.id} tourId={activeBatch.id} />
          </div>
        )}
        {/* Phase 1046: Kundenbewertungs-Live-Ticker — Nach jeder Lieferung: letzte Bewertung animiert + Wochentrend */}
        <div className="px-4">
          <FahrerPhase1046KundenbewertungsLiveTicker driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1040: Nächster-Stopp-Ultra-Kommando — Großer ETA-Countdown, Navigation, Bestätigung + nächste Stopps Vorschau */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase1040NaechsterStoppUltraKommando />
          </div>
        )}
        {/* Phase 1002: GPS-Navi-Kommando — Live-GPS-Navigationszentrale mit Google/Waze/Apple Maps + ETA + Ablieferungs-Bestätigung */}
        {isOnline && <FahrerPhase1002GpsNaviKommando />}

        {/* Phase 1015: Tour-Stops-Navigations-Hub — Nächster Stopp prominent + vollständige Stopp-Liste + Navigation + Kunden-Info */}
        {isOnline && activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1015TourStopsNavigationsHub
              stops={activeBatch.stops as any}
              driverId={driver.id}
              activeBatchId={activeBatch.id}
            />
          </div>
        )}
        {/* Phase 1018: Smart Tour Navigations-Hub — Nächster Stopp mit ETA-Ring + 1-Tap Navigation + Stopp-Liste + Bestätigen-Button */}
        {isOnline && activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1018SmartTourNavigationsHub
              stops={activeBatch.stops as any}
              driverId={driver.id}
              activeBatchId={activeBatch.id}
            />
          </div>
        )}

        {/* Phase 844: Schicht-Zusammenfassung — Kompakte Endabrechnung beim Abmelden: Touren, km, Einnahmen, Ø-Bewertung, Stornos */}
        <FahrerPhase844SchichtZusammenfassung driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />

        {/* Phase 850: Tour-Stopp Navigator Pro — Alle Stopps mit Navi-Button, ETA-Ampel, Fortschritt-Leiste */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase850TourStoppNavPro
              driverId={driver.id}
              activeBatchId={activeBatch.id}
              stops={activeBatch.stops as any}
            />
          </div>
        )}

        {/* Phase 776: Tour-Stopp-Sequenz-Live — visuelle Stopp-Liste mit ETA und Navigations-Button */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <Phase776TourStoppSequenzLive
              stops={activeBatch.stops as any}
              currentStopId={activeBatch.stops.find((s: any) => !s.geliefert_am)?.id ?? null}
            />
          </div>
        )}

        {/* Phase 787: Tour-Stopp Live-Kompass — Alle Stopps mit Navigation, ETA und Zustellbestätigung */}
        {activeBatch && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase787TourStoppLiveKompass
              stops={activeBatch.stops.map((s: any, idx: number) => ({
                id: s.id,
                stopp_nr: s.stopp_nr ?? idx + 1,
                adresse: s.adresse ?? s.address ?? '',
                stadtteil: s.stadtteil ?? s.district ?? null,
                kunde_name: s.kunde_name ?? s.customer_name ?? null,
                kunde_telefon: s.kunde_telefon ?? s.customer_phone ?? null,
                geliefert_am: s.geliefert_am ?? null,
                eta_min: s.eta_min ?? null,
                distanz_km: s.distanz_km ?? s.distance_km ?? null,
                notiz: s.notiz ?? s.note ?? null,
                order_id: s.order_id ?? null,
                bestellnummer: s.bestellnummer ?? null,
              }))}
              onNavigate={(stop) => {
                const addr = encodeURIComponent(stop.adresse);
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
              }}
            />
          </div>
        )}

        {/* Phase 222: Comeback-Bonus-Hinweis — Toast wenn Fahrer nach Pause Bonus erhält */}
        {isOnline && (
          <div className="px-4">
            <FahrerComebackBonusHinweis isOnline={isOnline} />
          </div>
        )}

        {/* Phase 222: Incentive-Live-Strip — heutige Boni + Meilenstein-Fortschritt */}
        {!activeBatch && isOnline && (
          <div className="px-4">
            <FahrerIncentiveLiveStrip />
          </div>
        )}

        {/* Wochen-Ranking — nur sichtbar wenn kein aktiver Batch und online */}
        {!activeBatch && isOnline && <FahrerRankingCard />}

        {/* Phase 309: Dispatch-Nachrichten — Betriebsnachrichten und Alerts vom Dispatch */}
        {isOnline && (
          <div className="px-4">
            <FahrerDispatchNachrichten />
          </div>
        )}

        {/* Phase 311: Echtzeit-Leistungs-Anzeige — eigener Live-Score + Rang (Phase-310-API) */}
        {isOnline && <EchtzeitLeistungsAnzeige />}
        {/* Phase 313: Schicht-Umsatz-Velocity — Umsatz/Stunde Tempo vs. Peak + Prognose */}
        {isOnline && <SchichtUmsatzVelocity locationId={driver.location_id} />}
        {/* Phase 315: Stop-Smart-Countdown — Echtzeit-Countdown zum nächsten Stopp mit Pünktlichkeits-Ring */}
        {isOnline && activeBatch && (
          <StopSmartCountdown driverId={driver.id} />
        )}
        {/* Phase 406: Tour-Stop-Schnell-Quittierung — Aktueller Stopp quittieren mit 3 Quick-Actions */}
        {isOnline && activeBatch && (
          <div className="px-4">
            <TourStopSchnellQuittierung />
          </div>
        )}
        {/* Phase 407: Tour-Stop-Quick-Actions — Navigation + Kontakt + Lieferung quittieren */}
        {isOnline && activeBatch && (() => {
          const currentStop = activeBatch.stops.find(s => !s.geliefert_am);
          if (!currentStop) return null;
          const address = [currentStop.order.kunde_adresse, currentStop.order.kunde_plz].filter(Boolean).join(', ');
          return (
            <div className="px-4 mt-3">
              <TourStopQuickActions
                tourId={activeBatch.id}
                stopId={currentStop.id}
                stopAddress={address}
                customerName={currentStop.order.kunde_name}
                customerPhone={currentStop.order.kunde_telefon ?? null}
                lat={currentStop.order.kunde_lat ?? null}
                lng={currentStop.order.kunde_lng ?? null}
                onComplete={() => {
                  setActiveBatch(prev => prev ? {
                    ...prev,
                    stops: prev.stops.map(s => s.id === currentStop.id ? { ...s, geliefert_am: new Date().toISOString() } : s)
                  } : prev);
                }}
              />
            </div>
          );
        })()}

        {/* Phase 409: Tour-Stop-Impulse-Karte — Kompakter Stopp-Überblick mit Navigations-Buttons + Lieferbestätigung */}
        {isOnline && activeBatch && (() => {
          const currentStop = activeBatch.stops.find(s => !s.geliefert_am);
          if (!currentStop) return null;
          const completedCount = activeBatch.stops.filter(s => s.geliefert_am).length;
          const address = [currentStop.order.kunde_adresse, currentStop.order.kunde_plz].filter(Boolean).join(', ');
          return (
            <div className="px-4 mt-3">
              <TourStopImpulseKarte
                stop={{
                  orderId: currentStop.order.id,
                  orderNr: currentStop.order.bestellnummer ?? `#${currentStop.order.id.slice(-4)}`,
                  address,
                  customerName: currentStop.order.kunde_name ?? 'Kunde',
                  phone: currentStop.order.kunde_telefon ?? null,
                  etaMin: null,
                  timeWindowStart: null,
                  timeWindowEnd: null,
                  notes: currentStop.order.kunde_lieferhinweis ?? null,
                  stopIndex: completedCount + 1,
                  totalStops: activeBatch.stops.length,
                  isOverdue: false,
                }}
                onConfirm={() => {
                  setActiveBatch(prev => prev ? {
                    ...prev,
                    stops: prev.stops.map(s => s.id === currentStop.id ? { ...s, geliefert_am: new Date().toISOString() } : s)
                  } : prev);
                }}
              />
            </div>
          );
        })()}

        {/* Tages-Zusammenfassung: Schicht-Performance als aufklappbare Übersicht */}
        {!activeBatch && isOnline && todayStats && (
          <FahrerTagesZusammenfassung
            driverId={driver.id}
            completedBatches={[]}
            totalDeliveries={todayStats.deliveries}
            cashCollected={todayStats.estEarnings}
            onlineSeit={status?.online_seit ?? null}
            currentBatchStops={0}
          />
        )}

        {/* Phase 410: Schicht-End-Summary — Kompaktes Abschluss-Banner mit Umsatz, Lieferungen, Trinkgeld am Schichtende */}
        {!activeBatch && isOnline && todayStats && (
          <SchichtEndSummary
            summary={{
              revenueEur:      todayStats.estEarnings ?? 0,
              deliveries:      todayStats.deliveries ?? 0,
              avgDeliveryMin:  null,
              tipsEur:         0,
              bonusEur:        null,
              isNearEnd:       false,
              minutesLeft:     null,
            }}
          />
        )}

        {/* Aktive Challenges */}
        {!activeBatch && isOnline && <ChallengeWidget />}

        {/* Positionierungs-Empfehlung */}
        {!activeBatch && isOnline && <PositioningSuggestionBanner />}

        {/* Tour-Stopp-Navigations-Hub — Unified Navigation für aktiven und verbleibende Stopps */}
        {activeBatch && activeBatch.status === 'unterwegs' && <TourStoppNavigationsHub />}

        {/* Phase 457: Schicht-Status-Streifen — Start/Ende + Fortschrittsbalken + verbleibende Zeit */}
        {isOnline && (
          <FahrerSchichtStatusStrip upcomingShifts={upcomingShifts} />
        )}

        {/* Phase 174: Geo-Cluster Hotspot-Tipp — beste Warte-Position bei Leerlauf */}
        {!activeBatch && isOnline && (
          <DriverHotspotTip
            isOnline={isOnline}
            hasActiveBatch={false}
            driverPos={driverPos}
            locationId={driver.location_id}
          />
        )}

        {/* Offline state */}
        {!isOnline && !activeBatch && (
          <section className="text-center py-8">
            <Power className="h-12 w-12 text-matcha-300 mx-auto mb-2 opacity-40" />
            <div className="text-matcha-200">Du bist offline. Geh online, um Touren anzunehmen.</div>
          </section>
        )}

        {/* Phase 1086: Nächster-Stopp-Navigation-Card — Adresse + Maps-Link + Klingel/Etage + Timer */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1086NaechsterStoppNavigationCard
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              isOnline={isOnline}
            />
          </div>
        )}

        {/* Phase 1087: Tour-Stopp Smart-Navigator Hub — Alle Stops priorisiert + Countdown + Navi-CTA + Abschluss-Button */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1087TourStoppSmartNavigatorHub
              stops={activeBatch.stops as any}
              batchId={activeBatch.id}
            />
          </div>
        )}

        {/* Phase 1090: Stopp-Navigator Cockpit — Fokussierter Navi-Hub: aktuelle Adresse, Google Maps / Waze, Quick-Actions */}
        {activeBatch && (
          <FahrerPhase1090StoppNavigatorCockpit
            stops={activeBatch.stops as any}
          />
        )}

        {/* Phase 1091: Tour-Abschluss-Selfie-Check — Selfie-Prompt für Schicht-Ende-Protokoll nach letzter Lieferung */}
        {activeBatch && isOnline && activeBatch.stops.length > 0 && (activeBatch.stops as any[]).every((s: any) => s.geliefert_am) && (
          <div className="px-4">
            <FahrerPhase1091TourAbschlussSelfieCheck
              driverId={driver.id}
              batchId={activeBatch.id}
              isOnline={isOnline}
            />
          </div>
        )}

        {/* Phase 1096: Kilometerstand-Quittung-Generator — PDF-ähnliche Fahrtenübersicht für Erstattungsnachweis */}
        {isOnline && (
          <div className="px-4">
            <FahrerPhase1096KilometerstandQuittung driverId={driver.id} isOnline={isOnline} />
          </div>
        )}

        {/* Phase 1101: Live-Kundenbewertung-Vorschau — Letzte 3 Bewertungen der Schicht + Trend */}
        <div className="px-4">
          <FahrerPhase1101LiveKundenbewertung driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1106: Trinkgeld-Wochen-Übersicht — Wöchentliche Trinkgeld-Statistik mit Tages-Balken + bester Tag + Ø/Tour */}
        <div className="px-4">
          <FahrerPhase1106TrinkgeldWochenUebersicht driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1111: Kunden-Feedback-Chronik — Letzte 10 Bewertungen mit Kommentar + Sterne + Datum scrollbar */}
        <div className="px-4">
          <FahrerPhase1111KundenFeedbackChronik driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1116: Schicht-Meilenstein-Tracker — Erreichte Meilensteine + Fortschritt zum nächsten Ziel */}
        <div className="px-4">
          <FahrerPhase1116SchichtMeilensteinTracker driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1121: Tages-Ziel-Fortschritts-Ring — Fahrer-Tagesziel Stopps+€ + SVG-Ring + Motivations-Nachricht */}
        <div className="px-4">
          <FahrerPhase1121TagesZielFortschrittsRing driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1126: Kombi-Tour-Vorschau — Stopps der nächsten möglichen Bündelungs-Tour + Zeitersparnis */}
        <div className="px-4">
          <FahrerPhase1126KombiTourVorschau driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1131: Schicht-Abschluss-Zusammenfassung — Stopps, km, Umsatz, Trinkgeld, Score nach Schichtende */}
        <div className="px-4">
          <FahrerPhase1131SchichtAbschlussZusammenfassung driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1132: Einnahmen-Wochenübersicht — 7-Tage-Balkendiagramm eigener Umsatz + Vergleich mit Vorwoche */}
        <div className="px-4">
          <FahrerPhase1132EinnahmenWochenuebersicht driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1137: Schicht-KPI-Abschluss — Tages-Leistung: Stopps, km, Umsatz, Trinkgeld, Pünktlichkeit + Motivation */}
        <div className="px-4">
          <FahrerPhase1137SchichtKpiAbschluss driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1142: Nächste-Schicht-Vorschau — Geplante nächste Schicht (Datum/Zeit/Bestelllast) wenn offline */}
        <div className="px-4">
          <FahrerPhase1142NaechsteSchichtVorschau driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1152: Schicht-Energie-Cockpit — Energie-Score + Personalisierte Tipps basierend auf Schichtdauer + Pausen */}
        <div className="px-4">
          <FahrerPhase1152SchichtEnergieCockpit driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1157: Tour-Stopp-Kommando-Ultra — Navigations-Zentrale mit aktuellem Stopp + nächste Stopps + Schnell-Aktionen */}
        {activeBatch && isOnline && (
          <div className="px-4">
            <FahrerPhase1157TourStoppKommandoUltra activeBatch={activeBatch as any} />
          </div>
        )}

        {/* Phase 1162: Tour-Stopp-Live-Kommando — Nächster Stopp mit ETA-Ring, Adresse + Navi-CTA */}
        {activeBatch && isOnline && (
          <div className="px-4">
            <FahrerPhase1162TourStoppLiveKommando activeBatch={activeBatch as any} />
          </div>
        )}

        {/* Phase 1167: Smart-Tour-Navigator-Pro — Alle Stopp-Schritte mit Sequenz + Routeneffizienz + aktuellem Fokus-Stopp */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1167SmartTourNavigatorPro activeBatch={activeBatch as any} />
          </div>
        )}

        {/* Phase 1172: Tour-Stopp-Navi-Hub — Aktueller + nächste Stopps + Schnell-Navi (Google/Waze) + ETA */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1172TourStoppNaviHub activeBatch={activeBatch as any} />
          </div>
        )}

        {/* Phase 1187: Tour-Stopp-Navigations-Cockpit — Aktueller Stopp mit GPS, ETA-Countdown, Navi-Button und Schnell-Anruf */}
        {activeBatch && isOnline && (
          <div className="px-4">
            <FahrerPhase1187TourStoppNavigationsCockpit driverId={driver.id} isOnline={isOnline} activeBatch={activeBatch as any} />
          </div>
        )}
        {/* Phase 1191: Schicht-Trinkgeld-Tracker — Kumuliertes Trinkgeld der Schicht + Ø/Stopp + Prognose Schichtende */}
        <div className="px-4">
          <FahrerPhase1191SchichtTrinkgeldTracker driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1196: Routen-Effizienz-Badge — km/Stopp vs. Team-Ø + Platin/Gold/Silber/Bronze */}
        <div className="px-4">
          <FahrerPhase1196RoutenEffizienzBadge driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1201: Tages-km-Live-Tracker — Kumulierte km + Balken vs. Durchschnitt + CO2-Fußabdruck */}
        <div className="px-4">
          <FahrerPhase1201TagesKmLiveTracker driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1214: Bonus-Status-Tracker — Tages-Bonus Stopps+Bewertung+Pünktlichkeit → Bronze/Silber/Gold */}
        <div className="px-4">
          <FahrerPhase1214BonusStatusTracker driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1219: Kunden-Anruf-Log — Letzte 5 Kontaktversuche (Anruf/Klingel/SMS) mit Status */}
        <div className="px-4">
          <FahrerPhase1219KundenAnrufLog driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1224: Schicht-Ende-Energie-Check — Erschöpfungs-Skala 1–5 + automatische Pausen-Empfehlung */}
        <div className="px-4">
          <FahrerPhase1224SchichtEndeEnergieCheck driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1229: Energie-Verlauf — Letzte 5 Checks + Mini-Trendlinie + Ø-Energie + Vergleich zu gestern */}
        <div className="px-4">
          <FahrerPhase1229EnergieVerlauf driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1234: Tour-Qualitäts-Abzeichen — Erfolgsquote letzte Stopps + Gold/Silber/Bronze-Badge */}
        <div className="px-4">
          <FahrerPhase1234TourQualitaetsAbzeichen driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1239: Einnahmen-Prognose-Widget — Hochrechnung Tagesende + Bronze/Silber/Gold-Zielbalken */}
        <div className="px-4">
          <FahrerPhase1239EinnahmenPrognoseWidget driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1244: Schicht-Bilanz-Preview — Fortlaufende Bilanz + Hochrechnung Schichtende */}
        <div className="px-4">
          <FahrerPhase1244SchichtBilanzPreview driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1249: Schicht-Stimmungs-Tracker — 5-Emoji Quick-Input + Verlauf + Empfehlung */}
        <div className="px-4">
          <FahrerPhase1249SchichtStimmungsTracker driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1254: Navi-Zusammenfassung-Widget — scrollbare Karten aller heutigen Stopps */}
        <div className="px-4">
          <FahrerPhase1254NaviZusammenfassungWidget driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1259: Tages-Rangliste — eigene Platzierung (Stopps/h) vs. anonymisierte Kollegen */}
        <div className="px-4">
          <FahrerPhase1259TagesRangliste driverId={driver.id} isOnline={isOnline} locationId={driver.location_id} />
        </div>
        {/* Phase 1264: Schicht-Snapshot-Widget — Gesamtumsatz, Ø-Lieferzeit, Top-Zone, aktive Fahrer */}
        <div className="px-4">
          <FahrerPhase1264SchichtSnapshotWidget locationId={driver.location_id} isOnline={isOnline} />
        </div>
        {/* Phase 1269: Trinkgeld-Wochenübersicht — Summe + Ø je Tag als Balken-Chart + Trend Vorwoche */}
        <div className="px-4">
          <FahrerPhase1269TrinkgeldWochenuebersicht driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1274: Kraftstoff-/Akku-Tracker — Eingabe Energie je Schicht + Effizienz-Trend + Kosten */}
        <div className="px-4">
          <FahrerPhase1274KraftstoffAkkuTracker driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1288: Schicht-Start-Checkliste — Vor Schichtbeginn: Fahrzeug/Handy/Wärmetasche/Ausweis/App-Check mit persistiertem State */}
        <div className="px-4">
          <FahrerPhase1288SchichtStartCheckliste driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1292: Schicht-Ende-Bestätigung — Stopps/Einnahmen/km/Bewertung-Summary + Schicht-beenden-Button */}
        <div className="px-4">
          <FahrerPhase1292SchichtEndeBestaetigung driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1297: Tour-Ende-Foto-Upload — Ablieferungs-Foto-Bestätigung mit Kamera/Datei-Upload + Preview */}
        <div className="px-4">
          <FahrerPhase1297TourEndeFotoUpload driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1302: Schicht-Statistik-Karte — Ø-Lieferzeit + Stopps + Trinkgeld + Bewertungs-Ø; 10-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1302SchichtStatistikKarte driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1307: Schicht-Pause-Empfehlung — Energie-Level + 15-Min-Pause-Timer mit localStorage-Persistenz */}
        <div className="px-4">
          <FahrerPhase1307SchichtPauseEmpfehlung driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1312: Tages-Ziel-Fortschritt — Stopp-Ziel-Balken + Meilenstein-Badges; isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1312TagesZielFortschritt isOnline={isOnline} stoppsAbgeschlossen={todayStats?.deliveries ?? 0} />
        </div>
        {/* Phase 1317: Schicht-Einnahmen-Tracker — Trinkgeld + Liefergebühren kumulativ + 7-Tage-Vergleich; isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1317SchichtEinnahmenTracker driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1322: Trinkgeld-Schnell-Eingabe — 1-Tap-Beträge + Freitext; POST an Einnahmen-API; isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1322TrinkgeldSchnellEingabe driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1327: Offline-Modus-Indikator — Verbindungsstatus-Banner + ausstehende Aktionen + Auto-Sync */}
        <div className="px-4">
          <FahrerPhase1327OfflineModusIndikator driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1345: Tour-Stopp-Navigator-Ultimate — Alle Stopps mit Farbkodierung, GPS-Navigation + Schnell-Aktionen + Fortschrittsbalken */}
        {activeBatch && activeBatch.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1345TourStoppNavigatorUltimate
              driverId={driver.id}
              stops={activeBatch.stops.map((s, i) => ({
                id: s.id,
                sequence: s.reihenfolge ?? i + 1,
                address: s.order.kunde_adresse,
                customer_name: s.order.kunde_name,
                customer_phone: s.order.kunde_telefon ?? null,
                status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
                notes: s.order.kunde_lieferhinweis ?? s.order.kunde_notiz ?? null,
                bestellnummer: s.order.bestellnummer,
                order_id: s.order.id,
              }))}
            />
          </div>
        )}
        {/* Phase 1354: Navigations-Favoriten — Häufige Adressen als 1-Tap-Schnellauswahl; localStorage; Google/Apple/Waze */}
        <div className="px-4">
          <FahrerPhase1354NavigationsFavoriten driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1359: Schicht-Ziel-Zusammenfassung — Schicht-Ende: 4 Ziel-Kacheln (Stopps/Einnahmen/Trinkgeld/Pünktlichkeit); localStorage */}
        <div className="px-4">
          <FahrerPhase1359SchichtZielZusammenfassung driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1364: Tour-Abschluss-Zusammenfassung — Overlay nach letztem Stopp: Zeit/Stopps/km/Trinkgeld/Bewertung; localStorage */}
        <FahrerPhase1364TourAbschlussZusammenfassung batchId={activeBatch?.id ?? null} isOnline={isOnline} />
        {/* Phase 1369: Kunden-Zufriedenheits-Ampel — Letzte Bewertung + 7-Tage-Ø + Trend-Ampel grün/gelb/rot; isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1369KundenZufriedenheitsAmpel driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1374: Schicht-Bilanz-Overlay — Tages-Abrechnung nach Schicht-Ende: Stopps/km/Trinkgeld/Einnahmen/Bewertung + Vortag-Vergleich; localStorage-Guard */}
        <FahrerPhase1374SchichtBilanzOverlay driverId={driver.id} isOnline={isOnline} />
        {/* Phase 1379: Tour-Stopp Navigation Live-Cockpit — Alle Stopps mit Ampel, GPS-Navigation (Google/Waze), Kunden-Anruf + Geliefert-Button */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1379TourStoppNavigationLiveCockpit
              batchId={activeBatch.id}
              stops={activeBatch.stops?.map((s) => ({
                id: s.id,
                position: s.reihenfolge,
                status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : 'ausstehend',
                kunde_name: s.order?.kunde_name ?? null,
                kunde_adresse: s.order?.kunde_adresse ?? null,
                kunde_plz: s.order?.kunde_plz ?? null,
                kunde_lat: s.order?.kunde_lat ?? null,
                kunde_lng: s.order?.kunde_lng ?? null,
                kunde_telefon: s.order?.kunde_telefon ?? null,
                bestellnummer: s.order?.bestellnummer ?? null,
                gesamtbetrag: s.order?.gesamtbetrag ?? null,
                zahlungsart: (s.order as any)?.zahlungsart ?? null,
                notiz: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? null,
              })) ?? []}
              totalEtaMin={activeBatch.total_eta_min ?? null}
              batchStartedAt={activeBatch.started_at ?? null}
              onMarkDelivered={markDelivered}
            />
          </div>
        )}
        {/* Phase 1384: Live-Einnahmen-Ticker — Echtzeit-Einnahmen heute + Tagesziel-Fortschritt + Trend vs. Vorwoche + Neue-Tour-Flash-Animation */}
        <div className="px-4">
          <FahrerPhase1384LiveEinnahmenTicker driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1388: Tour-Stopp Navi-Ultimate — Fortschrittsring + Nächster-Stopp-Karte mit Maps/Waze + Geliefert-Button + kollabierbare Stopp-Liste */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1388TourStoppNaviUltimate
              batchId={activeBatch.id}
              stops={activeBatch.stops?.map((s) => ({
                id: s.id,
                position: s.reihenfolge,
                status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : 'ausstehend',
                kunde_name: s.order?.kunde_name ?? null,
                kunde_adresse: s.order?.kunde_adresse ?? null,
                kunde_plz: s.order?.kunde_plz ?? null,
                kunde_lat: s.order?.kunde_lat ?? null,
                kunde_lng: s.order?.kunde_lng ?? null,
                kunde_telefon: s.order?.kunde_telefon ?? null,
                bestellnummer: s.order?.bestellnummer ?? null,
                gesamtbetrag: s.order?.gesamtbetrag ?? null,
                zahlungsart: (s.order as any)?.zahlungsart ?? null,
                notiz: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? null,
              })) ?? []}
              totalEtaMin={activeBatch.total_eta_min ?? null}
              batchStartedAt={activeBatch.started_at ?? null}
              onMarkDelivered={markDelivered}
            />
          </div>
        )}
        {/* Phase 1393: Schicht-Pause-Timer — Pause starten/beenden mit Zeitprotokoll + REST-Aufruf; isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1393SchichtPauseTimer driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1398: Kilometerstand-Quittung — Start/End-km Eingabe + gefahrene km Berechnung + POST; isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1398KilometerstandQuittung driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1403: Schicht-Notiz — Vorlagen + Freitext (280Z) + POST /api/driver-app/schicht-notiz; localStorage-Fallback offline */}
        <div className="px-4">
          <FahrerPhase1403SchichtNotiz driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1408: Schicht-Energie-Check — Alle 2h Energielevel 1-5 Eingabe + Empfehlung (Pause/Weiter/Schicht-Ende); isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1408SchichtEnergieCheck driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1413: Kunden-Bewertungs-Vorschau — Letzte Kundenbewertung + 7-Tage-Trend + Schnitt; isOnline-Guard; 60s-Polling */}
        <div className="px-4">
          <FahrerPhase1413KundenBewertungsVorschau driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1418: Schicht-Wetter-Check — Wetter-Icon + Extra-Lieferzeit-Hinweis aus delivery_config; isOnline-Guard; 15-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1418SchichtWetterCheck driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1423: Tages-Einnahmen-Übersicht — Grundlohn + Trinkgeld + Stopps + km heute vs. gestern; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1423TagesEinnahmenUebersicht driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1428: Tour-Sicherheits-Check — 4-Punkte-Checkliste vor Tourstart (Fahrzeug/Akku/Route/Waren); einmalig pro Batch */}
        <div className="px-4">
          <FahrerPhase1428TourSicherheitsCheck batchId={activeBatch?.id ?? null} isOnline={isOnline} />
        </div>
        {/* Phase 1433 (Post-Tour): Kurzfeedback nach Tour-Ende — 3 Fragen (Strecke/Kunden/Besonderheiten) mit 1–5 Sterne */}
        <div className="px-4">
          <FahrerPhase1433PostTourFeedback
            driverId={driver.id}
            locationId={driver.location_id}
            completedBatchId={lastCompletedBatchId}
            isOnline={isOnline}
          />
        </div>
        {/* Phase 1433: Smart-Stopp-Navigator-Ultra — Alle Stopps mit Google Maps/Waze, Countdown, Kunden-Kontakt + Fortschrittsbalken */}
        {activeBatch && activeBatch.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1433SmartStoppNavigatorUltra
              stops={activeBatch.stops.map((s, i) => ({
                id: s.id,
                stop_nummer: s.reihenfolge ?? i + 1,
                kunde_name: s.order?.kunde_name ?? null,
                adresse: s.order?.kunde_adresse ?? null,
                plz: s.order?.kunde_plz ?? null,
                lat: s.order?.kunde_lat ?? null,
                lng: s.order?.kunde_lng ?? null,
                telefon: s.order?.kunde_telefon ?? null,
                eta_min: activeBatch.total_eta_min != null
                  ? Math.round((activeBatch.total_eta_min / activeBatch.stops.length) * (i + 1))
                  : null,
                gesamtbetrag: s.order?.gesamtbetrag ?? null,
                status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
                zahlungsart: (s.order as { zahlungsart?: string | null } | null)?.zahlungsart ?? null,
                notiz: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? null,
              }))}
            />
          </div>
        )}
        {/* Phase 1437: Tour-Stopp-Analyse-Card — Expandierbare Stopp-Liste mit Kontaktbuttons, ETA und Trinkgeld-Badge */}
        {activeBatch && (
          <div className="px-4">
            <FahrerTourStoppAnalyseCard batchId={activeBatch.id} />
          </div>
        )}
        {/* Phase 1447: Persönliche Bonus-Karte — Eigene Bonus-Aufstellung + Monats-Fortschrittsbalken */}
        <div className="px-4">
          <FahrerPhase1447PersoenlicheBonusKarte driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1459: Tour-Navigation-Kommando — Kompaktes Navigation-Kommando mit allen Tour-Stops, Direkt-Maps und Schnell-Aktionen */}
        <div className="px-4">
          <FahrerPhase1459TourNavigationKommando
            stops={activeBatch?.stops?.map((s: any, i: number) => ({
              id: s.id,
              sequence: s.reihenfolge ?? (i + 1),
              address: s.order?.kunde_adresse ?? `Stopp ${i + 1}`,
              customerName: s.order?.kunde_name ?? `Kunde ${i + 1}`,
              phone: s.order?.kunde_telefon ?? null,
              notes: s.order?.kunde_notiz ?? null,
              status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
              etaMin: null,
              distanceKm: null,
              orderAmount: s.order?.gesamtbetrag ?? null,
            }))}
            driverName={driver ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim() : undefined}
          />
        </div>
        {/* Phase 1463: Persönliche Schicht-Zusammenfassung — Stopps/Strecke/Verdienst + Wochenschnitt-Vergleich */}
        {driver.location_id && (
          <div className="px-4">
            <FahrerPhase1463PersoenlicheSchichtZusammenfassung
              driverId={driver.id}
              isOnline={isOnline}
              locationId={driver.location_id}
            />
          </div>
        )}
        {/* Phase 1468: Tagesziel-Fortschritts-Ring — Tages-Bestellungs-Ziel als Ring-Diagramm + Verdienst-KPI + Prognose */}
        <div className="px-4">
          <FahrerPhase1468TageszielFortschrittsRing driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1469: Smart-Navigations-Ziel-Cockpit — Nächstes Lieferziel mit ETA + Navi-Deep-Link */}
        <div className="px-4">
          <FahrerPhase1469SmartNaviZielCockpit
            stops={(activeBatch?.stops ?? []) as any}
            isOnline={isOnline}
            currentLat={status?.last_lat ?? null}
            currentLng={status?.last_lng ?? null}
          />
        </div>
        {/* Phase 1470: Verdienst-Prognose-Live — Live-Hochrechnung Tagesverdienst auf Basis bisheriger Stopps */}
        <div className="px-4">
          <FahrerPhase1470VerdienstPrognoseLive
            driverId={driver.id}
            isOnline={isOnline}
            completedStops={activeBatch?.stops?.filter((s: any) => !!s.geliefert_am).length ?? 0}
            totalStops={activeBatch?.stops?.length ?? 0}
            schichtStartISO={status?.online_seit ?? null}
            earningsToday={todayStats?.estEarnings ?? 0}
            earningsGoal={60}
          />
        </div>
        {/* Phase 1471: Tour-Stopp Smart Navigator — Priorisierte Stopp-Liste mit ETA + schnellem Navi-Button */}
        <div className="px-4">
          <FahrerPhase1471TourStoppSmartNavigator
            activeBatch={activeBatch as any}
            isOnline={isOnline}
          />
        </div>
        {/* Phase 1474: Schicht-Ende-Countdown — Restzeit bis Schichtende + Empfehlung ob noch eine Tour sinnvoll */}
        <div className="px-4">
          <FahrerPhase1474SchichtEndeCountdown
            driverId={driver.id}
            isOnline={isOnline}
            locationId={driver.location_id ?? null}
          />
        </div>
        {/* Phase 1479: Schicht-Countdown-Timer v2 — SVG-Ring Restzeit + Tour-Prognose aus API; 1-Min-Interval + 10-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1479SchichtCountdownTimerV2
            driverId={driver.id}
            isOnline={isOnline}
            locationId={driver.location_id ?? null}
            schichtStart={status?.online_seit ?? null}
          />
        </div>
        {/* Phase 1484: Strecken-Effizienz-Score — Ø km/Stopp + Effizienz-Rang im Team + Spar-Tipp; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1484StreckenEffizienzScore
            driverId={driver.id}
            isOnline={isOnline}
            locationId={driver.location_id ?? null}
            stoppsHeute={todayStats?.deliveries ?? activeBatch?.stops?.filter((s: any) => !!s.geliefert_am).length ?? 0}
          />
        </div>
        {/* Phase 1489: Routen-Effizienz-Karte — Stopps/h + Ø km/Stopp + Team-Rang; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1489RoutenEffizienzKarte
            driverId={driver.id}
            isOnline={isOnline}
            locationId={driver.location_id ?? null}
          />
        </div>
        {/* Phase 1494: Smart-Stopp-Countdown — Nächster Stopp mit ETA-Ring, Countdown, Distanz und Navi-Button; isOnline-Guard */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1494SmartStoppCountdown
              isOnline={isOnline}
              nextStop={(activeBatch.stops as any[]).find((s: any) => !s.geliefert_am) ?? null}
              totalStops={activeBatch.stops.length}
              doneStops={(activeBatch.stops as any[]).filter((s: any) => !!s.geliefert_am).length}
            />
          </div>
        )}
        {/* Phase 1501: Stopp-Nav-Kommando — Kompakte Navigationszentrale für aktuellen Stopp (Adresse, ETA, 1-Tap-Navigation, Abschließen) */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <div className="px-4">
            <FahrerPhase1501StoppNavKommando
              stops={(activeBatch.stops as any[]).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                angekommen_am: s.angekommen_am ?? null,
                geliefert_am: s.geliefert_am ?? null,
                kunde_name: s.order?.kunde_name ?? null,
                kunde_adresse: s.order?.kunde_adresse ?? null,
                kunde_plz: s.order?.kunde_plz ?? null,
                kunde_stadt: s.order?.kunde_stadt ?? null,
                kunde_telefon: s.order?.kunde_telefon ?? null,
                bestellnummer: s.order?.bestellnummer ?? null,
                eta_min: s.eta_min ?? null,
              }))}
              onStoppAbschliessen={markDelivered}
            />
          </div>
        )}
        {/* Phase 1505: Smart-Tour-Cockpit — Kompaktes Tour-Cockpit mit Stopp-Übersicht, Nächster-Stopp-CTA, ETA-Countdown + 1-Tap-Navigation */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1505SmartTourCockpit
              stops={(activeBatch.stops as any[]).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? 0,
                angekommen_am: s.angekommen_am ?? null,
                geliefert_am: s.geliefert_am ?? null,
                kunde_name: s.order?.kunde_name ?? null,
                kunde_adresse: s.order?.kunde_adresse ?? null,
                kunde_plz: s.order?.kunde_plz ?? null,
                kunde_stadt: s.order?.kunde_stadt ?? null,
                kunde_telefon: s.order?.kunde_telefon ?? null,
                bestellnummer: s.order?.bestellnummer ?? null,
                eta_min: s.eta_min ?? null,
                notiz: s.order?.notiz ?? null,
                lat: s.order?.lat ?? null,
                lng: s.order?.lng ?? null,
              }))}
              onStoppAbschliessen={markDelivered}
            />
          </div>
        )}
        {/* Phase 1500: Tour-Abschluss-Zusammenfassung — Stopps/Verdienst/km/Ø Lieferzeit + Bewertungs-Trend; nur wenn alle Stopps geliefert */}
        <div className="px-4">
          <FahrerPhase1500TourAbschlussZusammenfassung
            driverId={driver.id}
            activeBatch={activeBatch as any}
          />
        </div>
        {/* Phase 1505: Schicht-Vergleichs-Karte — Heute vs. Vorwoche: Stopps/Verdienst/km/Ø Lieferzeit als Vergleichs-Grid */}
        <div className="px-4">
          <FahrerPhase1505SchichtVergleichsKarte driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1510: Kilometerstand-Tracker — Heutige km + laufender Durchschnitt je Tour + Wochentrend; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1510KilometerstandTracker driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1515: Nächste-Tour-Vorbereitung — Checkliste vor Tourstart (Fahrzeug/Handy/Akku/Route); Guard isOnline; localStorage je Tour-ID */}
        <div className="px-4">
          <FahrerPhase1515NaechsteTourVorbereitung
            driverId={driver.id}
            isOnline={isOnline}
            tourId={activeBatch?.id ?? null}
          />
        </div>
        {/* Phase 1520: Schicht-Pausen-Empfehlung — Empfehlung wann Pause sinnvoll; isOnline-Guard; lokale Logik */}
        <div className="px-4">
          <FahrerPhase1520SchichtPausenEmpfehlung
            isOnline={isOnline}
            aktiveTours={activeBatch ? 1 : 0}
          />
        </div>
        {/* Phase 1545: Tour-Stops-Final-Hub — Alle Tour-Stopps mit Navigation-Button, Kunden-Infos, Items-Liste und Google-Maps-Link */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1545TourStopsFinalHub stops={activeBatch.stops as any} batchStatus={activeBatch.status} />
          </div>
        )}
        {/* Phase 1535: Trinkgeld-Tracker — Heute Trinkgeld + Ø je Stopp + Vergleich Vorwoche; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1535TrinkgeldTracker isOnline={isOnline} driverId={driver?.id} />
        </div>
        {/* Phase 1540: Zonen-Tipp-Karte — Welche Zonen heute gut laufen; isOnline-Guard; 20-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1540ZonenTippKarte isOnline={isOnline} />
        </div>
        {/* Phase 1545: Schicht-Anmelde-Widget — Nächste Schicht bestätigen/ablehnen; isOnline-Guard; POST schicht-bestaetigung */}
        <div className="px-4">
          <FahrerPhase1545SchichtAnmeldeWidget isOnline={isOnline} driverId={driver?.id ?? ''} />
        </div>
        {/* Phase 1550: Live-Schicht-Bilanz — Verdienst/Trinkgeld/Bewertung/Pünktlichkeit live; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1550LiveSchichtBilanz isOnline={isOnline} driverId={driver?.id ?? ''} />
        </div>
        {/* Phase 1550b: Kundenbewertungs-Feedback-Karte — Letzte Bewertung + Kommentar + Datum; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1550KundenbewertungsFeedbackKarte isOnline={isOnline} driverId={driver?.id ?? ''} />
        </div>
        {/* Phase 1555: Bonus-Chancen-Widget — Erreichbare Boni (Pünktlichkeit/Trinkgeld/Streak); isOnline-Guard; 15-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1555BonusChancenWidget isOnline={isOnline} driverId={driver?.id ?? ''} />
        </div>
        {/* Phase 1560: Schicht-Effizienz-Ring — SVG-Ring Stopps/h + Team-Vergleich + Coach-Tipp; isOnline-Guard; 20-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1560SchichtEffizienzRing isOnline={isOnline} driverId={driver?.id ?? ''} />
        </div>
        {/* Phase 1565: Kunden-Zufriedenheits-Ampel — Ampel letzte 5 Bewertungen + Coach-Hinweis; isOnline-Guard; 15-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1565KundenZufriedenheitsAmpel isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1570: Tageseinnahmen-Verlauf — Stundenweise Einnahmen-Balken + Gesamt + Prognose; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1570TageseinnahmenVerlauf isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1570b: Nächste-Schicht-Erinnerungs-Karte — Nächste geplante Schicht + Countdown + Bestätigungsbutton; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1570NaechsteSchichtErinnerungsKarte isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1575: Nächste-Schicht-Erinnerungs-Karte — Nächste Schicht + Countdown + Bestätigungsbutton; isOnline-Guard; 30-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1575NaechsteSchichtErinnerungsKarte isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1580: Schicht-Countdown-Timer — Restliche Schichtzeit + ETA letzter Stopp + Empfehlung weitere Tour; isOnline-Guard; 5-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1580SchichtCountdownTimer isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1585: Tour-Stops-Navigation-Ultimate — Vollständige Stop-Liste mit Fortschrittsring, aktuellem Stop, Navi-CTA und Geliefert-Button */}
        {isOnline && activeBatch?.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1585TourStopsNavigationUltimate
              stops={activeBatch.stops as any}
            />
          </div>
        )}
        {/* Phase 1590: Einnahmen-Zusammenfassung-Karte — Tageseinnahmen gesamt + Touren/Trinkgeld/Bonus + Trend vs. Vortag; isOnline-Guard; 10-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1590EinnahmenZusammenfassungKarte isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1595: Smart-Tour-Stopp-Navigator — Aktuelle Tour-Stops mit Google-Maps-Navigation + Stopp-Reihenfolge + ETA je Stopp + Kunden-Notiz */}
        <div className="px-4">
          <FahrerPhase1595SmartTourStoppNavigator isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1600: Schicht-Energie-Coach — Pausenempfehlung basierend auf aktiven Stunden + Stopp-Count; Ampel grün/gelb/rot; 15-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1600SchichtEnergieCoach isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1605: Tour-Rückblick-Karte — Letzte abgeschlossene Tour: Stopps + Gesamtzeit + Ø-ETA + Trinkgeld-Gesamt; isOnline-Guard */}
        <div className="px-4">
          <FahrerPhase1605TourRueckblickKarte isOnline={isOnline} lastBatch={activeBatch as any} />
        </div>
        {/* Phase 1610: Trinkgeld-Wochenziel-Tracker — Fortschrittsbalken + Prognose Ende Woche + Schätzung je Schicht; 10-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1610TrinkgeldWochenzielTracker isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1615: Tour-Stopp-Navigations-Ultra-Hub — Alle Stopps mit Farbpunkt-Status, nächster-Stopp-Highlight, Navi-Button + Abschließen-Aktion; expandierbar */}
        {activeBatch?.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1615TourStoppNavigationsUltraHub
              stops={activeBatch.stops as any}
              currentStopId={null}
            />
          </div>
        )}
        {/* Phase 1620: Tages-KPI-Scoreboard — Touren + Ø Lieferzeit + Pünktlichkeit + Trinkgeld-Rate + Rang; isOnline-Guard; 10-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1620TagesKpiScoreboard isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1625: Routen-Effizienz-Karte — Geplante vs. tatsächliche Fahrtzeit letzter 5 Touren; Effizienzrate; Ampel gut/normal/schlecht; isOnline-Guard; 15-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1625RoutenEffizienzKarte isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1630: Tour-Stopp-Live-Navi-Cockpit — Alle Stopps der aktiven Tour mit Sequenz, Status-Ampel, ETA-Countdown, direkter Navi-App-Integration (Google/Waze/Apple Maps) */}
        <div className="px-4">
          <FahrerPhase1630TourStoppLiveNaviCockpit isOnline={isOnline} driverId={driver?.id ?? null} batchId={activeBatch?.id ?? null} />
        </div>
        {/* Phase 1634: Nächste-Schicht-Vorbereitung-Card — Schicht-Countdown + Vorbereitungs-Checklist; nur wenn offline und Schichtstart <3h */}
        <div className="px-4">
          <FahrerPhase1634NaechsteSchichtVorbereitungCard isOnline={isOnline} driverId={driver?.id ?? null} />
        </div>
        {/* Phase 1639: Feierabend-Zusammenfassung-Card — Schicht-KPIs wenn offline + letzte Tour geliefert; Abmeldungs-CTA */}
        <div className="px-4">
          <FahrerPhase1639FeierabendZusammenfassungCard
            isOnline={isOnline}
            driverId={driver?.id ?? null}
            stops={activeBatch?.stops as any}
            schichtStartedAt={status?.online_seit ?? undefined}
          />
        </div>
        {/* Phase 1644: Tour-Qualitäts-Score-Karte — Score der letzten 5 Touren (Pünktlichkeit + Kundenbewertung + Effizienz) als kompakte Timeline; isOnline-Guard; 15-Min-Polling */}
        <div className="px-4">
          <FahrerPhase1644TourQualitaetsScoreKarte
            isOnline={isOnline}
            driverId={driver?.id ?? null}
          />
          {/* Phase 1649: Smart-Tour-Stopp-Navigator-Pro — Alle Tour-Stops mit Priorität, ETA, Reihenfolge; Farbkodierung: Grün/Blau/Ausstehend */}
          {activeBatch?.stops && activeBatch.stops.length > 0 && (
            <FahrerPhase1649SmartTourStoppNavigatorPro
              stops={activeBatch.stops as any}
              currentStopId={null}
            />
          )}
          {/* Phase 1654: Schicht-Energie-Radar — Phase1651-API: Energie-Level (0–100) als Radial-Ring + Empfehlung; isOnline-Guard; 20-Min-Polling */}
          <FahrerPhase1654SchichtEnergieRadar driverId={driver?.id ?? null} isOnline={isOnline} />
          {/* Phase 1660: Lern-Tipp-Karte — Personalisierte Optimierungstipps heute vs. Vorwoche; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1660LernTippKarte driverId={driver?.id ?? null} isOnline={isOnline} />
          {/* Phase 1670: Meine-Effizienz-Score-Karte — Phase1667-API: eigener Score + Rang + Verbesserungs-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1670MeineEffizienzScoreKarte driverId={driver?.id ?? null} isOnline={isOnline} />
          {/* Phase 1665: Tour-Stops-Nav-Kommando — Farbkodierte Stop-Liste mit Navigation-CTA (Google/Apple Maps), ETA je Stop, Abschließen-Button; Supabase-Polling 20s */}
          {activeBatch?.id && (
            <FahrerPhase1665TourStopsNavKommando batchId={activeBatch.id} driverId={driver?.id ?? ''} />
          )}
          {/* Phase 1670: Schicht-Ende-Countdown-Timer — Restliche Schichtzeit als Ring + Empfehlung ob weitere Tour; Warnung <30 Min; isOnline-Guard */}
          <FahrerPhase1670SchichtEndeCountdownTimer onlineSeit={status?.online_seit ?? null} isOnline={isOnline} />
          {/* Phase 1675: Meine-Zone-Karte — Aktuelle Zone A/B/C/D + ETA-Benchmark + Anzahl Fahrer in gleicher Zone; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase1675MeineZoneKarte driverId={driver?.id ?? null} isOnline={isOnline} locationId={null} currentZone={null} />
          {/* Phase 1680: Smart Tour Navigator Hub — Aktueller Stopp mit Countdown + Google-Maps-Deeplink + Nächste-Stopps-Vorschau + Schnell-Aktionen; 60-Sek-Polling */}
          {activeBatch && <FahrerPhase1680SmartTourNavigatorHub driverId={driver?.id ?? null} />}
          {/* Phase 1685: Pausenzeit-Erinnerung — Wenn Fahrer >5.5h aktiv: In-App-Karte mit Pausenempfehlung; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase1685PausenzeitErinnerung driverId={driver?.id ?? null} isOnline={isOnline} onlineSeit={status?.online_seit ?? null} />
          {/* Phase 1690: Tour-Abschluss-Schnellbewertung — Nach letztem Stopp: Stern-Bewertung 1–5 + Kommentar; Guard deliveredAll; einmalig pro Tour */}
          <FahrerPhase1690TourAbschlussSchnellbewertung
            batchId={activeBatch?.id ?? null}
            driverId={driver?.id ?? null}
            stops={(activeBatch?.stops ?? []) as any}
            isOnline={isOnline}
          />
          {/* Phase 1695: Schicht-Rangliste-Vorschau — Eigener Rang + 2 über/unter dem Fahrer + Punktabstand; 20-Min-Polling; isOnline-Guard */}
          <FahrerPhase1695SchichtRanglisteVorschau
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1700: Tages-Umsatz-Beitrag-Karte — EUR-Umsatz durch Lieferungen heute; Fahrer-Anteil; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1700TagesUmsatzBeitragKarte
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1705: Mein Bewertungs-Verlauf — Letzte 5 Tour-Bewertungen + Ø-Score 7 Tage; isOnline-Guard; 60-Min-Polling */}
          <FahrerPhase1705MeinBewertungsVerlauf
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1715: Tages-Ziel-Kurzübersicht — Stopps/Verdienst/SLA Fortschrittsbalken; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1715TagesZielKurzuebersicht
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1720: Schicht-Schnellstart-Cockpit — 3-KPI-Kacheln (Online-Zeit/Stopps/Verdienst) + Schicht-Startzeit; isOnline stets sichtbar; kein Polling */}
          <FahrerPhase1720SchichtSchnellstartCockpit
            isOnline={isOnline}
            onlineSeit={status?.online_seit ?? null}
            stoppsHeute={todayStats?.deliveries ?? 0}
            verdienstEur={todayStats?.estEarnings ?? 0}
          />
          {/* Phase 1725: Einnahmen-Hochrechnung-Karte — Projektion Tagesverdienst + Konfidenz-Balken; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase1725EinnahmenHochrechnungKarte
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1750: Eigener Effizienz-Trend — Mein Tour-Score letzte 7 Tage + Trend-Pfeil + Team-Vergleich; 30-Min-Polling */}
          <FahrerPhase1750EigenerEffizienzTrend
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1755: Eigene Pünktlichkeits-Quote — Meine Pünktlichkeit + Team-Vergleich; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1755EigenePuenktlichkeitsQuote
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1760: Eigene Touren-Bilanz — Abgeschlossene vs. abgebrochene Touren heute + Team-Vergleich; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1760EigeneTourenBilanz
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1764: Smart Stopp-Navigator mit Karten-Link — Nächster Stopp: Adresse, ETA, Entfernung + Google Maps / Apple Maps Links; isOnline-Guard; 30s-Polling */}
          <FahrerPhase1764SmartStoppNavigatorMitKartenLink
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1769: Zonen-Verdienst-Vergleich — Ø Verdienst je Zone letzte 7 Tage; beste Zone hervorheben; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1769ZonenVerdienstVergleich
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1789: Nächster-Stopp-Navigator — Nächste Adresse + Karten-Link + Stopp-Fortschritt; isOnline-Guard; 2-Min-Polling */}
          <FahrerPhase1789NaechsterStoppNavigator
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1793: Tour-Stopp-Fortschritts-Navigator — Alle Tour-Stopps mit Fortschrittsbalken + aktivem Stopp + Navi-Link; 2-Min-Polling */}
          <FahrerPhase1793TourStoppFortschrittsNavigator
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1803: Stopp-Schnell-Bestätigung — Aktuellen Stopp bestätigen: Adresse + ETA + optionale Notiz + Bestätigungs-Button; isOnline-Guard */}
          <FahrerPhase1803StoppSchnellBestaetigung
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1809: Tour-Stopp-Navigations-Hub — Alle verbleibenden Stopps mit Adresse/ETA/Navi-Link; aktueller Stopp hervorgehoben; 90s-Polling */}
          <FahrerPhase1809TourStoppNavigationsHub
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1814: Schicht-Zuverlässigkeits-Badge — Score + Ampel + Wochenverlauf + Verbesserungstipps; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1814SchichtZuverlaessigkeitsBadge
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1819: Schicht-Effizienz-Karte — Effizienz-Score + Rang + Touren/h + km/Stopp + Team-Vergleich; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1819SchichtEffizienzKarte
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1824: Live-Einnahmen-Tracker — Heutige Einnahmen + Stunden-Chart + Ziel vs. Ist; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1824LiveEinnahmenTracker
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1829: Kunden-Bewertungs-Feed — Letzte 5 Bewertungen + Ø-Score + Trend; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1829KundenBewertungsFeed
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1834: Pünktlichkeits-Cockpit — Eigene Quote + 7-Tage-Verlauf + Rang + Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1834PuenktlichkeitsCockpit
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1839: Tages-Abschluss-Summary — Tageszahlen (Stopps, Einnahmen, Ø-Bewertung, Pünktlichkeit) + Team-Vergleich; nur nach Schichtende; 30-Min-Polling */}
          <FahrerPhase1839TagesAbschlussSummary
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1844: Eigene-Tour-Bilanz — Letzte 3 eigene Touren: Stopps/Dauer/km/Bewertung/Pünktlichkeit; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1844EigeneTourBilanz
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1849: Smart-Tour-Stopp-Navigations-Hub Ultra — Alle Stopps mit ETA-Zeitlinie; Ein-Tipp-Navi (Google/Apple/Waze); Telefon-Schnellzugriff; Punkte-Vorschau; Fortschrittsbalken */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase1849SmartTourStoppNavigationsHubUltra
              stopps={(activeBatch.stops ?? []) as any}
              tourId={activeBatch.id ?? null}
            />
          )}
          {/* Phase 1854: Liefertreue-Cockpit — Eigene SLA-Quote vs. Team; Statusbalken on-time/spät; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1854LiefertreueCockpit
            driverId={driver.id}
            locationId={driver.location_id}
            isOnline={isOnline}
          />
          {/* Phase 1859: Eigene GPS-Statusleiste — GPS-Stärke + Minuten seit Update + Warnung >3 Min; isOnline-Guard; 1-Min-Polling */}
          <FahrerPhase1859EigeneGpsStatusleiste
            driverId={driver.id}
            locationId={driver.location_id}
            isOnline={isOnline}
          />
          {/* Phase 1864: GPS-Ausfall-Selbstdiagnose — Schritt-für-Schritt Hilfe bei kritischem GPS; 30s-Countdown → Support-Alert; isOnline-Guard; 1-Min-Polling */}
          <FahrerPhase1864GpsAusfallSelbstdiagnose
            driverId={driver.id}
            locationId={driver.location_id}
            isOnline={isOnline}
          />
          {/* Phase 1865: Schicht-Verdienst-Prognose — Ist-Verdienst + Hochrechnung bis Schichtende + Tagesziel-Fortschrittsbalken; 2-Min-Polling */}
          <FahrerPhase1865SchichtVerdienstPrognose driverId={driver.id} />
          {/* Phase 1869: Eigene-Wartezeit-Statistik — Ø Wartezeit pro Stopp heute + 7 Tage; Trend-Vergleich; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1869EigeneWartezeitStatistik driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1875: Meine-Zonen-Affinität — Top-3 Zonen nach Ø-Verdienst/Stopp + Erfolgsquote; isOnline-Guard; Collapsible; 30-Min-Polling */}
          <FahrerPhase1875MeineZonenAffinitaet driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 1880: Zonen-Tipp-des-Tages — Beste Zone nach Ø-Verdienst/Stopp + SLA + Wartezeit; isOnline-Guard; Collapsible; 30-Min-Polling */}
          <FahrerPhase1880ZonenTippDesTages locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 1885: Schicht-Zonen-Bilanz — Stopps + Verdienst je Zone diese Schicht; Vergleich letzte Schicht; isOnline-Guard; Collapsible; 30-Min-Polling */}
          <FahrerPhase1885SchichtZonenBilanz locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1890: Top-Verdienst-Schicht-Recap — Beste Schicht diese Woche; Zonen + Stopps + Verdienst; Vergleich Ø; isOnline-Guard; Collapsible; einmalig */}
          <FahrerPhase1890TopVerdienstSchichtRecap locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1895: Persönlicher-Monats-Rekord-Banner — Bester Monat vs. aktueller Monat; Verdienst/Stopps/Pünktlichkeit; Trophy; Fortschrittsbalken; isOnline-Guard; Collapsible; 30-Min-Polling */}
          <FahrerPhase1895PersoenlichenMonatsRekordBanner locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1900: Schicht-Ziel-Fortschritt — Fortschrittsbalken Verdienst-Ziel; Schicht-Countdown; Motivations-Badge; isOnline-Guard; 10-Min-Polling */}
          <FahrerPhase1900SchichtZielFortschritt locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1905: Mein-Bonus-Fortschritt — Bonus-Stufe + Fortschrittsbalken; Anforderungen; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1905MeinBonusFortschritt locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1910: Meine-Pünktlichkeits-Kurve — 7-Tage-Sparkline + Trend-Text + Motivationstext; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase1910MeinePuenktlichkeitsKurve locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1915: Mein-Qualitäts-Score — Score-Ring + KPI-Aufschlüsselung + Rang im Team + Verbesserungstipp; isOnline-Guard; Collapsible; 30-Min-Polling */}
          <FahrerPhase1915MeinQualitaetsScore locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1920: Meine-Zonen-Statistik — Top-3-Zonen nach Stopps + Ø-Zeit + Tipp; isOnline-Guard; Collapsible; 1-Std-Polling */}
          <FahrerPhase1920MeineZonenStatistik locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1925: Meine-Effizienz-KPIs — Stopps/h + km/Stopp + Score + Team-Vergleich + Motivationstext; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1925MeineEffizienzKPIs locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1930: Meine-Schicht-Bilanz — Stopps/km/Bewertung/Bonus; Konfetti bei Gold; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1930MeineSchichtBilanz locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1935: Meine-Kundenbewertungen — Ø-Sterne + letzte 3 Kommentare + Trend + Motivationstext; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase1935MeineKundenbewertungen locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1940: Meine-Strecken-Übersicht — km heute + Team-Ø + letzte 5 Touren Mini-Balken; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1940MeineStreckenUebersicht locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1945: Meine-Schicht-Planung — nächste Schicht + stündliche Auslastungs-Prognose + Rush-Hour-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase1945MeineSchichtPlanung locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1950: Meine-Pausen-Planung — Empfohlene Pausenzeit; Warnung >2h ohne Pause; Pausen-Zähler; isOnline-Guard; 5-Min-Polling */}
          <FahrerPhase1950MeinePausenPlanung locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1951: Tour-Stopp-Navigator-Ultra — Fokus-Karte Nächster Stopp + One-Tap Google Maps + Telefon + Stopp-Liste mit Fortschrittsbalken */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase1951TourStoppNavigatorUltra
              stops={(activeBatch.stops ?? []).map((s: any, i: number) => ({
                id: s.id,
                sequence: s.reihenfolge ?? i,
                status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : ('neu' as const),
                kunde_name: s.order?.kunde_name ?? s.kunde_name ?? null,
                adresse: s.order?.kunde_adresse ?? s.kunde_adresse ?? s.address ?? null,
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                telefon: s.order?.kunde_telefon ?? s.kunde_telefon ?? null,
                notiz: s.order?.notiz ?? s.notiz ?? null,
              }))}
            />
          )}
          {/* Phase 1952: Tour-Fortschritts-Ring — SVG-Ring Stopps erledigt/gesamt + Laufzeit + Restzeit-Schätzung */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase1952TourFortschrittsRing
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : ('neu' as const),
              }))}
            />
          )}
          {/* Phase 1953: Nächster-Stopp-ETA-Cockpit — ETA-Countdown + Strecke + Verkehr + One-Tap Navigation; 2-Min-Polling */}
          <FahrerPhase1953NaechsterStoppEtaCockpit
            locationId={driver.location_id}
            driverId={driver.id}
            isOnline={isOnline}
          />
          {/* Phase 1891: Schicht-Routen-Effizienz-Score — Score-Ring + Stopps/h + Ø Stoppzeit vs. Ziel; isOnline-Guard; Collapsible; 2-Min-Polling */}
          <FahrerPhase1891SchichtRoutenEffizienzScore locationId={driver.location_id} driverId={driver.id} isOnline={isOnline} />
          {/* Phase 1870: Tour-Stopp-Smart-Sequenz-Navigator — Fokus-Karte Nächster Stopp + One-Tap-Navigation (Google/Apple) + Telefon-Link + kompakte Stopp-Sequenz; client-seitig */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase1870TourStoppSmartSequenzNav
              stops={(activeBatch.stops ?? []).map((s: any, i: number) => ({
                id: s.id,
                sequence: s.reihenfolge ?? i,
                status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : 'neu',
                kunde_name: s.order?.kunde_name ?? s.kunde_name ?? null,
                adresse: s.order?.kunde_adresse ?? s.kunde_adresse ?? s.address ?? null,
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                telefon: s.order?.kunde_telefon ?? s.kunde_telefon ?? null,
                estimated_arrival: s.estimated_arrival ?? null,
                bestellnummer: s.order?.bestellnummer ?? s.bestellnummer ?? null,
              }))}
            />
          )}
          {/* Phase 1880: Smart Tour-Stop Cockpit — Countdown-Ring + Google/Apple Maps One-Tap + Telefon + Nächste-Stopps-Vorschau; mobile-first */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase1880SmartTourStopCockpit
              stops={(activeBatch.stops ?? []).map((s: any, i: number) => ({
                id: s.id,
                sequence: s.reihenfolge ?? i,
                address: s.order?.kunde_adresse ?? s.kunde_adresse ?? s.address ?? null,
                adresse: s.order?.kunde_adresse ?? s.kunde_adresse ?? null,
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                customer_name: s.order?.kunde_name ?? s.kunde_name ?? null,
                kunde_name: s.order?.kunde_name ?? s.kunde_name ?? null,
                customer_phone: s.order?.kunde_telefon ?? s.kunde_telefon ?? null,
                telefon: s.order?.kunde_telefon ?? s.kunde_telefon ?? null,
                estimated_arrival: s.estimated_arrival ?? null,
                angekommen_am: s.angekommen_am ?? null,
                geliefert_am: s.geliefert_am ?? null,
                bestellnummer: s.order?.bestellnummer ?? s.bestellnummer ?? null,
                notes: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? null,
              }))}
            />
          )}
          {/* Phase 2001: Schicht-Abschluss-Assistent — Performance-Badge, Einnahmen, Trinkgeld, Ø Stoppzeit; erscheint wenn keine aktive Tour vorhanden */}
          <FahrerPhase2001SchichtAbschlussAssistent
            driverId={driver?.id ?? null}
            hasActiveTour={!!activeBatch}
          />
          {/* Phase 2004: Meine-ETA-Genauigkeit — Eigene ETA-Trefferquote + Score-Ring + Rang im Team + Verbesserungstipp */}
          <FahrerPhase2004MeineEtaGenauigkeit
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 2009: Mein-Schicht-Forecast — Fahrerverfügbarkeit 4h-Timeline + Pause-Empfehlung; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2009MeinSchichtForecast
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 2010: Tour-Stopp-Navigation Ultra — Nächster Stopp mit Adresse, ETA, Kundeninfos, Google Maps + Anrufen + Angekommen */}
          <FahrerPhase2010TourStoppNavigationUltra
            driverId={driver?.id ?? ''}
            batchId={activeBatch?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 2011: Live-Tour-Stopp-Übersicht — Alle Stopps der aktuellen Tour als Timeline-Liste mit Status */}
          <FahrerPhase2011LiveTourStoppUebersicht
            driverId={driver?.id ?? ''}
            batchId={activeBatch?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 2012: Smart-Navigations-Cockpit — Navi-App-Auswahl (Google Maps, Waze, Apple Maps) für aktuellen Stopp */}
          <FahrerPhase2012SmartNavigationsCockpit
            adresse={
              (activeBatch?.stops ?? []).find((s: any) => !s.geliefert_am && !s.completed_at)
                ?.order?.kunde_adresse ?? null
            }
            isOnline={isOnline}
          />
          <FahrerPhase2017MeineTourEffizienz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2022: Meine-Schicht-Auslastung — Eigene Matrix letzte 8h; Ø Auslastung%; Tipp */}
          <FahrerPhase2022MeineSchichtAuslastung driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2027: Meine-Pausenzeit-Analyse — Eigene Pausendauer letzte 7 Tage; Vergleich Team-Ø; Tipp */}
          <FahrerPhase2027MeinePausenzeitAnalyse driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2033: Meine-Tour-Abschluss-Bilanz — Abschlussrate 7 Tage vs. Team-Ø; Motivation; Mini-Balken */}
          <FahrerPhase2033MeineTourAbschlussBilanz locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2038: Meine-Bewertungs-Entwicklung — Ø-Rating + Trend vs. Team; Motivationstipp */}
          <FahrerPhase2038MeineBewertungsEntwicklung driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2043: Meine Pünktlichkeits-Statistik — Rate%, vs. Team-Ø, Trend, Motivationstipp */}
          <FahrerPhase2043MeinePuenktlichkeitsStatistik driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2051: Meine Stammkunden-Touren — Stammkundenanteil; "Du kennst X Kunden bereits!"; Motivationstipp; isOnline-Guard */}
          <FahrerPhase2051MeineStammkundenTouren driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2052: Tour-Stopp-Navigations-Pro — Aktueller Stopp groß + Navi-CTAs; nächste 2 Stopps; ETA-Badge; Fortschrittsleiste; 15s-Polling */}
          <FahrerPhase2052TourStoppNavigationsPro driverId={driver.id} locationId={driver.location_id ?? ''} isOnline={isOnline} />
          {/* Phase 2057: Meine Reaktionszeit-Statistik — Eigene Ø Reaktionszeit; vs. Team-Ø; Trend; Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2057MeineReaktionsteitStatistik driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2060: Tour-Stops & Navigation Live — Sequenzielle Stop-Liste; Live-ETA-Countdown; Google/Apple Maps Direktlink; Offline-fähig */}
          <FahrerPhase2060TourStopsNavigationLive driverId={driver.id} locationId={driver.location_id ?? ''} isOnline={isOnline} />
          {/* Phase 2062: Meine Effizienz-Bilanz — Aktiv-Zeit vs. Idle-Zeit heute; Effizienz-Ring (%); Tipp bei hoher Idle-Zeit; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2062MeineEffizienzBilanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2067: Meine Touren-Strecke — Km-Zähler heute; Ø km/Bestellung; Vergleich Team-Ø; Fortschrittsbalken; isOnline-Guard */}
          <FahrerPhase2067MeineTourenStrecke driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2073: Meine Lieblingszone — Häufigste Zone heute; Ø Lieferzeit; Vergleich Team-Ø; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2073MeineLieblingszone locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2078: Meine Schicht-Dauer — Ring-Gauge % von 8h; Überstunden-Warnung rot; Pausen-Empfehlung nach >6h; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2078MeineSchichtDauer driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2100: Tour-Stop-Navigator-Master — GPS-Deeplinks (Apple/Google), aktueller Stop groß, Nächster-Stop-Vorschau, Tour-Fortschrittsring */}
          <Phase2100TourStopNavigatorMaster driverId={driver.id} />
          {/* Phase 2105: Smart-Tour-Stopp-Live-Kommando-Ultra — aktueller Stopp + Navi/Anruf/Bestätigen-CTAs; Nächster-Stopp-Vorschau; Stop-Dot-Progress; Tour-Abschluss-Banner */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2105SmartTourStoppLiveKommandoUltra
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? null,
                address: s.address ?? null,
                customer_name: s.customer_name ?? null,
                customer_phone: s.customer_phone ?? null,
                status: s.status ?? null,
                notes: s.notes ?? null,
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                order_id: s.order_id ?? null,
                items: s.items ?? [],
              }))}
              driverId={driver.id}
            />
          )}
          {/* Phase 2110: Tour-Stopp-Echtzeit-Navigator — Hero-Stop + Navi/Anruf/Bestätigen-CTAs; Nächste-Stopps-Liste; Fortschrittsbalken; kein API-Call */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2110TourStoppEchtzeitNavigator
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? null,
                address: s.address ?? null,
                customer_name: s.customer_name ?? null,
                customer_phone: s.customer_phone ?? null,
                status: s.status ?? null,
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                items: s.items ?? [],
                estimated_arrival_at: s.estimated_arrival_at ?? null,
              }))}
              driverId={driver.id}
            />
          )}
          {/* Phase 2089: Meine Stunden-Bilanz — Team-Touren je Stunde; Spitzenstunde; Vergleich Team-Ø; isOnline-Guard; 1h-Polling */}
          <FahrerPhase2089MeineStundenBilanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2094: Mein Tages-Qualitäts-Score — Ring-Gauge; Pünktlichkeit + Bewertung + Stornofreiheit; Trend; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase2094MeinTagesQualitaetsScore driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2111: Tour-Stopp-Smart-GPS-Hub — Aktueller Stopp Hero; Navigation + Anruf + Bestätigen-CTAs; Nächster-Stopp-Vorschau; Stop-Liste; Fortschrittsbalken */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2111TourStoppSmartGpsHub
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? null,
                address: s.order?.kunde_adresse ?? s.address ?? null,
                customer_name: s.order?.kunde_name ?? s.customer_name ?? null,
                customer_phone: s.order?.kunde_telefon ?? s.customer_phone ?? null,
                status: s.geliefert_am ? 'delivered' : (s.angekommen_am ? 'arrived' : 'pending'),
                lat: s.order?.kunde_lat ?? s.lat ?? null,
                lng: s.order?.kunde_lng ?? s.lng ?? null,
                eta_min: s.order?.geschaetzte_lieferung_min ?? null,
                order_id: s.order_id ?? null,
                is_cash: s.order?.zahlungsart === 'cash',
                amount: s.order?.gesamtbetrag ?? null,
              }))}
              driverId={driver.id}
              isOnline={isOnline}
            />
          )}
          {/* Phase 2099: Meine Reaktionszeit — Stopp-Median; Vergleich Team-Median; Tipp; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase2099MeineReaktionszeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2105: Meine Kundenbewertung — Eigener Score; Team-Ø-Vergleich; Motivations-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2105MeineKundenbewertung driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2110: Mein Tour-Bonus — Eigene Bonus-Punkte; Streak; Multiplikator; Motivations-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2110MeinTourBonus driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2115: Meine Zonen-Auslastung — Eigene Zone heute; Auslastungsprozent; Tipp wenn Zone voll; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase2115MeineZonenAuslastung locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2120: Meine Pünktlichkeit — Eigene Quote; Vergleich Team-Ø; Tipp wenn <85%; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2120MeinePuenktlichkeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2125: Mein Wellbeing-Score — Positives Engagement; Stars; Motivationstipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2125MeinWellbeingScore driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2130: Meine Abschlussquote — Eigene Quote; Balken; Trend; vs. Team-Ø; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2130MeineAbschlussquote driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2131: Tour-Stopps-Navigations-Kommando — Aktiver Stopp groß; Navi-Button; Nächste Stopps; Fortschrittsleiste; 30s-Polling */}
          <FahrerPhase2131TourStoppsNavigationsKommando driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2135: Meine Touren-Vollständigkeit — Eigener Index; vs. Team-Ø; Badge bei 100%; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2135MeineTourenVollstaendigkeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2140: Meine Schicht-Effizienz — Eigener Score; vs. Team-Ø; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2140MeineSchichtEffizienz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2145: Mein Feedback-Score — Eigene Sternebewertung heute; Trend; Anzahl; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2145MeinFeedbackScore driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2150: Meine Reaktionszeit — Ø Zeit vom Batch-Empfang bis Abfahrt; Ziel <3 Min.; vs. Team-Ø; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2150MeineReaktionszeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2155a: Meine km-Effizienz — Eigene km/Auftrag heute; Vergleich Team-Ø; Tipp Routenwahl; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2155MeineKmEffizienz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2155b: Meine Tageskilometer — Eigene km heute; vs. Ziel; % Zielerreichung; Trend; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2155MeineTageskilometer driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2160: Meine Konsistenz — Eigene σ heute; Vergleich Team-Ø; Konsistenz-Score; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2160MeineKonsistenz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2165: Meine Spitzenzeit-Bilanz — Peak-Score; Stoßzeit- vs. Normalzeit-Aufträge; Team-Ø; Badge Rush-Hour-Profi wenn ≥80%; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2165MeineSpitzenzeitBilanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2170: Meine Wartezeit — Eigene Ø Wartezeit; Aufträge >5 Min.; vs. Team-Ø; Tipp Abholoptimierung; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2170MeineWartezeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2180: Mein Einsatz-Score — Aufträge/h heute; vs. Team-Ø; Score-Balken; Coaching-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2180MeinEinsatzScore driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2175: Tour-Stopp Echtzeit-Navigator — Kompakter Navigator mit Fortschritts-Ring, Stopp-Fokus, Navi-CTA, Vorschau nächste Stopps */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2175TourStoppEchtzeitNavigator
              stops={(activeBatch.stops ?? []).map((s: any, idx: number) => ({
                id: s.id,
                order_id: s.order_id,
                address: s.order?.kunde_adresse
                  ? `${s.order.kunde_adresse}${s.order.kunde_plz ? ', ' + s.order.kunde_plz : ''}`
                  : null,
                kunde_name: s.order?.kunde_name ?? null,
                telefon: s.order?.kunde_telefon ?? null,
                status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : 'offen',
                sort_order: s.reihenfolge ?? idx,
                eta_min: null,
              }))}
              currentStopIndex={(activeBatch.stops ?? []).findIndex((s: any) => !s.geliefert_am)}
              onNavigate={(addr) => { window.open(`https://maps.google.com/?q=${encodeURIComponent(addr)}`); }}
              onCall={(phone) => { window.open(`tel:${phone}`); }}
            />
          )}
          {/* Phase 2180: Schicht-Einnahmen-Prognose Live — Bisherige Einnahmen + Hochrechnung bis Schichtende; Ø/Lieferung; Ziel-Balken */}
          <FahrerPhase2180SchichtEinnahmenPrognoseLive
            driverId={driver.id}
            locationId={driver.location_id}
            isOnline={isOnline}
          />
          {/* Phase 2185: Meine Storno-Bilanz — Eigene Stornoquote; vs. Team-Ø; Trend; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2185MeineStornoBilanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2190: Mein Kundenfeedback — Eigene Sterne-Bewertung; Visualisierung; Team-Ø; Trend; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2190MeinKundenfeedback driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2195: Mein Verdienst Heute — Eigener Verdienst+Trinkgeld; vs. Team-Ø; Trend; Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2195MeinVerdienstHeute driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2203: Mein Schicht-Abschluss — Eigene Tagesleistung; Rang; Team-Ø; Motivations-Nachricht; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2203MeinSchichtAbschluss driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2208: Mein Schicht-Vergleich — Δ vs. gestern; Trend; Motivations-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2208MeinSchichtVergleich driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2213: Mein Bestzeit-Rekord — Schnellste Lieferzeit; Allzeit-Bestmarke; Rekord-Badge; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2213MeinBestzeitRekord driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2218: Mein Zuverlässigkeits-Score — Score + Trend; Warnung wenn hoch; isOnline-Guard; 2-Std-Polling */}
          <FahrerPhase2218MeinZuverlaessigkeitsScore driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2223: Meine Wartezeit-Bilanz — Ø Wartezeit + Trend; Coaching-Tipp; Team-Ø-Vergleich; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2223MeineWartezeitBilanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2228: Mein Energie-Level — Score + Empfehlung; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2228MeinEnergieLevel driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2233: Tour-Stop Smart-Navigator — Aktueller Stopp mit Countdown, Google-Maps-Link, Nächste 2 Stopps Vorschau; 30-Sek-Polling */}
          <FahrerPhase2233TourStopSmartNav driverId={driver.id} isOnline={isOnline} />
          {/* Phase 2237: Meine Schicht-Bilanz — Schicht-Score + Touren + Umsatz + Motivations-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2237MeineSchichtBilanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2241: Meine Routen-Effizienz — Score + km/Tour + Trend + Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2241MeineRoutenEffizienz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2246: Meine Reaktionszeit — Ø Reaktionszeit + Trend + Team-Ø + Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2246MeineReaktionszeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2251: Meine Pünktlichkeit — Quote + Trend + Team-Ø + Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2251MeinePuenktlichkeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2256: Meine Kundenbewertung — Ø Bewertung + Stern-Gauge + Trend + Team-Ø + Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2256MeineKundenbewertung driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2261: Mein Kilometerstand — Gesamt-km + Fortschrittsbalken + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2261MeinKilometerstand driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2266: Meine Abholwartezeit — Eigene Ø Wartezeit + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2266MeineAbholwartezeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2271: Meine Tour-Effizienz — Touren/Std + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2271MeineTourEffizienz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2276: Mein Lieferfenster — Quote pünktlich im Fenster + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2276MeinLieferfenster driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2293: Mein Durchsatz — B/h + Trend + Fortschrittsbalken + Team-Ø + Coaching-Tipp; isOnline-Guard; 1-Std-Polling */}
          <FahrerPhase2293MeinDurchsatz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2298: Meine Schicht-Bilanz — Schichtdauer+Touren+km+Kosten, Fortschrittsbalken, Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2298MeineSchichtBilanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2303: Meine Pausen — Letzte Pause + Anzahl Pausen; Pflichtpausen-Erinnerung; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase2303MeinePausen driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2309: Meine Distanz — Eigene km heute + Ø km/Tour + Tempo; Team-Ø Vergleich; Coaching-Tipp; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase2309MeineDistanz driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2313: Meine km — Gesamt-km heute + km/Tour + Kosten-Schätzung; Fortschrittsbalken 0–200km; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2313MeineKm driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2318: Mein Tempo — Ø km/h heute + Trend vs. Vorwoche + Team-Ø Vergleich; Coaching-Tipp; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase2318MeinTempo driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2323: Meine Wartezeit — Ø Wartezeit heute + Trend vs. Vorwoche + Team-Ø; Coaching-Tipp; isOnline-Guard; 15-Min-Polling */}
          <FahrerPhase2323MeineWartezeit driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2332: Meine Storno-Rate — Storno-Rate heute + Trend + Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2332MeineStornoRate driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2336: Mein Qualitäts-Score — Score (Pünktl./Storno/Bewert./Wartezt.); Ring; Trend; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2336MeinQualitaetsScore driverId={driver.id} locationId={driver.location_id} isOnline={isOnline} />
          {/* Phase 2340: Tour-Stops Navigation Pro — Hero-Stopp (nächster Stopp) + alle Stopps expandierbar + Nav-Link + Anruf + ETA je Stopp; 20-Sek-Polling */}
          <FahrerPhase2340TourStopsNavigationsPro driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2346: Meine Schicht-Effizienz — Score + Touren/h + Wartezeit + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2346MeineSchichtEffizienz driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2350: Mein Liefergebiet — Eigene Zone + Auslastung + Ø Distanz + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2350MeinLiefergebiet locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2355: Meine Bewertungen — Eigener Schnitt + Sterne-Visual + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2355MeineBewertungen driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2360: Meine Pünktlichkeit — Eigene Quote + Ampel + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2360MeinePuenktlichkeit driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2365: Mein Trinkgeld — Ø Trinkgeld/Tour + Gesamt + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2365MeinTrinkgeld driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2370: Meine Lieferzeit — Ø Min + Fortschrittsbalken + KPI-Grid + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2370MeineLieferzeit driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2375: Meine Auslastung — Rate groß + Farbcode + Schichtdauer + Fahrzeit + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2375MeineAuslastung driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2380: Meine Reaktionszeit — Ø Sek + Fortschrittsbalken (0–180s, Ziel 60s) + KPI-Grid + Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2380MeineReaktionszeit driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2385: Meine Abbruchquote — Quote groß + Farbcode; KPI-Grid (Abbrüche/Touren/Trend/Team-Ø); Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2385MeineAbbruchquote driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2390: Meine Kilometer — Gesamt-km groß + Farbcode; Ø km/Tour; KPI-Grid (Touren/Kürzeste/Trend/Team-Ø); Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2390MeineKilometer driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2395: Meine Pausenzeit — Ø Pause groß + Farbcode; Balken 0–40Min; KPI-Grid (Pausen/Touren/Trend/Team-Ø); Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2395MeinePausenzeit driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2400: Meine Touren-Anzahl — Touren groß + Farbcode; Balken 0–14; KPI-Grid (VW/Ziel/Trend/Team-Ø); Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2400MeineTourenAnzahl driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2405: Mein Effizienz-Score — Score 0–100 groß; Balken; 5-Faktoren-Aufschlüsselung; Coaching-Tipp je Ampelzone; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2405MeinEffizienzScore driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2410: Meine Schicht-Bilanz — Einnahmen groß + Farbcode; 4-KPI-Grid Touren/km/Bewertung/Schichtdauer; Trend vs. VW; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2410MeineSchichtBilanz driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2415: Mein Umsatz/h — €/h groß + Farbcode; Balken 0–20 €/h mit Ziel-Linien; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2415MeinUmsatzProStunde driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2420: Meine Trinkgeld-Quote — % groß + Farbcode; Balken 0–20 % mit Ziel-Linien bei 5 % und 10 %; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2420MeineTrinkgeldQuote driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2425: Tour-Stops & Navigation Hub — Alle Tour-Stops mit Status + Fortschrittsbalken + Stop-Dots + Navi-Button + Anruf-Button; aktiver Stop hervorgehoben */}
          <FahrerPhase2425TourStopsNaviHub driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2427: Meine Bewertung — Ø★ groß + Farbcode; Stern-Visualisierung; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2427MeineBewertung driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2432: Meine Pünktlichkeit — % groß + Farbcode; Balken 0–100% mit Ziel-Linien 75%/90%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2432MeinePuenktlichkeit driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2428: Tour-Stopp Navigator Ultra — alle Stopps + Status-Ampel, Next-Stop Hero-Karte, Fortschrittsbalken, Navi-Button, Anruf-Button, Notiz-Anzeige, 20-Sek-Polling */}
          <FahrerPhase2428TourStoppNavigatorUltra driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2433: Meine Überstunden — h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2433MeineUeberstunden driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2438: Meine Nachtschicht — h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2438MeineNachtschicht driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2443: Meine Wochenend-Schicht — h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2443MeineWochenendSchicht driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2448: Meine Feiertagsschicht — h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2448MeineFeiertagsschicht driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2453: Mein Schicht-Balance-Score — % groß + Farbcode; Balken 0–100% mit Ziel-Linien 60%/80%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2453MeinSchichtBalanceScore driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2458: Mein Effizienz-Index — Score groß + Ring-Gauge 0–100 mit Ziel-Linie 80; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2458MeinEffizienzIndex driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2463: Mein Kapazitäts-Score — Score groß + Farbcode; Fortschrittsbalken 0–100% mit Ziel-Linien 60%/80%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2463MeinKapazitaetScore driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2469: Meine Depot-Rückkehr-ETA — ETA groß + Farbcode; Fortschrittsbalken 0–45 min mit Ziel-Linien 15/30 min; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2469MeineRueckkehrDepotEta driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2474: Meine Lieferzeit-Effizienz — Ø-Zeit groß + Farbcode; Balken 0–45 min mit Ziel-Linien 20/30 min; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2474MeineLieferzeitEffizienz driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2479: Meine Stoppzeit — Ø-Zeit groß + Farbcode; Balken 0–15 min mit Ziel-Linien 5/10 min; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2479MeineStoppzeit driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2484: Meine KM-Effizienz — km/Auftrag groß + Farbcode; Balken 0–15km mit Ziel-Linien 5/10km; KPI-Grid Aufträge/Effizienz/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2484MeineKmEffizienz driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2489: Meine Touren-Anzahl — Touren groß + Farbcode; Balken 0–15 mit Ziel-Linien 6/10/12; KPI-Grid VW/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2489MeineTourenAnzahl driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2494: Meine Pausen-Compliance — % groß + Farbcode; Balken 0–120% mit Ziel-Linie 100%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2494MeinePausenCompliance driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2499: Meine Liefertreue — % groß + Farbcode; Balken 0–100% mit Ziel-Linien 85%/95%; KPI-Grid VW/Team-Ø/Pünktlich/Gesamt; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2499MeineLiefertreue driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2504: Mein Durchsatz — Lieferungen/h groß + Farbcode; Balken 0–5/h mit Ziel-Linien 2/3/h; KPI-Grid VW/Team-Ø/Touren/Aktiv-h; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2504MeinDurchsatz driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2509: Mein Umsatz — €-Wert groß + Farbcode; Balken 0–300€ mit Ziel-Linien 100/200€; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2509MeinUmsatz driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2519: Mein Trinkgeld — €/Tour groß + Farbcode; Balken 0–2€ mit Ziel-Linien 0,50/0,75€; KPI-Grid VW/Gesamt/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2519MeinTrinkgeld driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2526: Meine Akzeptanzrate — % groß + Farbcode; Balken 0–100% mit Ziel-Linien 70%/90%; KPI-Grid VW/Team-Ø/Angenommen/Angeboten; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2526MeineAkzeptanzrate driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2531: Meine Wartezeit am Depot — Min groß + Farbcode; Balken 0–30min mit Ziel-Linien 10/20min; KPI-Grid VW/Trend/Team-Ø/Intervalle; Coaching-Tipp; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase2531MeineWartezeitDepot driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2600: Smart Tour-Stopp Navigator Final — Aktueller Stopp + Navigation + Telefon + Bestätigung; Stop-Liste mit Status-Dots; ETA; 1-Sek-Tick + 30-Sek-Polling */}
          <FahrerPhase2600SmartTourStoppNavigatorFinal
            batchId={activeBatch?.id ?? null}
            stops={(activeBatch?.stops ?? []).map((s: any) => ({
              id: s.id,
              reihenfolge: s.reihenfolge ?? s.stop_number ?? 0,
              adresse: s.order?.kunde_adresse ?? s.address ?? s.kunde_adresse ?? null,
              kunde_name: s.order?.kunde_name ?? s.customer_name ?? s.kunde_name ?? null,
              kunde_telefon: s.order?.kunde_telefon ?? s.customer_phone ?? s.kunde_telefon ?? null,
              angekommen_am: s.angekommen_am ?? s.arrived_at ?? null,
              geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
              eta_min: s.eta_min ?? null,
              lat: s.lat ?? null,
              lng: s.lng ?? null,
            }))}
            onConfirm={markDelivered}
          />
          {/* Phase 2523: Tour-Stopp Smart-Navi Pro — Hero-Fokus nächster Stopp; 1-Tap Navigation Google/Apple/Waze; Anruf-Button; Fortschrittsleiste; Alle Stopps aufklappbar; mobile-optimiert */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <div className="px-4">
              <FahrerPhase2523TourStoppSmartNaviPro
                stops={(activeBatch.stops ?? []).map((s: any) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge ?? s.stop_number ?? 0,
                  adresse: s.order?.kunde_adresse ?? s.address ?? s.kunde_adresse ?? null,
                  plz: s.order?.kunde_plz ?? s.kunde_plz ?? null,
                  kunde_name: s.order?.kunde_name ?? s.customer_name ?? s.kunde_name ?? 'Kunde',
                  kunde_telefon: s.order?.kunde_telefon ?? s.customer_phone ?? s.kunde_telefon ?? null,
                  gesamtbetrag: s.order?.gesamtbetrag ?? s.gesamtbetrag ?? null,
                  geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
                  notiz: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? s.notes ?? null,
                  eta_min: s.eta_min ?? null,
                }))}
                batchId={activeBatch.id}
                onConfirmDelivered={markDelivered}
              />
            </div>
          )}
          {/* Phase 2510: Tour-Stopp Navigations-Hub — priorisierte Stop-Liste; One-Tap Navigation; Kundentelefon; Stop-Bestätigung; Next-Stop-Fokus-Karte; 30-Sek-Polling */}
          <FahrerPhase2510TourStoppNavigationsHub driverId={driver.id} />
          {/* Phase 2467: Tour-Stops Navigation Live Kommando — Alle Stops mit Status-Dots; Hero Next-Stop; Navi-Button; Anruf-Button; Notiz-Alert; Fortschrittsbalken; 20-Sek-Polling */}
          <FahrerPhase2467TourStopsNavigationLiveKommando fahrerSchichtId={activeBatch?.id ?? null} isOnline={isOnline} />
          {/* Phase 2437: Meine Reaktionszeit — Ø-Min groß + Farbcode; Balken 0–10min mit Ziel-Linien 3min/7min; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp */}
          <FahrerPhase2437MeineReaktionszeit driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2442: Meine Storno-Quote — % groß + Farbcode; Balken 0–20% mit Ziel-Linien 5%/10%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp */}
          <FahrerPhase2442MeineStornoQuote driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2447: Meine Schichtdauer — h groß + Farbcode; Balken 0–12h mit Ziel-Linien 8h/10h; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp */}
          <FahrerPhase2447MeineUeberstunden driverId={driver.id} locationId={driver.location_id ?? null} isOnline={isOnline} />
          {/* Phase 2380: Tour-Stopp Navigator Ultra — Stopp-Timeline mit Reihenfolge, ETA-Ampel, Navigations-Link, Anruf-Button, Fortschrittsleiste */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2380TourStoppNavigatorUltra
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? s.stop_number ?? 0,
                adresse: s.order?.kunde_adresse ?? s.address ?? s.kunde_adresse ?? null,
                kundeName: s.order?.kunde_name ?? s.customer_name ?? null,
                telefon: s.order?.kunde_telefon ?? s.customer_phone ?? null,
                eta_min: s.eta_min ?? null,
                geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
                notiz: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? s.notes ?? null,
              }))}
              aktiverStoppId={null}
            />
          )}
          {/* Phase 2328: Smart Tour-Stopps Navigation — Hero-Stopp + Fortschrittsbalken + expandierbare Stopp-Liste + Google-Maps-Nav + Anruf-Button */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2328SmartTourStopsNavigation
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? s.stop_number ?? 0,
                kunde_name: s.order?.kunde_name ?? s.customer_name ?? s.kunde_name ?? null,
                kunde_adresse: s.order?.kunde_adresse ?? s.address ?? s.kunde_adresse ?? null,
                kunde_telefon: s.order?.kunde_telefon ?? s.customer_phone ?? s.kunde_telefon ?? null,
                gesamtbetrag: s.order?.gesamtbetrag ?? s.gesamtbetrag ?? null,
                geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
                eta_min: s.eta_min ?? null,
                distanz_km: s.distanz_km ?? null,
                notizen: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? s.notes ?? s.notizen ?? null,
              }))}
              batchId={activeBatch.id}
            />
          )}
          {/* Phase 2285: Smart Tour Stop Navigator Ultra — expandierbare Stopp-Karten, Status-Farbkodierung, Navigations-Link, Anruf-Button */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2285SmartTourStopNavigatorUltra
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? s.stop_number ?? 0,
                kunde_name: s.customer_name ?? s.kunde_name ?? null,
                kunde_adresse: s.address ?? s.kunde_adresse ?? null,
                kunde_telefon: s.customer_phone ?? s.kunde_telefon ?? null,
                gesamtbetrag: s.gesamtbetrag ?? null,
                angekommen_am: s.angekommen_am ?? null,
                geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
                eta_min: s.eta_min ?? null,
                distanz_km: s.distanz_km ?? null,
              }))}
              batchId={activeBatch.id}
            />
          )}
          {/* Phase 2290: Tour-Stopp-Navi-Kommando — expandierbare Stopp-Karten, Google Maps / Waze Navigation, Stop-Status-Farbkodierung */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2290TourStoppNaviKommando
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? s.stop_number ?? 0,
                kunde_name: s.customer_name ?? s.kunde_name ?? null,
                kunde_adresse: s.address ?? s.kunde_adresse ?? null,
                kunde_telefon: s.customer_phone ?? s.kunde_telefon ?? null,
                gesamtbetrag: s.gesamtbetrag ?? null,
                geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
                eta_min: s.eta_min ?? null,
                distanz_km: s.distanz_km ?? null,
                notizen: s.notes ?? s.notizen ?? null,
              }))}
              batchId={activeBatch.id}
            />
          )}
          {/* Phase 2295: Tour-Stopp Navigation Cockpit — Alle Stopps, GPS-Nav (Google/Waze/Apple), ETA-Countdown */}
          <FahrerPhase2295TourStoppNavigationCockpit />
          {/* Phase 2300: Smart Tour Navigation Pro — Farbkodierte Stopp-Liste, Navi-Button, Anruf, ETA, Fortschrittsbalken */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2300SmartTourNavPro
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? s.stop_number ?? 0,
                kunde_name: s.customer_name ?? s.kunde_name ?? null,
                kunde_adresse: s.address ?? s.kunde_adresse ?? null,
                kunde_telefon: s.customer_phone ?? s.kunde_telefon ?? null,
                gesamtbetrag: s.gesamtbetrag ?? null,
                geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
                eta_min: s.eta_min ?? null,
                distanz_km: s.distanz_km ?? null,
                notizen: s.notes ?? s.notizen ?? null,
              }))}
              batchId={activeBatch.id}
            />
          )}
          {/* Phase 2200: Smart-Stopp-Navi-Cockpit — 1-Tap Navigation, Stopp-Bestätigung, ETA-Timeline */}
          <FahrerPhase2200SmartStoppNaviCockpit />
          {/* Phase 2028: Smart-Tour-Stopp-Abschluss-Navigator — Aktueller Stopp groß, Navi + Anruf + Abliefern-CTA, Vorschau nächste Stopps */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2028SmartTourStoppAbschlussNavigator
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                address: s.address,
                customer_name: s.customer_name,
                customer_phone: s.customer_phone,
                status: s.status,
                scheduled_for: s.scheduled_for,
                notes: s.notes,
                lat: s.lat,
                lng: s.lng,
                order_id: s.order_id,
                items: s.items,
              }))}
            />
          )}
          {/* Phase 2000: Smart Tour-Stop Kommandant — Konsolidierter Tour-Navigator: alle Stopps, Navi-App-Auswahl, Bestätigung */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2000SmartTourStopKommandant
              stops={(activeBatch.stops ?? []).map((s: any) => ({
                id: s.id,
                reihenfolge: s.reihenfolge ?? null,
                sequence: s.sequence ?? s.reihenfolge ?? null,
                geliefert_am: s.geliefert_am ?? null,
                completed_at: s.completed_at ?? null,
                angekommen_am: s.angekommen_am ?? null,
                order: s.order ? {
                  id: s.order.id,
                  bestellnummer: s.order.bestellnummer ?? null,
                  kunde_name: s.order.kunde_name ?? null,
                  kunde_adresse: s.order.kunde_adresse ?? null,
                  kunde_plz: s.order.kunde_plz ?? null,
                  kunde_lat: s.order.kunde_lat ?? s.lat ?? null,
                  kunde_lng: s.order.kunde_lng ?? s.lng ?? null,
                  gesamtbetrag: s.order.gesamtbetrag ?? null,
                  bezahlt: s.order.bezahlt ?? null,
                  zahlungsart: s.order.zahlungsart ?? null,
                  kunde_telefon: s.order.kunde_telefon ?? null,
                  kunde_notiz: s.order.kunde_notiz ?? null,
                  kunde_lieferhinweis: s.order.kunde_lieferhinweis ?? null,
                } : null,
              }))}
            />
          )}
          {/* Phase 2000: Smart Tour Nav Hub — Hero-Stop + ETA-Countdown + Nächste-Stopps-Liste + Tour-Score + Schnell-Aktionen */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase2000SmartTourNavHub
              stops={(activeBatch.stops ?? []).map((s: any, i: number) => ({
                id: s.id,
                sequence: s.reihenfolge ?? s.sequence ?? i,
                status: s.geliefert_am ? 'completed' : s.angekommen_am ? 'active' : 'pending',
                address: [s.order?.kunde_adresse, s.order?.kunde_plz].filter(Boolean).join(', ') || s.address || '',
                customerName: s.order?.kunde_name ?? null,
                customerPhone: s.order?.kunde_telefon ?? null,
                etaMin: s.eta_min ?? null,
                notes: s.order?.kunde_notiz ?? s.order?.kunde_lieferhinweis ?? null,
                lat: s.order?.kunde_lat ?? s.lat ?? null,
                lng: s.order?.kunde_lng ?? s.lng ?? null,
                orderId: s.order?.id,
                orderTotal: s.order?.gesamtbetrag ?? null,
                paymentMethod: s.order?.zahlungsart ?? null,
              }))}
              tourScore={(activeBatch as any).tour_score ?? null}
            />
          )}
          {/* Phase 1851: Smart-Tour-Stopp Final-Kommando — Primäre Navigations-Karte; Countdown + Adresse + Schnellaktionen + Nächste-Stopps-Vorschau */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase1851SmartTourStoppFinalKommando
              stops={(activeBatch.stops ?? []) as any}
            />
          )}
          {/* Tour-Stopp-Navi-Panel — Vollständige Stopp-Liste mit Status, ETA, Navigation (Google/Apple/Waze) und Telefon-Quick-Link */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <TourStoppNaviPanel
              stops={(activeBatch.stops ?? []).map((s: any, i: number) => ({
                id: s.id,
                sequence: s.reihenfolge ?? i,
                status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : 'neu',
                kunde_name: s.order?.kunde_name ?? s.kunde_name ?? null,
                adresse: s.order?.kunde_adresse ?? s.kunde_adresse ?? s.address ?? null,
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                telefon: s.order?.kunde_telefon ?? s.kunde_telefon ?? null,
                estimated_arrival: s.estimated_arrival ?? null,
                notizen: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? null,
                bestellnummer: s.order?.bestellnummer ?? s.bestellnummer ?? null,
              }))}
            />
          )}
          {/* Phase 1820: Smart Tour-Stop-Hub — Nächster Stopp Fokus-Karte + ETA-Ring + Bezahl-Warnung + Kunden-Notizen + kompakte Stopp-Liste */}
          {activeBatch && (activeBatch.stops ?? []).length > 0 && (
            <FahrerPhase1820SmartTourStopHub
              stops={(activeBatch.stops ?? []) as any}
              batchStartedAt={activeBatch.started_at ?? null}
            />
          )}
          {/* Phase 1784: Eigene Pause-Erinnerung — Alert bei >6h Schicht ohne 30 Min Pause; Countdown nächste Pause; isOnline-Guard; 5-Min-Polling */}
          <FahrerPhase1784EigenePauseErinnerung
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1799: Mein Qualitäts-Score-Verlauf — Score letzte 7 Tage Miniaturdiagramm + Grade + Team-Vergleich; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1799MeinQualitaetsScoreVerlauf
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1779: Meine Schicht-Bilanz-Karte — Letzte Tour Einnahmen + Bewertung + km; 30-Min-Polling; isOnline-Guard */}
          <FahrerPhase1779MeineSchichtBilanzKarte
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1774: Mein Schicht-Einnahmen-Zähler — Echtzeit-Einnahmen + Prognose Schichtende + Zielfortschrittsleiste; isOnline-Guard; 5-Min-Polling */}
          <FahrerPhase1774MeinSchichtEinnahmenZaehler
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1779: Meine Schicht-Bilanz-Karte — letzte Tour: Stops/Zeit/Bewertung/km; Schicht-Gesamt; isOnline-Guard; 30-Min-Polling */}
          <FahrerPhase1779MeineSchichtBilanzKarte
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1745: Eigene Reaktionszeit-Anzeige — Ø Reaktionszeit + Team-Vergleich; isOnline-Guard; 20-Min-Polling */}
          <FahrerPhase1745EigeneReaktionstanzAnzeige
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1740: Ziel-Erreicht-Animation — Erfolgs-Animation wenn Stopp geliefert; Auto-dismiss 3 Sek; isOnline-Guard */}
          <FahrerPhase1740ZielEreichtAnimation
            isOnline={isOnline}
            lastDeliveredAt={
              activeBatch?.stops
                ? ([...activeBatch.stops]
                    .filter((s: any) => s.geliefert_am)
                    .sort((a: any, b: any) => new Date(b.geliefert_am).getTime() - new Date(a.geliefert_am).getTime())[0]?.geliefert_am ?? null)
                : null
            }
          />
          {/* Phase 1735: Pause-Reminder — Wenn Fahrer >90 Min online ohne Pause: Pause-Empfehlung; isOnline-Guard; 1-Min-Polling */}
          <FahrerPhase1735PauseReminder
            driverId={driver?.id ?? null}
            isOnline={isOnline}
            onlineSeit={status?.online_seit ?? null}
          />
          {/* Phase 1730: Zonen-Tipp-Karte — Zone mit höchster Nachfrage + wenigsten Fahrern; Empfehlung; isOnline-Guard; 10-Min-Polling */}
          <FahrerPhase1730ZonenTippKarte
            driverId={driver?.id ?? null}
            locationId={driver?.location_id ?? null}
            isOnline={isOnline}
          />
          {/* Phase 1716: Schicht-Verdienst-Hochrechnung — Live-Prognose Schichtende-Verdienst basierend auf aktuellem Tempo; 5-Min-Polling; API+Mock-Fallback */}
          <FahrerPhase1716SchichtVerdienstHochrechnung
            driverId={driver?.id ?? null}
            isOnline={isOnline}
          />
        </div>
        {/* Phase 1709: Smart-Tour-Stopp-Live-Nav — Alle Tour-Stopps mit Nummern/Done-Status + Countdown-ETA + erweiterbare Adresse + Navigations-CTA; isOnline-Guard; kein Polling */}
        {activeBatch?.stops && activeBatch.stops.length > 0 && (
          <FahrerPhase1709SmartTourStoppLiveNav
            stops={activeBatch.stops as any}
            batchId={activeBatch.id}
            totalEtaMin={activeBatch.total_eta_min ?? null}
            startedAt={activeBatch.started_at ?? null}
            isOnline={isOnline}
          />
        )}
        {/* Phase 1710: Smart-Tour-Stopp-Navigation Ultra — Nummernierte Stopps mit Done-Status, aufklappbare Adress+Noti-Details, Navigations-CTA, Telefon-Button, ETA-Countdown je Stopp */}
        {activeBatch?.stops && activeBatch.stops.length > 0 && (
          <FahrerPhase1710SmartTourStoppNavigationUltra
            stops={activeBatch.stops as any}
            batchId={activeBatch.id}
            totalEtaMin={activeBatch.total_eta_min ?? null}
            startedAt={activeBatch.started_at ?? null}
            isOnline={isOnline}
          />
        )}
        {/* Phase 1724: Smart-Tour-Stopp-Navigator-Final — Aktueller Stopp prominent + Navigations-CTA + ETA-Countdown + Nächster-Stopp-Vorschau + aufklappbare Gesamt-Liste */}
        {activeBatch?.stops && activeBatch.stops.length > 0 && (
          <FahrerPhase1724SmartTourStoppNavigatorFinal
            stops={activeBatch.stops as any}
            batchId={activeBatch.id}
            totalEtaMin={activeBatch.total_eta_min ?? null}
            startedAt={activeBatch.started_at ?? null}
            isOnline={isOnline}
          />
        )}
        {/* Phase 1740: Smart-Tour-Navigation-Command — Kompakter Tour-Navigator: aktueller Stopp mit Nav-CTA + Telefonanruf + Nächste-Stopps-Liste + ETA-Fortschritt */}
        {activeBatch?.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1740SmartTourNavCommand
              stops={activeBatch.stops as any}
              currentBatchId={activeBatch.id}
            />
          </div>
        )}
        {/* Phase 1737: Tour-Stopp-Ultra-Final-Navigator — Fortschrittsbalken + aktueller Stopp mit Navigation+Telefon+Zustellung-CTA + Nächste-Stopps-Liste; Google-Maps-Link */}
        {activeBatch?.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1737TourStoppUltraFinalNavigator
              stops={activeBatch.stops as any}
              currentBatchId={activeBatch.id}
            />
          </div>
        )}
        {/* Phase 1530: Tagesabschluss-Berichts-Karte — Vollständige Schicht-Zusammenfassung wenn offline + alle Stopps geliefert */}
        <div className="px-4">
          <FahrerPhase1530TagesabschlussBerichtsKarte
            isOnline={isOnline}
            stops={activeBatch?.stops as any}
            schichtStartedAt={status?.online_seit ?? undefined}
          />
        </div>
        {/* Phase 1526: Smart-Tour-Stopp-Cockpit — Aktuelle Stops mit Navigation-CTA, ETA-Countdown und nächste Stops-Liste */}
        {activeBatch?.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1526SmartTourStoppCockpit stops={activeBatch.stops as any} />
          </div>
        )}
        {/* Phase 1454: Schicht-Gewinn-Ring-Cockpit — KPI-Ringe Einnahmen/Stops/Zeit + Gewinn-Fortschrittsleiste */}
        <div className="px-4">
          <FahrerPhase1454SchichtGewinnRingCockpit
            driverId={driver.id}
            isOnline={isOnline}
            schichtStart={status?.online_seit ?? null}
            completedStops={activeBatch?.stops?.filter((s: any) => !!s.geliefert_am).length ?? 0}
            totalStops={activeBatch?.stops?.length ?? 0}
            earningsToday={todayStats?.estEarnings ?? 0}
            earningsGoal={80}
            tipToday={0}
            kmToday={0}
          />
        </div>
        {/* Phase 1452: Liefer-Streak-Anzeige — Streak-Tage + Highscore */}
        <div className="px-4">
          <FahrerPhase1452LieferStreakAnzeige driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1457: Wochen-Rückblick-Widget — Letzte 7 Tage Stopps + Beste-Tag-Badge + Trend */}
        <div className="px-4">
          <FahrerPhase1457WochenRueckblickWidget driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1450: Tour-Stopp-Navigations-Final — Alle Tour-Stops mit Navigation, Countdown und Schnell-Aktionen */}
        <div className="px-4">
          <FahrerPhase1450TourStoppNavigationsFinal
            driverName={`${driver.vorname} ${driver.nachname}`}
            stops={activeBatch?.stops?.map((s, i) => ({
              id: s.id,
              sequence: s.reihenfolge ?? (i + 1),
              address: s.order?.kunde_adresse ?? `Stopp ${i + 1}`,
              customerName: s.order?.kunde_name ?? `Kunde ${i + 1}`,
              phone: s.order?.kunde_telefon ?? null,
              notes: s.order?.kunde_notiz ?? null,
              status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
              etaMin: null,
              distanceKm: null,
              orderAmount: s.order?.gesamtbetrag ?? null,
            }))}
          />
        </div>
        {/* Phase 1442: Heimweg-Assistent — Nach letzter Lieferung: Maps-Link + Heimkehrzeit + Schicht-Bilanz */}
        <div className="px-4">
          <FahrerPhase1442HeimwegAssistent
            activeBatch={activeBatch ? {
              id: activeBatch.id,
              status: activeBatch.status,
              stops: activeBatch.stops?.map(s => ({
                id: s.id,
                status: s.geliefert_am ? 'geliefert' : 'offen',
                geliefert_am: s.geliefert_am ?? null,
                completed_at: null,
                reihenfolge: s.reihenfolge ?? 0,
                trinkgeld: null,
                bestellwert: s.order?.gesamtbetrag ?? null,
              })) ?? [],
              started_at: activeBatch.started_at ?? null,
              total_eta_min: activeBatch.total_eta_min ?? null,
              gesamtumsatz: activeBatch.stops.reduce((sum, s) => sum + (s.order?.gesamtbetrag ?? 0), 0),
            } : null}
            driverId={driver.id}
            isOnline={isOnline}
          />
        </div>
        {/* Phase 1410: Smart-Heimkehr-Navigator — Nach letztem Stopp: Heimkehr-Anzeige + Navigations-Buttons (Google/Waze) + ETA */}
        <div className="px-4">
          <FahrerPhase1410SmartHeimkehrNavigator
            activeBatch={activeBatch ? { id: activeBatch.id, status: activeBatch.status, stops: activeBatch.stops?.map(s => ({ id: s.id, geliefert_am: s.geliefert_am ?? null, completed_at: null, reihenfolge: s.reihenfolge ?? 0 })) ?? [] } : null}
            restaurantLat={null}
            restaurantLng={null}
            restaurantName="Restaurant"
            driverPos={driverPos}
          />
        </div>
        {/* Phase 1350: Tour-Stopp-Navigator-Plus — Vollständige Stop-Liste mit Ampel, aktivem Stopp hervorgehoben, Kunden-Tel + Navigation */}
        <div className="px-4">
          <FahrerPhase1350TourStoppNavigatorPlus
            batchId={activeBatch?.id ?? null}
            stops={activeBatch?.stops?.map((s, i) => ({
              id: s.id,
              position: s.reihenfolge ?? i + 1,
              status: s.geliefert_am ? 'geliefert' : s.angekommen_am ? 'unterwegs' : 'ausstehend',
              kunde_name: s.order?.kunde_name ?? null,
              kunde_adresse: s.order?.kunde_adresse ?? null,
              kunde_plz: s.order?.kunde_plz ?? null,
              kunde_lat: s.order?.kunde_lat ?? null,
              kunde_lng: s.order?.kunde_lng ?? null,
              kunde_telefon: s.order?.kunde_telefon ?? null,
              bestellnummer: s.order?.bestellnummer ?? null,
              gesamtbetrag: s.order?.gesamtbetrag ?? null,
              zahlungsart: (s.order as { zahlungsart?: string | null } | null)?.zahlungsart ?? null,
              notiz: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? null,
            })) ?? []}
          />
        </div>
        {/* Phase 1310: Live-Stopp-Navigator — Alle Stopps mit GPS-Links (Google/Waze) + ETA-Countdown + Ankunfts-/Liefer-Buttons */}
        {activeBatch && activeBatch.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1310LiveStoppNavigator
              driverId={driver.id}
              isOnline={isOnline}
              batchStartedAt={activeBatch.started_at}
              stops={activeBatch.stops.map((s, i) => ({
                id: s.id,
                stop_nummer: s.reihenfolge ?? i + 1,
                kunde_name: s.order.kunde_name,
                adresse: s.order.kunde_adresse ?? '',
                plz: s.order.kunde_plz,
                lat: s.order.kunde_lat,
                lng: s.order.kunde_lng,
                telefon: s.order.kunde_telefon ?? null,
                eta_min: activeBatch.total_eta_min != null
                  ? Math.round((activeBatch.total_eta_min / activeBatch.stops.length) * (i + 1))
                  : null,
                gesamtbetrag: s.order.gesamtbetrag,
                status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
              }))}
            />
          </div>
        )}
        {/* Phase 1279: Kunden-Zufriedenheits-Schnell-Poll — Daumen oben/unten nach Lieferung + Kommentar */}
        <div className="px-4">
          <FahrerPhase1279KundenzufriedenheitsSchnellPoll driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1284: Tour-Stop Navigation Dashboard — Alle Stopps + GPS-Links (Google/Apple/Waze) + Ankunfts-/Liefer-Buttons */}
        {activeBatch && activeBatch.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1284TourStopNavigationDashboard
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          </div>
        )}

        {/* Phase 1206: Zonen-Vertrautheits-Score — Wie gut kennt der Fahrer jede Zone + Empfehlung */}
        <div className="px-4">
          <FahrerPhase1206ZonenVertrautheitsScore driverId={driver.id} isOnline={isOnline} />
        </div>
        {/* Phase 1206: Tour-Stopp-Navigation-Live-Kommando — Nächster Stopp + Countdown + Nav-Link + Stop-Vorschau */}
        {activeBatch && activeBatch.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1206TourStoppNavigationLiveKommando
              stops={activeBatch.stops as any}
              tourStartedAt={activeBatch.started_at}
            />
          </div>
        )}
        {/* Phase 1004: Smart-Navigation-Hub-Ultra — Nächster Stopp hervorgehoben mit Deep-Links (Google/Apple/Waze), Stopp-Abschluss-Button, Fortschrittsleiste */}
        {activeBatch && activeBatch.stops && activeBatch.stops.length > 0 && (
          <div className="px-4">
            <FahrerPhase1004SmartNavigationHubUltra
              stops={activeBatch.stops as any}
              batchStatus={activeBatch.status}
            />
          </div>
        )}

        {/* Phase 1182: Schicht-Momentum-Tracker — Live Stopps/Stunde + Hochrechnung Tagesende-Verdienst */}
        <div className="px-4">
          <FahrerPhase1182SchichtMomentumTracker driverId={driver.id} isOnline={isOnline} />
        </div>

        {/* Phase 1146: Stopp-Qualitäts-Check — Schnelle Selbstbewertung nach Lieferung (Übergabe, Freundlichkeit, Pünktlichkeit) */}
        {activeBatch && isOnline && (
          <div className="px-4">
            <FahrerPhase1146StoppQualitaetsCheck
              stopId={activeBatch.id}
              driverId={driver.id}
              customerName={activeBatch.stops[0]?.order?.kunde_name}
            />
          </div>
        )}

        {/* Phase 1125: Tour-Stopp-Navigations-Hub — Aktueller + nächster Stopp, ETA-Countdown, Entfernung + Navi-Button */}
        {activeBatch && (
          <div className="px-4">
            <FahrerPhase1125TourStoppNavigationsHub driverId={driver.id} isOnline={isOnline} activeBatch={activeBatch} />
          </div>
        )}

        {/* Phase 1081: Schicht-Abschluss-Statistik-Screen — Tages-Summary Stopps/Umsatz/km/Trinkgeld + Motivations-Badge */}
        {!isOnline && !activeBatch && (
          <div className="px-4">
            <FahrerPhase1081SchichtAbschlussStatistikScreen driverId={driver.id} isOnline={isOnline} />
          </div>
        )}

        {/* Phase 1178: Tour-Zusammenfassung-Screen — Abschluss-Screen nach Tour mit km/Stopps/Trinkgeld/Ø-Bewertung + Tier */}
        {!activeBatch && isOnline && lastCompletedBatchId && (
          <div className="px-4">
            <FahrerPhase1178TourZusammenfassung driverId={driver.id} lastBatchId={lastCompletedBatchId} />
          </div>
        )}

        {/* Tagesabschluss-Badge: persistente Schicht-Zusammenfassung nach Schichtende */}
        <TagesabschlussBadge
          isOnline={isOnline}
          driverId={driver.id}
          shiftData={tagesabschlussData}
          rankData={rankData}
        />

        {/* Schicht-Statistik — immer sichtbar wenn kein aktiver Batch */}
        {!activeBatch && <SchichtStats driverId={driver.id} isOnline={isOnline} />}

        {/* Tempo-Karte: rollendes Liefertempo der letzten 2 Stunden */}
        {!activeBatch && isOnline && <FahrerPaceCard driverId={driver.id} />}

        {/* Phase 94: Schicht-Dauer-Anzeige — wie lange ist der Fahrer schon online? */}
        {!activeBatch && isOnline && status?.online_seit && (
          <FahrerSchichtCountdown onlineSeit={status.online_seit} />
        )}

        {/* Heutige Stopps-Verlauf — zeitlicher Log der abgeschlossenen Lieferungen */}
        {!activeBatch && <LetzteStoppsLog driverId={driver.id} />}
        {/* Kunden-Bewertungs-Historie — persönliche Sterne + Trend */}
        {!activeBatch && <FahrerRatingHistorie driverId={driver.id} />}

        {/* Abrechnungsperioden — Lohnzettel-Download */}
        {!activeBatch && <MeineAbrechnungen />}

        {/* Schicht-Verlauf — letzte abgeschlossene Schichten */}
        {!activeBatch && <MeineSchichten />}

        {/* Schicht-Buchung — Fahrer können sich für offene Schichten anmelden */}
        {!activeBatch && driver.location_id && (
          <SchichtBuchung locationId={driver.location_id} />
        )}
      </main>

      <UpdateBanner />
      <OfflineNetworkBanner />

      {/* Alarm-Ringer: klingelt wenn Tour in Open-Liste (zum Annehmen) ODER zugewiesen (zum Picken) */}
      <PushRegister />
      <AlarmRinger
        openBatchIds={openBatches.map((b) => b.batch_id)}
        assignedBatchId={activeBatch?.status === 'zugewiesen' && !pickOpen ? activeBatch.id : null}
      />

      {pickOpen && activeBatch && (
        <PickDialog
          orderBestellnummer={activeBatch.stops[0]?.order.bestellnummer ?? ''}
          items={pickItems}
          batchId={activeBatch.id}
          onClose={() => setPickOpen(false)}
          onComplete={() => { setPickOpen(false); router.refresh(); }}
        />
      )}

      {/* Phase 1462: Tour-Stopp-Navigations-Kommando — Smart Stop Navigator mit GPS, Tel + Bestätigungs-Flow */}
      {activeBatch && activeBatch.status === 'unterwegs' && (
        <div className="px-4 pb-4">
          <FahrerPhase1462TourStoppNavigationsKommando
            stops={activeBatch.stops.map((s, i) => {
              const completed = !!s.geliefert_am;
              const isNext = !completed && activeBatch.stops.slice(0, i).every((prev) => !!prev.geliefert_am);
              return {
                id: s.id,
                sequence: s.reihenfolge ?? (i + 1),
                status: completed ? 'completed' : isNext ? 'active' : 'pending',
                address: [s.order?.kunde_adresse, s.order?.kunde_plz].filter(Boolean).join(', ') || `Stopp ${i + 1}`,
                customerName: s.order?.kunde_name ?? undefined,
                customerPhone: s.order?.kunde_telefon ?? undefined,
                notes: s.order?.kunde_notiz ?? undefined,
                lat: s.order?.kunde_lat ?? undefined,
                lng: s.order?.kunde_lng ?? undefined,
                orderId: s.order_id ?? undefined,
                orderTotal: s.order?.gesamtbetrag ?? undefined,
              };
            })}
            onStopComplete={markDelivered}
          />
        </div>
      )}
      {/* Phase 1001: Tour-Stopp Smart-Nav Final — Hero-Karte für aktiven Stopp + GPS-Button + aufklappbare Stopp-Liste */}
      {activeBatch && activeBatch.status === 'unterwegs' && activeBatch.stops.length > 0 && (
        <div className="px-4 pb-4">
          <FahrerPhase1001TourStoppSmartNavFinal
            stops={activeBatch.stops.map((s, i) => {
              const completed = !!s.geliefert_am;
              const arrived = !!s.angekommen_am;
              const isNext = !completed && activeBatch.stops.slice(0, i).every((prev) => !!prev.geliefert_am);
              return {
                id: s.id,
                sequence: s.reihenfolge ?? (i + 1),
                status: completed ? 'completed' : (isNext || arrived) ? 'active' : 'pending',
                address: [s.order?.kunde_adresse, s.order?.kunde_plz].filter(Boolean).join(', ') || `Stopp ${i + 1}`,
                customerName: s.order?.kunde_name ?? undefined,
                customerPhone: s.order?.kunde_telefon ?? undefined,
                notes: s.order?.kunde_lieferhinweis ?? s.order?.kunde_notiz ?? undefined,
                lat: s.order?.kunde_lat ?? undefined,
                lng: s.order?.kunde_lng ?? undefined,
                orderId: s.order_id ?? undefined,
                orderTotal: s.order?.gesamtbetrag ?? undefined,
                paymentMethod: s.order?.zahlungsart ?? undefined,
                etaMin: (s as any).eta_min ?? null,
              };
            })}
            onStopComplete={markDelivered}
          />
        </div>
      )}

      {/* Schicht-Abschluss Modal */}
      {showShiftEnd && shiftSnapshot && (
        <SchichtAbschlussModal
          snapshot={shiftSnapshot}
          rankData={rankData}
          driverId={driver.id}
          onConfirm={goOffline}
          onCancel={() => setShowShiftEnd(false)}
        />
      )}
    </div>
    </>
  );
}

/* ---------- SchichtStats ---------- */

function SchichtStats({ driverId, isOnline }: { driverId: string; isOnline: boolean }) {
  const supabase = createClient();
  const [stats, setStats] = useState<{
    deliveries: number;
    tours: number;
    totalBetrag: number;
    totalDistKm: number;
  } | null>(null);
  const [onlineMin, setOnlineMin] = useState<number>(0);
  const prevOnlineRef = React.useRef<number>(0);

  // Tick für Online-Zeit
  useEffect(() => {
    const t = setInterval(() => setOnlineMin((m) => m + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    (async () => {
      // Legacy + Mise parallel abfragen
      const [
        { data: legacyBatches },
        { data: miseDriver },
      ] = await Promise.all([
        supabase
          .from('delivery_batches')
          .select('id, total_distance_km')
          .eq('fahrer_id', driverId)
          .gte('created_at', today.toISOString()),
        supabase
          .from('mise_drivers')
          .select('id')
          .eq('employee_id', driverId)
          .maybeSingle(),
      ]);

      const miseDriverId = (miseDriver as any)?.id ?? null;

      const [{ data: legacyStops }, { data: miseBatches }] = await Promise.all([
        legacyBatches?.length
          ? supabase
              .from('delivery_batch_stops')
              .select('id, geliefert_am, order:customer_orders(gesamtbetrag)')
              .in('batch_id', (legacyBatches as any[]).map((b) => b.id))
              .not('geliefert_am', 'is', null)
          : Promise.resolve({ data: [] }),
        miseDriverId
          ? supabase
              .from('mise_delivery_batches')
              .select('id, total_distance_km')
              .eq('driver_id', miseDriverId)
              .gte('created_at', today.toISOString())
          : Promise.resolve({ data: [] }),
      ]);

      const { data: miseStops } = miseBatches?.length
        ? await supabase
            .from('mise_delivery_batch_stops')
            .select('id, completed_at, type, order:customer_orders(gesamtbetrag)')
            .in('batch_id', (miseBatches as any[]).map((b) => b.id))
            .eq('type', 'dropoff')
            .not('completed_at', 'is', null)
        : { data: [] };

      const legacyDelivered = (legacyStops as any[])?.length ?? 0;
      const miseDelivered = (miseStops as any[])?.length ?? 0;
      const legacyBetrag = ((legacyStops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
      const miseBetrag = ((miseStops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
      const legacyDist = ((legacyBatches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
      const miseDist = ((miseBatches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);

      setStats({
        deliveries: legacyDelivered + miseDelivered,
        tours: ((legacyBatches as any[])?.length ?? 0) + ((miseBatches as any[])?.length ?? 0),
        totalBetrag: legacyBetrag + miseBetrag,
        totalDistKm: legacyDist + miseDist,
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const [realEarnings, setRealEarnings] = useState<{ deliveries: number; totalEur: number } | null>(null);
  const [earningRecords, setEarningRecords] = useState<{ id: string; totalAmount: number; baseAmount: number; kmBonus: number; peakBonus: number; ratingBonus: number; deliveryKm: number; wasPeakTime: boolean; completedAt: string; paidOut: boolean }[]>([]);
  const [earningsOpen, setEarningsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/driver/earnings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.today?.deliveries >= 0) setRealEarnings(d.today);
        if (Array.isArray(d?.records)) setEarningRecords(d.records);
      })
      .catch(() => {});
  }, []);

  // Online-Zeit aus driver_status
  useEffect(() => {
    if (!isOnline) return;
    (async () => {
      const { data } = await supabase
        .from('driver_status')
        .select('online_seit')
        .eq('employee_id', driverId)
        .maybeSingle();
      if (data?.online_seit) {
        const min = Math.floor((Date.now() - new Date(data.online_seit as string).getTime()) / 60_000);
        setOnlineMin(min);
        prevOnlineRef.current = min;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!stats && !isOnline) return null;
  if (!stats) return null;

  const hasData = stats.deliveries > 0 || stats.tours > 0;

  return (
    <section className={cn(
      'rounded-2xl border p-4',
      hasData ? 'bg-white/5 border-white/10' : 'bg-white/3 border-white/5 opacity-60',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-accent" />
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">Heutige Schicht</div>
        {onlineMin > 0 && (
          <div className="ml-auto text-[10px] font-bold text-matcha-400 tabular-nums">
            {Math.floor(onlineMin / 60) > 0 ? `${Math.floor(onlineMin / 60)}h ` : ''}{onlineMin % 60}m online
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-2xl font-black text-accent leading-none">{stats.deliveries}</div>
          <div className="text-[10px] text-matcha-300 mt-1">Lieferungen</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-2xl font-black text-accent leading-none">{stats.tours}</div>
          <div className="text-[10px] text-matcha-300 mt-1">Touren</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-lg font-black text-accent leading-none">
            {stats.totalDistKm > 0 ? `${stats.totalDistKm.toFixed(1)} km` : '—'}
          </div>
          <div className="text-[10px] text-matcha-300 mt-1">Strecke</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-lg font-black text-accent leading-none">
            {euro(stats.totalBetrag)}
          </div>
          <div className="text-[10px] text-matcha-300 mt-1">Umsatz</div>
        </div>
      </div>
      {!hasData && isOnline && (
        <div className="mt-2 text-center text-[11px] text-matcha-400">
          Noch keine Lieferungen heute — erste Tour annehmen!
        </div>
      )}
      {stats.deliveries > 0 && (
        <>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-matcha-300">
            <TrendingUp className="h-3 w-3 text-accent" />
            Ø {stats.tours > 0 ? Math.round(stats.deliveries / stats.tours * 10) / 10 : 0} Stopps/Tour
            {stats.totalDistKm > 0 && stats.deliveries > 0 && (
              <span className="ml-2 opacity-70">· Ø {(stats.totalDistKm / stats.deliveries).toFixed(1)} km/Lieferung</span>
            )}
          </div>
          {/* Effizienz-Streifen */}
          {onlineMin > 0 && (() => {
            const delivPerHour = Math.round((stats.deliveries / Math.max(1, onlineMin)) * 60 * 10) / 10;
            const effScore = Math.min(100, Math.round(delivPerHour * 20)); // ~5/h = 100%
            const effLabel = effScore >= 80 ? 'Excellent' : effScore >= 60 ? 'Sehr gut' : effScore >= 40 ? 'Gut' : 'Aufwärmen';
            const effColor = effScore >= 80 ? 'bg-accent' : effScore >= 60 ? 'bg-blue-400' : effScore >= 40 ? 'bg-amber-400' : 'bg-muted';
            const estimatedEarnings = realEarnings?.totalEur ?? (stats.deliveries * 3 + stats.totalDistKm * 0.15);
            const isRealEarnings = realEarnings !== null && realEarnings.totalEur > 0;
            const earningsPerHour = onlineMin >= 5 ? (estimatedEarnings / Math.max(1, onlineMin)) * 60 : null;
            return (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Schicht-Effizienz</span>
                    <span className="text-[10px] font-black text-accent">{effLabel}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${effColor}`}
                      style={{ width: `${effScore}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-matcha-400">
                    <span>{delivPerHour}/h Lieferungen</span>
                    {earningsPerHour != null && (
                      <span className="text-accent font-bold">
                        ≈ {earningsPerHour.toFixed(2)}€/h
                        <span className="ml-1 opacity-60 text-[9px]">{isRealEarnings ? '✓ echt' : '~schätz.'}</span>
                      </span>
                    )}
                  </div>
                </div>
                {/* Schicht-Endprognose */}
                {earningsPerHour != null && (() => {
                  const nowH = new Date().getHours();
                  const shiftEndH = 22;
                  const hoursLeft = Math.max(0, shiftEndH - nowH - new Date().getMinutes() / 60);
                  const currentEarnings = estimatedEarnings;
                  const projectedEarnings = currentEarnings + earningsPerHour * hoursLeft;
                  if (hoursLeft <= 0 || projectedEarnings <= 0) return null;
                  return (
                    <div className="rounded-xl bg-accent/10 border border-accent/20 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-matcha-300 uppercase tracking-wider">
                          Prognose bis {shiftEndH}:00 Uhr
                        </span>
                        <span className="font-display text-lg font-black text-accent tabular-nums">
                          ~{projectedEarnings.toFixed(0)}€
                        </span>
                      </div>
                      <div className="text-[9px] text-matcha-400 mt-0.5">
                        {currentEarnings.toFixed(0)}€ bereits{isRealEarnings ? ' (Echtdaten)' : ' (Schätzung)'} + {(earningsPerHour * hoursLeft).toFixed(0)}€ prognose
                      </div>
                    </div>
                  );
                })()}
                {/* Tages-Meilenstein */}
                {(() => {
                  const MILESTONES = [5, 10, 15, 20, 30, 50];
                  const next = MILESTONES.find((m) => m > stats.deliveries);
                  if (!next) return null;
                  const pct = Math.round((stats.deliveries / next) * 100);
                  const remaining = next - stats.deliveries;
                  return (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Nächstes Ziel</span>
                        <span className="text-[10px] font-black text-matcha-200">
                          {stats.deliveries}/{next} <span className="text-accent">🏆</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gold transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-matcha-400">
                        Noch {remaining} {remaining === 1 ? 'Lieferung' : 'Lieferungen'} bis zum Meilenstein
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Verdienst-Aufschlüsselung: Letzte Lieferungen mit Bonus-Details */}
          {earningRecords.length > 0 && (() => {
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const todayRecs = earningRecords.filter(r => new Date(r.completedAt) >= todayStart);
            if (todayRecs.length === 0) return null;
            return (
              <div className="mt-3 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <button
                  onClick={() => setEarningsOpen(p => !p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">
                    Verdienst-Details ({todayRecs.length} Lieferungen)
                  </span>
                  <span className="text-matcha-400 text-[10px]">{earningsOpen ? '▲' : '▼'}</span>
                </button>
                {earningsOpen && (
                  <div className="border-t border-white/8 divide-y divide-white/5">
                    {todayRecs.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-matcha-200 tabular-nums">
                            {new Date(r.completedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="text-[9px] bg-white/10 rounded px-1.5 py-0.5 text-matcha-300">
                              {euro(r.baseAmount)} Basis
                            </span>
                            {r.kmBonus > 0 && (
                              <span className="text-[9px] bg-matcha-600/40 rounded px-1.5 py-0.5 text-matcha-200">
                                +{euro(r.kmBonus)} km ({r.deliveryKm.toFixed(1)}km)
                              </span>
                            )}
                            {r.peakBonus > 0 && (
                              <span className="text-[9px] bg-amber-500/20 rounded px-1.5 py-0.5 text-amber-300">
                                +{euro(r.peakBonus)} Peak
                              </span>
                            )}
                            {r.ratingBonus > 0 && (
                              <span className="text-[9px] bg-blue-500/20 rounded px-1.5 py-0.5 text-blue-300">
                                +{euro(r.ratingBonus)} Bonus
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`text-sm font-black tabular-nums shrink-0 ${r.paidOut ? 'text-accent' : 'text-matcha-300'}`}>
                          {euro(r.totalAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </section>
  );
}

/* ---------- FahrerPaceCard ---------- */

function FahrerPaceCard({ driverId }: { driverId: string }) {
  const supabase = createClient();
  type SlotData = { h: number; count: number };
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const since = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    (async () => {
      const [{ data: legacyBatches }, { data: miseDriver }] = await Promise.all([
        supabase.from('delivery_batches').select('id').eq('fahrer_id', driverId).gte('created_at', since),
        supabase.from('mise_drivers').select('id').eq('employee_id', driverId).maybeSingle(),
      ]);
      const miseDriverId = (miseDriver as { id: string } | null)?.id ?? null;

      const { data: miseBatches } = miseDriverId
        ? await supabase.from('mise_delivery_batches').select('id').eq('driver_id', miseDriverId).gte('created_at', since)
        : { data: [] as { id: string }[] };

      const [{ data: legacyStops }, { data: miseStops }] = await Promise.all([
        legacyBatches?.length
          ? supabase.from('delivery_batch_stops').select('geliefert_am').in('batch_id', (legacyBatches as { id: string }[]).map((b) => b.id)).not('geliefert_am', 'is', null).gte('geliefert_am', since) as Promise<{ data: { geliefert_am: string }[] | null }>
          : Promise.resolve({ data: [] as { geliefert_am: string }[] }),
        miseBatches?.length
          ? supabase.from('mise_delivery_batch_stops').select('completed_at').eq('type', 'dropoff').in('batch_id', (miseBatches as { id: string }[]).map((b) => b.id)).not('completed_at', 'is', null).gte('completed_at', since) as Promise<{ data: { completed_at: string }[] | null }>
          : Promise.resolve({ data: [] as { completed_at: string }[] }),
      ]);

      const allTimestamps: string[] = [
        ...(legacyStops ?? []).map((s) => s.geliefert_am),
        ...(miseStops ?? []).map((s) => s.completed_at),
      ];
      if (!allTimestamps.length) return;

      const buckets: Record<number, number> = {};
      for (const ts of allTimestamps) {
        const h = new Date(ts).getHours();
        buckets[h] = (buckets[h] ?? 0) + 1;
      }
      const nowH = new Date().getHours();
      const result: SlotData[] = [];
      for (let i = 1; i >= 0; i--) {
        const h = (nowH - i + 24) % 24;
        result.push({ h, count: buckets[h] ?? 0 });
      }
      setSlots(result);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (slots.length === 0 || slots.every((s) => s.count === 0)) return null;

  const total = slots.reduce((s, x) => s + x.count, 0);
  const rate = Math.round(total / 2 * 10) / 10; // deliveries/hour over 2h window
  const max = Math.max(...slots.map((s) => s.count), 1);

  const rateColor =
    rate >= 4 ? 'text-accent' : rate >= 2 ? 'text-amber-300' : 'text-matcha-400';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">
          Liefertempo (2h)
        </span>
        <span className={cn('ml-auto font-mono text-lg font-black tabular-nums', rateColor)}>
          {rate}/h
        </span>
      </div>
      <div className="flex items-end gap-1.5">
        {slots.map(({ h, count }) => {
          const barPct = Math.max(8, Math.round((count / max) * 100));
          const isNow = h === new Date().getHours();
          return (
            <div key={h} className="flex flex-1 flex-col items-center gap-0.5">
              <span className="text-[8px] font-bold tabular-nums text-matcha-400">{count}</span>
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all',
                  isNow ? 'bg-accent' : 'bg-matcha-600',
                )}
                style={{ height: `${barPct * 0.4}px` }}
              />
              <span className="text-[8px] tabular-nums text-matcha-500">{h}h</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Haversine ---------- */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* ---------- FahrerWarteAnzeige ---------- */

function FahrerWarteAnzeige({ driverId, locationId }: { driverId: string; locationId?: string | null }) {
  const supabase = createClient();
  const [waitSec, setWaitSec] = useState(0);
  const [lastDeliveryMin, setLastDeliveryMin] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [kitchenLoad, setKitchenLoad] = useState<{ eta_min: number; active_orders: number } | null>(null);

  // Tick every second for wait timer
  useEffect(() => {
    const t = setInterval(() => {
      setWaitSec((s) => s + 1);
      setPulse((p) => !p);
    }, 1_000);
    return () => clearInterval(t);
  }, []);

  // Live kitchen queue depth
  useEffect(() => {
    if (!locationId) return;
    const poll = () =>
      fetch(`/api/delivery/eta/live?location_id=${locationId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.eta_min != null)
            setKitchenLoad({ eta_min: d.eta_min as number, active_orders: (d.active_orders as number) ?? 0 });
        })
        .catch(() => {});
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  // Fetch last completed delivery time
  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: lastStop } = await supabase
        .from('delivery_batch_stops')
        .select('geliefert_am, batch:delivery_batches!inner(fahrer_id)')
        .eq('batch.fahrer_id', driverId)
        .gte('geliefert_am', today.toISOString())
        .not('geliefert_am', 'is', null)
        .order('geliefert_am', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastStop?.geliefert_am) {
        const min = Math.floor((Date.now() - new Date(lastStop.geliefert_am as string).getTime()) / 60_000);
        setLastDeliveryMin(min);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const waitMin = Math.floor(waitSec / 60);
  const waitSecDisplay = waitSec % 60;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/3 p-5 text-center">
      {/* Pulse ring */}
      <div className="relative inline-flex items-center justify-center mb-4">
        <div className={cn(
          'absolute h-16 w-16 rounded-full border-2 border-accent transition-all duration-1000',
          pulse ? 'scale-125 opacity-0' : 'scale-100 opacity-40',
        )} />
        <div className="h-12 w-12 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
          <Route className="h-6 w-6 text-accent" />
        </div>
      </div>

      <div className="font-display text-matcha-100 font-bold text-base mb-1">
        Warte auf nächste Tour…
      </div>
      <div className="text-[11px] text-matcha-400 mb-3">
        System ist aktiv — du bekommst sofort eine Benachrichtigung
      </div>

      {/* Wait timer */}
      <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2 tabular-nums">
        <Clock className="h-3.5 w-3.5 text-matcha-400" />
        <span className="text-sm font-black text-matcha-200">
          {waitMin > 0 ? `${waitMin}m ` : ''}{waitSecDisplay.toString().padStart(2, '0')}s
        </span>
        <span className="text-[10px] text-matcha-400">Wartezeit</span>
      </div>

      {lastDeliveryMin !== null && (
        <div className="mt-2 text-[10px] text-matcha-400">
          Letzte Lieferung vor {lastDeliveryMin} Min
        </div>
      )}

      {/* Live kitchen load */}
      {kitchenLoad && (
        <div className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold',
          kitchenLoad.eta_min > 30
            ? 'bg-red-500/15 text-red-300'
            : kitchenLoad.eta_min > 20
              ? 'bg-orange-500/15 text-orange-300'
              : 'bg-matcha-500/15 text-matcha-300',
        )}>
          <Package className="h-3 w-3 shrink-0" />
          Küche: {kitchenLoad.active_orders} Bestellung{kitchenLoad.active_orders !== 1 ? 'en' : ''} · ETA {kitchenLoad.eta_min} Min
        </div>
      )}

      {/* Nächste Tour Schätzung: basierend auf Küchen-ETA */}
      {kitchenLoad && kitchenLoad.active_orders >= 1 && (() => {
        // Schätze wann die erste fertige Bestellung dispatcht werden kann
        // (erste Hälfte der ETA = Durchschnitt bis erste Bestellung fertig)
        const estMin = Math.max(1, Math.round(kitchenLoad.eta_min * 0.4));
        return (
          <div className="mt-2 text-[11px] font-bold text-accent/80 tabular-nums">
            ⚡ Nächste Tour in ca. {estMin} Min erwartet
          </div>
        );
      })()}
    </section>
  );
}

/* ---------- FahrerRankingCard ---------- */

type RankingState = {
  rank: number;
  total: number;
  toursWeek: number;
  stopsWeek: number;
  distKmWeek: number;
  onTimeRate: number | null;
  trend: 'up' | 'down' | 'same';
};

function FahrerRankingCard() {
  const [perf, setPerf] = useState<RankingState | null>(null);

  useEffect(() => {
    fetch('/api/delivery/driver/my-performance?period=week&days=14')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.rank == null) return;
        const history = (d.history ?? []) as Array<{
          toursCompleted: number;
          stopsCompleted: number;
          totalDistanceKm: number;
          onTimeRate: number | null;
        }>;
        const lastWeek = history.slice(-7);
        const toursWeek = lastWeek.reduce((s, h) => s + h.toursCompleted, 0);
        const stopsWeek = lastWeek.reduce((s, h) => s + h.stopsCompleted, 0);
        const distKmWeek = lastWeek.reduce((s, h) => s + h.totalDistanceKm, 0);
        const ratedDays = lastWeek.filter((h) => h.onTimeRate != null);
        const onTimeRate =
          ratedDays.length > 0
            ? ratedDays.reduce((s, h) => s + h.onTimeRate!, 0) / ratedDays.length
            : null;
        const recentStops = lastWeek.slice(-3).reduce((s, h) => s + h.stopsCompleted, 0);
        const prevStops = lastWeek.slice(-6, -3).reduce((s, h) => s + h.stopsCompleted, 0);
        const trend: 'up' | 'down' | 'same' =
          recentStops > prevStops + 1 ? 'up' : recentStops < prevStops - 1 ? 'down' : 'same';
        setPerf({ rank: d.rank, total: d.total ?? 1, toursWeek, stopsWeek, distKmWeek, onTimeRate, trend });
      })
      .catch(() => {});
  }, []);

  if (!perf) return null;

  const medal = perf.rank === 1 ? '🥇' : perf.rank === 2 ? '🥈' : perf.rank === 3 ? '🥉' : null;
  const rankColor =
    perf.rank === 1
      ? 'text-yellow-400'
      : perf.rank <= 3
      ? 'text-matcha-300'
      : 'text-white/60';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/60">
            Wochen-Ranking
          </span>
        </div>
        <div className={cn('flex items-center gap-1 font-display font-black text-2xl', rankColor)}>
          {medal && <span>{medal}</span>}
          <span>#{perf.rank}</span>
          <span className="text-sm font-normal text-white/40">/ {perf.total}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 px-2 py-2.5">
          <div className="font-display text-xl font-black text-white">{perf.stopsWeek}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Lieferungen</div>
        </div>
        <div className="rounded-xl bg-white/5 px-2 py-2.5">
          <div className="font-display text-xl font-black text-white">{perf.toursWeek}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Touren</div>
        </div>
        <div className="rounded-xl bg-white/5 px-2 py-2.5">
          <div className="font-display text-xl font-black text-white">
            {perf.distKmWeek.toFixed(0)}
            <span className="text-xs font-normal text-white/50"> km</span>
          </div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Strecke</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-white/50">
        {perf.onTimeRate != null && (
          <span>
            Pünktlich:{' '}
            <span className="font-bold text-matcha-300">{Math.round(perf.onTimeRate * 100)}%</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <TrendingUp
            className={cn(
              'h-3.5 w-3.5',
              perf.trend === 'up'
                ? 'text-matcha-400'
                : perf.trend === 'down'
                ? 'text-red-400 rotate-180'
                : 'text-white/30',
            )}
          />
          {perf.trend === 'up' ? 'Trend steigend' : perf.trend === 'down' ? 'Trend fallend' : 'Stabil'}
        </span>
      </div>
    </section>
  );
}

/* ---------- ChallengeWidget — aktive Challenges in der Fahrer-App ---------- */

type ChallengeEntry = {
  challenge: {
    id: string;
    title: string;
    challengeType: string;
    targetValue: number;
    rewardEur: number;
    endsAt: string;
  };
  participation: {
    currentValue: number;
    progressPct: number;
    completed: boolean;
    rank: number;
  };
};

function ChallengeWidget() {
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);

  useEffect(() => {
    fetch('/api/delivery/driver/challenges')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.challenges) setEntries(d.challenges as ChallengeEntry[]); })
      .catch(() => {});
  }, []);

  if (entries.length === 0) return null;

  function unitLabel(type: string): string {
    if (type === 'deliveries_count') return 'Lieferungen';
    if (type === 'on_time_rate')     return '% Pünktlichkeit';
    if (type === 'avg_rating')       return '★ Sterne';
    if (type === 'revenue_total')    return '€ Umsatz';
    return '';
  }

  function timeLeft(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Abgelaufen';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} Min`;
  }

  return (
    <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">Aktive Challenges</span>
      </div>
      {entries.map(({ challenge: ch, participation: p }) => {
        const pct = Math.min(100, Math.round(p.progressPct));
        return (
          <div key={ch.id} className="rounded-xl bg-white/5 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-white leading-tight">{ch.title}</span>
              {ch.rewardEur > 0 && (
                <span className="shrink-0 rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-xs font-bold text-amber-300">
                  +€{ch.rewardEur.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
              <span>{p.currentValue} / {ch.targetValue} {unitLabel(ch.challengeType)}</span>
              <span>{timeLeft(ch.endsAt)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  p.completed ? 'bg-emerald-400' : pct >= 75 ? 'bg-amber-400' : 'bg-blue-400',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {p.completed && (
              <p className="mt-1.5 text-xs text-emerald-400 font-medium">
                ✓ Ziel erreicht — Prämie wird abgerechnet!
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

function OpenBatchSection({
  openBatches,
  pending,
  onClaim,
  driverPos,
}: {
  openBatches: OpenBatch[];
  pending: boolean;
  onClaim: (batchId: string) => void;
  driverPos?: { lat: number; lng: number } | null;
}) {
  // Group stops by batch_id for multi-stop display
  const grouped = useMemo(() => {
    const map = new Map<string, OpenBatch[]>();
    for (const b of openBatches) {
      if (!map.has(b.batch_id)) map.set(b.batch_id, []);
      map.get(b.batch_id)!.push(b);
    }
    return Array.from(map.entries()).map(([batchId, stops]) => {
      const locLat = stops[0].location_lat;
      const locLng = stops[0].location_lng;
      let totalDistanceKm = 0;
      let prev = locLat != null && locLng != null ? { lat: locLat, lng: locLng } : null;
      for (const s of stops) {
        if (s.kunde_lat && s.kunde_lng && prev) {
          totalDistanceKm += haversineKm(prev, { lat: s.kunde_lat, lng: s.kunde_lng });
          prev = { lat: s.kunde_lat, lng: s.kunde_lng };
        }
      }
      const estEtaMin = Math.round((totalDistanceKm / 20) * 60 + stops.length * 3);
      const cashAmount = stops
        .filter((s) => s.zahlungsart === 'bar' || s.bezahlt === false)
        .reduce((sum, s) => sum + s.gesamtbetrag, 0);
      // Fahrer-Verdienstschätzung: Basis 3€/Stop + 0.15€/km
      const estDriverEarnings = Math.round((stops.length * 3 + totalDistanceKm * 0.15) * 100) / 100;
      return {
        batchId,
        stops,
        totalAmount: stops.reduce((s, x) => s + x.gesamtbetrag, 0),
        cashAmount,
        estDriverEarnings,
        locationName: stops[0].location_name,
        locationLat: locLat,
        locationLng: locLng,
        maxEta: stops.reduce((m, x) => Math.max(m, x.geschaetzte_lieferung_min ?? 0), 0),
        totalDistanceKm: totalDistanceKm > 0 ? totalDistanceKm : null,
        estEtaMin: estEtaMin > 0 ? estEtaMin : null,
      };
    });
  }, [openBatches]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 text-accent">
        <ShoppingBag className="h-4 w-4" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wider">Verfügbare Touren</h2>
        {grouped.length > 0 && (
          <span className="ml-auto rounded-full bg-accent text-matcha-900 px-2 py-0.5 text-xs font-bold">{grouped.length}</span>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
          <Clock className="h-8 w-8 text-matcha-300 mx-auto mb-2 opacity-60" />
          <div className="text-matcha-200 text-sm">Gerade keine offenen Touren.</div>
          <div className="text-matcha-300 text-xs mt-1">Bleib online — wir sagen dir Bescheid.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ batchId, stops, totalAmount, cashAmount, estDriverEarnings, locationName, maxEta, totalDistanceKm, estEtaMin }, idx) => {
            // Beste Wahl: höchster Verdienst / geschätzte Minuten
            const earningRate = estEtaMin && estEtaMin > 0 && estDriverEarnings > 0
              ? estDriverEarnings / estEtaMin
              : 0;
            const bestIdx = grouped.reduce((best, g, i) => {
              const r = g.estEtaMin && g.estEtaMin > 0 && g.estDriverEarnings > 0
                ? g.estDriverEarnings / g.estEtaMin : 0;
              return r > (grouped[best].estEtaMin && grouped[best].estEtaMin! > 0 && grouped[best].estDriverEarnings > 0
                ? grouped[best].estDriverEarnings / grouped[best].estEtaMin! : 0) ? i : best;
            }, 0);
            const isBestChoice = grouped.length > 1 && idx === bestIdx && earningRate > 0;
            return (
            <div key={batchId} className={cn('rounded-2xl p-4', isBestChoice ? 'bg-accent/10 border-2 border-accent' : 'bg-accent/5 border-2 border-accent/30')}>
              <div className="flex items-start gap-3 mb-3">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', isBestChoice ? 'bg-accent text-matcha-900' : 'bg-accent/20 text-accent')}>
                  <Zap size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display font-bold">
                      {stops.length === 1 ? stops[0].kunde_name : `${stops.length} Stopps · ${locationName}`}
                    </div>
                    {isBestChoice && (
                      <span className="rounded-full bg-accent text-matcha-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                        ⭐ Beste Wahl
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-matcha-300">
                    <span className="font-bold text-accent">{euro(totalAmount)}</span>
                    {cashAmount > 0 && (
                      <span className="flex items-center gap-1 font-bold text-amber-300">
                        <Banknote size={10} /> Bar: {euro(cashAmount)}
                      </span>
                    )}
                    {/* Fahrer-Verdienstschätzung */}
                    {estDriverEarnings > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-matcha-700/40 border border-matcha-600/40 px-2 py-0.5 font-bold text-matcha-100">
                        <TrendingUp size={10} /> ~{euro(estDriverEarnings)} Verdienst
                      </span>
                    )}
                    {estEtaMin ? (
                      <span className="flex items-center gap-1"><Clock size={10} /> ~{estEtaMin} Min</span>
                    ) : maxEta > 0 ? (
                      <span className="flex items-center gap-1"><Clock size={10} /> ~{maxEta} Min</span>
                    ) : null}
                    {totalDistanceKm != null && (
                      <span className="flex items-center gap-1"><Route size={10} /> {totalDistanceKm.toFixed(1)} km</span>
                    )}
                    <span>{stops.length} {stops.length === 1 ? 'Stopp' : 'Stopps'}</span>
                    {/* Distance from driver to pickup location */}
                    {driverPos && stops[0].location_lat && stops[0].location_lng && (() => {
                      const d = haversineKm(driverPos, { lat: stops[0].location_lat!, lng: stops[0].location_lng! });
                      const label = d < 0.1 ? '< 100m' : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
                      return (
                        <span className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-0.5 font-bold',
                          d < 0.3 ? 'bg-accent/20 text-accent' : d < 1 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-matcha-300',
                        )}>
                          <Navigation size={9} /> {label} zur Abholung
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Route-Visualisierung für Multi-Stop */}
              {stops.length > 1 && totalDistanceKm != null && (
                <div className="mb-3 rounded-xl bg-white/5 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-1.5">Route</div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="h-5 w-5 rounded-full bg-matcha-700 text-accent flex items-center justify-center">
                        <MapPin size={10} />
                      </div>
                      <div className="text-[9px] text-matcha-400 max-w-[52px] truncate text-center mt-0.5">{locationName}</div>
                    </div>
                    {stops.map((s, i) => (
                      <div key={s.order_id} className="flex items-center gap-1 shrink-0">
                        <div className="w-4 h-0.5 bg-accent/40 rounded-full mb-3" />
                        <div className="flex flex-col items-center">
                          <div className="h-5 w-5 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center text-[9px] font-black">{i + 1}</div>
                          <div className="text-[9px] text-matcha-400 max-w-[52px] truncate text-center mt-0.5">{s.kunde_name.split(' ')[0]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Karten-Vorschau: Alle Lieferpunkte vor dem Annehmen auf der Karte sehen */}
              <OpenBatchMap
                stops={stops.map((s) => ({
                  order_id: s.order_id,
                  kunde_name: s.kunde_name,
                  kunde_lat: s.kunde_lat ?? null,
                  kunde_lng: s.kunde_lng ?? null,
                }))}
                restaurantLat={stops[0]?.location_lat ?? null}
                restaurantLng={stops[0]?.location_lng ?? null}
                restaurantName={stops[0]?.location_name}
                className="mb-3"
              />

              {/* Stop list — Phase 105: mit geschätzter Ankunftszeit pro Stopp */}
              <div className="space-y-2 mb-3">
                {stops.map((s, i) => {
                  const isCash = s.zahlungsart === 'bar' || s.bezahlt === false;
                  // Schätze Ankunftszeit: Abholung ~5 Min + 3 Min/Stopp (grob)
                  const pickupMin = 5;
                  const perStopMin = 3;
                  const etaMin = pickupMin + (i + 1) * perStopMin + Math.round(((s.geschaetzte_lieferung_min ?? 20) / stops.length));
                  const etaTime = new Date(Date.now() + etaMin * 60_000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={s.order_id} className={cn(
                      'flex items-start gap-2 rounded-xl px-3 py-2',
                      isCash ? 'bg-amber-500/10 border border-amber-400/30' : 'bg-white/5',
                    )}>
                      <div className="h-6 w-6 rounded-lg bg-accent/20 text-accent grid place-items-center text-[11px] font-black shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{s.kunde_name}</div>
                        <div className="text-[11px] text-matcha-300 truncate">
                          {s.kunde_adresse}{s.kunde_plz ? `, ${s.kunde_plz}` : ''}
                        </div>
                        {/* Phase 105: Geschätzte Ankunftszeit */}
                        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent/80">
                          <Clock size={8} />
                          ~{etaMin} Min · ca. {etaTime} Uhr
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={cn('text-sm font-bold', isCash ? 'text-amber-300' : 'text-accent')}>{euro(s.gesamtbetrag)}</div>
                        {isCash && (
                          <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-300 uppercase tracking-wide">
                            <Banknote size={9} /> Bar
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => onClaim(batchId)}
                disabled={pending}
                className="w-full h-12 rounded-xl bg-accent text-matcha-900 font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
              >
                {pending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {stops.length === 1 ? 'Tour annehmen' : `${stops.length}-Stopp-Tour annehmen`}
              </button>
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- SchichtBuchung ---------- */

type BookableSlot = {
  slotStart: string;
  slotEnd: string;
  dayLabel: string;
  timeLabel: string;
  driverNeeded: number;
  driverTarget: number;
  alreadyClaimed: boolean;
};

type DriverClaim = {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejectionReason: string | null;
};

function SchichtBuchung({ locationId }: { locationId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [claims, setClaims] = useState<DriverClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimPending, setClaimPending] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [slotsRes, claimsRes] = await Promise.all([
        fetch(`/api/delivery/shifts/available?location_id=${locationId}`),
        fetch('/api/delivery/shifts/claim'),
      ]);
      if (slotsRes.ok) {
        const { slots: s = [] } = await slotsRes.json() as { slots: BookableSlot[] };
        setSlots(s);
      }
      if (claimsRes.ok) {
        const { claims: c = [] } = await claimsRes.json() as { claims: DriverClaim[] };
        setClaims(c);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!expanded) load();
    setExpanded(v => !v);
  }

  async function doClaim(slot: BookableSlot) {
    setClaimPending(slot.slotStart);
    try {
      const res = await fetch('/api/delivery/shifts/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id:   locationId,
          planned_start: slot.slotStart,
          planned_end:   slot.slotEnd,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error?: string };
        alert(error ?? 'Anmeldung fehlgeschlagen');
      } else {
        await load();
      }
    } finally {
      setClaimPending(null);
    }
  }

  async function doCancel(claimId: string) {
    setCancelPending(claimId);
    try {
      await fetch(`/api/delivery/shifts/claim?claim_id=${claimId}`, { method: 'DELETE' });
      await load();
    } finally {
      setCancelPending(null);
    }
  }

  const pendingClaims  = claims.filter(c => c.status === 'pending');
  const approvedClaims = claims.filter(c => c.status === 'approved');
  const openSlots      = slots.filter(s => !s.alreadyClaimed);
  const totalBadge     = openSlots.length + pendingClaims.length + approvedClaims.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
      >
        <div className="h-9 w-9 rounded-xl bg-matcha-700 flex items-center justify-center shrink-0">
          <Calendar size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm">Schichten buchen</div>
          <div className="text-[11px] text-matcha-300">
            {expanded
              ? 'Tippe um zuzuklappen'
              : openSlots.length > 0
              ? `${openSlots.length} offene Slot${openSlots.length === 1 ? '' : 's'}`
              : 'Verfügbare Schichten anzeigen'}
          </div>
        </div>
        {totalBadge > 0 && !expanded && (
          <span className="rounded-full bg-accent text-matcha-900 px-2 py-0.5 text-xs font-black">
            {totalBadge}
          </span>
        )}
        {expanded
          ? <ChevronUp size={16} className="text-matcha-300 shrink-0" />
          : <ChevronDown size={16} className="text-matcha-300 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-matcha-300 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Lade Schichten…
            </div>
          )}

          {/* Meine Anmeldungen */}
          {!loading && (pendingClaims.length > 0 || approvedClaims.length > 0) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300 mb-2">
                Meine Anmeldungen
              </div>
              <div className="space-y-2">
                {[...approvedClaims, ...pendingClaims].map(c => {
                  const start = new Date(c.plannedStart);
                  const end   = new Date(c.plannedEnd);
                  const dayLbl = start.toLocaleDateString('de-DE', {
                    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
                  });
                  const timeLbl = `${start.toISOString().slice(11, 16)} – ${end.toISOString().slice(11, 16)} Uhr`;
                  const isApproved = c.status === 'approved';
                  return (
                    <div key={c.id} className={cn(
                      'rounded-xl border px-3 py-2.5 flex items-center gap-3',
                      isApproved
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-white/5 border-white/10',
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{dayLbl}</div>
                        <div className="text-[11px] text-matcha-300">{timeLbl}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                          isApproved
                            ? 'bg-accent/20 text-accent'
                            : 'bg-amber-500/20 text-amber-300',
                        )}>
                          {isApproved ? '✓ Genehmigt' : '⏳ Wartet'}
                        </span>
                        {c.status === 'pending' && (
                          <button
                            onClick={() => doCancel(c.id)}
                            disabled={cancelPending === c.id}
                            className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-matcha-300 transition disabled:opacity-40"
                            title="Anmeldung zurückziehen"
                          >
                            {cancelPending === c.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <span className="text-xs">✕</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Verfügbare Slots */}
          {!loading && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300 mb-2">
                Offene Slots
              </div>
              {openSlots.length === 0 ? (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-5 text-center">
                  <Clock size={20} className="mx-auto mb-1.5 text-matcha-300 opacity-60" />
                  <div className="text-sm text-matcha-200">Keine offenen Schichten</div>
                  <div className="text-[11px] text-matcha-400 mt-0.5">
                    Alle Slots für die nächsten 7 Tage sind gedeckt.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {openSlots.map(slot => (
                    <div
                      key={slot.slotStart}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{slot.dayLabel}</div>
                        <div className="text-[11px] text-matcha-300">{slot.timeLabel}</div>
                        <div className="text-[10px] text-amber-300 mt-0.5">
                          {slot.driverNeeded} von {slot.driverTarget} Fahrern noch gesucht
                        </div>
                      </div>
                      <button
                        onClick={() => doClaim(slot)}
                        disabled={claimPending === slot.slotStart}
                        className="h-9 px-3 rounded-xl bg-accent text-matcha-900 font-display font-bold text-xs inline-flex items-center gap-1.5 shrink-0 transition active:scale-95 disabled:opacity-60"
                      >
                        {claimPending === slot.slotStart
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Check size={12} />}
                        Anmelden
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={load}
            disabled={loading}
            className="w-full text-center text-[11px] text-matcha-400 hover:text-matcha-200 transition py-1"
          >
            {loading ? 'Aktualisiere…' : '↻ Aktualisieren'}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- SchichtAbschlussModal ---------- */

function SchichtAbschlussModal({
  snapshot,
  rankData,
  driverId,
  onConfirm,
  onCancel,
}: {
  snapshot: { deliveries: number; tours: number; distKm: number; betrag: number; onlineMin: number };
  rankData: { rank: number; total: number } | null;
  driverId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  type TourDetail = { id: string; stops: number; distKm: number | null; startzeit: string | null; durationMin: number | null };
  const [tourDetails, setTourDetails] = useState<TourDetail[]>([]);
  const [showTours, setShowTours] = useState(false);

  useEffect(() => {
    async function load() {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select('id, total_distance_km, startzeit, stops:delivery_batch_stops(id, geliefert_am)')
        .eq('fahrer_id', driverId)
        .gte('created_at', today.toISOString())
        .order('startzeit', { ascending: true });
      if (!batches) return;
      const details: TourDetail[] = (batches as any[]).map((b: any) => {
        const stops = (b.stops as any[]) ?? [];
        const delivered = stops.filter((s: any) => s.geliefert_am);
        let durationMin: number | null = null;
        if (b.startzeit && delivered.length > 0) {
          const last = delivered.reduce((latest: any, s: any) => (!latest || s.geliefert_am > latest.geliefert_am ? s : latest), null);
          if (last) durationMin = Math.round((new Date(last.geliefert_am).getTime() - new Date(b.startzeit).getTime()) / 60_000);
        }
        return { id: b.id, stops: delivered.length, distKm: b.total_distance_km, startzeit: b.startzeit, durationMin };
      });
      setTourDetails(details.filter(d => d.stops > 0));
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);
  const effScore = snapshot.onlineMin > 0
    ? Math.min(100, Math.round((snapshot.deliveries / Math.max(1, snapshot.onlineMin)) * 60 * 20))
    : 0;
  const badge = effScore >= 80
    ? { label: 'Excellent! 🏆', color: 'text-accent' }
    : effScore >= 60
    ? { label: 'Sehr gut! ⭐', color: 'text-blue-400' }
    : effScore >= 40
    ? { label: 'Gut gemacht! 👏', color: 'text-amber-400' }
    : { label: 'Danke für deine Schicht!', color: 'text-matcha-200' };

  const estEarnings = snapshot.deliveries * 3 + snapshot.distKm * 0.15;
  const hStr = snapshot.onlineMin >= 60 ? `${Math.floor(snapshot.onlineMin / 60)}h ` : '';
  const mStr = `${snapshot.onlineMin % 60}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-matcha-900/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-matcha-800 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🎉</div>
          <div className="font-display text-2xl font-black text-accent">Schicht abgeschlossen!</div>
          <div className={`text-sm font-bold mt-1 ${badge.color}`}>{badge.label}</div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-3xl font-black text-accent leading-none">{snapshot.deliveries}</div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Lieferungen</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-3xl font-black text-accent leading-none">{snapshot.tours}</div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Touren</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-xl font-black text-accent leading-none">
              {snapshot.distKm > 0 ? `${snapshot.distKm.toFixed(1)} km` : '—'}
            </div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Strecke</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-xl font-black text-accent leading-none">
              {snapshot.onlineMin > 0 ? `${hStr}${mStr}` : '—'}
            </div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Online-Zeit</div>
          </div>
        </div>

        {/* Estimated earnings */}
        {estEarnings > 0 && (
          <div className="rounded-2xl bg-accent/10 border border-accent/20 px-4 py-3 mb-5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-1">
              Geschätzter Verdienst
            </div>
            <div className="font-display text-2xl font-black text-accent">{euro(Math.round(estEarnings * 100) / 100)}</div>
            <div className="text-[9px] text-matcha-400 mt-0.5">Ø {euro(Math.round((estEarnings / Math.max(1, snapshot.deliveries)) * 100) / 100)} pro Lieferung</div>
          </div>
        )}

        {/* Efficiency bar */}
        {effScore > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Schicht-Effizienz</span>
              <span className="text-[10px] font-black text-accent">{effScore}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${effScore >= 80 ? 'bg-accent' : effScore >= 60 ? 'bg-blue-400' : 'bg-amber-400'}`}
                style={{ width: `${effScore}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-matcha-400 text-right">
              {snapshot.onlineMin > 0 ? `${((snapshot.deliveries / Math.max(1, snapshot.onlineMin)) * 60).toFixed(1)}/h Lieferungen` : ''}
            </div>
          </div>
        )}

        {/* Wochen-Rang — Kontext für diese Schicht */}
        {rankData && (
          <div className={cn(
            'rounded-2xl border px-4 py-3 mb-5 flex items-center justify-between',
            rankData.rank <= 3 ? 'bg-yellow-500/15 border-yellow-500/30' : 'bg-white/5 border-white/10',
          )}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-0.5">Wochenrang</div>
              <div className={cn('font-display text-xl font-black', rankData.rank <= 3 ? 'text-yellow-300' : 'text-accent')}>
                {rankData.rank <= 3 && '🏆 '}#{rankData.rank}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-matcha-400">von {rankData.total} Fahrern</div>
              <div className="text-[10px] text-matcha-300 mt-0.5">diese Woche</div>
            </div>
          </div>
        )}

        {/* Per-Tour Breakdown */}
        {tourDetails.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowTours(v => !v)}
              className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-[11px] font-bold text-matcha-300 active:bg-white/10 transition"
            >
              <span>Tour-Details ({tourDetails.length} Touren)</span>
              <span>{showTours ? '▲' : '▼'}</span>
            </button>
            {showTours && (
              <div className="mt-1.5 space-y-1.5">
                {tourDetails.map((t, i) => (
                  <div key={t.id} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-matcha-400">Tour {i + 1}</span>
                      {t.startzeit && (
                        <span className="text-[10px] text-matcha-500">
                          {new Date(t.startzeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-right">
                      <span className="text-accent font-bold">{t.stops} Stopps</span>
                      {t.distKm != null && <span className="text-matcha-300">{t.distKm.toFixed(1)} km</span>}
                      {t.durationMin != null && <span className="text-matcha-400">{t.durationMin}m</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onConfirm}
            className="w-full h-13 rounded-2xl bg-matcha-700 border border-white/10 text-matcha-100 font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Power size={18} />
            Schicht abschließen
          </button>
          <button
            onClick={onCancel}
            className="w-full h-12 rounded-2xl bg-accent text-matcha-900 font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            Weiter arbeiten
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- LetzteStoppsLog ---------- */

type StopLogEntry = {
  id: string;
  geliefert_am: string;
  kunde_name: string;
  kunde_adresse: string | null;
  bestellnummer: string;
  gesamtbetrag: number;
};

function LetzteStoppsLog({ driverId }: { driverId: string }) {
  const supabase = createClient();
  const [stops, setStops] = useState<StopLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    (async () => {
      const { data: batches } = await supabase
        .from('mise_delivery_batches')
        .select('id')
        .eq('driver_id', driverId)
        .gte('created_at', today.toISOString());
      if (!batches?.length) return;
      const { data: rows } = await supabase
        .from('mise_delivery_batch_stops')
        .select('id, completed_at, order:customer_orders(bestellnummer, kunde_name, kunde_adresse, gesamtbetrag)')
        .in('batch_id', (batches as { id: string }[]).map((b) => b.id))
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20);
      if (!rows) return;
      setStops((rows as any[]).map((r) => ({
        id: r.id,
        geliefert_am: r.completed_at,
        kunde_name: r.order?.kunde_name ?? '—',
        kunde_adresse: r.order?.kunde_adresse ?? null,
        bestellnummer: r.order?.bestellnummer ?? '—',
        gesamtbetrag: r.order?.gesamtbetrag ?? 0,
      })));
    })().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (stops.length === 0) return null;

  const visible = expanded ? stops : stops.slice(0, 4);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <button
        className="flex w-full items-center gap-2 mb-3"
        onClick={() => setExpanded((e) => !e)}
      >
        <ListOrdered className="h-4 w-4 text-matcha-300 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60 flex-1 text-left">
          Heutige Lieferungen ({stops.length})
        </span>
        {stops.length > 4 && (
          <ChevronDown className={cn('h-4 w-4 text-matcha-400 transition-transform', expanded && 'rotate-180')} />
        )}
      </button>
      <div className="space-y-1.5">
        {visible.map((s, i) => {
          const time = new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={s.id} className="flex items-center gap-2.5 py-1.5">
              {/* Timeline dot */}
              <div className="relative flex shrink-0 flex-col items-center">
                <div className={cn(
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center text-[9px] font-black',
                  i === 0 ? 'border-accent bg-accent/20 text-accent' : 'border-white/20 bg-white/5 text-matcha-400',
                )}>
                  {stops.length - i}
                </div>
                {i < visible.length - 1 && (
                  <div className="absolute top-5 h-full w-px bg-white/10" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-matcha-200 truncate">
                    {s.kunde_name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-matcha-400 truncate flex-1">
                    {s.kunde_adresse?.split(',')[0] ?? ''}
                  </span>
                </div>
                <div className="text-[9px] text-matcha-500">
                  #{s.bestellnummer.replace(/^[A-Z]+-/, '')}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-bold text-accent">{euro(s.gesamtbetrag)}</div>
                <div className="text-[9px] text-matcha-500 tabular-nums">{time}</div>
              </div>
            </div>
          );
        })}
      </div>
      {stops.length > 4 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 w-full text-center text-[10px] text-matcha-400 hover:text-matcha-200 transition"
        >
          + {stops.length - 4} weitere anzeigen
        </button>
      )}
    </section>
  );
}

/* ---------- MeineAbrechnungen ---------- */

interface DriverPeriod {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  deliveriesCount: number;
  totalKm: number;
  totalPayout: number;
  avgRating: number | null;
  onTimeRatePct: number | null;
  status: 'draft' | 'approved' | 'paid';
  paidAt: string | null;
  pdfUrl: string;
}

function MeineAbrechnungen() {
  const [periods, setPeriods] = useState<DriverPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/driver/periods')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.periods) setPeriods(d.periods); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && periods.length === 0) return null;

  const PERIOD_LABELS: Record<string, string> = {
    daily: 'Tagesabr.', weekly: 'Wochenabr.', monthly: 'Monatsabr.', custom: 'Abrechnung',
  };
  const STATUS_COLORS: Record<string, string> = {
    draft: 'text-white/40',
    approved: 'text-blue-400',
    paid: 'text-accent',
  };
  const STATUS_LABELS: Record<string, string> = {
    draft: 'Entwurf', approved: 'Freigegeben', paid: 'Ausgezahlt',
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2"
      >
        <Receipt className="h-4 w-4 text-matcha-300" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">
          Meine Abrechnungen
        </span>
        {periods.length > 0 && (
          <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-matcha-300">
            {periods.length}
          </span>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          ) : (
            periods.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-matcha-200">
                      {PERIOD_LABELS[p.periodType] ?? 'Abrechnung'}
                    </span>
                    <span className={cn('text-[10px] font-medium', STATUS_COLORS[p.status])}>
                      · {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <div className="text-[10px] text-matcha-500 tabular-nums mt-0.5">
                    {new Date(p.periodStart).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    {' – '}
                    {new Date(p.periodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    {' · '}{p.deliveriesCount} Lief.
                    {p.avgRating != null && ` · ★${p.avgRating.toFixed(1)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-accent tabular-nums">
                    {p.totalPayout.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                  <a
                    href={p.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-medium text-matcha-300 hover:bg-white/20 transition"
                    title="Lohnzettel als PDF"
                  >
                    <FileText className="h-3 w-3" />
                    PDF
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- MeineSchichten ---------- */

interface ShiftEntry {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: string;
  durationMinutes: number | null;
  activeMinutes: number | null;
  breakMinutes: number;
  breakCount: number;
  deliveries: number;
  distanceKm: number;
  earningsEur: number;
}

const SHIFT_STATUS_LABEL: Record<string, string> = {
  completed: 'Abgeschlossen',
  active:    'Läuft',
  missed:    'Verpasst',
};
const SHIFT_STATUS_COLOR: Record<string, string> = {
  completed: 'text-accent',
  active:    'text-blue-400',
  missed:    'text-red-400',
};

function MeineSchichten() {
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/delivery/driver/shifts?limit=15')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { shifts?: ShiftEntry[] } | null) => { if (d?.shifts) setShifts(d.shifts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && shifts.length === 0) return null;

  function fmtTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }
  function fmtMin(min: number | null): string {
    if (min === null || min < 0) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2"
      >
        <History className="h-4 w-4 text-matcha-300" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">
          Schicht-Verlauf
        </span>
        {shifts.length > 0 && (
          <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-matcha-300">
            {shifts.length}
          </span>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          ) : (
            shifts.map((s) => {
              const isExpanded = expandedId === s.id;
              const basePay = s.deliveries * 1.50;
              const distPay = s.distanceKm * 0.20;
              const calcTotal = basePay + distPay;
              const activeH = (s.activeMinutes ?? s.durationMinutes ?? 0) / 60;
              const eurPerH = activeH > 0 ? s.earningsEur / activeH : null;
              const stopsPerH = activeH > 0 ? s.deliveries / activeH : null;
              const completedStatus = s.status === 'completed';

              return (
                <div key={s.id} className="rounded-xl bg-white/5 overflow-hidden">
                  {/* Klickbarer Schicht-Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="w-full p-3 space-y-2 text-left"
                  >
                    {/* Header: Datum + Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
                        <span className="text-[11px] font-bold text-matcha-200">
                          {fmtDate(s.plannedStart)}
                        </span>
                        <span className="text-[10px] text-matcha-500 tabular-nums">
                          {fmtTime(s.actualStart)} – {fmtTime(s.actualEnd)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-[10px] font-semibold', SHIFT_STATUS_COLOR[s.status] ?? 'text-white/40')}>
                          {SHIFT_STATUS_LABEL[s.status] ?? s.status}
                        </span>
                        <ChevronDown className={cn('h-3 w-3 text-white/30 transition-transform', isExpanded && 'rotate-180')} />
                      </div>
                    </div>

                    {/* Stats-Zeile */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-accent tabular-nums">{s.deliveries}</span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Lief.</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-matcha-200 tabular-nums">
                          {s.activeMinutes !== null ? fmtMin(s.activeMinutes) : fmtMin(s.durationMinutes)}
                        </span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Aktiv</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-matcha-200 tabular-nums">
                          {s.distanceKm > 0 ? `${s.distanceKm.toFixed(1)} km` : '—'}
                        </span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Strecke</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-accent tabular-nums">
                          {s.earningsEur > 0
                            ? s.earningsEur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
                            : '—'}
                        </span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Verdienst</span>
                      </div>
                    </div>

                    {/* Pausen-Info (nur wenn vorhanden) */}
                    {s.breakCount > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] text-matcha-500">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{s.breakCount} Pause{s.breakCount !== 1 ? 'n' : ''} · {fmtMin(s.breakMinutes)}</span>
                      </div>
                    )}
                  </button>

                  {/* Aufgeklappte Verdienst-Aufschlüsselung */}
                  {isExpanded && completedStatus && (
                    <div className="border-t border-white/10 px-3 pb-3 pt-2.5 space-y-2.5">
                      <div className="text-[9px] font-black uppercase tracking-widest text-matcha-400">
                        Verdienst-Aufschlüsselung
                      </div>

                      {/* Berechnungszeilen */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-matcha-400">
                            Basis ({s.deliveries} × €1,50)
                          </span>
                          <span className="font-bold text-matcha-200 tabular-nums">
                            {basePay.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {s.distanceKm > 0 && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-matcha-400">
                              Strecke ({s.distanceKm.toFixed(1)} km × €0,20)
                            </span>
                            <span className="font-bold text-matcha-200 tabular-nums">
                              {distPay.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {s.earningsEur > 0 && Math.abs(s.earningsEur - calcTotal) > 0.01 && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-matcha-400">Bonus / Sonstiges</span>
                            <span className="font-bold text-matcha-200 tabular-nums">
                              {(s.earningsEur - calcTotal).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] border-t border-white/10 pt-1.5">
                          <span className="font-bold text-matcha-200">Gesamt erfasst</span>
                          <span className="font-black text-accent tabular-nums">
                            {s.earningsEur > 0
                              ? s.earningsEur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
                              : calcTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Effizienz-Kennzahlen */}
                      {(eurPerH !== null || stopsPerH !== null) && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {eurPerH !== null && (
                            <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                              <div className="text-sm font-black text-accent tabular-nums">
                                {eurPerH.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[9px] text-matcha-500 mt-0.5">€ / Stunde</div>
                            </div>
                          )}
                          {stopsPerH !== null && (
                            <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                              <div className="text-sm font-black text-matcha-200 tabular-nums">
                                {stopsPerH.toFixed(1)}
                              </div>
                              <div className="text-[9px] text-matcha-500 mt-0.5">Stopps / Std.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function TourBriefingCard({ batch }: { batch: { stops: { order: { gesamtbetrag: number; zahlungsart?: string | null; bezahlt?: boolean | null; kunde_adresse?: string | null } }[]; total_distance_km?: number | null; total_eta_min?: number | null } }) {
  const cashStops = batch.stops.filter(s => !s.order.bezahlt || s.order.zahlungsart === 'bar');
  const totalCash = cashStops.reduce((s, st) => s + st.order.gesamtbetrag, 0);
  const estEarnings = batch.stops.length * 1.50 + ((batch.total_distance_km ?? 0) * 0.20);
  const etaMin = batch.total_eta_min ?? null;

  if (batch.stops.length === 0) return null;

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-white/8 border border-white/15 p-4 space-y-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-matcha-300">Tour-Übersicht</div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-xl font-black text-white tabular-nums">{batch.stops.length}</div>
          <div className="text-[9px] text-matcha-400 font-bold uppercase">Stopps</div>
        </div>
        {etaMin && (
          <div className="text-center">
            <div className="text-xl font-black text-accent tabular-nums">{etaMin}</div>
            <div className="text-[9px] text-matcha-400 font-bold uppercase">Min ETA</div>
          </div>
        )}
        {batch.total_distance_km != null && (
          <div className="text-center">
            <div className="text-xl font-black text-white tabular-nums">{batch.total_distance_km.toFixed(1)}</div>
            <div className="text-[9px] text-matcha-400 font-bold uppercase">km</div>
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {cashStops.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-[11px] font-bold text-amber-200">
            💵 {cashStops.length}× Bar · {totalCash.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
          </div>
        )}
        {estEarnings > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-matcha-700/60 border border-matcha-600/40 px-2.5 py-1 text-[11px] font-bold text-matcha-100">
            ~{estEarnings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })} Verdienst
          </div>
        )}
      </div>
    </div>
  );
}

/* ----- TourLiveProgressHeader ----- */
// Kopfleiste mit Live-Sekunden-Countdown — ersetzt das IIFE-Pattern und re-rendert sekündlich.
function TourLiveProgressHeader({ batch }: {
  batch: {
    stops: { geliefert_am?: string | null }[];
    total_eta_min?: number | null;
    started_at?: string | null;
  };
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const total = batch.stops.length;
  const done = batch.stops.filter((s) => s.geliefert_am).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const etaMin = batch.total_eta_min;
  const startedAt = batch.started_at;

  // Berechne verbleibende Sekunden (live)
  const remainSec = (() => {
    if (!startedAt || etaMin == null) return null;
    const endMs = new Date(startedAt).getTime() + etaMin * 60_000;
    return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
  })();

  const overdue = remainSec === 0 && done < total;
  const totalOverdueSec = (() => {
    if (!startedAt || etaMin == null) return 0;
    const endMs = new Date(startedAt).getTime() + etaMin * 60_000;
    return Math.max(0, Math.floor((Date.now() - endMs) / 1000));
  })();

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const returnTime = (() => {
    if (remainSec == null || remainSec === 0) return null;
    return new Date(Date.now() + remainSec * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3 mb-3',
      overdue ? 'bg-red-900/30 border-red-500/40' :
      pct === 100 ? 'bg-accent/15 border-accent/30' :
      'bg-matcha-800/60 border-white/10',
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Route className="h-3.5 w-3.5 text-matcha-300" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">
            Tour-Fortschritt
          </span>
        </div>
        <span className="font-display font-bold text-accent tabular-nums">
          {done}/{total} Stopps
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-accent' :
            overdue ? 'bg-red-500 animate-pulse' :
            pct >= 60 ? 'bg-matcha-400' : 'bg-orange-400',
          )}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums">
        {pct === 100 ? (
          <span className="text-accent font-bold">Tour abgeschlossen! ✓</span>
        ) : overdue ? (
          <span className="text-red-400 font-bold animate-pulse">
            +{fmtSec(totalOverdueSec)} überfällig
          </span>
        ) : remainSec != null ? (
          <span className={cn('font-bold tabular-nums', remainSec < 300 ? 'text-amber-300' : 'text-matcha-300')}>
            Noch {fmtSec(remainSec)} bis Tour-Ende
          </span>
        ) : (
          <span className="text-matcha-400">{done < total ? 'Tour läuft…' : ''}</span>
        )}
        {returnTime && done < total && (
          <span className="text-matcha-300">
            Rückkehr ~{returnTime} Uhr
          </span>
        )}
      </div>
    </div>
  );
}

// Phase 84 — Pausen-Timer mit Backend-Integration (Phase 58 shift_breaks)
function FahrerPauseWidget() {
  const [activeShiftId, setActiveShiftId] = React.useState<string | null>(null);
  const [pauseStart, setPauseStart] = React.useState<number | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [todayPausenMin, setTodayPausenMin] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  // Aktive Schicht + laufende Pause beim Mount laden
  useEffect(() => {
    fetch('/api/delivery/driver/shifts?limit=5')
      .then(r => r.ok ? r.json() : null)
      .then((d: { shifts?: { id: string; status: string; breakMinutes?: number }[] } | null) => {
        const active = d?.shifts?.find(s => s.status === 'active');
        if (!active) return;
        setActiveShiftId(active.id);
        setTodayPausenMin(active.breakMinutes ?? 0);
        fetch(`/api/delivery/driver/shift/break?shift_id=${active.id}`)
          .then(r => r.ok ? r.json() : null)
          .then((b: { activeBreak?: { id: string; startedAt: string } | null } | null) => {
            if (b?.activeBreak) {
              setPauseStart(new Date(b.activeBreak.startedAt).getTime());
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pauseStart === null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - pauseStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [pauseStart]);

  async function startPause() {
    if (saving) return;
    setSaving(true);
    try {
      if (activeShiftId) {
        await fetch('/api/delivery/driver/shift/break', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'start', shift_id: activeShiftId, break_type: 'pause' }),
        }).catch(() => {});
      }
      setPauseStart(Date.now());
      setElapsed(0);
    } finally {
      setSaving(false);
    }
  }

  async function endPause() {
    if (saving) return;
    setSaving(true);
    try {
      if (activeShiftId) {
        await fetch('/api/delivery/driver/shift/break', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'end', shift_id: activeShiftId }),
        }).catch(() => {});
        fetch(`/api/delivery/driver/shift/break?shift_id=${activeShiftId}`)
          .then(r => r.ok ? r.json() : null)
          .then((b: { summary?: { totalBreakMinutes?: number } } | null) => {
            if (b?.summary?.totalBreakMinutes != null) setTodayPausenMin(b.summary.totalBreakMinutes);
          })
          .catch(() => {});
      } else if (pauseStart !== null) {
        const min = Math.round((Date.now() - pauseStart) / 60_000);
        setTodayPausenMin(p => p + Math.max(1, min));
      }
      setPauseStart(null);
      setElapsed(0);
    } finally {
      setSaving(false);
    }
  }

  const isPausing = pauseStart !== null;
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 mt-3 transition-colors',
      isPausing ? 'bg-amber-500/20 border-amber-400/40' : 'bg-white/5 border-white/10',
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">
            {isPausing ? '⏸ Pause läuft' : '☕ Pause'}
          </div>
          {isPausing ? (
            <div className="font-display font-black text-amber-200 text-xl tabular-nums leading-none mt-0.5">
              {mm}:{String(ss).padStart(2, '0')}
            </div>
          ) : todayPausenMin > 0 ? (
            <div className="text-[11px] text-matcha-400 mt-0.5">
              Heute: {todayPausenMin} Min Pause
            </div>
          ) : (
            <div className="text-[11px] text-matcha-400 mt-0.5">Noch keine Pause heute</div>
          )}
        </div>
        <button
          onClick={isPausing ? endPause : startPause}
          disabled={saving}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-bold shrink-0 transition active:scale-95 disabled:opacity-60',
            isPausing
              ? 'bg-amber-400 text-matcha-900 hover:bg-amber-300'
              : 'bg-white/10 text-matcha-200 hover:bg-white/20',
          )}
        >
          {saving ? '…' : isPausing ? 'Beenden' : 'Pause nehmen'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 94: FahrerSchichtCountdown — Schicht-Dauer-Tracker
// Zeigt wie lange der Fahrer schon online ist und wie viel von einer
// 8-Stunden-Schicht noch übrig bleibt, mit farbcodiertem Fortschrittsring.
// ---------------------------------------------------------------------------
function FahrerSchichtCountdown({ onlineSeit }: { onlineSeit: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const SHIFT_HOURS = 8;
  const elapsedMs = Date.now() - new Date(onlineSeit).getTime();
  const elapsedMin = Math.max(0, Math.floor(elapsedMs / 60_000));
  const elapsedHours = Math.floor(elapsedMin / 60);
  const elapsedRestMin = elapsedMin % 60;

  const shiftMaxMin = SHIFT_HOURS * 60;
  const pct = Math.min(100, Math.round((elapsedMin / shiftMaxMin) * 100));
  const remainingMin = Math.max(0, shiftMaxMin - elapsedMin);
  const remainingH = Math.floor(remainingMin / 60);
  const remainingRestMin = remainingMin % 60;

  const isDone = elapsedMin >= shiftMaxMin;
  const isLate = elapsedMin >= 7 * 60;
  const isWarn = elapsedMin >= 5 * 60;

  const ringColor = isDone ? 'text-red-400' : isLate ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-matcha-400';
  const barColor  = isDone ? 'bg-red-500' : isLate ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-matcha-500';
  const label     = isDone ? '⚠ Schicht überschritten' : isLate ? '⚠ Fast Schichtende' : isWarn ? '→ Schicht läuft gut' : '⚡ Frisch gestartet';

  // SVG Kreis-Segment (klein, 36px)
  const R = 14;
  const CIRCUM = 2 * Math.PI * R;
  const dash = (pct / 100) * CIRCUM;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Schicht-Dauer</span>
        <span className={cn('text-[10px] font-bold', ringColor)}>{label}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* SVG Fortschrittsring */}
        <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0 -rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r={R} fill="none"
            stroke={isDone || isLate ? '#ef4444' : isWarn ? '#f59e0b' : '#6aab8a'}
            strokeWidth="3"
            strokeDasharray={`${dash} ${CIRCUM}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>

        <div className="flex-1 min-w-0">
          {/* Abgelaufene Zeit */}
          <div className="flex items-baseline gap-1">
            <span className={cn('font-mono text-xl font-black tabular-nums leading-none', ringColor)}>
              {elapsedHours}:{String(elapsedRestMin).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-matcha-400">h online</span>
          </div>

          {/* Verbleibende Zeit */}
          {!isDone ? (
            <div className="text-[11px] text-matcha-400 mt-0.5">
              Noch {remainingH}:{String(remainingRestMin).padStart(2, '0')} h bis 8h
            </div>
          ) : (
            <div className="text-[11px] text-red-400 mt-0.5 font-bold">
              {elapsedHours - SHIFT_HOURS}h {String(elapsedRestMin).padStart(2, '0')}m überschritten
            </div>
          )}
        </div>

        {/* Prozent-Badge */}
        <div className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums',
          isDone || isLate ? 'bg-red-500/20 text-red-300' : isWarn ? 'bg-amber-500/20 text-amber-300' : 'bg-matcha-500/20 text-matcha-300',
        )}>
          {pct}%
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[9px] text-matcha-500">
        <span>Start: {new Date(onlineSeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
        <span>Ziel: {new Date(new Date(onlineSeit).getTime() + SHIFT_HOURS * 3_600_000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
      </div>
    </div>
  );
}

/* ---------- PositioningSuggestionBanner — Standort-Empfehlung für Idle-Fahrer ---------- */

type PositioningSuggestionData = {
  id: string;
  target_label: string;
  reason: string;
  demand_score: number;
  expires_at: string;
  target_lat: number | null;
  target_lng: number | null;
};

function PositioningSuggestionBanner() {
  const [suggestion, setSuggestion] = useState<PositioningSuggestionData | null>(null);
  const [responded, setResponded] = useState(false);
  const [minsLeft, setMinsLeft] = useState(0);

  useEffect(() => {
    fetch('/api/delivery/driver/positioning')
      .then((r) => r.json())
      .then((d) => {
        if (d?.suggestion) {
          setSuggestion(d.suggestion);
          setMinsLeft(Math.max(0, Math.round((new Date(d.suggestion.expires_at).getTime() - Date.now()) / 60_000)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!suggestion || responded) return;
    const timer = setInterval(() => {
      setMinsLeft((m) => {
        if (m <= 0) { clearInterval(timer); setSuggestion(null); return 0; }
        return m - 1;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, [suggestion, responded]);

  const respond = async (response: 'accepted' | 'rejected') => {
    if (!suggestion) return;
    setResponded(true);
    await fetch('/api/delivery/driver/positioning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestion_id: suggestion.id, response }),
    }).catch(() => {});
  };

  const openNavigation = () => {
    if (!suggestion?.target_lat || !suggestion?.target_lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${suggestion.target_lat},${suggestion.target_lng}`;
    window.open(url, '_blank');
  };

  if (!suggestion || responded) return null;

  const isHighDemand = suggestion.demand_score >= 70;

  return (
    <section className="bg-gradient-to-br from-blue-900/80 to-blue-800/80 border border-blue-700/50 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm',
            isHighDemand ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300',
          )}>
            📍
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wide">
              Positions-Empfehlung
            </div>
            <div className="text-sm font-bold text-white">{suggestion.target_label}</div>
          </div>
        </div>
        <div className="text-xs text-blue-400 shrink-0">
          {minsLeft} Min
        </div>
      </div>

      <p className="text-xs text-blue-300 leading-relaxed">{suggestion.reason}</p>

      {isHighDemand && (
        <div className="flex items-center gap-1.5 text-xs text-orange-300 font-medium">
          <span>🔥</span> Hohe Nachfrage erwartet
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {suggestion.target_lat && suggestion.target_lng && (
          <button
            onClick={() => { respond('accepted'); openNavigation(); }}
            className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <span>🗺️</span> Navigieren
          </button>
        )}
        {!suggestion.target_lat && (
          <button
            onClick={() => respond('accepted')}
            className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ Verstanden
          </button>
        )}
        <button
          onClick={() => respond('rejected')}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-blue-200 text-sm rounded-xl transition-colors"
        >
          ✕
        </button>
      </div>
    </section>
  );
}

// Smart Delivery System — Navigation Cockpit (neu)
export { SmartDeliveryNavCockpit } from "./smart-delivery-nav-cockpit";

// Phase 2280 — Smart Tour-Stops Navigation Hub
export { FahrerPhase2280SmartTourStopsNavHub } from './phase2280-smart-tour-stops-nav-hub';

// Phase 2285 — Smart Tour Stop Navigator Ultra (Tour-Stops + Navigation)
export { FahrerPhase2285SmartTourStopNavigatorUltra } from './phase2285-smart-tour-stop-navigator-ultra';

// Phase 2290 — Tour-Stopp Navi Kommando (Tour-Stops + Navigation + Waze/Maps)
export { FahrerPhase2290TourStoppNaviKommando } from './phase2290-tour-stopp-navi-kommando';

// Phase 2295 — Tour-Stopp Navigation Cockpit (Alle Stopps + GPS-Nav + ETA-Countdown)
export { FahrerPhase2295TourStoppNavigationCockpit } from './phase2295-tour-stopp-navigation-cockpit';

// Phase 2300 — Smart Tour Navigation Pro (Tour-Stops + Navi + ETA + Bestätigung)
export { FahrerPhase2300SmartTourNavPro } from './phase2300-smart-tour-nav-pro';

// Phase 2303 — Meine Pausen (Letzte Pause + Anzahl + Pflichtpausen-Erinnerung; isOnline-Guard)
export { FahrerPhase2303MeinePausen } from './phase2303-meine-pausen';
// Phase 2309 — Meine Distanz (km heute, Ø km/Tour, Tempo, Trend vs. Vorwoche, Coaching-Tipp; isOnline-Guard)
export { FahrerPhase2309MeineDistanz } from './phase2309-meine-distanz';

// Phase 2313 — Meine km (Gesamt-km heute + km/Tour + Kosten-Schätzung; Fortschrittsbalken; isOnline-Guard)
export { FahrerPhase2313MeineKm } from './phase2313-meine-km';

// Phase 2318 — Mein Tempo (Ø km/h heute + Trend vs. Vorwoche + Team-Ø; Coaching-Tipp; isOnline-Guard)
export { FahrerPhase2318MeinTempo } from './phase2318-mein-tempo';

// Phase 2323 — Meine Wartezeit (Ø Wartezeit am Restaurant heute + Trend + Team-Ø; Coaching-Tipp; isOnline-Guard)
export { FahrerPhase2323MeineWartezeit } from './phase2323-meine-wartezeit';

// Phase 2328 — Smart Tour-Stopps Navigation (Hero-Stopp + Fortschrittsbalken + expandierbare Stopp-Liste + Google Maps + Anruf)
export { FahrerPhase2328SmartTourStopsNavigation } from './phase2328-smart-tour-stops-navigation';

// Phase 2332 — Meine Storno-Rate (Storno-Rate heute + Trend + Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2332MeineStornoRate } from './phase2332-meine-storno-rate';

// Phase 2336 — Mein Qualitäts-Score (Score aus Pünktl./Storno/Bewert./Wartezt.; Trend; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2336MeinQualitaetsScore } from './phase2336-mein-qualitaets-score';

// Phase 2340 — Tour-Stops Navigation Pro (Hero-Stopp nächster Stopp + alle Stopps expandierbar + Nav-Link + Anruf + ETA je Stopp; 20-Sek-Polling)
export { FahrerPhase2340TourStopsNavigationsPro } from './phase2340-tour-stops-navigations-pro';

// Phase 2346 — Meine Schicht-Effizienz (Score + Touren/h + Wartezeit + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2346MeineSchichtEffizienz } from './phase2346-meine-schicht-effizienz';

// Phase 2350 — Mein Liefergebiet (Eigene Zone + Auslastung + Ø Distanz + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2350MeinLiefergebiet } from './phase2350-mein-liefergebiet';
// Phase 2355 — Meine Bewertungen (Eigener Schnitt + Sterne + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2355MeineBewertungen } from './phase2355-meine-bewertungen';
// Phase 2360 — Meine Pünktlichkeit (Eigene Quote + Ampel + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2360MeinePuenktlichkeit } from './phase2360-meine-puenktlichkeit';
// Phase 2365 — Mein Trinkgeld (Ø Trinkgeld/Tour + Gesamt + Trend + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2365MeinTrinkgeld } from './phase2365-mein-trinkgeld';
// Phase 2370 — Meine Lieferzeit (Ø Min + Fortschrittsbalken + KPI-Grid Touren/Kürzeste/Trend/Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2370MeineLieferzeit } from './phase2370-meine-lieferzeit';
// Phase 2375 — Meine Auslastung (Rate groß + Farbcode + Schichtdauer/Fahrzeit + Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2375MeineAuslastung } from './phase2375-meine-auslastung';
// Phase 2380 — Meine Reaktionszeit (Ø Sek groß + Fortschrittsbalken 0–180s Ziel 60s + KPI-Grid Touren/Schnellste/Trend/Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2380MeineReaktionszeit } from './phase2380-meine-reaktionszeit';
// Phase 2385 — Meine Abbruchquote (Quote groß + Farbcode + KPI-Grid Abbrüche/Touren/Trend/Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2385MeineAbbruchquote } from './phase2385-meine-abbruchquote';
// Phase 2390 — Meine Kilometer (Gesamt-km groß + Farbcode + Ø km/Tour + KPI-Grid Touren/Kürzeste/Trend/Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2390MeineKilometer } from './phase2390-meine-kilometer';
// Phase 2395 — Meine Pausenzeit (Ø Pause groß + Farbcode + Balken 0–40Min + KPI-Grid Pausen/Touren/Trend/Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2395MeinePausenzeit } from './phase2395-meine-pausenzeit';
// Phase 2400 — Meine Touren-Anzahl (Touren groß + Farbcode + Balken 0–14 + KPI-Grid VW/Ziel/Trend/Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2400MeineTourenAnzahl } from './phase2400-meine-touren-anzahl';
// Phase 2405 — Mein Effizienz-Score (Score 0–100 groß + Balken + 5-Faktoren-Aufschlüsselung + KPI-Grid VW/Trend/Ziel/Team-Ø + Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2405MeinEffizienzScore } from './phase2405-mein-effizienz-score';
// Phase 2410 — Meine Schicht-Bilanz (Einnahmen groß + Farbcode; 4-KPI-Grid Touren/km/Bewertung/Schichtdauer; Trend vs. VW; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2410MeineSchichtBilanz } from './phase2410-meine-schicht-bilanz';
// Phase 2415 — Mein Umsatz/h (€/h groß + Farbcode; Balken 0–20 €/h mit Ziel-Linien bei 8 und 12 €/h; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2415MeinUmsatzProStunde } from './phase2415-mein-umsatz-pro-stunde';
// Phase 2420 — Meine Trinkgeld-Quote (% groß + Farbcode; Balken 0–20 % mit Ziel-Linien bei 5 % und 10 %; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2420MeineTrinkgeldQuote } from './phase2420-meine-trinkgeld-quote';
// Phase 2425 — Tour-Stops & Navigation Hub (Alle Tour-Stops mit Status + Fortschrittsbalken + Stop-Dots + Navi-Button + Anruf-Button; aktiver Stop hervorgehoben; 30-Sek-Polling)
export { FahrerPhase2425TourStopsNaviHub } from './phase2425-tour-stops-navi-hub';
// Phase 2427 — Meine Bewertung (Ø★ groß + Farbcode; Stern-Visualisierung; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2427MeineBewertung } from './phase2427-meine-bewertung';
// Phase 2432 — Meine Pünktlichkeit (% groß + Farbcode; Balken 0–100% mit Ziel-Linien 75%/90%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2432MeinePuenktlichkeit } from './phase2432-meine-puenktlichkeit';
// Phase 2428 — Tour-Stopp Navigator Ultra (alle Stopps + Status-Ampel; Next-Stop Hero-Karte; Fortschrittsbalken; Navi-Button; Anruf-Button; Notiz-Anzeige; 20-Sek-Polling)
export { FahrerPhase2428TourStoppNavigatorUltra } from './phase2428-tour-stopp-navigator-ultra';
// Phase 2433 — Meine Überstunden (h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2433MeineUeberstunden } from './phase2433-meine-ueberstunden';
// Phase 2438 — Meine Nachtschicht (h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2438MeineNachtschicht } from './phase2438-meine-nachtschicht';
// Phase 2443 — Meine Wochenend-Schicht (h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2443MeineWochenendSchicht } from './phase2443-meine-wochenend-schicht';
// Phase 2448 — Meine Feiertagsschicht (h-Wert groß + Farbcode; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2448MeineFeiertagsschicht } from './phase2448-meine-feiertagsschicht';
// Phase 2453 — Mein Schicht-Balance-Score (% groß + Farbcode; Balken 0–100% mit Ziel-Linien 60%/80%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2453MeinSchichtBalanceScore } from './phase2453-mein-schicht-balance-score';
// Phase 2458 — Mein Effizienz-Index (Score groß + Ring-Gauge 0–100 mit Ziel-Linie 80; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp je Zone; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2458MeinEffizienzIndex } from './phase2458-mein-effizienz-index';
// Phase 2463 — Mein Kapazitäts-Score (Score groß + Farbcode; Fortschrittsbalken 0–100% mit Ziel-Linien 60%/80%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2463MeinKapazitaetScore } from './phase2463-mein-kapazitaet-score';
export { FahrerPhase2469MeineRueckkehrDepotEta } from './phase2469-meine-rueckkehr-depot-eta';
// Phase 2474 — Meine Lieferzeit-Effizienz (Ø-Zeit groß + Farbcode; Balken 0–45 min mit Ziel-Linien 20/30 min; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2474MeineLieferzeitEffizienz } from './phase2474-meine-lieferzeit-effizienz';
// Phase 2479 — Meine Stoppzeit (Ø-Zeit groß + Farbcode; Balken 0–15 min mit Ziel-Linien 5/10 min; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2479MeineStoppzeit } from './phase2479-meine-stoppzeit';
// Phase 2484 — Meine KM-Effizienz (km/Auftrag groß + Farbcode; Balken 0–15km mit Ziel-Linien 5/10km; KPI-Grid Aufträge/Effizienz-Score/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2484MeineKmEffizienz } from './phase2484-meine-km-effizienz';
// Phase 2489 — Meine Touren-Anzahl (Touren groß + Farbcode; Balken 0–15 mit Ziel-Linien 6/10/12; KPI-Grid VW/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2489MeineTourenAnzahl } from './phase2489-meine-touren-anzahl';
// Phase 2494 — Meine Pausen-Compliance (% groß + Farbcode; Balken 0–120% mit Ziel-Linie 100%; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2494MeinePausenCompliance } from './phase2494-meine-pausen-compliance';
// Phase 2499 — Meine Liefertreue (pünktlich/Gesamt×100% groß + Farbcode; Balken 0–100% mit Ziel-Linien 85%/95%; KPI-Grid VW/Team-Ø/Pünktlich/Gesamt; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2499MeineLiefertreue } from './phase2499-meine-liefertreue';
// Phase 2504 — Mein Durchsatz (Lieferungen/h groß + Farbcode; Balken 0–5/h mit Ziel-Linien 2/3/h; KPI-Grid VW/Team-Ø/Touren/Aktiv-h; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2504MeinDurchsatz } from './phase2504-mein-durchsatz';
// Phase 2509 — Mein Umsatz (€ heute; Balken 0–300€ mit Ziel-Linien 100/200€; Ampel <100/100-199/≥200€; KPI-Grid VW/Trend/Ziel/Team-Ø; Coaching-Tipp; isOnline-Guard; 30-Min-Polling)
export { FahrerPhase2509MeinUmsatz } from './phase2509-mein-umsatz';
// Phase 2437 — Meine Reaktionszeit (Ø Zeit bis Abfahrt nach Zuweisung; Balken 0–10min; Ampel <3min/3-7min/>7min; Coaching-Tipp)
export { FahrerPhase2437MeineReaktionszeit } from './phase2437-meine-reaktionszeit';
// Phase 2442 — Meine Storno-Quote (Stornierungen/Gesamt × 100%; Balken 0–20% mit Ziel-Linien 5%/10%; Ampel <5%/5-10%/>10%; Coaching-Tipp)
export { FahrerPhase2442MeineStornoQuote } from './phase2442-meine-storno-quote';
// Phase 2447 — Meine Schichtdauer (Stunden; Balken 0–12h mit Ziel-Linien 8h/10h; Ampel <8h/8-10h/>10h; Coaching-Tipp)
export { FahrerPhase2447MeineUeberstunden } from './phase2447-meine-ueberstunden';
// Phase 2467 — Tour-Stops Navigation Live Kommando (alle Stops mit Status-Dots; Hero Next-Stop; Navi-Button; Anruf-Button; Notiz-Alert; Fortschrittsbalken; 20-Sek-Polling)
export { FahrerPhase2467TourStopsNavigationLiveKommando } from './phase2467-tour-stops-navigation-live-kommando';
// Phase 2480 — Tour-Stopp Navigator Ultimate (vollständige Stop-Liste; Next-Stop-Fokus; ETA-Countdown; Nav-Buttons Google/Waze/Apple; Stop-Bestätigung angekommen/zugestellt)
export { FahrerPhase2480TourStoppNavUltimate } from './phase2480-tour-stopp-nav-ultimate';
// Phase 2495 — Tour-Stopp Navigation Master (Aktueller Stopp im Fokus; Fortschrittsring; Nav-Buttons Google/Waze/Apple; ETA-Countdown; Next-Stops-Preview; Alle Stopps aufklappbar; mobile-optimiert)
export { FahrerPhase2495TourStoppNavigationMaster, type MasterTourStop } from './phase2495-tour-stopp-navigation-master';
// Phase 2510 — Tour-Stopp Navigations-Hub (priorisierte Stop-Liste; ETA je Stopp; One-Tap Navi; Stopp-Bestätigung; Kundentelefon; mobile-first; 30-Sek-Polling)
export { FahrerPhase2510TourStoppNavigationsHub } from './phase2510-tour-stopp-navigations-hub';
// Phase 2523 — Tour-Stopp Smart-Navi Pro (Hero-Fokus nächster Stopp; 1-Tap Navigation Google/Apple/Waze; Anruf-Button; Fortschrittsleiste; Alle Stopps aufklappbar; mobile-optimiert)
export { FahrerPhase2523TourStoppSmartNaviPro } from './phase2523-tour-stopp-smart-navi-pro';
// Phase 2600 — Smart Tour-Stopp Navigator Final (Aktueller Stopp + Navigation-Button + Telefon + Bestätigung; Stop-Liste mit Status-Dots; ETA; 1-Sek-Tick)
export { FahrerPhase2600SmartTourStoppNavigatorFinal } from './phase2600-smart-tour-stopp-navigator-final';
