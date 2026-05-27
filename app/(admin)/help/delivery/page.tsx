import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';

export default function DeliveryDocsPage() {
  return (
    <>
      <PageHeader title="Lieferdienst · Handbuch" description="Von der ersten Lieferung bis zur Fahrer-App." backHref="/help" />

      <div className="max-w-3xl prose prose-sm prose-headings:font-display prose-headings:font-black prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-lg prose-h3:mt-6">

<h2>1. Einrichten</h2>

<h3>1.1 Liefergebiet</h3>
<p><Link href="/delivery/zone">/delivery/zone</Link> → Radius um deinen Standort setzen (1–30 km). Bestellungen außerhalb werden auf der Bestellseite abgelehnt.</p>

<h3>1.2 Konditionen</h3>
<p><Link href="/delivery/conditions">/delivery/conditions</Link>:</p>
<ul>
<li><strong>Liefergebühr</strong> (z. B. 2,90 €) — Presets Gratis/1,90/2,90/3,90/4,90</li>
<li><strong>Mindestbestellwert</strong> (z. B. 12 €)</li>
<li><strong>Lieferzeit</strong> (wird Kunden angezeigt)</li>
</ul>

<h3>1.3 Zahlungsarten</h3>
<p><Link href="/shop/payments">/shop/payments</Link> → Stripe Connect für Apple/Google Pay. Alternativ „Bar beim Kellner" / „Karte an der Kasse" (bei Abholung).</p>

<h2>2. Fahrer einladen</h2>

<h3>2.1 Einladung</h3>
<ol>
<li><Link href="/drivers">/drivers</Link> → „Fahrer einladen"</li>
<li>Name, Vorname, Handy, E-Mail eingeben</li>
<li>Fahrer bekommt Mail mit Login-Link</li>
<li>Beim ersten Login muss Passwort gesetzt werden</li>
</ol>

<h3>2.2 Fahrer-PWA installieren</h3>
<p>Fahrer öffnet auf seinem Handy <code>/fahrer</code> → „Installieren" / „Zum Homescreen hinzufügen".
Funktioniert wie eine echte App (iOS: Safari Teilen-Menü → „Zum Home-Bildschirm").</p>

<h3>2.3 Fahrer-Alltag</h3>
<p>Fahrer öffnet <code>/fahrer/app</code>:</p>
<ul>
<li><strong>Online-Button</strong> tippen → bereit für Touren</li>
<li>Fahrzeug wählen (E-Bike, Auto, Fahrrad)</li>
<li><strong>Pickup-Inbox</strong> zeigt verfügbare Touren</li>
<li>„Tour annehmen" → Navigation + Stop-Liste</li>
<li>Pro Stop: „Navigieren" (Google Maps) + „Zugestellt"-Button</li>
</ul>

<h2>3. Auto-Dispatch</h2>

<p>Wenn eine Online-Bestellung als <strong>„fertig"</strong> markiert wird (aus Küche), passiert automatisch:</p>
<ol>
<li>Neues <code>delivery_batch</code> wird angelegt</li>
<li>Nächstgelegener Online-Fahrer wird gefunden (Haversine-Distanz)</li>
<li>Ist ein Fahrer verfügbar → Batch wird ihm zugewiesen</li>
<li>Falls nicht → Batch bleibt offen, <strong>Push an alle online Fahrer</strong> („🛵 Neue Tour verfügbar")</li>
<li>Der schnellste Fahrer tippt „Annehmen" im <code>/fahrer/app</code> → Tour läuft</li>
</ol>

<h2>4. Kunden-Tracking</h2>

<h3>4.1 Tracking-Seite</h3>
<p>Jede Bestellung bekommt eine Track-URL: <code>/track/{'{'}bestellnummer{'}'}</code></p>
<p>Dort sieht der Kunde:</p>
<ul>
<li>Status (Neu → In Zubereitung → Fertig → Unterwegs → Geliefert)</li>
<li>Live-Karte mit Fahrer-Position</li>
<li>ETA</li>
<li>Kontakt-Optionen (Chat mit Fahrer, Telefon)</li>
</ul>

<h3>4.2 Push-Notifications</h3>
<p>Nach dem Bestellen fragt die Track-Seite: „Bestätige damit du weißt wo deine Bestellung ist".
Wenn Kunde zustimmt → Browser-Permission-Dialog → Push aktiv. Kunde bekommt bei jedem Status-Wechsel eine Push (auch wenn Browser zu ist).</p>

<h2>5. Externe Plattformen</h2>

<p><Link href="/delivery/platforms">/delivery/platforms</Link> zeigt 4 Anbieter:</p>

<ul>
<li><strong>Deliverect</strong> ✅ sofort verfügbar — Middleware für Lieferando + Uber + Wolt in einem</li>
<li>🧡 <strong>Lieferando</strong> — Coming Soon (Q3 2026, im Partner-Onboarding)</li>
<li>🟩 <strong>Uber Eats</strong> — Coming Soon (Q2 2026)</li>
<li>💙 <strong>Wolt</strong> — Coming Soon (Q3 2026)</li>
</ul>

<p>Bei Coming-Soon: Button „Benachrichtigen wenn live" → du wirst per Mail informiert sobald verfügbar.</p>

<h3>5.1 Deliverect einrichten</h3>
<ol>
<li>Deliverect-Account eröffnen (deliverect.com)</li>
<li>In <Link href="/delivery/platforms">/delivery/platforms</Link> Webhook-URL + Secret kopieren</li>
<li>In Deliverect eingeben → Test-Ping senden</li>
<li>Bestellungen laufen jetzt automatisch ein</li>
</ol>

<h2>6. Kitchen-Integration</h2>

<p>Im Küchen-Monitor siehst du Fahrer-Status live:</p>
<ul>
<li>🟢 <strong>Frei</strong> — wartet auf Auftrag</li>
<li>🟠 <strong>Liefert</strong> — Stopp X/Y mit Adresse</li>
<li>🍵 <strong>Kommt zurück</strong> — alle Stops erledigt (pulsierend + Sound)</li>
</ul>

<h2>7. Lieferdienst-Übersicht</h2>

<p><Link href="/delivery">/delivery</Link> — Dashboard mit:</p>
<ul>
<li>Umsatz Lieferung heute</li>
<li>Offene Touren</li>
<li>Fahrer online</li>
<li>Plattformen aktiv</li>
<li>Sektion-Karten zu allen Unterseiten</li>
</ul>

      </div>
    </>
  );
}
