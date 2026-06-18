import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Bike, MapPin, Plug, Banknote, Users, ArrowRight, Clock, TrendingUp, Zap, BarChart3, Activity,
  Star, Calendar, Target, AlertTriangle, PackageX, Clock as ClockIcon,
  Wallet, UserCheck, List, Ticket, XCircle, MapPinned, ShieldAlert,
  BellRing, Megaphone, RotateCcw, Signal, SlidersHorizontal,
  Settings, DollarSign, ShieldCheck, UserPlus, CalendarClock, Bell, BadgePercent, BellDot,
  Smartphone, FileBarChart, Award, TrendingDown, ClipboardCheck, BrainCircuit,
  LineChart, Gauge, Wrench, Building, Webhook, Gift, FlaskConical,
  UserX, Flame, Route, HeartPulse, MapPinOff, GitCompare, UtensilsCrossed, CalendarRange, MailCheck,
  Repeat2, CreditCard, Coins, MessageCircle, Trophy, Navigation2, MonitorDot, Crosshair, PieChart,
  Smile, Receipt, Heart, CloudRain, Network, LayoutGrid, WandSparkles, FilePen, Leaf, Medal,
} from 'lucide-react';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { euro } from '@/lib/utils';
// import { SeedTestButton } from './seed-test-button'; // deaktiviert in Produktion

export const dynamic = 'force-dynamic';

export default async function DeliveryOverviewPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: tenant },
    { count: driversCount },
    { count: activeDriversCount },
    { count: openDeliveries },
    { data: salesToday },
    { data: platformConfigs },
    { count: waitlistCount },
  ] = await Promise.all([
    svc.from('tenants').select('liefergebuehr,mindestbestellwert,lieferradius_km').eq('id', emp.tenant_id).single(),
    svc.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', emp.tenant_id).eq('rolle', 'fahrer'),
    svc.from('driver_status').select('driver_id', { count: 'exact', head: true }).eq('online', true),
    svc.from('customer_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', emp.tenant_id).in('status', ['bereit_zur_lieferung', 'unterwegs']),
    svc.from('customer_orders').select('gesamtbetrag').eq('tenant_id', emp.tenant_id).eq('bestellart', 'lieferung').gte('bestellt_am', today),
    svc.from('tenant_platform_configs').select('source,aktiv').eq('tenant_id', emp.tenant_id),
    svc.from('platform_waitlist').select('source', { count: 'exact', head: true }).eq('tenant_id', emp.tenant_id),
  ]);

  const umsatzLieferung = (salesToday as { gesamtbetrag: number | null }[] | null ?? [])
    .reduce((s, r) => s + Number(r.gesamtbetrag ?? 0), 0);

  const activePlatforms = (platformConfigs as { source: string; aktiv: boolean }[] ?? []).filter((p) => p.aktiv).length;

  return (
    <>
      <PageHeader
        title="Lieferdienst"
        description="Fahrer, Touren, Konditionen und externe Plattformen an einem Ort."
      />

      {/* Test-Orders-Button — deaktiviert (Produktion). Falls dev-only, in Env-Check verpacken.
      <div className="mb-6">
        <SeedTestButton />
      </div>
      */}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KPI icon={<TrendingUp size={14} />} label="Umsatz Lieferung heute" value={euro(umsatzLieferung)} />
        <KPI icon={<Clock size={14} />}      label="Offene Touren"          value={openDeliveries ?? 0} />
        <KPI icon={<Bike size={14} />}       label="Fahrer online"          value={`${activeDriversCount ?? 0}/${driversCount ?? 0}`} />
        <KPI icon={<Plug size={14} />}       label="Plattformen aktiv"      value={activePlatforms} />
      </div>

      {/* ── Live-Betrieb ─────────────────────────────────────── */}
      <SectionGroup title="Live-Betrieb">
        <SectionCard href="/dispatch" icon={<MapPin className="h-5 w-5" />} title="Touren & Dispatch"
          subtitle={`${openDeliveries ?? 0} Lieferungen offen · Live-Karte`} cta="Touren öffnen"
          highlight={Boolean(openDeliveries && openDeliveries > 0)} />
        <SectionCard href="/delivery/dispatch-queue" icon={<SlidersHorizontal className="h-5 w-5" />} title="Dispatch-Queue"
          subtitle="Prioritätsliste offener Bestellungen · Boost und Eskalation" cta="Queue ansehen" />
        <SectionCard href="/delivery/queue-signal" icon={<Signal className="h-5 w-5" />} title="Kapazitäts-Signal"
          subtitle="Normal / Surge / Pausiert – Bestellannahme steuern" cta="Signal steuern" />
        <SectionCard href="/delivery/alerts" icon={<AlertTriangle className="h-5 w-5" />} title="Betriebsalarme"
          subtitle="Aktive Alarme · Queue, Fahrer, Küche, ETA-Genauigkeit" cta="Alarme ansehen" />
        <SectionCard href="/delivery/delay-monitor" icon={<ClockIcon className="h-5 w-5" />} title="Verzögerungs-Monitor"
          subtitle="Verspätete Bestellungen · Kompensations-Gutscheine" cta="Monitor öffnen" />
        <SectionCard href="/delivery/amendments" icon={<FilePen className="h-5 w-5" />} title="Bestellungsänderungen"
          subtitle="Nachträgliche Änderungen mit Audit-Trail · In-Flight-Erkennung · Dispatch-Impact" cta="Änderungen öffnen" />
        <SectionCard href="/delivery/carbon-footprint" icon={<Leaf className="h-5 w-5" />} title="CO₂-Fußabdruck"
          subtitle="Tägliche Emissionen · Eco-Touren-Rate · Fahrer-Eco-Ranking · Baum-Äquivalente · 30-Tage-Trend" cta="CO₂ ansehen" />
        <SectionCard href="/delivery/quality-score" icon={<Medal className="h-5 w-5" />} title="Qualitäts-Score"
          subtitle="Composite-Note A–F · Pünktlichkeit, Zufriedenheit, SLA, Stornierungen · 30-Tage-Trend" cta="Score ansehen" />
        <SectionCard href="/delivery/benchmarking" icon={<BarChart3 className="h-5 w-5" />} title="Benchmark-Analyse"
          subtitle="Multi-Standort-Vergleich · Qualität/SLA/CO₂/Durchsatz/Effizienz · Best-Practice-Export · Tägliches Ranking" cta="Benchmark ansehen" />
        <SectionCard href="/delivery/stale-orders" icon={<PackageX className="h-5 w-5" />} title="Feststeckende Bestellungen"
          subtitle="Ohne Fahrer seit >10 Min · Eskalationsstatus" cta="Prüfen" />
        <SectionCard href="/delivery/gps-trails" icon={<MapPinned className="h-5 w-5" />} title="GPS-Fahrerspuren"
          subtitle="Live-Positionen · Fahrspuren der letzten 30 Minuten" cta="GPS ansehen" />
        <SectionCard href="/delivery/performance" icon={<Gauge className="h-5 w-5" />} title="Fahrer-Performance live"
          subtitle="Lieferungen heute, Kapazität und aktiver Batch-Status" cta="Performance" />
        <SectionCard href="/delivery/live-ops" icon={<MonitorDot className="h-5 w-5" />} title="Live-Ops Command Center"
          subtitle="KPIs · Fahrerstatus · Touren · Bestellfluss auf einen Blick" cta="Command Center" highlight />
        <SectionCard href="/delivery/scheduled" icon={<Calendar className="h-5 w-5" />} title="Vorbestellungen"
          subtitle="Geplante Lieferungen · manuelle Freigabe" cta="Vorbestellungen" />
        <SectionCard href="/delivery/trends" icon={<TrendingDown className="h-5 w-5" />} title="Tages-Trends"
          subtitle="Heute vs. gestern · Bestellungen, Lieferungen und Bewertungen" cta="Trends ansehen" />
      </SectionGroup>

      {/* ── Fahrer ───────────────────────────────────────────── */}
      <SectionGroup title="Fahrer">
        <SectionCard href="/drivers" icon={<Users className="h-5 w-5" />} title="Fahrer-Verwaltung"
          subtitle={`${driversCount ?? 0} Fahrer · ${activeDriversCount ?? 0} gerade online`} cta="Fahrer verwalten" />
        <SectionCard href="/delivery/applications" icon={<UserPlus className="h-5 w-5" />} title="Fahrer-Bewerbungen"
          subtitle="Onboarding-Trichter · Bewerbungen prüfen und genehmigen" cta="Bewerbungen" />
        <SectionCard href="/delivery/compliance" icon={<ShieldCheck className="h-5 w-5" />} title="Compliance & Zertifizierungen"
          subtitle="Fahrerdokumente · ablaufende Zertifikate · Dispatch-Sperren" cta="Compliance prüfen" />
        <SectionCard href="/delivery/driver-leaderboard" icon={<TrendingUp className="h-5 w-5" />} title="Fahrer-Rangliste"
          subtitle="Touren, Pünktlichkeit, Bewertungen und Verdienst im Vergleich" cta="Rangliste" />
        <SectionCard href="/delivery/driver-reliability" icon={<Award className="h-5 w-5" />} title="Fahrer-Zuverlässigkeit"
          subtitle="No-Shows, Verspätungen, Frühende · Zuverlässigkeits-Score" cta="Zuverlässigkeit" />
        <SectionCard href="/delivery/broadcasts" icon={<Megaphone className="h-5 w-5" />} title="Fahrer-Broadcasts"
          subtitle="Betriebsnachrichten an alle Fahrer senden" cta="Broadcasts" />
        <SectionCard href="/delivery/push-stats" icon={<Smartphone className="h-5 w-5" />} title="Push-Statistiken"
          subtitle="Fahrer-Push-Durchsatz · Mise App & Web Push · Ausstehende Pushes" cta="Push-Stats" />
        <SectionCard href="/delivery/fatigue-monitor" icon={<HeartPulse className="h-5 w-5" />} title="Erschöpfungs-Monitor"
          subtitle="Fahrer-Ermüdungsscore · Risiko-Alerts · Schutzmaßnahmen" cta="Monitor öffnen" />
        <SectionCard href="/delivery/comms-log" icon={<List className="h-5 w-5" />} title="Kommunikations-Log"
          subtitle="Admin-Nachrichten und Broadcasts an Fahrer · Verlauf" cta="Log ansehen" />
        <SectionCard href="/delivery/driver-digest" icon={<MailCheck className="h-5 w-5" />} title="Fahrer Tagesabschluss-Mail"
          subtitle="Personalisierte Tagesberichte per E-Mail · Leistung, Verdienst, Challenges · täglich 20:00 UTC" cta="Konfigurieren" />
      </SectionGroup>

      {/* ── Planung & Schichten ───────────────────────────────── */}
      <SectionGroup title="Planung & Schichten">
        <SectionCard href="/delivery/capacity-planner" icon={<LayoutGrid className="h-5 w-5" />} title="Kapazitäts-Planer"
          subtitle="7-Tage Fahrerbesetzung · Nachfragebasierte Empfehlungen · Lücken-Erkennung" cta="Planer öffnen" />
        <SectionCard href="/delivery/shift-calendar" icon={<CalendarRange className="h-5 w-5" />} title="Schicht-Kalender"
          subtitle="Wochenübersicht aller Schichten · Coverage-Status · Schichten planen" cta="Kalender öffnen" />
        <SectionCard href="/delivery/coverage" icon={<UserCheck className="h-5 w-5" />} title="Schichtabdeckung"
          subtitle="Besetzungsplan · Unterdeckungen der nächsten 24h" cta="Abdeckung prüfen" />
        <SectionCard href="/delivery/shift-planner" icon={<Calendar className="h-5 w-5" />} title="Schicht-Planung (7 Tage)"
          subtitle="Stundengenaue Prognose vs. geplante Fahrer · Gap-Übersicht" cta="Planung ansehen" />
        <SectionCard href="/delivery/shift-suggestions" icon={<Zap className="h-5 w-5" />} title="Auto-Schichtvorschläge"
          subtitle="KI-basierte Schichtempfehlungen aus Nachfrageprognose" cta="Vorschläge ansehen" />
        <SectionCard href="/delivery/auto-shift-generator" icon={<WandSparkles className="h-5 w-5" />} title="Auto-Schicht-Generator"
          subtitle="Kapazitätslücken → Schichtentwurf → Ein-Klick-Übertrag · Fahrerzuweisung nach Zuverlässigkeit" cta="Generator öffnen" />
        <SectionCard href="/delivery/shift-claims" icon={<ClipboardCheck className="h-5 w-5" />} title="Schicht-Anmeldungen"
          subtitle="Offene Fahrer-Anmeldungen prüfen und genehmigen" cta="Anmeldungen prüfen" />
        <SectionCard href="/delivery/windows" icon={<CalendarClock className="h-5 w-5" />} title="Lieferfenster"
          subtitle="Zeitslots konfigurieren · Kapazitäten und Buchungen" cta="Fenster verwalten" />
        <SectionCard href="/delivery/surge-prediction" icon={<Flame className="h-5 w-5" />} title="Surge-Prognose"
          subtitle="KI-Vorhersage für Stoßzeiten · Fahrer-Mobilisierung" cta="Prognosen ansehen" />
        <SectionCard href="/delivery/peak-intelligence" icon={<TrendingUp className="h-5 w-5" />} title="Peak-Tage-Intelligenz"
          subtitle="Wochentag-Muster · Event-Kalender · Stoßtag-Prognose 14 Tage" cta="Peaks ansehen" />
      </SectionGroup>

      {/* ── Analytics & Reports ───────────────────────────────── */}
      <SectionGroup title="Analytics & Reports">
        <SectionCard href="/delivery/reporting" icon={<FileBarChart className="h-5 w-5" />} title="Business-Reporting"
          subtitle="Tages- und Perioden-KPIs · Umsatz, Bestellungen und Fahrer" cta="Berichte ansehen" />
        <SectionCard href="/delivery/profitability" icon={<TrendingUp className="h-5 w-5" />} title="Profitabilität (P&L)"
          subtitle="Kosten je Lieferung · Marge · Zonen- und Fahrer-P&L" cta="P&L ansehen" />
        <SectionCard href="/delivery/trip-cost-intelligence" icon={<Receipt className="h-5 w-5" />} title="Trip-Kosten-Analyse"
          subtitle="Echtzeit-Ökonomie jeder Tour · Fahrerlohn + Kraftstoff + Fixkosten vs. Liefergebühr · Marge pro Fahrer" cta="Kosten analysieren" />
        <SectionCard href="/delivery/tour-analytics" icon={<Route className="h-5 w-5" />} title="Tour-Analytics"
          subtitle="Touren-Performance · Stoppzeiten · Bündelungs-Effizienz" cta="Touren analysieren" />
        <SectionCard href="/delivery/route-optimization" icon={<GitCompare className="h-5 w-5" />} title="Routen-Optimierung"
          subtitle="2-opt + Google TSP · Distanzeinsparung · Zeitfenster-Compliance · alle 10 Min automatisch" cta="Routen optimieren" />
        <SectionCard href="/delivery/sla" icon={<Activity className="h-5 w-5" />} title="SLA-Bericht"
          subtitle="On-Time-Rate, Lieferzeitabweichung · Performance nach Fahrer & Zone" cta="SLA ansehen" />
        <SectionCard href="/delivery/flow-intelligence" icon={<Zap className="h-5 w-5" />} title="Bestellfluss-Intelligenz"
          subtitle="Volume-Anomalien · Stornierungsmuster · Fahrerengpässe · Auto-Incidents" cta="Fluss ansehen" />
        <SectionCard href="/delivery/menu-analytics" icon={<UtensilsCrossed className="h-5 w-5" />} title="Menü-Analytics"
          subtitle="Beliebteste Artikel · Umsatz-Contribution · Bestell-Trends" cta="Menü analysieren" />
        <SectionCard href="/delivery/geo-demand" icon={<MapPinOff className="h-5 w-5" />} title="Geo-Nachfrage"
          subtitle="Nachfragekonzentration nach Postleitzahl · Expansions-Hinweise" cta="Geo-Demand" />
        <SectionCard href="/delivery/heatmap" icon={<BarChart3 className="h-5 w-5" />} title="Auslastungs-Heatmap"
          subtitle="Liefervolumen nach Wochentag & Uhrzeit · Stoßzeiten" cta="Heatmap öffnen" />
        <SectionCard href="/delivery/eta-accuracy" icon={<Target className="h-5 w-5" />} title="ETA-Genauigkeit"
          subtitle="Vorhersagegenauigkeit · Kalibrierungsfaktoren nach Zone & Zeit" cta="ETA-Bericht" />
        <SectionCard href="/delivery/satisfaction" icon={<Star className="h-5 w-5" />} title="Kundenzufriedenheit"
          subtitle="Bewertungen, Trends und Feedback nach Fahrer" cta="Bewertungen ansehen" />
        <SectionCard href="/delivery/rating-trends" icon={<LineChart className="h-5 w-5" />} title="Bewertungs-Trends"
          subtitle="Wöchentliche & monatliche Rating-Aggregation · Fahrer- und Zonen-Vergleich" cta="Trends ansehen" />
        <SectionCard href="/delivery/events" icon={<List className="h-5 w-5" />} title="Liefer-Ereignisse"
          subtitle="Audit-Trail · Dispatch, Touren, Fahrer, ETA-Events" cta="Ereignisse" />
      </SectionGroup>

      {/* ── KI-Tools ─────────────────────────────────────────── */}
      <SectionGroup title="KI-Tools">
        <SectionCard href="/delivery/ai-assist" icon={<BrainCircuit className="h-5 w-5" />} title="KI-Dispatch-Assistent"
          subtitle="Claude analysiert Live-Zustand und liefert Dispatch-Empfehlungen" cta="KI starten" />
        <SectionCard href="/delivery/ai-forecast" icon={<LineChart className="h-5 w-5" />} title="KI-Nachfrage-Prognose"
          subtitle="Claude prognostiziert Stoßzeiten und Fahrerbedarf" cta="Prognose starten" />
        <SectionCard href="/delivery/demand-forecast" icon={<BrainCircuit className="h-5 w-5" />} title="Smart Demand Forecasting"
          subtitle="Stündliche Prognose-Genauigkeit · Forecast vs. Ist · 7-Tage Wochenraster" cta="Forecasting öffnen" />
        <SectionCard href="/delivery/digest" icon={<FileBarChart className="h-5 w-5" />} title="Tages-Digest (KI)"
          subtitle="Automatische KI-Zusammenfassung der Betriebslage · Anomalie-Erkennung" cta="Digest öffnen" />
        <SectionCard href="/delivery/weather-intelligence" icon={<CloudRain className="h-5 w-5" />} title="Wetter-Intelligenz"
          subtitle="Echtzeit-Wetterdaten · Schwierigkeits-Score · ETA-Faktor · Nachfrage-Prognose" cta="Wetter öffnen" />
        <SectionCard href="/delivery/network-health" icon={<Network className="h-5 w-5" />} title="Netzwerk-Gesundheit"
          subtitle="7-Faktoren Score (0–100) · Pünktlichkeit · Zufriedenheit · Auslastung · Profitabilität" cta="Score ansehen" />
      </SectionGroup>

      {/* ── Finanzen ─────────────────────────────────────────── */}
      <SectionGroup title="Finanzen & Vergütung">
        <SectionCard href="/delivery/payouts" icon={<Wallet className="h-5 w-5" />} title="Fahrer-Abrechnungen"
          subtitle="Abrechnungsperioden · Genehmigung · Auszahlungsstatus" cta="Abrechnungen" />
        <SectionCard href="/delivery/payout-config" icon={<Settings className="h-5 w-5" />} title="Abrechnungs-Konfiguration"
          subtitle="Basis-Vergütung, km-Satz, Peak-Bonus, Meilensteine" cta="Konfigurieren" />
        <SectionCard href="/delivery/fee-config" icon={<DollarSign className="h-5 w-5" />} title="Zonen-Gebühren"
          subtitle="Liefergebühren, Mindestbestellwerte und Gratis-Schwellen pro Zone" cta="Gebühren" />
        <SectionCard href="/delivery/driver-bonus" icon={<Gift className="h-5 w-5" />} title="Fahrer-Boni"
          subtitle="Leistungsboni nach Lieferungen, Pünktlichkeit und Rating" cta="Boni verwalten" />
        <SectionCard href="/delivery/driver-incentives" icon={<Trophy className="h-5 w-5" />} title="Echtzeit-Incentives"
          subtitle="Per-Lieferung Boni bei Surge, Stoßzeiten, Schicht-Meilensteinen und Qualitäts-Score" cta="Incentives" />
        <SectionCard href="/delivery/tips" icon={<Heart className="h-5 w-5" />} title="Trinkgeld-System"
          subtitle="Kundenseitige Trinkgelder · Fahrer-Leaderboard · Konfiguration · Tages-Snapshots" cta="Trinkgeld öffnen" />
        <SectionCard href="/delivery/sla-compensation" icon={<Activity className="h-5 w-5" />} title="SLA-Auto-Kompensation"
          subtitle="Automatische Gutschriften bei SLA-Verletzungen · Schwellenwerte" cta="Kompensation" />
        <SectionCard href="/delivery/credits" icon={<Ticket className="h-5 w-5" />} title="Kundengutschriften"
          subtitle="Gutschriften nach Verspätungen und Zustellproblemen" cta="Gutschriften" />
        <SectionCard href="/delivery/credit-rules" icon={<BadgePercent className="h-5 w-5" />} title="Gutschrift-Regeln"
          subtitle="Automatische Gutschriften bei Verspätungen konfigurieren" cta="Regeln anpassen" />
        <SectionCard href="/delivery/cash-reconciliation" icon={<Coins className="h-5 w-5" />} title="Bargeld-Abrechnung"
          subtitle="Bar-Übergaben pro Fahrer · Kassenstand · Differenz-Erkennung · Tagesabschluss" cta="Kasse öffnen" />
      </SectionGroup>

      {/* ── Loyalty & A/B-Tests ──────────────────────────────── */}
      <SectionGroup title="Loyalty & A/B-Tests">
        <SectionCard href="/delivery/loyalty" icon={<Star className="h-5 w-5" />} title="Loyalty-Programm"
          subtitle="Punkte, Stufen und Einlösung für Stammkunden" cta="Programm verwalten" />
        <SectionCard href="/delivery/loyalty-ab" icon={<FlaskConical className="h-5 w-5" />} title="A/B-Tests Loyalty"
          subtitle="Teste verschiedene Punktemultiplikatoren auf echten Kundendaten" cta="Tests verwalten" />
        <SectionCard href="/delivery/churn-prevention" icon={<UserX className="h-5 w-5" />} title="Kunden-Retention"
          subtitle="RFM-Score · Abwanderungsrisiko · Re-Engagement-Kampagnen · Win-Back" cta="Retention öffnen" />
        <SectionCard href="/delivery/reorder-engine" icon={<Repeat2 className="h-5 w-5" />} title="Wiederbestellungs-Engine"
          subtitle="Kunden-Profile · Lieblings-Artikel · Bestellmuster · Wiederbestellrate" cta="Engine öffnen" />
        <SectionCard href="/delivery/subscriptions" icon={<CreditCard className="h-5 w-5" />} title="Liefer-Abonnements"
          subtitle="Flatrate-Pläne · Aktive Abos · MRR · Auto-Renewal · Kunden-Ersparnisse" cta="Abos verwalten" />
        <SectionCard href="/delivery/mov-ab-test" icon={<FlaskConical className="h-5 w-5" />} title="MOV A/B-Test"
          subtitle="Mindestbestellwert-Experimente je Zone (A/B/C/D) und Tageszeit · Konversionsrate und Ø-Bestellwert vergleichen" cta="Tests verwalten" />
      </SectionGroup>

      {/* ── Probleme & Eskalation ────────────────────────────── */}
      <SectionGroup title="Probleme & Eskalation">
        <SectionCard href="/delivery/incidents" icon={<ShieldAlert className="h-5 w-5" />} title="Vorfälle"
          subtitle="Bewertungen, Verspätungen, Beschädigungen · Eskalationsworkflow" cta="Vorfälle verwalten" />
        <SectionCard href="/delivery/failed-attempts" icon={<XCircle className="h-5 w-5" />} title="Fehlgeschlagene Zustellungen"
          subtitle="Nicht zugestellt · Retry-Planung · Auflösung" cta="Versuche verwalten" />
        <SectionCard href="/delivery/recovery" icon={<RotateCcw className="h-5 w-5" />} title="Tour-Recovery"
          subtitle="Abgebrochene Touren neu einplanen · Bestellungen retten" cta="Recovery" />
      </SectionGroup>

      {/* ── Konfiguration & System ───────────────────────────── */}
      <SectionGroup title="Konfiguration & System">
        <SectionCard href="/delivery/config" icon={<Wrench className="h-5 w-5" />} title="Lieferdienst-Konfiguration"
          subtitle="Dispatch, ETA, Bundling, Zonen und Scoring-Gewichte" cta="Konfiguration" />
        <SectionCard href="/delivery/conditions" icon={<Banknote className="h-5 w-5" />} title="Konditionen"
          subtitle={`Liefergebühr ${tenant?.liefergebuehr ? euro(tenant.liefergebuehr) : '—'} · Mindest ${tenant?.mindestbestellwert ? euro(tenant.mindestbestellwert) : '—'}`}
          cta="Preise & Limits" />
        <SectionCard href="/delivery/zone" icon={<MapPin className="h-5 w-5" />} title="Liefergebiet"
          subtitle={tenant?.lieferradius_km ? `Radius ${tenant.lieferradius_km} km` : 'Noch nicht definiert'} cta="Radius & Zonen" />
        <SectionCard href="/delivery/alert-rules" icon={<BellDot className="h-5 w-5" />} title="Alarm-Regeln"
          subtitle="Schwellwerte für Queue, Fahrer, Küche und ETA konfigurieren" cta="Alarm-Regeln" />
        <SectionCard href="/delivery/notification-config" icon={<Bell className="h-5 w-5" />} title="Kunden-Push-Konfiguration"
          subtitle="Webhook, Ereignisse und Versand-Einstellungen" cta="Konfigurieren" />
        <SectionCard href="/delivery/notification-log" icon={<BellRing className="h-5 w-5" />} title="Kunden-Benachrichtigungen"
          subtitle="Gesendete Push/SMS nach Bestellstatus · Erfolgsquote" cta="Log ansehen" />
        <SectionCard href="/delivery/webhooks" icon={<Webhook className="h-5 w-5" />} title="Webhooks"
          subtitle="Liefer-Events an externe Systeme weiterleiten" cta="Webhooks verwalten" />
        <SectionCard href="/delivery/platforms" icon={<Plug className="h-5 w-5" />} title="Externe Lieferdienste"
          subtitle={activePlatforms > 0 ? `${activePlatforms} aktiv · Deliverect, Lieferando, Uber, Wolt` : `Noch keine verbunden${waitlistCount ? ` · ${waitlistCount} auf Warteliste` : ''}`}
          cta={activePlatforms > 0 ? 'Verwalten' : 'Verbinden'} />
        <SectionCard href="/delivery/franchise" icon={<Building className="h-5 w-5" />} title="Franchise-Leitstelle"
          subtitle="Live-Status aller Standorte · Queue, Touren und Alarme" cta="Alle Standorte" />
        <SectionCard href="/delivery/franchise-compare" icon={<GitCompare className="h-5 w-5" />} title="Standort-Vergleich"
          subtitle="KPI-Benchmark zwischen allen Franchise-Standorten" cta="Vergleich ansehen" />
        <SectionCard href="/delivery/whatsapp" icon={<MessageCircle className="h-5 w-5" />} title="WhatsApp-Benachrichtigungen"
          subtitle="Bestell-Status-Updates via WhatsApp · Meta Cloud API oder Twilio · Opt-In-Verwaltung" cta="WhatsApp konfigurieren" />
        <SectionCard href="/delivery/customer-web-push" icon={<BellRing className="h-5 w-5" />} title="Kunden Browser-Push"
          subtitle="Native Browser-Push-Benachrichtigungen · VAPID · Lieferstatus-Updates ohne App" cta="Push verwalten" />
        <SectionCard href="/delivery/push-analytics" icon={<Activity className="h-5 w-5" />} title="Push-Analytics"
          subtitle="Kanal-übergreifende Performance · VAPID + WhatsApp + Fahrer-Push · Zustellraten & Event-Aufschlüsselung" cta="Analytics öffnen" />
        <SectionCard href="/delivery/rfm-segmentation" icon={<PieChart className="h-5 w-5" />} title="Kunden-Segmentierung (RFM)"
          subtitle="Recency · Frequency · Monetary · 10 Segmente · Champions · At-Risk · Lost · Zielgruppen für Push-Kampagnen" cta="Segmente ansehen" />
        <SectionCard href="/delivery/feedback-sentiment" icon={<Smile className="h-5 w-5" />} title="Feedback-Sentiment-Analyse"
          subtitle="Keyword-basierte Stimmungsanalyse aller Bewertungskommentare · Positiv/Negativ/Neutral · Geflaggte Kommentare" cta="Analyse öffnen" />
        <SectionCard href="/delivery/health-observatory" icon={<HeartPulse className="h-5 w-5" />} title="System-Health-Observatory"
          subtitle="End-to-End-Gesundheits-Score · Datenqualität · Service-Status" cta="Health ansehen" />
        <SectionCard href="/delivery/ops-center" icon={<MonitorDot className="h-5 w-5" />} title="Ops-Cockpit"
          subtitle="Echtzeit-KPIs: Queue, Fahrer, Alarme, SLA, Umsatz — Aktualisierung alle 30s" cta="Cockpit öffnen" />
      </SectionGroup>

      {/* ── Qualität & Erfahrung ─────────────────────────────── */}
      <SectionGroup title="Qualität & Erfahrung">
        <SectionCard href="/delivery/cdes" icon={<Star className="h-5 w-5" />} title="Erfahrungs-Score (CDES)"
          subtitle="Ganzheitlicher Qualitäts-Score · ETA-Genauigkeit, Benachrichtigungen, Fahrer-Verlässlichkeit" cta="Score ansehen" />
        <SectionCard href="/delivery/challenges" icon={<Trophy className="h-5 w-5" />} title="Fahrer-Challenges"
          subtitle="Gamifizierte Anreize · Zeitbegrenzte Delivery-Ziele · Automatische Fortschrittsverfolgung" cta="Challenges verwalten" />
        <SectionCard href="/delivery/driver-streaks" icon={<Flame className="h-5 w-5" />} title="Streak-Tracking V2"
          subtitle="Pünktlichkeits-Serien · Multiplikator-Boni bei 5/10/20/50 Stops · Meilenstein-Prämien" cta="Streaks ansehen" />
        <SectionCard href="/delivery/positioning" icon={<Navigation2 className="h-5 w-5" />} title="Fahrer-Vorpositionierung"
          subtitle="Smart Pre-Positioning · Idle-Fahrer in Bedarfszonen lenken · Demand-basierte Empfehlungen" cta="Positioning öffnen" />
        <SectionCard href="/delivery/geo-clustering" icon={<Crosshair className="h-5 w-5" />} title="Geo-Clustering"
          subtitle="K-Means Hotspot-Analyse · Liefer-Cluster aus Echtdaten · Optimale Fahrer-Positionen" cta="Clustering öffnen" />
      </SectionGroup>
    </>
  );
}

function SectionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mb-8">
      <h2 className="font-display text-base font-bold text-foreground/70 uppercase tracking-widest border-b border-border pb-2">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-matcha-700">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold">{value}</div>
    </Card>
  );
}

function SectionCard({
  href, icon, title, subtitle, cta, highlight,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border bg-card p-5 hover:shadow-soft hover:-translate-y-0.5 transition block ${
        highlight ? 'border-matcha-500/50 bg-matcha-50/40' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-bold">{title}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 group-hover:translate-x-0.5 transition" />
      </div>
      <div className="mt-3 text-xs font-bold text-matcha-800 flex items-center gap-1">
        {cta} <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
