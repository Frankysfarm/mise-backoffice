/**
 * lib/delivery/customer-tracking-sse.ts
 *
 * Phase 301 — Echtzeit-Kunden-Tracking via Server-Sent Events
 *
 * Streams driver position + ETA updates to the customer's browser
 * every POLL_INTERVAL_MS using the existing getOrderTrackingData() function.
 *
 * Public API:
 *  createTrackingSseStream(bestellnummer, opts) — ReadableStream für Next.js Response
 *  logSseSession(params)                        — Session-Analytics in DB schreiben
 *  getSseTrackingStats(locationId)              — Admin-Statistik
 *
 * Stream-Protokoll (text/event-stream):
 *  event: tracking_update  — vollständiges Tracking-Payload (JSON)
 *  event: heartbeat        — Ping alle 15s um Verbindung offen zu halten
 *  event: closed           — Lieferung abgeschlossen oder Timeout
 *
 * Sicherheit:
 *  Kein Auth — bestellnummer ist cryptographisch stark genug als Lookup-Key.
 *  Kein GPS-Logging über diesen Endpoint — Position kommt nur aus der DB.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrderTrackingData } from './live-tracking';

// ── Konstanten ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS   = 3_000;   // Fahrer-Position alle 3s aktualisieren
const HEARTBEAT_INTERVAL = 5;       // Heartbeat alle 5 Zyklen ≙ 15s
const MAX_SESSION_MS     = 2 * 60 * 60_000; // Maximale Session: 2 Stunden

// Endstatus: Stream schließen wenn Bestellung in einem dieser Zustände
const TERMINAL_STATUSES = new Set(['geliefert', 'storniert', 'abgebrochen']);

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface SseTrackingFrame {
  type:            'tracking_update' | 'heartbeat' | 'closed';
  ts:              string;      // ISO-Timestamp
  // tracking_update fields (undefined für heartbeat/closed)
  order_id?:       string;
  bestellnummer?:  string;
  status?:         string;
  eta_label?:      string | null;
  eta_earliest?:   string | null;
  eta_latest?:     string | null;
  stops_before?:   number | null;
  driver?:         {
    lat:           number;
    lng:           number;
    heading:       number | null;
    speed_kmh:     number | null;
    seconds_stale: number;
  } | null;
  driver_name?:    string | null;
  geo?: {
    distance_m:        number | null;
    almost_there:      boolean;
    eta_min_remaining: number | null;
    bearing_deg:       number | null;
  };
  close_reason?:   string;  // für 'closed'-Frames
}

export interface SseSessionParams {
  orderId:       string;
  locationId:    string;
  bestellnummer: string;
  ipHash:        string | null;
  userAgentHint: 'mobile' | 'desktop' | null;
}

export interface SseTrackingStats {
  locationId:             string;
  last7Days: {
    day:                    string;
    totalSessions:          number;
    completedToDelivery:    number;
    timedOut:               number;
    avgFramesPerSession:    number;
    avgSessionMin:          number;
  }[];
}

// ── SSE-Stream erstellen ───────────────────────────────────────────────────────

export function createTrackingSseStream(
  bestellnummer: string,
  sessionParams: Omit<SseSessionParams, 'orderId' | 'locationId' | 'bestellnummer'>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const sessionId = crypto.randomUUID();
      const startedAt = Date.now();
      let framesSent  = 0;
      let cycle       = 0;
      let dbSessionId: string | null = null;

      // Sendet ein SSE-Frame
      function send(frame: SseTrackingFrame) {
        const data = JSON.stringify(frame);
        controller.enqueue(encoder.encode(`event: ${frame.type}\ndata: ${data}\n\n`));
        framesSent++;
      }

      // Session in DB anlegen (fire-and-forget bis wir orderId kennen)
      async function initSession(orderId: string, locationId: string) {
        try {
          const svc = createServiceClient();
          const { data } = await svc
            .from('tracking_sse_sessions')
            .insert({
              id:              sessionId,
              order_id:        orderId,
              location_id:     locationId,
              bestellnummer,
              ip_hash:         sessionParams.ipHash,
              user_agent_hint: sessionParams.userAgentHint,
            })
            .select('id')
            .single();
          dbSessionId = (data as { id: string } | null)?.id ?? null;
        } catch { /* analytics failure doesn't break stream */ }
      }

      async function closeSession(reason: string) {
        if (!dbSessionId) return;
        try {
          const svc = createServiceClient();
          await svc
            .from('tracking_sse_sessions')
            .update({
              closed_at:    new Date().toISOString(),
              close_reason: reason,
              frames_sent:  framesSent,
              last_ping_at: new Date().toISOString(),
            })
            .eq('id', dbSessionId);
        } catch { /* best-effort */ }
      }

      async function pingSession() {
        if (!dbSessionId) return;
        try {
          const svc = createServiceClient();
          await svc
            .from('tracking_sse_sessions')
            .update({ last_ping_at: new Date().toISOString(), frames_sent: framesSent })
            .eq('id', dbSessionId);
        } catch { /* best-effort */ }
      }

      try {
        // Poll-Schleife
        while (Date.now() - startedAt < MAX_SESSION_MS) {
          const payload = await getOrderTrackingData(bestellnummer);

          if (!payload) {
            // Bestellung nicht gefunden — kurz warten, dann abbrechen
            send({ type: 'closed', ts: new Date().toISOString(), close_reason: 'not_found' });
            await closeSession('not_found');
            break;
          }

          // Beim ersten Frame: Session in DB anlegen
          if (cycle === 0) {
            await initSession(payload.orderId, payload.orderId); // locationId via live-tracking geladen
          }

          // Heartbeat alle HEARTBEAT_INTERVAL Zyklen
          if (cycle % HEARTBEAT_INTERVAL === 0 && cycle > 0) {
            send({ type: 'heartbeat', ts: new Date().toISOString() });
            await pingSession();
          }

          // Tracking-Frame
          const frame: SseTrackingFrame = {
            type:          'tracking_update',
            ts:            new Date().toISOString(),
            order_id:      payload.orderId,
            bestellnummer: payload.bestellnummer,
            status:        payload.status,
            eta_label:     payload.etaLabel,
            eta_earliest:  payload.etaEarliest,
            eta_latest:    payload.etaLatest,
            stops_before:  payload.stopsBefore,
            driver:        payload.driver
              ? {
                  lat:           payload.driver.lat,
                  lng:           payload.driver.lng,
                  heading:       payload.driver.heading,
                  speed_kmh:     payload.driver.speedKmh,
                  seconds_stale: payload.driver.positionAgeSec,
                }
              : null,
            driver_name: payload.driverName,
            geo: {
              distance_m:        payload.geo.distanceM,
              almost_there:      payload.geo.almostThere,
              eta_min_remaining: payload.geo.etaMinRemaining,
              bearing_deg:       payload.geo.bearingDeg,
            },
          };
          send(frame);

          // Terminal-Status → Stream schließen
          if (TERMINAL_STATUSES.has(payload.status)) {
            send({ type: 'closed', ts: new Date().toISOString(), close_reason: payload.status });
            await closeSession(payload.status);
            break;
          }

          cycle++;
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }

        // Timeout
        if (Date.now() - startedAt >= MAX_SESSION_MS) {
          send({ type: 'closed', ts: new Date().toISOString(), close_reason: 'timeout' });
          await closeSession('timeout');
        }
      } catch (err) {
        console.error('[SSE tracking]', err);
        try {
          send({ type: 'closed', ts: new Date().toISOString(), close_reason: 'error' });
          await closeSession('error');
        } catch { /* ignore */ }
      } finally {
        controller.close();
      }
    },
  });
}

// ── Admin-Statistik ────────────────────────────────────────────────────────────

export async function getSseTrackingStats(locationId: string): Promise<SseTrackingStats> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('v_sse_tracking_stats')
    .select('day, total_sessions, completed_to_delivery, timed_out, avg_frames_per_session, avg_session_min')
    .eq('location_id', locationId)
    .gte('day', new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
    .order('day', { ascending: false });

  return {
    locationId,
    last7Days: (data ?? []).map((r) => ({
      day:                 r.day as string,
      totalSessions:       Number(r.total_sessions),
      completedToDelivery: Number(r.completed_to_delivery),
      timedOut:            Number(r.timed_out),
      avgFramesPerSession: Number(r.avg_frames_per_session ?? 0),
      avgSessionMin:       Number(r.avg_session_min ?? 0),
    })),
  };
}
