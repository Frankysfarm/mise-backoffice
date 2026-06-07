/**
 * lib/delivery/delivery-fee.ts
 *
 * Delivery Fee Calculator — Phase 42.
 *
 * Berechnet die kundengerechte Liefergebühr für eine Bestellung auf Basis von:
 *  1. Zonen-Gebühr      — surcharge_eur aus delivery_zones (distance-based)
 *  2. Surge-Multiplikator — aktiver Surge aus surge.ts
 *  3. Kostenlos-Schwelle  — free_delivery_above_eur (Mindestbestellwert für Gratislieferung)
 *  4. Mindestbestellwert  — min_order_eur pro Zone
 *
 * Hauptfunktion:
 *  getDeliveryFeeQuote(locationId, customerCoords, orderTotalEur) → FeeQuote
 *
 * Storefront-Hilfsfunktion (ohne Auth):
 *  getPublicFeeQuote() — wie oben, aber Graceful Fallback bei Fehler
 *
 * Verwendet von:
 *  - GET /api/delivery/fee (Storefront Checkout)
 *  - Dispatch-Engine (zukünftig für Fee-Logging)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { classifyZone } from './zones';
import { getSurgeMultiplier } from './surge';
import type { ZoneName } from './zones';

// ──────────────────────────────────────────────────────────────────────────────
// Typen
// ──────────────────────────────────────────────────────────────────────────────

export interface FeeQuote {
  zone: ZoneName;
  zone_label: string;
  zone_color: string;
  distance_km: number;
  eta_min: number;
  base_fee_eur: number;
  surge_multiplier: number;
  surge_surcharge_eur: number;
  total_fee_eur: number;
  is_free_delivery: boolean;
  free_delivery_above_eur: number | null;
  min_order_eur: number;
  is_min_order_met: boolean;
  breakdown: string;
}

export interface FeeQuoteError {
  error: string;
  zone: null;
  total_fee_eur: 0;
  is_min_order_met: false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ──────────────────────────────────────────────────────────────────────────────

/** Lädt Restaurant-Koordinaten (lat/lng) für eine Location. */
async function getLocationCoords(locationId: string): Promise<{ lat: number; lng: number } | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();
  if (!data || data.lat == null || data.lng == null) return null;
  return { lat: Number(data.lat), lng: Number(data.lng) };
}

function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function buildBreakdown(params: {
  baseFee: number;
  surgeSurcharge: number;
  totalFee: number;
  isFree: boolean;
  surgeMultiplier: number;
}): string {
  const { baseFee, surgeSurcharge, totalFee, isFree, surgeMultiplier } = params;

  if (isFree) return `Kostenlose Lieferung (Mindestbestellwert erreicht)`;
  if (baseFee === 0 && surgeSurcharge === 0) return `Kostenlose Lieferung`;

  const parts: string[] = [formatEur(baseFee)];
  if (surgeMultiplier > 1.0 && surgeSurcharge > 0) {
    parts.push(`Surge ${formatEur(surgeSurcharge)} (×${surgeMultiplier.toFixed(1)})`);
  }
  if (parts.length > 1) {
    parts.push(`= ${formatEur(totalFee)}`);
  }
  return parts.join(' + ');
}

// ──────────────────────────────────────────────────────────────────────────────
// Hauptfunktion
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet die vollständige Liefergebühr für eine Bestellung.
 *
 * @param locationId     - Location UUID (Restaurant-Standort)
 * @param customerCoords - Kunden-GPS-Koordinaten
 * @param orderTotalEur  - Bestellwert in EUR (für Free-Delivery-Check)
 */
export async function getDeliveryFeeQuote(
  locationId: string,
  customerCoords: { lat: number; lng: number },
  orderTotalEur: number,
): Promise<FeeQuote> {
  const restaurantCoords = await getLocationCoords(locationId);
  if (!restaurantCoords) {
    throw new Error(`[delivery-fee] Location ${locationId} hat keine GPS-Koordinaten`);
  }

  const [{ zone, zoneConfig, distanceKm }, surgeMultiplier] = await Promise.all([
    classifyZone(locationId, restaurantCoords, customerCoords),
    getSurgeMultiplier(locationId).catch(() => 1.0),
  ]);

  const baseFee = zoneConfig.surcharge_eur;
  const surgeSurcharge = baseFee > 0
    ? Math.round((baseFee * (surgeMultiplier - 1)) * 100) / 100
    : 0;
  const feeBeforeDiscount = Math.round((baseFee + surgeSurcharge) * 100) / 100;

  const freeThreshold = zoneConfig.free_delivery_above_eur;
  const isFreeDelivery = freeThreshold != null && orderTotalEur >= freeThreshold;

  const totalFee = isFreeDelivery ? 0 : feeBeforeDiscount;
  const isMinOrderMet = orderTotalEur >= zoneConfig.min_order_eur;

  return {
    zone,
    zone_label: zoneConfig.label,
    zone_color: zoneConfig.color,
    distance_km: Math.round(distanceKm * 100) / 100,
    eta_min: zoneConfig.eta_base_min,
    base_fee_eur: baseFee,
    surge_multiplier: surgeMultiplier,
    surge_surcharge_eur: surgeSurcharge,
    total_fee_eur: totalFee,
    is_free_delivery: isFreeDelivery,
    free_delivery_above_eur: freeThreshold,
    min_order_eur: zoneConfig.min_order_eur,
    is_min_order_met: isMinOrderMet,
    breakdown: buildBreakdown({
      baseFee,
      surgeSurcharge,
      totalFee,
      isFree: isFreeDelivery,
      surgeMultiplier,
    }),
  };
}

/**
 * Wie getDeliveryFeeQuote, aber mit Graceful Fallback — gibt null zurück
 * statt zu werfen (für unkritische Storefront-Prefetches).
 */
export async function getPublicFeeQuote(
  locationId: string,
  customerCoords: { lat: number; lng: number },
  orderTotalEur: number,
): Promise<FeeQuote | null> {
  try {
    return await getDeliveryFeeQuote(locationId, customerCoords, orderTotalEur);
  } catch {
    return null;
  }
}

/**
 * Gibt alle konfigurierten Zonen mit ihren Gebühren zurück.
 * Nützlich für Admin-Dashboards und "Liefergebiet"-Seiten.
 */
export async function getAllZoneFees(locationId: string): Promise<
  Array<{
    zone: ZoneName;
    zone_label: string;
    zone_color: string;
    min_km: number;
    max_km: number;
    surcharge_eur: number;
    min_order_eur: number;
    free_delivery_above_eur: number | null;
    eta_min: number;
  }>
> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_zones')
    .select('name, label, color, min_km, max_km, surcharge_eur, min_order_eur, free_delivery_above_eur, eta_base_min')
    .eq('location_id', locationId)
    .eq('active', true)
    .order('min_km', { ascending: true });

  if (error) throw new Error(`[delivery-fee] getAllZoneFees: ${error.message}`);

  return (data ?? []).map((r) => ({
    zone: r.name as ZoneName,
    zone_label: r.label as string,
    zone_color: r.color as string,
    min_km: Number(r.min_km),
    max_km: Number(r.max_km),
    surcharge_eur: Number(r.surcharge_eur),
    min_order_eur: Number(r.min_order_eur),
    free_delivery_above_eur: r.free_delivery_above_eur != null ? Number(r.free_delivery_above_eur) : null,
    eta_min: Number(r.eta_base_min),
  }));
}
