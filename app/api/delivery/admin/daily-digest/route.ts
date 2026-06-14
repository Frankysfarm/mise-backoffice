/**
 * GET  /api/delivery/admin/daily-digest?location_id=...&date=YYYY-MM-DD&action=email_config
 *   → Digest laden, History, E-Mail-Konfig + Log
 *
 * POST /api/delivery/admin/daily-digest
 *   Body: { location_id, date?, stream? }           → Digest generieren / SSE
 *   Body: { location_id, action: 'save_email_config', ... } → E-Mail-Konfig speichern
 *   Body: { location_id, action: 'send_email', date? }      → E-Mail manuell senden
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDailyDigest,
  getDigestHistory,
  saveDailyDigest,
  streamDailyDigest,
  gatherDailyMetrics,
  detectAnomalies,
} from '@/lib/delivery/daily-digest';
import {
  getDigestEmailConfig,
  upsertDigestEmailConfig,
  sendDailyDigestEmail,
  getEmailLog,
} from '@/lib/delivery/digest-mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const locationId = p.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });

  const date = p.get('date') ?? new Date().toISOString().slice(0, 10);

  const [digest, history, emailConfig, emailLog] = await Promise.all([
    getDailyDigest(locationId, date),
    getDigestHistory(locationId, 30),
    getDigestEmailConfig(locationId).catch(() => null),
    getEmailLog(locationId, 20).catch(() => []),
  ]);

  // Wenn kein Digest in DB, Live-Metriken berechnen (ohne AI-Summary)
  let liveMetrics = null;
  if (!digest) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const prevDate = new Date(new Date(today + 'T00:00:00Z').getTime() - 86_400_000)
        .toISOString().slice(0, 10);
      const [cur, prev] = await Promise.all([
        gatherDailyMetrics(locationId, date),
        gatherDailyMetrics(locationId, prevDate),
      ]);
      liveMetrics = { metrics: cur, anomalies: detectAnomalies(cur, prev) };
    } catch {
      // Graceful fallback
    }
  }

  return NextResponse.json({
    digest,
    liveMetrics,
    history,
    date,
    emailConfig,
    emailLog,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Nicht eingeloggt' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: {
    location_id?: string;
    date?: string;
    stream?: boolean;
    action?: string;
    // email config fields
    enabled?: boolean;
    send_hour_utc?: number;
    include_ai_summary?: boolean;
    extra_recipients?: string[];
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const locationId = body.location_id;
  if (!locationId) {
    return new Response(JSON.stringify({ error: 'location_id erforderlich' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const date = body.date ?? new Date().toISOString().slice(0, 10);

  // ── E-Mail-Konfig speichern ───────────────────────────────────────────────

  if (body.action === 'save_email_config') {
    try {
      const cfg = await upsertDigestEmailConfig(locationId, {
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.send_hour_utc !== undefined ? { sendHourUtc: body.send_hour_utc } : {}),
        ...(body.include_ai_summary !== undefined ? { includeAiSummary: body.include_ai_summary } : {}),
        ...(body.extra_recipients !== undefined ? { extraRecipients: body.extra_recipients } : {}),
      });
      return NextResponse.json({ ok: true, emailConfig: cfg });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Speichern';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── E-Mail manuell senden ─────────────────────────────────────────────────

  if (body.action === 'send_email') {
    try {
      const result = await sendDailyDigestEmail(locationId, body.date);
      return NextResponse.json({ ok: true, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'E-Mail-Fehler';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Streaming-Modus ──────────────────────────────────────────────────────

  if (body.stream) {
    try {
      const textStream = await streamDailyDigest(locationId, date);
      const encoder = new TextEncoder();

      const sseStream = new ReadableStream({
        async start(controller) {
          const reader = textStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                break;
              }
              const escaped = value.replace(/\n/g, '\\n');
              controller.enqueue(encoder.encode(`data: ${escaped}\n\n`));
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(sseStream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'x-accel-buffering': 'no',
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  // ── Speichern-Modus ──────────────────────────────────────────────────────

  try {
    const digest = await saveDailyDigest(locationId, date);
    return NextResponse.json({ ok: true, digest });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
