import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Verfahrensdokumentation gem. GoBD Rz. 151+ (Pflicht des Betreibers,
 * aber SaaS-Anbieter liefert den System-Teil)
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('Nicht eingeloggt', { status: 401 });

  const svc = createServiceClient();
  const { data: emp } = await svc.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return new NextResponse('Kein Zugriff', { status: 403 });

  const { data: tenant } = await svc.from('tenants').select('name, steuernummer, ust_id, stadt, adresse, plz, fiskaly_tss_id').eq('id', emp.tenant_id).single();

  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<title>Verfahrensdokumentation · ${tenant?.name}</title>
<style>
  @media print { @page { size: A4; margin: 20mm; } body { margin: 0; } .no-print { display: none; } }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 1rem 2rem; color: #111; line-height: 1.5; }
  h1 { font-size: 2rem; margin-bottom: .5rem; border-bottom: 3px solid #0d1f16; padding-bottom: .5rem; }
  h2 { font-size: 1.25rem; margin-top: 2rem; color: #0d1f16; border-bottom: 1px solid #ddd; padding-bottom: .25rem; }
  h3 { font-size: 1rem; margin-top: 1.5rem; }
  p, li { margin: .5rem 0; }
  .meta { font-size: .875rem; color: #666; margin-bottom: 2rem; }
  .meta strong { color: #000; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .875rem; }
  td, th { border: 1px solid #ccc; padding: .5rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  .print-btn { position: fixed; bottom: 2rem; right: 2rem; background: #0d1f16; color: white; padding: .75rem 1.5rem; border-radius: 999px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,.15); }
</style>
</head>
<body>
<button class="no-print print-btn" onclick="window.print()">🖨 Als PDF drucken</button>

<h1>Verfahrensdokumentation</h1>
<p>nach GoBD (BMF-Schreiben vom 28.11.2019, geändert 11.03.2024), § 146a AO, KassenSichV</p>

<div class="meta">
  <p><strong>Unternehmen:</strong> ${esc(tenant?.name ?? '')}</p>
  <p><strong>Adresse:</strong> ${esc([tenant?.adresse, tenant?.plz, tenant?.stadt].filter(Boolean).join(', '))}</p>
  <p><strong>Steuernummer:</strong> ${esc(tenant?.steuernummer ?? '—')}</p>
  <p><strong>USt-IdNr:</strong> ${esc(tenant?.ust_id ?? '—')}</p>
  <p><strong>Erstellt am:</strong> ${heute}</p>
  <p><strong>Version:</strong> 1.0</p>
</div>

<h2>1. Allgemeine Angaben</h2>

<h3>1.1 Ziel der Dokumentation</h3>
<p>Diese Verfahrensdokumentation beschreibt das eingesetzte Kassensystem <strong>„Mise POS"</strong>, seine Komponenten, Schnittstellen,
den Datenfluss und die organisatorischen Regelungen zur Nutzung. Sie dient der Einhaltung der GoBD und der KassenSichV.</p>

<h3>1.2 Eingesetztes System</h3>
<table>
<tr><th>Produktname</th><td>Mise POS · SaaS-Kassensystem</td></tr>
<tr><th>Anbieter</th><td>Mise (Restaurant-SaaS-Plattform)</td></tr>
<tr><th>Softwareversion</th><td>2026.04</td></tr>
<tr><th>Hosting</th><td>Vercel (Frankfurt/EU) + Supabase (Frankfurt/EU)</td></tr>
<tr><th>TSE-Anbieter</th><td>fiskaly Cloud-TSE (BSI-zertifiziert, TR-03153)</td></tr>
<tr><th>TSS-ID</th><td>${esc(tenant?.fiskaly_tss_id ?? '— (noch nicht eingerichtet)')}</td></tr>
</table>

<h2>2. Datenfluss</h2>

<h3>2.1 Erfassung</h3>
<p>Kassenvorgänge werden erfasst über:</p>
<ul>
  <li><strong>Kellner am Tablet</strong> (/pos/terminal) mit PIN-Login und gestarteter Schicht</li>
  <li><strong>Kundenbestellung per QR-Code</strong> am Tisch (/t/[token] oder /here/[location-token])</li>
  <li><strong>Externe Online-Shop-Bestellungen</strong> (via API-Webhook integrierter Plattformen)</li>
</ul>

<h3>2.2 Verarbeitung</h3>
<p>Jede Transaktion durchläuft:</p>
<ol>
  <li>Anlage in <code>customer_orders</code> (Bestellung)</li>
  <li>Routing der Items an Küchenstationen (über <code>station_category_routing</code>)</li>
  <li>Bei Bezahlung: Anlage in <code>pos_transactions</code> mit TSE-Signatur über fiskaly API</li>
  <li>Signatur-Felder gespeichert: TSE-Transaktions-ID, Signature, Counter, Log-Time, Serial</li>
  <li>Automatischer Eintrag in <code>audit_log</code></li>
  <li>Belegausgabe per QR-Code auf Kassen-Display (Kunde scannt → Bon aufs Handy)</li>
</ol>

<h3>2.3 Aufbewahrung</h3>
<p>Alle Transaktionen, TSE-Signaturen, Audit-Logs und Belege werden <strong>10 Jahre</strong> unveränderlich gespeichert (§ 147 AO).
PostgreSQL-Trigger verhindern UPDATE und DELETE auf relevanten Tabellen. Backups:
Supabase Point-in-Time-Recovery (7 Tage) + monatliches vollständiges Archiv auf S3 (EU-Frankfurt) mit Object Lock (10 Jahre).</p>

<h3>2.4 Ausgabe</h3>
<p>Belege werden ausgegeben als:</p>
<ul>
  <li>Digitaler Beleg mit QR-Code auf Kassen-Display (Kunde scannt)</li>
  <li>Bon-Seite (/bon/[token]) mit allen TSE-Pflichtangaben</li>
  <li>E-Mail-Versand auf Kundenwunsch (Resend-Integration)</li>
  <li>Bewirtungsbeleg auf Kundenwunsch (§ 4 Abs. 5 Nr. 2 EStG)</li>
</ul>

<h2>3. Technische Sicherheitseinrichtung (TSE)</h2>
<p>Eingesetzte TSE: <strong>fiskaly Cloud-TSE</strong> (BSI-zertifiziert TR-03153).</p>
<p><strong>Signierte Geschäftsvorfälle:</strong></p>
<ul>
  <li>Jeder Bon-Start (FinishTransaction)</li>
  <li>Jedes Storno (mit Referenz auf Originalbeleg und Gegenbuchung)</li>
  <li>Trainingsbon (separat gekennzeichnet)</li>
  <li>Kassenabschlüsse (Z-Berichte)</li>
</ul>
<p><strong>TSE-Ausfall:</strong> Wird in <code>tse_outage_log</code> erfasst (Start, Ende, Grund). Belege werden in dieser Zeit mit dem
Hinweis „TSE ausgefallen" gedruckt. Der Ausfall wird automatisch in den DSFinV-K-Export einbezogen.</p>

<h2>4. Storno / Korrekturen</h2>
<p>Stornos sind <strong>nicht möglich durch Überschreiben</strong> der Originaltransaktion. Stattdessen wird eine neue Transaktion vom Typ <code>storno</code>
angelegt mit negativem Betrag und Referenz auf den Original-Beleg. Jeder Storno erfordert einen Pflicht-Grund und, ab 20 € Belegbetrag,
einen <strong>Manager-PIN</strong> (4-Augen-Prinzip).</p>

<h2>5. Zugriff und Berechtigungen</h2>
<table>
<tr><th>Rolle</th><th>Berechtigungen</th></tr>
<tr><td>Inhaber / Admin</td><td>Vollzugriff auf Backoffice, Stammdaten, Z-Berichte, Exporte, Kassen-Nachschau-Modus</td></tr>
<tr><td>Manager</td><td>POS nutzen, Stornos freigeben, Z-Berichte einsehen</td></tr>
<tr><td>Mitarbeiter</td><td>POS nutzen, eigene Schicht führen, keine Freigaben</td></tr>
<tr><td>Finanzbeamter (§ 146b AO)</td><td>Read-Only-Zugang via temporärem Token (max. 24h, durch Inhaber widerrufbar)</td></tr>
</table>

<h2>6. Datensicherung</h2>
<ul>
  <li><strong>Primär:</strong> PostgreSQL in Supabase (Frankfurt) mit Point-in-Time-Recovery (7 Tage rückwirkend)</li>
  <li><strong>Sekundär:</strong> Monatliches Voll-Backup auf AWS S3 (EU-Frankfurt) mit Object Lock (10 Jahre)</li>
  <li><strong>TSE-Signaturen:</strong> Redundant bei fiskaly + in unserer DB</li>
  <li><strong>Audit-Logs:</strong> Append-only durch DB-Trigger geschützt</li>
</ul>

<h2>7. Kassen-Nachschau / Außenprüfung</h2>
<p>Für eine unangekündigte Kassen-Nachschau (§ 146b AO) stellt das System folgende Funktionen bereit:</p>
<ul>
  <li><strong>Kassen-Nachschau-Modus:</strong> Zeitlich befristeter Read-Only-Zugang per URL-Token</li>
  <li><strong>DSFinV-K 2.4 Export:</strong> Ein-Klick-ZIP-Download mit 20 CSVs + index.xml + DTD (/settings/legal)</li>
  <li><strong>§ 146a Meldepaket:</strong> XML-Download für ELSTER-Upload</li>
  <li><strong>Verfahrensdokumentation:</strong> PDF (diese Datei)</li>
  <li><strong>Z-Bericht-Archiv:</strong> Alle Z-Berichte lückenlos im System</li>
  <li><strong>TSE-Ausfall-Protokoll:</strong> Vollständige Liste aller Ausfälle mit Dauer und Grund</li>
</ul>

<h2>8. Änderungen an dieser Dokumentation</h2>
<p>Jede Änderung an dieser Dokumentation wird datiert und versioniert. Die Version des Systems (Softwarestand) wird automatisch im
Dokumentkopf eingetragen. Die betriebliche Ergänzung (z.B. Öffnungszeiten, Kassenaufstellung, Schulungsplan) erfolgt durch den
Steuerpflichtigen in einem separaten Dokument „Betrieblicher Teil".</p>

<h2>9. Kontakt / Ansprechpartner</h2>
<p><strong>IT-Systemanbieter:</strong> Mise (SaaS-Plattform) · support@mise.app</p>
<p><strong>Kassenverantwortlicher im Unternehmen:</strong> [Vom Inhaber zu ergänzen]</p>
<p><strong>Datenschutzbeauftragter:</strong> [Vom Inhaber zu ergänzen]</p>

<p style="margin-top: 3rem; font-size: .75rem; color: #999; border-top: 1px solid #ddd; padding-top: 1rem;">
Diese Verfahrensdokumentation wurde automatisch aus dem System generiert und stellt den aktuellen Stand der technischen Konfiguration dar.
Der Betreiber des Kassensystems ist verpflichtet, diese Dokumentation um betriebsspezifische Angaben zu ergänzen und aktuell zu halten.
</p>

</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function esc(s: string): string {
  return (s ?? '').toString().replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] ?? c));
}
