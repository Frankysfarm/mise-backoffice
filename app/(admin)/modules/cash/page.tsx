/**
 * /modules/cash — Hub-Page für das POS-/Kasse-Modul.
 *
 * Klick auf "Kasse & Finanzen" im Module-Marketplace landet hier.
 * Von hier aus werden ALLE POS-relevanten Konfigurations- und
 * Betriebsroutinen verlinkt — der Owner hat einen einzigen Einstiegspunkt
 * statt durch die Sidebar zu jagen.
 *
 * Sektionen (in dieser Reihenfolge — Owner-Mental-Model):
 *  1. Loslegen — Terminal aufrufen / Tischplan
 *  2. Was wird verkauft — Menü, Modifier, Steuern, Upsells
 *  3. Wo wird verkauft — Bestellseite, Tische, Theke, KDS
 *  4. Wie wird bezahlt — Stripe, SumUp, Zahlungsarten
 *  5. Tagesgeschäft — Tagesabschluss, Z-Bon, Trinkgeld, Voids
 *  6. Compliance — TSE, DSFinV-K, Kassenprüfung-Token, Manager-PIN
 *  7. Auswertung — Dashboard, Analytics
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireManagerPlus } from "@/lib/auth/requireRole";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  Download,
  FileText,
  Layers,
  Lock,
  MonitorSmartphone,
  QrCode,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Tag,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Section = {
  title: string;
  emoji: string;
  desc: string;
  links: Array<{
    href: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    title: string;
    desc: string;
    badge?: string;
  }>;
};

const SECTIONS: Section[] = [
  {
    title: "Loslegen",
    emoji: "🚀",
    desc: "Direkter Einstieg ins Tagesgeschäft.",
    links: [
      {
        href: "/pos/terminal",
        icon: MonitorSmartphone,
        title: "Kassen-Terminal öffnen",
        desc: "Theke, Tischbestellungen, Karten- & Bar-Zahlung.",
        badge: "Live",
      },
      {
        href: "/pos/tables",
        icon: QrCode,
        title: "Tischplan & QR-Codes",
        desc: "Tische anlegen, eigene QR-Codes drucken, Tischbelegung.",
      },
      {
        href: "/pos",
        icon: Receipt,
        title: "POS-Übersicht",
        desc: "Letzte Bons, offene Rechnungen, aktive Sessions.",
      },
    ],
  },
  {
    title: "Was wird verkauft",
    emoji: "🍽️",
    desc: "Menü pflegen, Steuersätze, Modifier, Upsells.",
    links: [
      {
        href: "/menu",
        icon: UtensilsCrossed,
        title: "Speisekarte",
        desc: "Kategorien, Artikel, Preise, USt 7%/19%.",
      },
      {
        href: "/menu/import",
        icon: Download,
        title: "Menü importieren",
        desc: "CSV / Lieferando-Import. Schnell-Setup für neue Filialen.",
      },
      {
        href: "/menu/upsells",
        icon: Tag,
        title: "Upsells & Cross-Sell",
        desc: "Empfehlungen am Bon, Combo-Rabatte.",
      },
      {
        href: "/recipes",
        icon: Layers,
        title: "Rezepte",
        desc: "Rezeptdatenbank — verbindet Inventory mit Verkauf.",
      },
    ],
  },
  {
    title: "Wo wird verkauft",
    emoji: "🛍️",
    desc: "Bestellseite für Kunden, Theke, Küche.",
    links: [
      {
        href: "/shop/design",
        icon: Smartphone,
        title: "Bestellseite (Design)",
        desc: "Logo, Farben, Bilder — was Gäste beim QR-Scan sehen.",
      },
      {
        href: "/shop/hours",
        icon: ShoppingBag,
        title: "Öffnungszeiten",
        desc: "Wann nimmt die Bestellseite Bestellungen an.",
      },
      {
        href: "/pos/registers",
        icon: Wallet,
        title: "Kassen verwalten",
        desc: "Mehrere Theken-Stationen + Schichten.",
      },
      {
        href: "/pos/stations",
        icon: UtensilsCrossed,
        title: "Küchen-Stationen (KDS)",
        desc: "Bons-Routing: welcher Drucker, welcher KDS-Bildschirm.",
      },
      {
        href: "/kitchen",
        icon: MonitorSmartphone,
        title: "Kitchen Display öffnen",
        desc: "Live-View für die Küche, Status pro Bon.",
      },
    ],
  },
  {
    title: "Wie wird bezahlt",
    emoji: "💳",
    desc: "Online-Karten + Theken-Lesegerät.",
    links: [
      {
        href: "/settings/stripe",
        icon: CreditCard,
        title: "Stripe Connect (Online)",
        desc: "Karten + Apple Pay für Bestellseite & QR-Tisch.",
      },
      {
        href: "/settings/sumup",
        icon: Smartphone,
        title: "SumUp (Theke)",
        desc: "Air-Reader für Karten an der Theke. Self-Service-Setup.",
      },
      {
        href: "/shop/payments",
        icon: Wallet,
        title: "Zahlungsarten",
        desc: "Welche Bezahlungen sind aktiv (Bar, Karte, Apple Pay…).",
      },
    ],
  },
  {
    title: "Tagesgeschäft",
    emoji: "📒",
    desc: "Z-Bon, Tagesabschluss, Trinkgeld.",
    links: [
      {
        href: "/cash",
        icon: Wallet,
        title: "Tagesabschluss / Kassenbuch",
        desc: "Tageskasse zählen, Soll/Ist, Trinkgeld-Verteilung.",
      },
      {
        href: "/pos/z-report",
        icon: Receipt,
        title: "Z-Bon erstellen",
        desc: "Tages-Z-Bon. Pflicht laut KassenSichV.",
      },
      {
        href: "/pos",
        icon: FileText,
        title: "Bon-Historie",
        desc: "Alle Bons, Stornos, Rückgaben — durchsuchbar.",
      },
    ],
  },
  {
    title: "Compliance & Finanzamt",
    emoji: "🛡️",
    desc: "KassenSichV, GoBD, DSFinV-K, TSE.",
    links: [
      {
        href: "/settings/tse",
        icon: ShieldCheck,
        title: "TSE-Status",
        desc: "Live-Modus aktivieren, Fiskaly-Anbindung.",
      },
      {
        href: "/api/pos/dsfinvk/export",
        icon: Download,
        title: "DSFinV-K-Export",
        desc: "ZIP für Steuerprüfer (Schema 2.3, BMF-konform).",
      },
      {
        href: "/settings/kassenpruefung",
        icon: FileText,
        title: "Steuerprüfer-Zugang",
        desc: "Sicherer Token-Link mit Lese-Zugriff für Außenprüfung.",
      },
      {
        href: "/settings/manager-pin",
        icon: Lock,
        title: "Manager-PIN",
        desc: "Pflicht-PIN für Stornos, Rabatte, Z-Bon.",
      },
    ],
  },
  {
    title: "Auswertung",
    emoji: "📊",
    desc: "Umsatz, Top-Items, Stoßzeiten.",
    links: [
      {
        href: "/dashboard",
        icon: BarChart3,
        title: "Dashboard",
        desc: "Heutige Zahlen auf einen Blick.",
      },
      {
        href: "/analytics",
        icon: BarChart3,
        title: "Analytics",
        desc: "Umsatz-Trends, Top-Seller, Food-Cost.",
      },
    ],
  },
];

export default async function CashModuleHub() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from("employees")
    .select("tenant_id")
    .eq("id", emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id) redirect("/start");

  // Kennzahlen (heute) — schneller Statusüberblick im Hub-Header.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: heutigeBons }, { data: tseRow }, { data: stripeRow }, { data: sumupRow }] =
    await Promise.all([
      svc
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", empRow.tenant_id)
        .gte("created_at", today.toISOString()),
      svc
        .from("tenants")
        .select("tse_activated_at")
        .eq("id", empRow.tenant_id)
        .maybeSingle(),
      svc
        .from("tenants")
        .select("stripe_account_id")
        .eq("id", empRow.tenant_id)
        .maybeSingle(),
      svc
        .from("tenants")
        .select("sumup_merchant_code")
        .eq("id", empRow.tenant_id)
        .maybeSingle(),
    ]);

  const tseLive = !!tseRow?.tse_activated_at;
  const stripeConnected = !!stripeRow?.stripe_account_id;
  const sumupConnected = !!sumupRow?.sumup_merchant_code;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Kasse & Finanzen"
        description="Alles für POS, Bestellseite, Bezahlung und Steuer in einem Hub."
        backHref="/modules"
      />

      {/* Status-Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heutiger Stand</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Bons heute" value={heutigeBons ?? 0} />
          <Stat
            label="TSE"
            value={tseLive ? "Live" : "Demo"}
            tone={tseLive ? "ok" : "warn"}
          />
          <Stat
            label="Stripe (Online)"
            value={stripeConnected ? "verbunden" : "nicht verbunden"}
            tone={stripeConnected ? "ok" : "muted"}
          />
          <Stat
            label="SumUp (Theke)"
            value={sumupConnected ? "verbunden" : "nicht verbunden"}
            tone={sumupConnected ? "ok" : "muted"}
          />
        </CardContent>
      </Card>

      {/* Sektionen */}
      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              <span className="mr-2">{section.emoji}</span>
              {section.title}
            </h2>
            <p className="text-sm text-muted-foreground">{section.desc}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {section.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/30 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5">
                    <l.icon className="h-5 w-5 text-foreground/80" />
                  </div>
                  {l.badge && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {l.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-base font-semibold leading-tight">
                  {l.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {l.desc}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-foreground/70 group-hover:text-foreground">
                  Öffnen
                  <ArrowRight
                    size={12}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
