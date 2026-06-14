/**
 * lib/delivery/push-campaigns.ts
 *
 * Phase 177 — Push-Notification Scheduling Engine
 *
 * Features:
 *  - Kampagnen erstellen/planen (VAPID + Fahrer-Push + WhatsApp-Zählung)
 *  - Best-Time-to-Send via historische WhatsApp-Öffnungsraten
 *  - Zielgruppen: all / active_7d / active_30d / inactive_30d / inactive_90d
 *  - Cron: fällige Kampagnen alle 10 Min automatisch versenden
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { broadcastToLocation } from './customer-web-push';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type CampaignChannel  = 'vapid' | 'whatsapp' | 'driver' | 'all';
export type CampaignAudience = 'all' | 'active_7d' | 'active_30d' | 'inactive_30d' | 'inactive_90d';
export type CampaignStatus   = 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface PushCampaign {
  id:                  string;
  locationId:          string;
  name:                string;
  channel:             CampaignChannel;
  title:               string;
  body:                string;
  url:                 string | null;
  audience:            CampaignAudience;
  status:              CampaignStatus;
  scheduledAt:         string | null;
  useBestTime:         boolean;
  bestTimeWindowStart: number;
  bestTimeWindowEnd:   number;
  startedAt:           string | null;
  completedAt:         string | null;
  recipientsTotal:     number;
  recipientsSent:      number;
  recipientsFailed:    number;
  createdAt:           string;
  updatedAt:           string;
}

export interface CampaignPerformance extends PushCampaign {
  sendRatePct:     number | null;
  deliveredCount:  number;
  deliveryRatePct: number | null;
  durationSec:     number | null;
}

export interface BestSendHour {
  hourUtc:         number;
  totalSent:       number;
  totalDelivered:  number;
  deliveryRatePct: number | null;
  sendScore:       number;
}

export interface CampaignDashboard {
  totalCampaigns:    number;
  scheduledCount:    number;
  completedCount:    number;
  totalRecipients:   number;
  avgSendRatePct:    number | null;
  bestHourUtc:       number | null;
  recentCampaigns:   CampaignPerformance[];
  upcomingCampaigns: PushCampaign[];
  bestSendHours:     BestSendHour[];
}

export interface CreateCampaignInput {
  locationId:           string;
  name:                 string;
  channel:              CampaignChannel;
  title:                string;
  body:                 string;
  url?:                 string;
  audience?:            CampaignAudience;
  scheduledAt?:         string;
  useBestTime?:         boolean;
  bestTimeWindowStart?: number;
  bestTimeWindowEnd?:   number;
}

export interface ExecuteResult {
  campaignId: string;
  channel:    CampaignChannel;
  sent:       number;
  failed:     number;
  skipped:    number;
  durationMs: number;
}

export interface CronCampaignResult {
  executed:  number;
  totalSent: number;
  errors:    number;
}

// ── Row-Mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): PushCampaign {
  return {
    id:                  r.id as string,
    locationId:          r.location_id as string,
    name:                r.name as string,
    channel:             r.channel as CampaignChannel,
    title:               r.title as string,
    body:                r.body as string,
    url:                 (r.url as string | null) ?? null,
    audience:            ((r.audience ?? 'all') as CampaignAudience),
    status:              r.status as CampaignStatus,
    scheduledAt:         (r.scheduled_at as string | null) ?? null,
    useBestTime:         Boolean(r.use_best_time),
    bestTimeWindowStart: ((r.best_time_window_start as number) ?? 8),
    bestTimeWindowEnd:   ((r.best_time_window_end as number) ?? 21),
    startedAt:           (r.started_at as string | null) ?? null,
    completedAt:         (r.completed_at as string | null) ?? null,
    recipientsTotal:     ((r.recipients_total as number) ?? 0),
    recipientsSent:      ((r.recipients_sent as number) ?? 0),
    recipientsFailed:    ((r.recipients_failed as number) ?? 0),
    createdAt:           r.created_at as string,
    updatedAt:           (r.updated_at ?? r.created_at) as string,
  };
}

// ── Audience-Filter ───────────────────────────────────────────────────────────

function audienceDays(audience: CampaignAudience): { minDays?: number; maxDays?: number } {
  if (audience === 'active_7d')    return { maxDays: 7 };
  if (audience === 'active_30d')   return { maxDays: 30 };
  if (audience === 'inactive_30d') return { minDays: 30, maxDays: 90 };
  if (audience === 'inactive_90d') return { minDays: 90 };
  return {};
}

async function countVapidSubs(
  sb:         ReturnType<typeof createServiceClient>,
  locationId: string,
  audience:   CampaignAudience,
): Promise<number> {
  const { minDays, maxDays } = audienceDays(audience);
  const now = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb
    .from('customer_push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId);

  if (maxDays !== undefined) q = q.gte('last_used_at', new Date(now - maxDays * 86400_000).toISOString());
  if (minDays !== undefined) q = q.lt('last_used_at',  new Date(now - minDays * 86400_000).toISOString());

  const { count } = await q;
  return count ?? 0;
}

// ── Best-Time-to-Send ─────────────────────────────────────────────────────────

export async function getBestSendHours(locationId: string): Promise<BestSendHour[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('whatsapp_message_log')
    .select('created_at, status')
    .eq('location_id', locationId)
    .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    .limit(5000);

  const buckets = Array.from({ length: 24 }, (_, h) => ({ h, sent: 0, delivered: 0 }));

  for (const row of data ?? []) {
    const h = new Date(row.created_at as string).getUTCHours();
    buckets[h].sent++;
    if ((row.status as string) === 'delivered' || (row.status as string) === 'read') {
      buckets[h].delivered++;
    }
  }

  return buckets
    .map(({ h, sent, delivered }) => ({
      hourUtc:         h,
      totalSent:       sent,
      totalDelivered:  delivered,
      deliveryRatePct: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : null,
      sendScore:       sent > 0 ? Math.round(sent * (delivered / sent) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.sendScore - a.sendScore);
}

async function bestHourInWindow(locationId: string, start: number, end: number): Promise<number> {
  const hours = await getBestSendHours(locationId);
  const inWin = hours.filter(h => h.hourUtc >= start && h.hourUtc < end);
  return inWin.length > 0 ? inWin[0].hourUtc : Math.floor((start + end) / 2);
}

// ── Kampagne ausführen ────────────────────────────────────────────────────────

export async function executeCampaign(campaignId: string): Promise<ExecuteResult> {
  const sb    = createServiceClient();
  const start = Date.now();

  const { data: c } = await sb
    .from('push_campaigns')
    .select('id, location_id, channel, title, body, url, audience, status')
    .eq('id', campaignId)
    .single();

  if (!c || !(['scheduled', 'draft'] as string[]).includes(c.status as string)) {
    return { campaignId, channel: 'all', sent: 0, failed: 0, skipped: 1, durationMs: Date.now() - start };
  }

  await sb.from('push_campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', campaignId);

  const locationId = c.location_id as string;
  const channel    = c.channel as CampaignChannel;
  const audience   = (c.audience ?? 'all') as CampaignAudience;
  const title      = c.title as string;
  const body       = c.body as string;
  const url        = (c.url as string | null) ?? '';

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let totalRecipients = 0;

  // ── VAPID ──
  if (channel === 'vapid' || channel === 'all') {
    const subsTotal = await countVapidSubs(sb, locationId, audience);
    totalRecipients += subsTotal;

    if (subsTotal > 0) {
      const result = await broadcastToLocation(locationId, title, body, url).catch(
        () => ({ sent: 0, failed: subsTotal, expired: 0 }),
      );
      sent   += result.sent;
      failed += result.failed + result.expired;
    }
  }

  // ── Driver Push ──
  if (channel === 'driver' || channel === 'all') {
    const { data: employees } = await sb
      .from('employees')
      .select('id')
      .eq('location_id', locationId)
      .eq('is_driver', true)
      .limit(100);

    const employeeIds = (employees ?? []).map(e => e.id as string);

    if (employeeIds.length > 0) {
      const { data: drivers } = await sb
        .from('mise_drivers')
        .select('id')
        .in('employee_id', employeeIds)
        .eq('status', 'active');

      totalRecipients += (drivers ?? []).length;

      for (const d of drivers ?? []) {
        const { error } = await sb.from('mise_push_outbox').insert({
          fahrer_id:   d.id as string,
          location_id: locationId,
          title,
          body,
          url:         url || null,
          event_type:  'campaign',
          status:      'pending',
        });
        if (error) failed++; else sent++;
      }
    }
  }

  // ── WhatsApp ── (Zählung; Bulk-Versand benötigt Template-Approval)
  if (channel === 'whatsapp' || channel === 'all') {
    const { count } = await sb
      .from('whatsapp_optins')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('opted_in', true);
    totalRecipients += count ?? 0;
    skipped         += count ?? 0;
  }

  const durationMs = Date.now() - start;

  await sb.from('push_campaigns').update({
    status:            'completed',
    completed_at:      new Date().toISOString(),
    recipients_total:  totalRecipients,
    recipients_sent:   sent,
    recipients_failed: failed,
  }).eq('id', campaignId);

  if (totalRecipients > 0) {
    await sb.from('push_campaign_sends').insert({
      campaign_id:   campaignId,
      location_id:   locationId,
      channel:       channel === 'all' ? 'vapid' : channel,
      recipient_ref: `batch_${totalRecipients}`,
      status:        sent > 0 ? 'sent' : (skipped > 0 ? 'skipped' : 'failed'),
      sent_at:       sent > 0 ? new Date().toISOString() : null,
    });
  }

  return { campaignId, channel, sent, failed, skipped, durationMs };
}

// ── Cron: fällige Kampagnen ───────────────────────────────────────────────────

export async function runDueCampaigns(): Promise<CronCampaignResult> {
  const sb = createServiceClient();

  const { data: due } = await sb
    .from('push_campaigns')
    .select('id, location_id, use_best_time, best_time_window_start, best_time_window_end')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10);

  if (!due || due.length === 0) return { executed: 0, totalSent: 0, errors: 0 };

  let executed = 0;
  let totalSent = 0;
  let errors = 0;

  for (const c of due) {
    try {
      if (c.use_best_time) {
        const best = await bestHourInWindow(
          c.location_id as string,
          (c.best_time_window_start as number) ?? 8,
          (c.best_time_window_end as number) ?? 21,
        );
        if (new Date().getUTCHours() !== best) continue;
      }

      const result = await executeCampaign(c.id as string);
      executed++;
      totalSent += result.sent;
    } catch {
      errors++;
      await sb.from('push_campaigns').update({ status: 'failed' }).eq('id', c.id as string);
    }
  }

  return { executed, totalSent, errors };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createCampaign(input: CreateCampaignInput): Promise<PushCampaign> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('push_campaigns')
    .insert({
      location_id:             input.locationId,
      name:                    input.name,
      channel:                 input.channel,
      title:                   input.title,
      body:                    input.body,
      url:                     input.url ?? null,
      audience:                input.audience ?? 'all',
      status:                  input.scheduledAt ? 'scheduled' : 'draft',
      scheduled_at:            input.scheduledAt ?? null,
      use_best_time:           input.useBestTime ?? false,
      best_time_window_start:  input.bestTimeWindowStart ?? 8,
      best_time_window_end:    input.bestTimeWindowEnd ?? 21,
    })
    .select('id, location_id, name, channel, title, body, url, audience, status, scheduled_at, use_best_time, best_time_window_start, best_time_window_end, started_at, completed_at, recipients_total, recipients_sent, recipients_failed, created_at, updated_at')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'create failed');
  return mapRow(data as Record<string, unknown>);
}

export async function listCampaigns(locationId: string, limit = 50): Promise<PushCampaign[]> {
  const { data } = await createServiceClient()
    .from('push_campaigns')
    .select('id, location_id, name, channel, title, body, url, audience, status, scheduled_at, use_best_time, best_time_window_start, best_time_window_end, started_at, completed_at, recipients_total, recipients_sent, recipients_failed, created_at, updated_at')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

export async function updateCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
  await createServiceClient().from('push_campaigns').update({ status }).eq('id', id);
}

export async function deleteCampaign(id: string, locationId: string): Promise<void> {
  await createServiceClient()
    .from('push_campaigns').delete().eq('id', id).eq('location_id', locationId);
}

export async function getAudienceSize(
  locationId: string,
  channel:    CampaignChannel,
  audience:   CampaignAudience,
): Promise<number> {
  const sb = createServiceClient();
  let total = 0;

  if (channel === 'vapid' || channel === 'all') {
    total += await countVapidSubs(sb, locationId, audience);
  }
  if (channel === 'driver' || channel === 'all') {
    const { count } = await sb
      .from('employees').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId).eq('is_driver', true);
    total += count ?? 0;
  }
  if (channel === 'whatsapp' || channel === 'all') {
    const { count } = await sb
      .from('whatsapp_optins').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId).eq('opted_in', true);
    total += count ?? 0;
  }
  return total;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getCampaignDashboard(locationId: string): Promise<CampaignDashboard> {
  const sb = createServiceClient();

  const [allCampaigns, bestHours] = await Promise.all([
    listCampaigns(locationId, 100),
    getBestSendHours(locationId),
  ]);

  const completed = allCampaigns.filter(c => c.status === 'completed');
  const scheduled = allCampaigns.filter(c => c.status === 'scheduled');

  const totalRecipients = completed.reduce((s, c) => s + c.recipientsTotal, 0);
  const totalSent       = completed.reduce((s, c) => s + c.recipientsSent, 0);
  const avgSendRatePct  = totalRecipients > 0
    ? Math.round((totalSent / totalRecipients) * 1000) / 10
    : null;

  const { data: perfRows } = await sb
    .from('v_campaign_performance')
    .select('id, location_id, name, channel, audience, status, scheduled_at, started_at, completed_at, recipients_total, recipients_sent, recipients_failed, send_rate_pct, delivered_count, delivery_rate_pct, duration_sec, created_at')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10);

  const recentCampaigns: CampaignPerformance[] = (perfRows ?? []).map(r => ({
    id:                  r.id as string,
    locationId:          r.location_id as string,
    name:                r.name as string,
    channel:             r.channel as CampaignChannel,
    title:               '',
    body:                '',
    url:                 null,
    audience:            ((r.audience ?? 'all') as CampaignAudience),
    status:              r.status as CampaignStatus,
    scheduledAt:         (r.scheduled_at as string | null) ?? null,
    useBestTime:         false,
    bestTimeWindowStart: 8,
    bestTimeWindowEnd:   21,
    startedAt:           (r.started_at as string | null) ?? null,
    completedAt:         (r.completed_at as string | null) ?? null,
    recipientsTotal:     ((r.recipients_total as number) ?? 0),
    recipientsSent:      ((r.recipients_sent as number) ?? 0),
    recipientsFailed:    ((r.recipients_failed as number) ?? 0),
    createdAt:           r.created_at as string,
    updatedAt:           r.created_at as string,
    sendRatePct:         (r.send_rate_pct as number | null) ?? null,
    deliveredCount:      ((r.delivered_count as number) ?? 0),
    deliveryRatePct:     (r.delivery_rate_pct as number | null) ?? null,
    durationSec:         (r.duration_sec as number | null) ?? null,
  }));

  const upcoming = scheduled
    .filter(c => c.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 5);

  return {
    totalCampaigns:    allCampaigns.length,
    scheduledCount:    scheduled.length,
    completedCount:    completed.length,
    totalRecipients,
    avgSendRatePct,
    bestHourUtc:       bestHours.length > 0 ? bestHours[0].hourUtc : null,
    recentCampaigns,
    upcomingCampaigns: upcoming,
    bestSendHours:     bestHours.slice(0, 8),
  };
}
