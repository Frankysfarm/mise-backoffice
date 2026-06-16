/**
 * lib/delivery/weather-intelligence.ts
 *
 * Phase 203: Smart Weather Intelligence Engine
 *
 * Fetches real-time weather data via Open-Meteo (free, no API key) and
 * translates conditions into delivery difficulty score, ETA factor, and
 * demand impact multiplier. Cron snapshots every 30 min.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherCondition {
  tempC: number;
  precipMm: number;
  windKmh: number;
  visibilityKm: number;
  weatherCode: number;
  weatherDesc: string;
}

export interface WeatherScores {
  difficultyScore: number;   // 0-100
  etaFactor: number;         // 1.0 (normal) – 1.5 (very hard)
  demandImpact: number;      // 0.8 – 1.4
  isDangerous: boolean;
  alertMessage: string | null;
}

export interface WeatherSnapshot {
  id: string;
  locationId: string;
  capturedAt: string;
  lat: number | null;
  lng: number | null;
  tempC: number | null;
  precipMm: number | null;
  windKmh: number | null;
  visibilityKm: number | null;
  weatherCode: number | null;
  weatherDesc: string | null;
  difficultyScore: number;
  etaFactor: number;
  demandImpact: number;
  isDangerous: boolean;
  alertMessage: string | null;
}

export interface WeatherTrendHour {
  hourUtc: string;
  avgDifficulty: number;
  avgTempC: number;
  totalPrecipMm: number;
  maxWindKmh: number;
  avgEtaFactor: number;
  avgDemandImpact: number;
  hadDangerous: boolean;
}

export interface WeatherDashboard {
  current: WeatherSnapshot | null;
  trend24h: WeatherTrendHour[];
  recentSnapshots: WeatherSnapshot[];
  minutesAgo: number | null;
}

// ── WMO weather code → description ───────────────────────────────────────────

const WMO_DESCRIPTIONS: Record<number, string> = {
  0:  'Klarer Himmel',
  1:  'Überwiegend klar',
  2:  'Teils bewölkt',
  3:  'Bedeckt',
  45: 'Nebel',
  48: 'Reifnebel',
  51: 'Leichter Nieselregen',
  53: 'Mäßiger Nieselregen',
  55: 'Starker Nieselregen',
  61: 'Leichter Regen',
  63: 'Mäßiger Regen',
  65: 'Starker Regen',
  71: 'Leichter Schneefall',
  73: 'Mäßiger Schneefall',
  75: 'Starker Schneefall',
  77: 'Schneekörner',
  80: 'Leichte Regenschauer',
  81: 'Mäßige Regenschauer',
  82: 'Starke Regenschauer',
  85: 'Leichte Schneeschauer',
  86: 'Starke Schneeschauer',
  95: 'Gewitter',
  96: 'Gewitter mit Hagel',
  99: 'Gewitter mit starkem Hagel',
};

function wmoDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? `Wetter-Code ${code}`;
}

// ── Difficulty Scoring ────────────────────────────────────────────────────────

/**
 * Computes a 0-100 delivery difficulty score from weather conditions.
 * Higher = harder / riskier for delivery.
 */
export function computeDifficultyScore(w: WeatherCondition): number {
  let score = 0;

  // Precipitation / weather code impact
  const code = w.weatherCode;
  if (code === 0 || code === 1) score += 0;
  else if (code === 2 || code === 3) score += 5;
  else if (code === 45 || code === 48) score += 30;             // fog
  else if (code === 51 || code === 53) score += 12;             // drizzle
  else if (code === 55) score += 20;                            // heavy drizzle
  else if (code === 61) score += 20;                            // light rain
  else if (code === 63) score += 35;                            // moderate rain
  else if (code === 65) score += 55;                            // heavy rain
  else if (code === 71) score += 35;                            // light snow
  else if (code === 73) score += 55;                            // moderate snow
  else if (code === 75 || code === 77) score += 70;             // heavy snow
  else if (code === 80 || code === 85) score += 25;             // light showers
  else if (code === 81 || code === 86) score += 45;             // moderate showers
  else if (code === 82) score += 60;                            // violent showers
  else if (code === 95) score += 70;                            // thunderstorm
  else if (code === 96 || code === 99) score += 85;             // thunderstorm + hail

  // Wind speed penalty (over 30 km/h)
  if (w.windKmh > 80) score += 30;
  else if (w.windKmh > 60) score += 20;
  else if (w.windKmh > 40) score += 10;
  else if (w.windKmh > 30) score += 5;

  // Visibility penalty
  if (w.visibilityKm < 0.5) score += 35;
  else if (w.visibilityKm < 1) score += 25;
  else if (w.visibilityKm < 2) score += 15;
  else if (w.visibilityKm < 5) score += 5;

  // Temperature penalty (very cold increases risk)
  if (w.tempC < -10) score += 20;
  else if (w.tempC < -5) score += 12;
  else if (w.tempC < 0) score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Maps difficulty score to ETA factor (1.0 = no change, 1.5 = 50% longer).
 */
export function computeEtaFactor(score: number): number {
  if (score >= 80) return 1.50;
  if (score >= 60) return 1.35;
  if (score >= 40) return 1.20;
  if (score >= 20) return 1.10;
  return 1.00;
}

/**
 * Maps weather conditions to demand impact multiplier.
 * Rain typically increases delivery orders; extreme weather decreases them.
 */
export function computeDemandImpact(w: WeatherCondition): number {
  const code = w.weatherCode;
  if (code === 95 || code === 96 || code === 99) return 1.35; // thunderstorm spikes demand
  if (code >= 61 && code <= 82) return 1.20;                  // rain boosts orders
  if (code >= 51 && code <= 55) return 1.10;                  // drizzle mild boost
  if (code >= 71 && code <= 77) return 1.15;                  // snow boosts orders
  if (code === 45 || code === 48) return 1.10;                 // fog mild boost
  if (w.tempC < -10) return 0.85;                              // extreme cold reduces orders
  if (w.tempC > 35) return 0.90;                               // extreme heat reduces orders
  return 1.00;
}

/**
 * Computes all scores from a WeatherCondition.
 */
export function computeWeatherScores(w: WeatherCondition): WeatherScores {
  const difficultyScore = computeDifficultyScore(w);
  const etaFactor       = computeEtaFactor(difficultyScore);
  const demandImpact    = computeDemandImpact(w);
  const isDangerous     = difficultyScore >= 60;

  let alertMessage: string | null = null;
  if (difficultyScore >= 80) {
    alertMessage = `⚠️ Extremes Wetter: ${w.weatherDesc}. Fahrer-Sicherheit prüfen!`;
  } else if (difficultyScore >= 60) {
    alertMessage = `⚠️ Gefährliche Bedingungen: ${w.weatherDesc}. ETAs verlängert (×${etaFactor.toFixed(2)}).`;
  } else if (difficultyScore >= 40) {
    alertMessage = `ℹ️ Schlechtes Wetter: ${w.weatherDesc}. ETAs leicht verlängert.`;
  }

  return { difficultyScore, etaFactor, demandImpact, isDangerous, alertMessage };
}

// ── Open-Meteo API ────────────────────────────────────────────────────────────

interface OpenMeteoResponse {
  current_weather: {
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  hourly: {
    time: string[];
    precipitation: number[];
    windspeed_10m: number[];
    visibility: number[];
    temperature_2m: number[];
  };
}

/**
 * Fetches current weather from Open-Meteo (free, no API key).
 * Falls back gracefully if the API is unavailable.
 */
async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherCondition | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current_weather=true` +
    `&hourly=precipitation,windspeed_10m,visibility,temperature_2m` +
    `&forecast_days=1&timezone=UTC`;

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data: OpenMeteoResponse = await res.json();
    const cw = data.current_weather;

    // Find the nearest hourly slot for precip/visibility
    const now = new Date();
    const currentHour = now.toISOString().substring(0, 13) + ':00';
    const hourlyIdx = data.hourly.time.findIndex((t) => t.startsWith(currentHour.substring(0, 13)));
    const idx = hourlyIdx >= 0 ? hourlyIdx : 0;

    return {
      tempC:        cw.temperature,
      precipMm:     data.hourly.precipitation[idx] ?? 0,
      windKmh:      cw.windspeed,
      visibilityKm: (data.hourly.visibility[idx] ?? 10000) / 1000,
      weatherCode:  cw.weathercode,
      weatherDesc:  wmoDescription(cw.weathercode),
    };
  } catch {
    return null;
  }
}

// ── takeWeatherSnapshot ────────────────────────────────────────────────────────

/**
 * Fetches weather for a location and saves a snapshot to DB.
 */
export async function takeWeatherSnapshot(locationId: string): Promise<{
  ok: boolean;
  difficultyScore?: number;
  etaFactor?: number;
  isDangerous?: boolean;
}> {
  const sb = createServiceClient();

  const { data: loc } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();

  const lat = loc?.lat as number | null;
  const lng = loc?.lng as number | null;

  if (!lat || !lng) {
    // Still store a "no data" snapshot so UI shows that location has no coords
    await sb.from('weather_snapshots').insert({
      location_id:      locationId,
      difficulty_score: 0,
      eta_factor:       1.0,
      demand_impact:    1.0,
      is_dangerous:     false,
    });
    return { ok: false };
  }

  const weather = await fetchOpenMeteo(lat, lng);
  if (!weather) {
    return { ok: false };
  }

  const scores = computeWeatherScores(weather);

  await sb.from('weather_snapshots').insert({
    location_id:      locationId,
    lat,
    lng,
    temp_c:           weather.tempC,
    precip_mm:        weather.precipMm,
    wind_kmh:         weather.windKmh,
    visibility_km:    weather.visibilityKm,
    weather_code:     weather.weatherCode,
    weather_desc:     weather.weatherDesc,
    difficulty_score: scores.difficultyScore,
    eta_factor:       scores.etaFactor,
    demand_impact:    scores.demandImpact,
    is_dangerous:     scores.isDangerous,
    alert_message:    scores.alertMessage,
  });

  return {
    ok:              true,
    difficultyScore: scores.difficultyScore,
    etaFactor:       scores.etaFactor,
    isDangerous:     scores.isDangerous,
  };
}

// ── takeWeatherSnapshotAllLocations ───────────────────────────────────────────

export async function takeWeatherSnapshotAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  dangerous: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  let snapshots = 0;
  let dangerous = 0;
  let errors    = 0;

  await Promise.all(
    (locs ?? []).map(async (loc: { id: string }) => {
      try {
        const r = await takeWeatherSnapshot(loc.id);
        if (r.ok) {
          snapshots++;
          if (r.isDangerous) dangerous++;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }),
  );

  return { locations: (locs ?? []).length, snapshots, dangerous, errors };
}

// ── getCurrentWeather ─────────────────────────────────────────────────────────

export async function getCurrentWeather(locationId: string): Promise<WeatherSnapshot | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('weather_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data);
}

// ── getWeatherTrend24h ────────────────────────────────────────────────────────

export async function getWeatherTrend24h(locationId: string): Promise<WeatherTrendHour[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_weather_trend_24h')
    .select('*')
    .eq('location_id', locationId)
    .order('hour_utc', { ascending: false })
    .limit(24);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    hourUtc:         r.hour_utc as string,
    avgDifficulty:   Number(r.avg_difficulty ?? 0),
    avgTempC:        Number(r.avg_temp_c ?? 0),
    totalPrecipMm:   Number(r.total_precip_mm ?? 0),
    maxWindKmh:      Number(r.max_wind_kmh ?? 0),
    avgEtaFactor:    Number(r.avg_eta_factor ?? 1),
    avgDemandImpact: Number(r.avg_demand_impact ?? 1),
    hadDangerous:    Boolean(r.had_dangerous),
  }));
}

// ── getRecentSnapshots ────────────────────────────────────────────────────────

export async function getRecentSnapshots(
  locationId: string,
  limit = 48,
): Promise<WeatherSnapshot[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('weather_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .order('captured_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapRow);
}

// ── getWeatherDashboard ───────────────────────────────────────────────────────

export async function getWeatherDashboard(locationId: string): Promise<WeatherDashboard> {
  const [current, trend24h, recentSnapshots] = await Promise.all([
    getCurrentWeather(locationId),
    getWeatherTrend24h(locationId),
    getRecentSnapshots(locationId, 48),
  ]);

  let minutesAgo: number | null = null;
  if (current?.capturedAt) {
    minutesAgo = Math.floor(
      (Date.now() - new Date(current.capturedAt).getTime()) / 60_000,
    );
  }

  return { current, trend24h, recentSnapshots, minutesAgo };
}

// ── pruneOldWeatherSnapshots ──────────────────────────────────────────────────

export async function pruneOldWeatherSnapshots(days = 30): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { count } = await sb
    .from('weather_snapshots')
    .delete({ count: 'exact' })
    .lt('captured_at', cutoff);
  return count ?? 0;
}

// ── row mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): WeatherSnapshot {
  return {
    id:              r.id as string,
    locationId:      r.location_id as string,
    capturedAt:      r.captured_at as string,
    lat:             r.lat != null ? Number(r.lat) : null,
    lng:             r.lng != null ? Number(r.lng) : null,
    tempC:           r.temp_c != null ? Number(r.temp_c) : null,
    precipMm:        r.precip_mm != null ? Number(r.precip_mm) : null,
    windKmh:         r.wind_kmh != null ? Number(r.wind_kmh) : null,
    visibilityKm:    r.visibility_km != null ? Number(r.visibility_km) : null,
    weatherCode:     r.weather_code != null ? Number(r.weather_code) : null,
    weatherDesc:     r.weather_desc as string | null,
    difficultyScore: Number(r.difficulty_score ?? 0),
    etaFactor:       Number(r.eta_factor ?? 1),
    demandImpact:    Number(r.demand_impact ?? 1),
    isDangerous:     Boolean(r.is_dangerous),
    alertMessage:    r.alert_message as string | null,
  };
}
