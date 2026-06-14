/**
 * GET  /api/delivery/admin/push-campaigns        — Dashboard + Kampagnen-Liste
 * POST /api/delivery/admin/push-campaigns        — Kampagne erstellen / ausführen / stornieren
 *
 * Phase 177 — Push-Notification Scheduling Engine
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getCampaignDashboard,
  listCampaigns,
  createCampaign,
  executeCampaign,
  updateCampaignStatus,
  deleteCampaign,
  getBestSendHours,
  getAudienceSize,
  type CreateCampaignInput,
  type CampaignChannel,
  type CampaignAudience,
} from '@/lib/delivery/push-campaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('employees')
    .select('location_id')
    .eq('id', userId)
    .maybeSingle();
  return (data?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'Keine Location' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action   = searchParams.get('action') ?? 'dashboard';
  const channel  = (searchParams.get('channel') ?? 'all') as CampaignChannel;
  const audience = (searchParams.get('audience') ?? 'all') as CampaignAudience;

  if (action === 'list') {
    const campaigns = await listCampaigns(locationId);
    return NextResponse.json({ campaigns }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'best_hours') {
    const hours = await getBestSendHours(locationId);
    return NextResponse.json({ hours }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'audience_size') {
    const size = await getAudienceSize(locationId, channel, audience);
    return NextResponse.json({ size }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // default: dashboard
  const dashboard = await getCampaignDashboard(locationId);
  return NextResponse.json(dashboard, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'Keine Location' }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const action = (body.action as string | undefined) ?? 'create';

  if (action === 'create') {
    const input: CreateCampaignInput = {
      locationId,
      name:                 String(body.name ?? '').trim(),
      channel:              (body.channel as CampaignChannel) ?? 'vapid',
      title:                String(body.title ?? '').trim(),
      body:                 String(body.body ?? '').trim(),
      url:                  body.url ? String(body.url) : undefined,
      audience:             (body.audience as CampaignAudience) ?? 'all',
      scheduledAt:          body.scheduled_at ? String(body.scheduled_at) : undefined,
      useBestTime:          Boolean(body.use_best_time),
      bestTimeWindowStart:  body.best_time_window_start ? Number(body.best_time_window_start) : 8,
      bestTimeWindowEnd:    body.best_time_window_end   ? Number(body.best_time_window_end)   : 21,
    };

    if (!input.name || !input.title || !input.body) {
      return NextResponse.json({ error: 'name, title, body sind Pflichtfelder' }, { status: 400 });
    }

    const campaign = await createCampaign(input);
    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  }

  if (action === 'execute') {
    const campaignId = String(body.campaign_id ?? '');
    if (!campaignId) return NextResponse.json({ error: 'campaign_id fehlt' }, { status: 400 });
    const result = await executeCampaign(campaignId);
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'cancel') {
    const campaignId = String(body.campaign_id ?? '');
    if (!campaignId) return NextResponse.json({ error: 'campaign_id fehlt' }, { status: 400 });
    await updateCampaignStatus(campaignId, 'cancelled');
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const campaignId = String(body.campaign_id ?? '');
    if (!campaignId) return NextResponse.json({ error: 'campaign_id fehlt' }, { status: 400 });
    await deleteCampaign(campaignId, locationId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
