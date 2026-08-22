"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Apple,
  ArrowRight,
  Banknote,
  Bell,
  Check,
  CreditCard,
  Download,
  Eye,
  Hash,
  Heart,
  Lock,
  Loader2,
  Monitor,
  Moon,
  Music,
  Percent,
  Printer,
  QrCode,
  Receipt,
  Send,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  Tag,
  Ticket,
  Vibrate,
  Volume2,
  Wifi,
  FileText,
  Plug,
  XCircle,
  Zap,
} from "lucide-react";

type SettingsRow = {
  id: string;
  tenant_id: string;
  location_id: string;
  pay_cash: boolean;
  pay_card_sumup: boolean;
  pay_card_stripe: boolean;
  pay_apple_pay: boolean;
  pay_voucher: boolean;
  pay_on_house: boolean;
  pay_invoice: boolean;
  receipt_mode: "printer" | "qr" | "email" | "none" | "ask_customer";
  receipt_qr_after_payment: boolean;
  receipt_show_review_qr: boolean;
  receipt_review_url: string | null;
  receipt_footer_text: string | null;
  printer_type: "none" | "epson_escpos" | "star" | "generic_escpos";
  printer_connection: "wifi" | "bluetooth" | "usb";
  printer_address: string | null;
  printer_paper_width_mm: number;
  printer_auto_cut: boolean;
  printer_open_drawer: boolean;
  printer_last_test_at: string | null;
  tip_enabled: boolean;
  tip_suggestions: number[];
  tip_default_pct: number | null;
  tip_round_up: boolean;
  service_charge_pct: number;
  service_charge_label: string | null;
  pin_for_void: boolean;
  pin_for_discount_above_pct: number;
  pin_for_refund: boolean;
  pin_for_no_sale: boolean;
  pin_for_z_report: boolean;
  require_starting_balance: boolean;
  auto_close_shift_hours: number;
  theme: "auto" | "light" | "dark";
  language: "de" | "en";
  sound_effects: boolean;
  vibration_on_action: boolean;
  auto_logout_minutes: number;
  show_item_images: boolean;
  open_tab_max_cents: number;
  open_tab_timeout_hours: number;
  default_send_to_kitchen: "manual" | "on_payment" | "immediate";
  // Compliance + Außer-Haus
  auto_takeaway_tax: boolean;
  takeaway_food_vat_bps: number;
  dine_in_food_vat_bps: number;
  drink_vat_bps: number;
  void_reasons: string[];
  receipt_number_format: string;
  receipt_number_reset: "daily" | "monthly" | "yearly" | "never";
  cash_drop_threshold_cents: number;
  // Marketing
  discount_presets: Array<{ name: string; type: "percent" | "fixed"; value: number; requires_pin: boolean }>;
  voucher_min_order_cents: number;
  voucher_validity_days: number;
  voucher_transferable: boolean;
  happy_hour_enabled: boolean;
  happy_hour_rules: Array<{ day: number; from: string; to: string; discount_pct: number; label?: string }>;
  // Service
  course_mode_enabled: boolean;
  course_labels: string[];
  splitting_enabled: boolean;
  splitting_modes: Array<"items" | "persons" | "amounts">;
  hold_order_enabled: boolean;
  pfand_enabled: boolean;
  pfand_items: Array<{ name: string; cents: number }>;
  // Mitarbeiter
  staff_pin_required: boolean;
  staff_pin_session_minutes: number;
  staff_max_void_per_shift_cents: number;
  staff_max_discount_pct: number;
  staff_geofence_required: boolean;
  // KDS Quick-Wins
  kds_aging_yellow_min: number;
  kds_aging_red_min: number;
  kds_aging_alarm_min: number;
  kds_sound_on_new: boolean;
  kds_polling_seconds: number;
  // Quick-Items + Notiz-Templates
  quick_items_enabled: boolean;
  quick_items: Array<{ menu_item_id: string; label?: string }>;
  note_templates: string[];
  // Tisch-VIP
  table_vip_enabled: boolean;
  // Bon-Kopf
  bon_show_address: boolean;
  bon_show_tax_id: boolean;
  bon_show_vat_id: boolean;
  bon_show_phone: boolean;
  bon_show_owner_name: boolean;
  // Mehrweg
  mehrweg_offered: boolean;
  mehrweg_hint_text: string | null;
  mehrweg_show_on_bon: boolean;
  // Allergene
  allergens_show_on_bon: boolean;
  allergens_qr_url: string | null;
  // Mehrere Drucker
  printers_split: boolean;
  kitchen_printer_address: string | null;
  bar_printer_address: string | null;
  // Reservierungen
  reservations_enabled: boolean;
  reservation_min_lead_hours: number;
  reservation_max_party_size: number;
  walk_in_buffer_pct: number;
  // Pre-Orders
  preorders_enabled: boolean;
  preorder_max_days_ahead: number;
  preorder_min_lead_hours: number;
  // Customer-Display
  customer_display_enabled: boolean;
  customer_display_show_promo: boolean;
  customer_display_promo_text: string | null;
  // Workflow
  enforce_required_modifiers: boolean;
  auto_send_kitchen_minutes: number;
  // Integrationen
  lexoffice_export_enabled: boolean;
  lexoffice_api_key_set: boolean;
  datev_export_email: string | null;
  webhook_url: string | null;
  webhook_events: string[];
  newsletter_optin_on_bon: boolean;
  newsletter_optin_text: string | null;
  lieferando_api_connected: boolean;
  wolt_api_connected: boolean;
  ubereats_api_connected: boolean;
};

export function POSSettingsClient({
  tenantId,
  locationId,
  initial,
  sumupConnected,
  stripeConnected,
}: {
  tenantId: string;
  locationId: string;
  initial: SettingsRow;
  sumupConnected: boolean;
  stripeConnected: boolean;
}) {
  const supabase = createClient();
  const [s, setS] = useState<SettingsRow>(initial);
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [printerTesting, setPrinterTesting] = useState(false);

  function patch(p: Partial<SettingsRow>) {
    const next = { ...s, ...p } as SettingsRow;
    setS(next);
    startSaving(async () => {
      await supabase.from("pos_settings").update(p).eq("id", s.id);
      setSavedAt(Date.now());
    });
  }

  async function testPrinter() {
    setPrinterTesting(true);
    try {
      const res = await fetch("/api/pos/printer/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, location_id: locationId }),
      });
      const data = await res.json();
      if (data.ok) {
        await supabase
          .from("pos_settings")
          .update({ printer_last_test_at: new Date().toISOString() })
          .eq("id", s.id);
        setS({ ...s, printer_last_test_at: new Date().toISOString() });
        alert("Drucker reagiert ✓");
      } else {
        alert(`Drucker antwortet nicht: ${data.error ?? "unbekannt"}`);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Test fehlgeschlagen");
    } finally {
      setPrinterTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Saved indicator */}
      <div className="sticky top-0 z-10 -mt-2 mb-4 flex items-center justify-end">
        <div
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-opacity",
            saving
              ? "bg-amber-100 text-amber-900 opacity-100"
              : savedAt
                ? "bg-emerald-100 text-emerald-900 opacity-100"
                : "opacity-0"
          )}
        >
          {saving ? "Speichere…" : "Gespeichert ✓"}
        </div>
      </div>

      {/* ── 1. APP-DOWNLOAD ──────────────────────────────────────── */}
      <SectionCard
        icon={Smartphone}
        accent="from-matcha-700 to-matcha-900"
        title="Mitarbeiter-App"
        subtitle="Lade die Mise-App auf Tablet oder Phone — sie ist dein Kassen-Terminal."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="https://apps.apple.com/app/mise"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl border bg-white p-4 hover:border-matcha-700 transition group"
          >
            <Apple className="h-8 w-8" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Lade aus dem
              </div>
              <div className="font-display font-bold">App Store (iOS)</div>
            </div>
            <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition" />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=app.mise.mobile"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl border bg-white p-4 hover:border-matcha-700 transition group"
          >
            <Smartphone className="h-8 w-8" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Lade aus dem
              </div>
              <div className="font-display font-bold">Google Play (Android)</div>
            </div>
            <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition" />
          </a>
        </div>
        <div className="mt-3 rounded-xl bg-matcha-50/60 border border-matcha-100 p-3 text-xs text-matcha-900 flex items-start gap-2">
          <Hash className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Pairing-Code für neue Geräte:</strong> findest du unter{" "}
            <a href="/pos/registers" className="underline font-semibold">
              Kassen / Terminals
            </a>
            . Code in der App eingeben → fertig.
          </span>
        </div>
      </SectionCard>

      {/* ── 2. ZAHLUNGSMETHODEN ─────────────────────────────────── */}
      <SectionCard
        icon={CreditCard}
        accent="from-blue-600 to-blue-800"
        title="Zahlungsmethoden"
        subtitle="Welche Optionen sieht der Kassierer beim Bezahlen?"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="Bargeld"
            icon={Banknote}
            checked={s.pay_cash}
            onChange={(v) => patch({ pay_cash: v })}
          />
          <Toggle
            label="Karte (SumUp Reader)"
            icon={CreditCard}
            checked={s.pay_card_sumup}
            disabled={!sumupConnected}
            disabledHint="Erst SumUp verbinden"
            disabledLink="/settings/sumup"
            onChange={(v) => patch({ pay_card_sumup: v })}
          />
          <Toggle
            label="Karte (Stripe — Online)"
            icon={CreditCard}
            checked={s.pay_card_stripe}
            disabled={!stripeConnected}
            disabledHint="Erst Stripe verbinden"
            disabledLink="/settings/stripe"
            onChange={(v) => patch({ pay_card_stripe: v })}
          />
          <Toggle
            label="Apple Pay / Google Pay"
            icon={Apple}
            checked={s.pay_apple_pay}
            disabled={!stripeConnected && !sumupConnected}
            disabledHint="SumUp oder Stripe verbinden"
            onChange={(v) => patch({ pay_apple_pay: v })}
          />
          <Toggle
            label="Gutschein einlösen"
            icon={Ticket}
            checked={s.pay_voucher}
            onChange={(v) => patch({ pay_voucher: v })}
          />
          <Toggle
            label="Aufs Haus"
            icon={Heart}
            checked={s.pay_on_house}
            onChange={(v) => patch({ pay_on_house: v })}
          />
          <Toggle
            label="Auf Rechnung (B2B)"
            icon={Receipt}
            checked={s.pay_invoice}
            onChange={(v) => patch({ pay_invoice: v })}
          />
        </div>
      </SectionCard>

      {/* ── 3. BON-OUTPUT ─────────────────────────────────────── */}
      <SectionCard
        icon={Receipt}
        accent="from-amber-600 to-amber-800"
        title="Bon nach Zahlung"
        subtitle="Wie bekommt der Gast seinen Bon? Drucker, Bildschirm-QR, E-Mail oder gar nicht."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          <RadioCard
            label="Bon drucken"
            desc="Klassisch auf Bondrucker"
            icon={Printer}
            checked={s.receipt_mode === "printer"}
            onClick={() => patch({ receipt_mode: "printer" })}
          />
          <RadioCard
            label="QR auf Bildschirm"
            desc="Gast scannt, sieht digitalen Bon"
            icon={QrCode}
            checked={s.receipt_mode === "qr"}
            onClick={() => patch({ receipt_mode: "qr" })}
            badge="Papierlos"
          />
          <RadioCard
            label="E-Mail an Gast"
            desc="Bon per Mail nach Eingabe"
            icon={Send}
            checked={s.receipt_mode === "email"}
            onClick={() => patch({ receipt_mode: "email" })}
          />
          <RadioCard
            label="Gast fragen"
            desc="Drucken / E-Mail / QR — der Gast wählt"
            icon={Eye}
            checked={s.receipt_mode === "ask_customer"}
            onClick={() => patch({ receipt_mode: "ask_customer" })}
          />
          <RadioCard
            label="Kein Bon"
            desc="Nur auf Wunsch des Gastes"
            icon={XCircle}
            checked={s.receipt_mode === "none"}
            onClick={() => patch({ receipt_mode: "none" })}
          />
        </div>
        <div className="space-y-2 pt-3 border-t">
          <Toggle
            label="Zusätzlich QR-Code zum Bon nach jeder Zahlung am Bildschirm"
            desc="Gast kann jederzeit fotografieren & wegscrollen"
            icon={QrCode}
            checked={s.receipt_qr_after_payment}
            onChange={(v) => patch({ receipt_qr_after_payment: v })}
          />
          <Toggle
            label="Google-Review-QR auf den Bon"
            desc="Stammkunden direkt zur Bewertung leiten"
            icon={Star}
            checked={s.receipt_show_review_qr}
            onChange={(v) => patch({ receipt_show_review_qr: v })}
          />
          {s.receipt_show_review_qr && (
            <Input
              label="Google-Review-Link"
              value={s.receipt_review_url ?? ""}
              onChange={(v) => patch({ receipt_review_url: v })}
              placeholder="https://g.page/r/..."
            />
          )}
          <Input
            label="Eigener Bon-Footer-Text"
            value={s.receipt_footer_text ?? ""}
            onChange={(v) => patch({ receipt_footer_text: v })}
            placeholder="z.B. Danke! Wir freuen uns aufs naechste Mal."
            multiline
          />
        </div>
      </SectionCard>

      {/* ── 4. BONDRUCKER ───────────────────────────────────── */}
      <SectionCard
        icon={Printer}
        accent="from-zinc-600 to-zinc-800"
        title="Bondrucker"
        subtitle="ESC/POS-kompatible Drucker (Epson, Star, …) — über WiFi, Bluetooth oder USB."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Drucker-Typ"
            value={s.printer_type}
            onChange={(v) => patch({ printer_type: v as SettingsRow["printer_type"] })}
            options={[
              { value: "none", label: "Kein Drucker" },
              { value: "epson_escpos", label: "Epson ESC/POS (TM-…)" },
              { value: "star", label: "Star (TSP-… / mC-…)" },
              { value: "generic_escpos", label: "Anderer ESC/POS" },
            ]}
          />
          <Select
            label="Verbindung"
            value={s.printer_connection}
            onChange={(v) => patch({ printer_connection: v as SettingsRow["printer_connection"] })}
            disabled={s.printer_type === "none"}
            options={[
              { value: "wifi", label: "WiFi / LAN" },
              { value: "bluetooth", label: "Bluetooth" },
              { value: "usb", label: "USB" },
            ]}
          />
          {s.printer_connection === "wifi" && s.printer_type !== "none" && (
            <Input
              label="IP-Adresse + Port"
              value={s.printer_address ?? ""}
              onChange={(v) => patch({ printer_address: v })}
              placeholder="z.B. 192.168.1.42:9100"
            />
          )}
          {s.printer_connection === "bluetooth" && s.printer_type !== "none" && (
            <Input
              label="Bluetooth-Adresse"
              value={s.printer_address ?? ""}
              onChange={(v) => patch({ printer_address: v })}
              placeholder="MAC, z.B. 00:11:22:33:44:55"
            />
          )}
          <Select
            label="Papierbreite"
            value={String(s.printer_paper_width_mm)}
            onChange={(v) => patch({ printer_paper_width_mm: Number(v) })}
            disabled={s.printer_type === "none"}
            options={[
              { value: "58", label: "58 mm" },
              { value: "80", label: "80 mm (Standard)" },
              { value: "112", label: "112 mm (XL)" },
            ]}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle
            label="Auto-Cut nach jedem Bon"
            checked={s.printer_auto_cut}
            disabled={s.printer_type === "none"}
            onChange={(v) => patch({ printer_auto_cut: v })}
          />
          <Toggle
            label="Kassenschublade automatisch öffnen"
            desc="Bei Bar-Zahlungen via Drucker-Trigger"
            checked={s.printer_open_drawer}
            disabled={s.printer_type === "none"}
            onChange={(v) => patch({ printer_open_drawer: v })}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={testPrinter}
            disabled={s.printer_type === "none" || printerTesting}
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold hover:bg-matcha-800 disabled:opacity-40"
          >
            {printerTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Test-Bon drucken
          </button>
          {s.printer_last_test_at && (
            <span className="text-xs text-muted-foreground">
              zuletzt OK: {new Date(s.printer_last_test_at).toLocaleString("de-DE")}
            </span>
          )}
        </div>
      </SectionCard>

      {/* ── 5. TRINKGELD ─────────────────────────────────────── */}
      <SectionCard
        icon={Heart}
        accent="from-rose-500 to-rose-700"
        title="Trinkgeld"
        subtitle="% Stufen die der Gast am Terminal vorgeschlagen bekommt."
      >
        <Toggle
          label="Trinkgeld am Terminal anbieten"
          checked={s.tip_enabled}
          onChange={(v) => patch({ tip_enabled: v })}
        />
        {s.tip_enabled && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1 block">
                Vorgeschlagene Stufen (%)
              </label>
              <div className="flex flex-wrap gap-2">
                {[0, 5, 8, 10, 12, 15, 18, 20, 25].map((pct) => {
                  const active = s.tip_suggestions.includes(pct);
                  return (
                    <button
                      key={pct}
                      onClick={() => {
                        const next = active
                          ? s.tip_suggestions.filter((x) => x !== pct)
                          : [...s.tip_suggestions, pct].sort((a, b) => a - b);
                        patch({ tip_suggestions: next });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                        active
                          ? "bg-matcha-900 text-matcha-50 border-matcha-900"
                          : "bg-white border-zinc-200 hover:border-matcha-700"
                      )}
                    >
                      {pct === 0 ? "kein" : `${pct}%`}
                    </button>
                  );
                })}
              </div>
            </div>
            <Toggle
              label={'Aufrunden-Button anzeigen'}
              desc="Vorgeschlagene Aufrundung auf nächsten ganzen Euro"
              checked={s.tip_round_up}
              onChange={(v) => patch({ tip_round_up: v })}
            />
          </div>
        )}
      </SectionCard>

      {/* ── 6. SERVICE-CHARGE ──────────────────────────────────── */}
      <SectionCard
        icon={Percent}
        accent="from-orange-500 to-orange-700"
        title="Service-Aufschlag"
        subtitle="Optional: pauschaler Aufschlag (z.B. 'Servicepauschale 5%' für Großgruppen)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Aufschlag (%)"
            value={String(s.service_charge_pct)}
            onChange={(v) => patch({ service_charge_pct: Number(v) || 0 })}
            placeholder="0"
            type="number"
          />
          <Input
            label="Bezeichnung im Bon"
            value={s.service_charge_label ?? ""}
            onChange={(v) => patch({ service_charge_label: v })}
            placeholder="Servicepauschale"
          />
        </div>
      </SectionCard>

      {/* ── 7. MANAGER-PIN ─────────────────────────────────────── */}
      <SectionCard
        icon={Lock}
        accent="from-red-600 to-red-800"
        title="Manager-PIN-Pflicht"
        subtitle="Welche Aktionen erfordern den Manager-PIN? (Schutz vor Mitarbeiter-Schummelei)."
      >
        <div className="space-y-2">
          <Toggle
            label="Storno (Item / Bon)"
            icon={XCircle}
            checked={s.pin_for_void}
            onChange={(v) => patch({ pin_for_void: v })}
          />
          <Toggle
            label="Refund / Rückerstattung"
            icon={ArrowRight}
            checked={s.pin_for_refund}
            onChange={(v) => patch({ pin_for_refund: v })}
          />
          <Toggle
            label="Z-Bericht ziehen"
            icon={Receipt}
            checked={s.pin_for_z_report}
            onChange={(v) => patch({ pin_for_z_report: v })}
          />
          <Toggle
            label="No-Sale (Schublade ohne Verkauf)"
            icon={Banknote}
            checked={s.pin_for_no_sale}
            onChange={(v) => patch({ pin_for_no_sale: v })}
          />
          <div className="flex items-center gap-3 pt-2 border-t">
            <span className="text-sm text-foreground/80">Rabatt erfordert PIN ab</span>
            <input
              type="number"
              min={0}
              max={100}
              value={s.pin_for_discount_above_pct}
              onChange={(e) => patch({ pin_for_discount_above_pct: Number(e.target.value) || 0 })}
              className="w-16 rounded-lg border border-zinc-200 px-2 py-1 text-sm text-center"
            />
            <span className="text-sm text-foreground/80">% Rabatt</span>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          PIN setzen unter{" "}
          <a href="/settings/manager-pin" className="underline font-semibold">
            Einstellungen → Manager-PIN
          </a>
          .
        </div>
      </SectionCard>

      {/* ── 8. SCHICHT ────────────────────────────────────────── */}
      <SectionCard
        icon={Sun}
        accent="from-yellow-500 to-yellow-700"
        title="Schicht-Verwaltung"
        subtitle="Anfangsbestand, Auto-Schluss, Open-Tab-Limit."
      >
        <div className="space-y-2">
          <Toggle
            label="Anfangsbestand beim Schicht-Start eingeben"
            desc="Kassierer zählt Geld vor dem ersten Verkauf"
            checked={s.require_starting_balance}
            onChange={(v) => patch({ require_starting_balance: v })}
          />
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <NumberInput
              label="Auto-Schluss nach (Stunden)"
              desc="Schicht wird automatisch geschlossen wenn nicht manuell"
              value={s.auto_close_shift_hours}
              onChange={(v) => patch({ auto_close_shift_hours: v })}
              min={1}
              max={24}
            />
            <NumberInput
              label="Open-Tab Max. (€)"
              desc="Höchster offener Betrag pro Tisch"
              value={s.open_tab_max_cents / 100}
              onChange={(v) => patch({ open_tab_max_cents: v * 100 })}
              min={0}
              max={10000}
            />
          </div>
          <NumberInput
            label="Open-Tab Auto-Close nach (Stunden)"
            desc="Tisch wird auto-geschlossen wenn nicht bezahlt"
            value={s.open_tab_timeout_hours}
            onChange={(v) => patch({ open_tab_timeout_hours: v })}
            min={1}
            max={24}
          />
        </div>
      </SectionCard>

      {/* ── 9. UI / SOUND / SPRACHE ─────────────────────────── */}
      <SectionCard
        icon={Sparkles}
        accent="from-purple-600 to-purple-800"
        title="Bedienung & Sound"
        subtitle="Wie fühlt sich die Kasse an."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Theme"
            value={s.theme}
            onChange={(v) => patch({ theme: v as SettingsRow["theme"] })}
            options={[
              { value: "auto", label: "Automatisch (System)" },
              { value: "light", label: "Hell" },
              { value: "dark", label: "Dunkel" },
            ]}
          />
          <Select
            label="Sprache"
            value={s.language}
            onChange={(v) => patch({ language: v as SettingsRow["language"] })}
            options={[
              { value: "de", label: "Deutsch" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 mt-3">
          <Toggle
            label="Sound-Effekte"
            desc="Beep beim Item-Tap, Erfolgs-Sound"
            icon={Volume2}
            checked={s.sound_effects}
            onChange={(v) => patch({ sound_effects: v })}
          />
          <Toggle
            label="Vibration"
            desc="Haptisches Feedback (Tablet/Phone)"
            icon={Vibrate}
            checked={s.vibration_on_action}
            onChange={(v) => patch({ vibration_on_action: v })}
          />
          <Toggle
            label="Item-Bilder anzeigen"
            desc="Schöner aber etwas langsamer"
            icon={Eye}
            checked={s.show_item_images}
            onChange={(v) => patch({ show_item_images: v })}
          />
          <NumberInput
            label="Auto-Logout nach (Min)"
            desc="Sicherheit: Inaktivität logged Mitarbeiter aus"
            value={s.auto_logout_minutes}
            onChange={(v) => patch({ auto_logout_minutes: v })}
            min={1}
            max={60}
          />
        </div>
      </SectionCard>

      {/* ── 10. KDS-ROUTING ─────────────────────────────────── */}
      <SectionCard
        icon={Zap}
        accent="from-emerald-600 to-emerald-800"
        title="Bestellung an die Küche"
        subtitle="Wann werden Items an den KDS geschickt?"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <RadioCard
            label="Manuell"
            desc="Kellner klickt Senden wenn fertig"
            icon={Send}
            checked={s.default_send_to_kitchen === "manual"}
            onClick={() => patch({ default_send_to_kitchen: "manual" })}
          />
          <RadioCard
            label="Sofort beim Tap"
            desc="Jedes Item geht direkt an die Küche"
            icon={Zap}
            checked={s.default_send_to_kitchen === "immediate"}
            onClick={() => patch({ default_send_to_kitchen: "immediate" })}
          />
          <RadioCard
            label="Erst nach Zahlung"
            desc="Vor-Kasse-Modus (Cafés)"
            icon={CreditCard}
            checked={s.default_send_to_kitchen === "on_payment"}
            onClick={() => patch({ default_send_to_kitchen: "on_payment" })}
          />
        </div>
      </SectionCard>

      {/* ── 11. AUSSER-HAUS + COMPLIANCE ──────────────────────── */}
      <SectionCard
        icon={Shield}
        accent="from-red-700 to-red-900"
        title="Außer-Haus & Compliance"
        subtitle="USt-Wechsel beim Mitnehmen, Storno-Gründe, Bon-Nummer-Format. Pflicht für DE-Steuerprüfung."
      >
        <Toggle
          label="Auto-USt-Wechsel beim Mitnehmen-Button"
          desc="Speisen werden automatisch von 19% auf 7% umgeschaltet wenn der Gast Take-Away wählt"
          checked={s.auto_takeaway_tax}
          onChange={(v) => patch({ auto_takeaway_tax: v })}
        />
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <NumberInput
            label="Speisen vor Ort (%)"
            value={s.dine_in_food_vat_bps / 100}
            onChange={(v) => patch({ dine_in_food_vat_bps: Math.round(v * 100) })}
            min={0}
            max={30}
          />
          <NumberInput
            label="Speisen mitnehmen (%)"
            value={s.takeaway_food_vat_bps / 100}
            onChange={(v) => patch({ takeaway_food_vat_bps: Math.round(v * 100) })}
            min={0}
            max={30}
          />
          <NumberInput
            label="Getränke (%)"
            value={s.drink_vat_bps / 100}
            onChange={(v) => patch({ drink_vat_bps: Math.round(v * 100) })}
            min={0}
            max={30}
          />
        </div>

        <div className="mt-4 pt-4 border-t">
          <label className="text-xs font-semibold text-zinc-700 mb-1 block">
            Storno-Gründe (DSFinV-K Pflicht-Feld)
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Mitarbeiter wählen einen Grund beim Stornieren. Komma-getrennt.
          </p>
          <input
            type="text"
            value={s.void_reasons.join(", ")}
            onChange={(e) =>
              patch({
                void_reasons: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mt-4 pt-4 border-t">
          <Input
            label="Bon-Nummer-Format"
            value={s.receipt_number_format}
            onChange={(v) => patch({ receipt_number_format: v })}
            placeholder="{date}-{counter:4}"
          />
          <Select
            label="Counter-Reset"
            value={s.receipt_number_reset}
            onChange={(v) => patch({ receipt_number_reset: v as SettingsRow["receipt_number_reset"] })}
            options={[
              { value: "daily", label: "Täglich" },
              { value: "monthly", label: "Monatlich" },
              { value: "yearly", label: "Jährlich" },
              { value: "never", label: "Nie (durchgehend)" },
            ]}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Format-Tokens: <code>{`{date}`}</code> = YYMMDD, <code>{`{counter}`}</code> = Zähler,{" "}
          <code>{`{counter:4}`}</code> = 4-stellig (z.B. 0001).
        </p>

        <div className="mt-4 pt-4 border-t">
          <NumberInput
            label="Cash-Drop-Vorschlag ab (€)"
            desc="Bei mehr als X Euro Bar im Geldbeutel: Mitarbeiter wird gefragt ob er Geld in den Tresor legen will"
            value={s.cash_drop_threshold_cents / 100}
            onChange={(v) => patch({ cash_drop_threshold_cents: Math.round(v * 100) })}
            min={0}
          />
        </div>
      </SectionCard>

      {/* ── 12. RABATT-VORLAGEN + GUTSCHEINE + HAPPY HOUR ────── */}
      <SectionCard
        icon={Tag}
        accent="from-pink-600 to-pink-800"
        title="Rabatte, Gutscheine, Happy Hour"
        subtitle="Vordefinierte Aktionen. Ein-Klick-Rabatte für Mitarbeiter, Gutschein-Rules, Zeit-basierte Preise."
      >
        <div>
          <label className="text-xs font-semibold text-zinc-700 mb-1 block">
            Rabatt-Vorlagen
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Ein-Klick-Rabatte im Terminal. Mitarbeiter sehen die Liste beim Rabatt-Dialog.
          </p>
          <DiscountPresetEditor
            presets={s.discount_presets}
            onChange={(v) => patch({ discount_presets: v })}
          />
        </div>

        <div className="mt-5 pt-5 border-t space-y-3">
          <div className="text-xs font-semibold text-zinc-700">Gutscheine</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput
              label="Mindestbestellwert (€)"
              value={s.voucher_min_order_cents / 100}
              onChange={(v) => patch({ voucher_min_order_cents: Math.round(v * 100) })}
              min={0}
            />
            <NumberInput
              label="Gültigkeit (Tage)"
              value={s.voucher_validity_days}
              onChange={(v) => patch({ voucher_validity_days: v })}
              min={0}
              max={3650}
            />
            <Toggle
              label="Übertragbar"
              desc="Gutschein kann verschenkt werden"
              checked={s.voucher_transferable}
              onChange={(v) => patch({ voucher_transferable: v })}
            />
          </div>
        </div>

        <div className="mt-5 pt-5 border-t">
          <Toggle
            label="Happy Hour aktivieren"
            desc="Zeit-basierte automatische Rabatte (z.B. Mo-Fr 17-19h: 20% auf Getränke)"
            icon={Sun}
            checked={s.happy_hour_enabled}
            onChange={(v) => patch({ happy_hour_enabled: v })}
          />
          {s.happy_hour_enabled && (
            <div className="mt-3">
              <HappyHourEditor
                rules={s.happy_hour_rules}
                onChange={(v) => patch({ happy_hour_rules: v })}
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 13. SERVICE-MODI ─────────────────────────────────── */}
      <SectionCard
        icon={Sparkles}
        accent="from-teal-600 to-teal-800"
        title="Service-Modi"
        subtitle="Restaurant-Spezifika: Gänge, Splitting, Hold-Orders, Pfand."
      >
        <div className="space-y-3">
          <Toggle
            label="Gang-Modus (Course-Mode)"
            desc="Vorspeise → Hauptgang → Dessert getrennt an die Küche senden"
            icon={Receipt}
            checked={s.course_mode_enabled}
            onChange={(v) => patch({ course_mode_enabled: v })}
          />
          {s.course_mode_enabled && (
            <Input
              label="Gang-Bezeichnungen (Komma-getrennt)"
              value={s.course_labels.join(", ")}
              onChange={(v) =>
                patch({
                  course_labels: v
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Vorspeise, Hauptgang, Dessert"
            />
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Toggle
            label="Rechnung teilen (Splitting)"
            desc="Tisch-Rechnung kann auf Items / Personen / Beträge aufgeteilt werden"
            icon={Hash}
            checked={s.splitting_enabled}
            onChange={(v) => patch({ splitting_enabled: v })}
          />
          {s.splitting_enabled && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(["items", "persons", "amounts"] as const).map((mode) => {
                const active = s.splitting_modes.includes(mode);
                const label =
                  mode === "items" ? "auf Items" : mode === "persons" ? "auf Personen" : "auf Beträge";
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      const next = active
                        ? s.splitting_modes.filter((x) => x !== mode)
                        : [...s.splitting_modes, mode];
                      patch({ splitting_modes: next });
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      active
                        ? "bg-matcha-900 text-matcha-50 border-matcha-900"
                        : "bg-white border-zinc-200 hover:border-matcha-700"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Toggle
            label="Hold-Order"
            desc="Tisch hat schon bestellt aber Küche soll später anfangen (Service-Wunsch)"
            icon={Tag}
            checked={s.hold_order_enabled}
            onChange={(v) => patch({ hold_order_enabled: v })}
          />
        </div>

        <div className="mt-4 pt-4 border-t">
          <Toggle
            label="Pfand-System (Mehrweg)"
            desc="Glas/Becher/Flasche mit Pfandwert. Rückgabe als Negativ-Position."
            icon={Banknote}
            checked={s.pfand_enabled}
            onChange={(v) => patch({ pfand_enabled: v })}
          />
          {s.pfand_enabled && (
            <div className="mt-3">
              <PfandEditor
                items={s.pfand_items}
                onChange={(v) => patch({ pfand_items: v })}
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 14. MITARBEITER-SICHERHEIT ─────────────────────── */}
      <SectionCard
        icon={Lock}
        accent="from-slate-700 to-slate-900"
        title="Mitarbeiter-Sicherheit"
        subtitle="PIN-Login, Limits gegen Diebstahl, Geofence."
      >
        <Toggle
          label="PIN-Login pro Schicht"
          desc="Jeder Mitarbeiter hat eigene 4-stellige PIN. Verhindert dass jemand unter falschem Namen kassiert."
          checked={s.staff_pin_required}
          onChange={(v) => patch({ staff_pin_required: v })}
        />
        {s.staff_pin_required && (
          <NumberInput
            label="PIN-Session-Dauer (Min)"
            desc="Nach so vielen Min Inaktivität wird PIN erneut gefragt"
            value={s.staff_pin_session_minutes}
            onChange={(v) => patch({ staff_pin_session_minutes: v })}
            min={1}
            max={480}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 mt-4 pt-4 border-t">
          <NumberInput
            label="Max. Storno pro Schicht (€)"
            desc="Wenn Mitarbeiter mehr stornieren will: Manager-PIN erforderlich"
            value={s.staff_max_void_per_shift_cents / 100}
            onChange={(v) => patch({ staff_max_void_per_shift_cents: Math.round(v * 100) })}
            min={0}
          />
          <NumberInput
            label="Max. Rabatt-Höhe (%)"
            desc="Mitarbeiter darf max so viel % Rabatt geben ohne Manager-PIN"
            value={s.staff_max_discount_pct}
            onChange={(v) => patch({ staff_max_discount_pct: v })}
            min={0}
            max={100}
          />
        </div>

        <div className="mt-4 pt-4 border-t">
          <Toggle
            label="Geofence beim Login (Pflicht)"
            desc="Mitarbeiter kann sich nur einloggen wenn er sich am Restaurant befindet (GPS-Check)"
            icon={Wifi}
            checked={s.staff_geofence_required}
            onChange={(v) => patch({ staff_geofence_required: v })}
          />
        </div>
      </SectionCard>

      {/* ── 15. KDS / KÜCHE Quick-Wins ────────────────────── */}
      <SectionCard
        icon={Zap}
        accent="from-orange-600 to-orange-800"
        title="KDS Stress-Management"
        subtitle="Aging-Farben, Sound bei neuer Order, Polling-Frequenz."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput
            label="Gelb nach (Min)"
            desc="Bon wird gelb wenn er so lange offen ist"
            value={s.kds_aging_yellow_min}
            onChange={(v) => patch({ kds_aging_yellow_min: v })}
            min={1}
            max={60}
          />
          <NumberInput
            label="Rot nach (Min)"
            desc="Bon wird rot — Küche unter Druck"
            value={s.kds_aging_red_min}
            onChange={(v) => patch({ kds_aging_red_min: v })}
            min={1}
            max={60}
          />
          <NumberInput
            label="Alarm (Bell) nach (Min)"
            desc="Akustischer Alarm + Pulse"
            value={s.kds_aging_alarm_min}
            onChange={(v) => patch({ kds_aging_alarm_min: v })}
            min={1}
            max={120}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mt-4 pt-4 border-t">
          <Toggle
            label="Sound bei neuer Bestellung"
            desc="Beep am KDS wenn Order rein kommt"
            icon={Music}
            checked={s.kds_sound_on_new}
            onChange={(v) => patch({ kds_sound_on_new: v })}
          />
          <NumberInput
            label="Polling-Intervall (Sek)"
            desc="Wie oft KDS aktualisiert. Niedriger = schneller, höher = batterieschonender."
            value={s.kds_polling_seconds}
            onChange={(v) => patch({ kds_polling_seconds: v })}
            min={1}
            max={60}
          />
        </div>
        <div className="mt-3 rounded-xl bg-orange-50 border border-orange-200 p-3 text-xs text-orange-900">
          <Bell className="h-4 w-4 inline mr-1" />
          KDS-Routing pro Item (welche Station)? Wird unter{" "}
          <a href="/menu" className="underline font-semibold">
            Speisekarte
          </a>{" "}
          pro Artikel gesetzt.
        </div>
      </SectionCard>

      {/* ── 16. QUICK-WINS Theken-Speed ────────────────────── */}
      <SectionCard
        icon={Sparkles}
        accent="from-cyan-600 to-cyan-800"
        title="Theken-Speed"
        subtitle="Schnellauswahl, vordefinierte Notizen, VIP-Flagging."
      >
        <Toggle
          label="Quick-Items / Favoriten anzeigen"
          desc="Top-Artikel als Big-Tiles oben im Terminal — Espresso/Wasser/Klassiker mit One-Tap"
          icon={Star}
          checked={s.quick_items_enabled}
          onChange={(v) => patch({ quick_items_enabled: v })}
        />
        {s.quick_items_enabled && (
          <p className="mt-2 text-xs text-muted-foreground">
            Quick-Items konfigurierst du unter{" "}
            <a href="/menu" className="underline font-semibold text-matcha-700">
              Speisekarte
            </a>{" "}
            — Stern-Icon an Artikel klicken. Maximal 6 Stück.
          </p>
        )}

        <div className="mt-4 pt-4 border-t">
          <label className="text-xs font-semibold text-zinc-700 mb-1 block">
            Notiz-Templates (Komma-getrennt)
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Mitarbeiter klickt One-Tap statt zu tippen. Erscheint als Chips beim Item-Hinzufügen.
          </p>
          <input
            type="text"
            value={s.note_templates.join(", ")}
            onChange={(e) =>
              patch({
                note_templates: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.note_templates.map((t, i) => (
              <span
                key={i}
                className="rounded-full bg-cyan-100 text-cyan-900 px-2 py-0.5 text-[11px]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <Toggle
            label="Tisch-VIP-Flag aktivieren"
            desc="Stammkunden / Geburtstage / Allergien-Hinweise direkt am Tisch sichtbar im Tischplan"
            icon={Star}
            checked={s.table_vip_enabled}
            onChange={(v) => patch({ table_vip_enabled: v })}
          />
          {s.table_vip_enabled && (
            <p className="mt-2 text-xs text-muted-foreground">
              VIP-Flag + Notiz pro Tisch unter{" "}
              <a href="/pos/tables" className="underline font-semibold text-matcha-700">
                Tische & QR-Codes
              </a>
              .
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── 17. BON-KOPF + COMPLIANCE-PFLICHT ──────────────── */}
      <SectionCard
        icon={FileText}
        accent="from-red-800 to-red-950"
        title="Bon-Pflichtangaben (DE)"
        subtitle="Was muss laut §14 UStG, LMIV und VerpackG auf jedem Bon stehen."
      >
        <div className="text-xs font-semibold text-zinc-700 mb-2">Bon-Kopf</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="Adresse + Stadt"
            desc="Pflicht laut §14 UStG"
            checked={s.bon_show_address}
            onChange={(v) => patch({ bon_show_address: v })}
          />
          <Toggle
            label="Steuer-Nr."
            desc="Pflicht laut §14 UStG"
            checked={s.bon_show_tax_id}
            onChange={(v) => patch({ bon_show_tax_id: v })}
          />
          <Toggle
            label="USt-ID"
            desc="Pflicht bei B2B-Rechnungen"
            checked={s.bon_show_vat_id}
            onChange={(v) => patch({ bon_show_vat_id: v })}
          />
          <Toggle
            label="Telefon-Nummer"
            desc="Empfohlen für Rückfragen"
            checked={s.bon_show_phone}
            onChange={(v) => patch({ bon_show_phone: v })}
          />
          <Toggle
            label="Inhaber-Name"
            desc="Pflicht bei Kleinunternehmer (§19 UStG)"
            checked={s.bon_show_owner_name}
            onChange={(v) => patch({ bon_show_owner_name: v })}
          />
        </div>
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          Restaurant-Stammdaten editierst du unter{" "}
          <a href="/settings/restaurant" className="underline font-semibold">
            Restaurant-Einstellungen
          </a>
          .
        </div>

        <div className="mt-5 pt-5 border-t">
          <Toggle
            label="Mehrweg-Verpackung anbieten"
            desc="§33 VerpackG seit 1.1.2023 — Pflicht ab 80m² oder 5+ Mitarbeitern. Verstoß = bis 10.000 € Strafe."
            icon={Shield}
            checked={s.mehrweg_offered}
            onChange={(v) => patch({ mehrweg_offered: v })}
          />
          {s.mehrweg_offered && (
            <>
              <Input
                label="Hinweis-Text auf Bon"
                value={s.mehrweg_hint_text ?? ""}
                onChange={(v) => patch({ mehrweg_hint_text: v })}
                placeholder="Wir bieten Mehrweg-Verpackung an. Bitte fragen."
              />
              <Toggle
                label="Hinweis auf Bon drucken"
                checked={s.mehrweg_show_on_bon}
                onChange={(v) => patch({ mehrweg_show_on_bon: v })}
              />
            </>
          )}
        </div>

        <div className="mt-5 pt-5 border-t">
          <Toggle
            label="Allergen-Tabelle auf Bon"
            desc="LMIV-Pflicht — die 14 Hauptallergene pro Item müssen für den Gast verfügbar sein"
            icon={AlertCircle}
            checked={s.allergens_show_on_bon}
            onChange={(v) => patch({ allergens_show_on_bon: v })}
          />
          <Input
            label="QR-Link zur Allergen-Übersicht (optional, statt voller Tabelle)"
            value={s.allergens_qr_url ?? ""}
            onChange={(v) => patch({ allergens_qr_url: v })}
            placeholder="https://frankys-farm.de/allergene"
          />
        </div>
      </SectionCard>

      {/* ── 18. MEHRERE DRUCKER (BON / KÜCHE / BAR) ───────── */}
      <SectionCard
        icon={Printer}
        accent="from-zinc-700 to-zinc-900"
        title="Drucker-Routing"
        subtitle="Heiße Items zur Küche, Getränke zur Bar, Gast-Bon zum Tresen."
      >
        <Toggle
          label="Drei separate Drucker (Bon / Küche / Bar)"
          desc="Items werden je nach KDS-Station an den richtigen Drucker geschickt"
          checked={s.printers_split}
          onChange={(v) => patch({ printers_split: v })}
        />
        {s.printers_split && (
          <div className="mt-3 space-y-3">
            <Input
              label="Küchen-Drucker (IP/Bluetooth)"
              value={s.kitchen_printer_address ?? ""}
              onChange={(v) => patch({ kitchen_printer_address: v })}
              placeholder="192.168.1.43:9100"
            />
            <Input
              label="Bar-Drucker (IP/Bluetooth)"
              value={s.bar_printer_address ?? ""}
              onChange={(v) => patch({ bar_printer_address: v })}
              placeholder="192.168.1.44:9100"
            />
            <p className="text-xs text-muted-foreground">
              Item-Routing pro Artikel unter{" "}
              <a href="/pos/stations" className="underline font-semibold">
                Küchen-Stationen
              </a>
              .
            </p>
          </div>
        )}
      </SectionCard>

      {/* ── 19. RESERVIERUNGEN + PRE-ORDERS + CUSTOMER-DISPLAY ─ */}
      <SectionCard
        icon={Eye}
        accent="from-violet-600 to-violet-800"
        title="Service-Erweiterungen"
        subtitle="Reservierungen, Vorbestellungen, Customer-Display."
      >
        <Toggle
          label="Reservierungs-System aktivieren"
          desc="Online-Booking-Form auf der Bestellseite + Tisch-Reservierung im Backoffice"
          icon={Hash}
          checked={s.reservations_enabled}
          onChange={(v) => patch({ reservations_enabled: v })}
        />
        {s.reservations_enabled && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <NumberInput
              label="Vorlauf-Zeit (Std)"
              desc="Min. Stunden vor Termin"
              value={s.reservation_min_lead_hours}
              onChange={(v) => patch({ reservation_min_lead_hours: v })}
              min={0}
            />
            <NumberInput
              label="Max. Personen pro Buchung"
              value={s.reservation_max_party_size}
              onChange={(v) => patch({ reservation_max_party_size: v })}
              min={1}
            />
            <NumberInput
              label="Walk-In-Buffer (%)"
              desc="So viel % Plätze für Spontankunden frei halten"
              value={s.walk_in_buffer_pct}
              onChange={(v) => patch({ walk_in_buffer_pct: v })}
              min={0}
              max={100}
            />
          </div>
        )}

        <div className="mt-5 pt-5 border-t">
          <Toggle
            label="Vorbestellungen / Catering"
            desc="Gast bestellt heute für später (z.B. Catering, Mittagstisch-Vorbestellung)"
            icon={Send}
            checked={s.preorders_enabled}
            onChange={(v) => patch({ preorders_enabled: v })}
          />
          {s.preorders_enabled && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumberInput
                label="Max. Tage im Voraus"
                value={s.preorder_max_days_ahead}
                onChange={(v) => patch({ preorder_max_days_ahead: v })}
                min={1}
                max={90}
              />
              <NumberInput
                label="Min. Vorlauf (Std)"
                value={s.preorder_min_lead_hours}
                onChange={(v) => patch({ preorder_min_lead_hours: v })}
                min={0}
              />
            </div>
          )}
        </div>

        <div className="mt-5 pt-5 border-t">
          <Toggle
            label="Customer-Display (Zweit-Bildschirm)"
            desc="iPad oder Bildschirm zeigt dem Gast die Items live + Total + Werbung"
            icon={Monitor}
            checked={s.customer_display_enabled}
            onChange={(v) => patch({ customer_display_enabled: v })}
          />
          {s.customer_display_enabled && (
            <div className="mt-3 space-y-2">
              <Toggle
                label="Werbung zwischen Bestellungen anzeigen"
                checked={s.customer_display_show_promo}
                onChange={(v) => patch({ customer_display_show_promo: v })}
              />
              <Input
                label="Werbe-Text"
                value={s.customer_display_promo_text ?? ""}
                onChange={(v) => patch({ customer_display_promo_text: v })}
                placeholder="z.B. Heute: Hausmacher Pasta 9.90 statt 12.90"
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 20. WORKFLOW-AUTOMATIK ────────────────────────── */}
      <SectionCard
        icon={Zap}
        accent="from-yellow-600 to-yellow-800"
        title="Workflow-Automatik"
        subtitle="Pflicht-Modifier, Auto-Send-Timer."
      >
        <Toggle
          label="Pflicht-Modifier erzwingen"
          desc="Pizza muss Größe haben sonst nicht in Cart. Verhindert unfertige Bestellungen."
          icon={Check}
          checked={s.enforce_required_modifiers}
          onChange={(v) => patch({ enforce_required_modifiers: v })}
        />
        <div className="mt-3 pt-3 border-t">
          <NumberInput
            label="Auto-Send an Küche nach (Min, 0 = aus)"
            desc="Bestellung wird X Min nach Aufnahme automatisch an KDS geschickt — wenn Kellner vergisst"
            value={s.auto_send_kitchen_minutes}
            onChange={(v) => patch({ auto_send_kitchen_minutes: v })}
            min={0}
            max={60}
          />
        </div>
      </SectionCard>

      {/* ── 21. INTEGRATIONEN (BUCHHALTUNG + WEBHOOK + PLATTFORMEN) ─ */}
      <SectionCard
        icon={Plug}
        accent="from-blue-700 to-blue-900"
        title="Integrationen"
        subtitle="Buchhaltung, Webhooks, Lieferplattformen."
      >
        <div className="text-xs font-semibold text-zinc-700 mb-2">Buchhaltung</div>
        <Toggle
          label="lexoffice-Export aktivieren"
          desc="Tagesabschluss + DSFinV-K automatisch zu lexoffice"
          icon={Receipt}
          checked={s.lexoffice_export_enabled}
          onChange={(v) => patch({ lexoffice_export_enabled: v })}
        />
        {s.lexoffice_export_enabled && (
          <p className="mt-2 text-xs text-muted-foreground">
            API-Key hinterlegst du unter{" "}
            <a href="/settings/integrations/lexoffice" className="underline font-semibold">
              Integrationen → lexoffice
            </a>
            .{" "}
            <span className={s.lexoffice_api_key_set ? "text-emerald-700 font-semibold" : "text-amber-700"}>
              {s.lexoffice_api_key_set ? "Verbunden ✓" : "Noch kein Key"}
            </span>
          </p>
        )}
        <Input
          label="DATEV-Export Email (optional)"
          value={s.datev_export_email ?? ""}
          onChange={(v) => patch({ datev_export_email: v })}
          placeholder="buchhalter@deine-kanzlei.de"
        />

        <div className="mt-5 pt-5 border-t">
          <div className="text-xs font-semibold text-zinc-700 mb-2">Webhook (für eigene Systeme)</div>
          <Input
            label="Webhook-URL"
            value={s.webhook_url ?? ""}
            onChange={(v) => patch({ webhook_url: v })}
            placeholder="https://eigene-app.de/api/mise-events"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            POST nach jedem Event. Events: order.paid · z_report · void
          </p>
        </div>

        <div className="mt-5 pt-5 border-t">
          <Toggle
            label="Newsletter-Opt-in beim Bon"
            desc="Email-Feld nach Zahlung — Gast meldet sich für Newsletter an"
            icon={Send}
            checked={s.newsletter_optin_on_bon}
            onChange={(v) => patch({ newsletter_optin_on_bon: v })}
          />
          {s.newsletter_optin_on_bon && (
            <Input
              label="Datenschutz-Hinweis-Text"
              value={s.newsletter_optin_text ?? ""}
              onChange={(v) => patch({ newsletter_optin_text: v })}
              multiline
            />
          )}
        </div>

        <div className="mt-5 pt-5 border-t">
          <div className="text-xs font-semibold text-zinc-700 mb-2">Liefer-Plattformen (Bestellungen-Inbound)</div>
          <div className="space-y-2">
            <Toggle
              label="Lieferando"
              icon={Plug}
              checked={s.lieferando_api_connected}
              onChange={(v) => patch({ lieferando_api_connected: v })}
            />
            <Toggle
              label="Wolt"
              icon={Plug}
              checked={s.wolt_api_connected}
              onChange={(v) => patch({ wolt_api_connected: v })}
            />
            <Toggle
              label="Uber Eats"
              icon={Plug}
              checked={s.ubereats_api_connected}
              onChange={(v) => patch({ ubereats_api_connected: v })}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            API-Keys + Margen-Settings unter{" "}
            <a href="/delivery/platforms" className="underline font-semibold">
              Lieferdienst → Plattformen
            </a>
            .
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Sub-Editoren für die JSONB-Felder ───────────────────────

function DiscountPresetEditor({
  presets,
  onChange,
}: {
  presets: SettingsRow["discount_presets"];
  onChange: (v: SettingsRow["discount_presets"]) => void;
}) {
  function update(idx: number, patch: Partial<SettingsRow["discount_presets"][number]>) {
    onChange(presets.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function add() {
    onChange([...presets, { name: "Neu", type: "percent", value: 10, requires_pin: false }]);
  }
  function remove(idx: number) {
    onChange(presets.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      {presets.map((p, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2">
          <input
            type="text"
            value={p.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="flex-1 min-w-[120px] rounded border border-zinc-200 px-2 py-1 text-sm"
            placeholder="Name"
          />
          <select
            value={p.type}
            onChange={(e) => update(i, { type: e.target.value as "percent" | "fixed" })}
            className="rounded border border-zinc-200 px-2 py-1 text-sm"
          >
            <option value="percent">%</option>
            <option value="fixed">€</option>
          </select>
          <input
            type="number"
            value={p.value}
            onChange={(e) => update(i, { value: Number(e.target.value) || 0 })}
            className="w-20 rounded border border-zinc-200 px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={p.requires_pin}
              onChange={(e) => update(i, { requires_pin: e.target.checked })}
            />
            Manager-PIN
          </label>
          <button
            onClick={() => remove(i)}
            className="text-red-600 hover:bg-red-50 rounded px-2 py-1 text-xs"
          >
            Entfernen
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-sm text-matcha-700 hover:text-matcha-900 underline"
      >
        + Rabatt-Vorlage hinzufügen
      </button>
    </div>
  );
}

function HappyHourEditor({
  rules,
  onChange,
}: {
  rules: SettingsRow["happy_hour_rules"];
  onChange: (v: SettingsRow["happy_hour_rules"]) => void;
}) {
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  function update(idx: number, patch: Partial<SettingsRow["happy_hour_rules"][number]>) {
    onChange(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function add() {
    onChange([...rules, { day: 1, from: "17:00", to: "19:00", discount_pct: 20, label: "Happy Hour" }]);
  }
  function remove(idx: number) {
    onChange(rules.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2">
          <input
            type="text"
            value={r.label ?? ""}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Label"
            className="flex-1 min-w-[100px] rounded border border-zinc-200 px-2 py-1 text-sm"
          />
          <select
            value={r.day}
            onChange={(e) => update(i, { day: Number(e.target.value) })}
            className="rounded border border-zinc-200 px-2 py-1 text-sm"
          >
            {days.map((d, idx) => (
              <option key={idx} value={idx}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={r.from}
            onChange={(e) => update(i, { from: e.target.value })}
            className="rounded border border-zinc-200 px-2 py-1 text-sm"
          />
          <span>–</span>
          <input
            type="time"
            value={r.to}
            onChange={(e) => update(i, { to: e.target.value })}
            className="rounded border border-zinc-200 px-2 py-1 text-sm"
          />
          <input
            type="number"
            value={r.discount_pct}
            onChange={(e) => update(i, { discount_pct: Number(e.target.value) || 0 })}
            className="w-16 rounded border border-zinc-200 px-2 py-1 text-sm"
          />
          <span className="text-xs">%</span>
          <button
            onClick={() => remove(i)}
            className="text-red-600 hover:bg-red-50 rounded px-2 py-1 text-xs"
          >
            Entfernen
          </button>
        </div>
      ))}
      <button onClick={add} className="text-sm text-matcha-700 hover:text-matcha-900 underline">
        + Happy-Hour-Regel hinzufügen
      </button>
    </div>
  );
}

function PfandEditor({
  items,
  onChange,
}: {
  items: SettingsRow["pfand_items"];
  onChange: (v: SettingsRow["pfand_items"]) => void;
}) {
  function update(idx: number, patch: Partial<SettingsRow["pfand_items"][number]>) {
    onChange(items.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function add() {
    onChange([...items, { name: "Neu", cents: 100 }]);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      {items.map((p, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border bg-white p-2">
          <input
            type="text"
            value={p.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="flex-1 rounded border border-zinc-200 px-2 py-1 text-sm"
          />
          <input
            type="number"
            value={p.cents / 100}
            step={0.01}
            onChange={(e) => update(i, { cents: Math.round((Number(e.target.value) || 0) * 100) })}
            className="w-20 rounded border border-zinc-200 px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">€</span>
          <button
            onClick={() => remove(i)}
            className="text-red-600 hover:bg-red-50 rounded px-2 py-1 text-xs"
          >
            Entfernen
          </button>
        </div>
      ))}
      <button onClick={add} className="text-sm text-matcha-700 hover:text-matcha-900 underline">
        + Pfand-Item hinzufügen
      </button>
    </div>
  );
}

// ─── UI-Helpers ──────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  accent,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            "h-12 w-12 rounded-2xl grid place-items-center text-white shrink-0 bg-gradient-to-br shadow-md",
            accent
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold text-matcha-900">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="pl-0 sm:pl-16">{children}</div>
    </Card>
  );
}

function Toggle({
  label,
  desc,
  icon: Icon,
  checked,
  disabled,
  disabledHint,
  disabledLink,
  onChange,
}: {
  label: string;
  desc?: string;
  icon?: React.ComponentType<{ className?: string }>;
  checked: boolean;
  disabled?: boolean;
  disabledHint?: string;
  disabledLink?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-white p-3 transition cursor-pointer",
        checked && !disabled ? "border-matcha-700 bg-matcha-50/40" : "border-zinc-200",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0",
            checked && !disabled ? "text-matcha-700" : "text-muted-foreground"
          )}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-matcha-900">{label}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
        {disabled && disabledHint && (
          <div className="text-xs text-amber-700 mt-1">
            {disabledHint}
            {disabledLink && (
              <>
                {" "}
                <a href={disabledLink} className="underline font-semibold">
                  öffnen
                </a>
              </>
            )}
          </div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 mt-0.5 rounded accent-matcha-700 cursor-pointer disabled:cursor-not-allowed"
      />
    </label>
  );
}

function RadioCard({
  label,
  desc,
  icon: Icon,
  checked,
  badge,
  onClick,
}: {
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  checked: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-xl border bg-white p-3 text-left transition",
        checked
          ? "border-matcha-700 bg-matcha-50/60 ring-2 ring-matcha-700/20"
          : "border-zinc-200 hover:border-matcha-300"
      )}
    >
      {badge && (
        <span className="absolute top-2 right-2 rounded-full bg-gold/30 text-amber-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
          {badge}
        </span>
      )}
      <Icon className={cn("h-5 w-5", checked ? "text-matcha-700" : "text-muted-foreground")} />
      <div>
        <div className="text-sm font-bold text-matcha-900">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      {checked && (
        <div className="absolute bottom-2 right-2 h-5 w-5 rounded-full bg-matcha-700 text-white grid place-items-center">
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-700 mb-1 block">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
        />
      )}
    </div>
  );
}

function NumberInput({
  label,
  desc,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  desc?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-700 mb-1 block">{label}</label>
      {desc && <div className="text-xs text-muted-foreground mb-1">{desc}</div>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-700 mb-1 block">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
