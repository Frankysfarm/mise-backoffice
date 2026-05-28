/**
 * lib/delivery/scoring.ts
 *
 * 10-Faktoren Scoring — bewertet wie gut ein Fahrer für eine Bestellung passt.
 * Score 0–100, höher = besser.
 *
 * Faktoren (je 0–10 Punkte, Summe × 1 = 0–100):
 *  1. Distanz       — näher = besser
 *  2. Fahrerlast    — weniger aktive Orders = besser
 *  3. Fahrzeugtyp   — Auto für große Orders besser
 *  4. Erfahrung     — mehr Lieferungen = zuverlässiger
 *  5. Zonenpassung  — selbe Zone = kein Umweg
 *  6. Küchen-Timing — Fahrer kommt rechtzeitig zum Pickup
 *  7. Tageszeit     — Rush-Hour berücksichtigen
 *  8. Bestellpriority — Priorität (VIP/Express)
 *  9. Bündelbarkeit — passt zur offenen Tour
 * 10. Historie      — Fahrer-Rating / Zuverlässigkeit
 */
import 'server-only';
import { haversineKm } from '@/lib/google-maps';
import type { ZoneName } from './zones';

export interface DriverScoreInput {
  id: string;
  vehicle: 'bike' | 'car';
  last_lat: number | null;
  last_lng: number | null;
  current_capacity: number;
  max_capacity: number;
  total_deliveries: number;
  zone?: ZoneName | null;
  active_batch_id?: string | null;
  rating?: number | null;           // 0–5
  avg_delivery_min?: number | null; // Durchschnittliche Lieferzeit
}

export interface OrderScoreInput {
  id: string;
  location_id: string;
  kunde_lat: number;
  kunde_lng: number;
  restaurant_lat: number;
  restaurant_lng: number;
  zone?: ZoneName | null;
  priority?: 'normal' | 'rush' | 'vip' | 'express' | null;
  item_count?: number;
  estimated_prep_min?: number;
  created_at: string;
}

export interface ScoreBreakdown {
  total: number;
  f_distance: number;
  f_load: number;
  f_vehicle: number;
  f_experience: number;
  f_zone: number;
  f_prep_time: number;
  f_time_of_day: number;
  f_priority: number;
  f_bundle_fit: number;
  f_history: number;
}

/**
 * Berechnet den Gesamt-Score eines Fahrers für eine Bestellung.
 * Gibt null zurück wenn der Fahrer grundsätzlich ungeeignet ist (z.B. voll).
 */
export function scoreDriver(
  driver: DriverScoreInput,
  order: OrderScoreInput,
  nowUtc: Date = new Date(),
): ScoreBreakdown | null {
  if (driver.current_capacity >= driver.max_capacity) return null;

  const scores: Omit<ScoreBreakdown, 'total'> = {
    f_distance:    scoreDistance(driver, order),
    f_load:        scoreLoad(driver),
    f_vehicle:     scoreVehicle(driver, order),
    f_experience:  scoreExperience(driver),
    f_zone:        scoreZone(driver, order),
    f_prep_time:   scorePrepTime(driver, order, nowUtc),
    f_time_of_day: scoreTimeOfDay(nowUtc),
    f_priority:    scorePriority(order),
    f_bundle_fit:  scoreBundleFit(driver),
    f_history:     scoreHistory(driver),
  };

  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  return { total: Math.round(total * 100) / 100, ...scores };
}

/**
 * Rankt mehrere Fahrer für eine Bestellung. Gibt sortiertes Array zurück.
 */
export function rankDrivers(
  drivers: DriverScoreInput[],
  order: OrderScoreInput,
  nowUtc: Date = new Date(),
): Array<{ driver: DriverScoreInput; score: ScoreBreakdown }> {
  const scored = drivers
    .map((d) => ({ driver: d, score: scoreDriver(d, order, nowUtc) }))
    .filter((e): e is { driver: DriverScoreInput; score: ScoreBreakdown } => e.score !== null)
    .sort((a, b) => b.score.total - a.score.total);
  return scored;
}

// --- Einzelfaktoren ---

function scoreDistance(driver: DriverScoreInput, order: OrderScoreInput): number {
  if (driver.last_lat == null || driver.last_lng == null) return 5;
  const distToRestaurant = haversineKm(
    { lat: driver.last_lat, lng: driver.last_lng },
    { lat: order.restaurant_lat, lng: order.restaurant_lng },
  );
  // 0 km = 10 Punkte, 10+ km = 0 Punkte (linear)
  return Math.max(0, 10 - distToRestaurant);
}

function scoreLoad(driver: DriverScoreInput): number {
  const free = driver.max_capacity - driver.current_capacity;
  const ratio = free / driver.max_capacity;
  // Leerer Fahrer = 10, voller Fahrer = 0
  return Math.round(ratio * 10 * 100) / 100;
}

function scoreVehicle(driver: DriverScoreInput, order: OrderScoreInput): number {
  if (driver.vehicle === 'car') return 10;
  const itemCount = order.item_count ?? 1;
  if (itemCount > 4) return 3;   // Fahrrad für viele Artikel schlecht
  if (itemCount > 2) return 6;
  return 9;                       // wenige Artikel: Fahrrad ok
}

function scoreExperience(driver: DriverScoreInput): number {
  const d = driver.total_deliveries;
  if (d >= 500) return 10;
  if (d >= 200) return 8;
  if (d >= 100) return 7;
  if (d >= 50)  return 6;
  if (d >= 20)  return 5;
  if (d >= 5)   return 3;
  return 1;
}

function scoreZone(driver: DriverScoreInput, order: OrderScoreInput): number {
  if (!driver.zone || !order.zone) return 5;
  if (driver.zone === order.zone) return 10;
  const zones: ZoneName[] = ['A', 'B', 'C', 'D'];
  const diff = Math.abs(zones.indexOf(driver.zone) - zones.indexOf(order.zone));
  return Math.max(0, 10 - diff * 3);
}

function scorePrepTime(
  driver: DriverScoreInput,
  order: OrderScoreInput,
  now: Date,
): number {
  if (driver.last_lat == null || driver.last_lng == null) return 5;
  const distToRestaurant = haversineKm(
    { lat: driver.last_lat, lng: driver.last_lng },
    { lat: order.restaurant_lat, lng: order.restaurant_lng },
  );
  // Geschätzte Fahrzeit zum Restaurant (18 km/h Bike / 30 km/h Auto)
  const speedKmh = driver.vehicle === 'car' ? 30 : 18;
  const driveMins = (distToRestaurant / speedKmh) * 60;
  const prepMins = order.estimated_prep_min ?? 15;

  const orderAgeMins = (now.getTime() - new Date(order.created_at).getTime()) / 60000;
  const remainingPrepMins = Math.max(0, prepMins - orderAgeMins);

  const slack = remainingPrepMins - driveMins;
  // Fahrer kommt genau rechtzeitig = 10, zu früh/spät = Abzüge
  if (slack >= 0 && slack <= 5) return 10;   // perfektes Timing
  if (slack > 5 && slack <= 10) return 8;     // leicht zu früh
  if (slack > 10) return 5;                   // stark zu früh (wartet)
  if (slack >= -3) return 7;                  // leicht zu spät (noch ok)
  return 2;                                    // deutlich zu spät
}

function scoreTimeOfDay(now: Date): number {
  const hour = now.getUTCHours() + 1; // UTC+1 grob
  // Rush-Hours 12–13 Uhr und 18–20 Uhr → Bonus für erfahrene Fahrer (hier neutral)
  if ((hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 20)) return 6;
  if (hour >= 11 && hour <= 21) return 8;  // Kernlieferzeiten
  return 4;                                 // Randzeiten
}

function scorePriority(order: OrderScoreInput): number {
  switch (order.priority) {
    case 'express': return 10;
    case 'vip':     return 9;
    case 'rush':    return 8;
    default:        return 5;
  }
}

function scoreBundleFit(driver: DriverScoreInput): number {
  if (!driver.active_batch_id) return 7; // freier Fahrer, kein Bundle-Overhead
  const free = driver.max_capacity - driver.current_capacity;
  if (free >= 2) return 9;  // viel Platz in offener Tour
  if (free === 1) return 7; // letzter Slot
  return 0;                  // voll (sollte durch Null-Return oben gefiltert sein)
}

function scoreHistory(driver: DriverScoreInput): number {
  const rating = driver.rating ?? 4.5;
  const avgMin = driver.avg_delivery_min ?? 25;
  const ratingScore = ((rating - 1) / 4) * 7;        // 1–5 → 0–7
  const speedScore = avgMin <= 20 ? 3 : avgMin <= 30 ? 2 : avgMin <= 40 ? 1 : 0;
  return Math.min(10, ratingScore + speedScore);
}
