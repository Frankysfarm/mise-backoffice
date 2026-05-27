import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  createAgent, updateAgent, createTwilioPhoneNumber,
  assignPhoneNumberToAgent, deletePhoneNumber,
} from '@/lib/voice-orders/elevenlabs';
import {
  VOICE_PROFILES, GREETING_TEMPLATES, buildSystemPrompt,
  type GreetingStyle,
} from '@/lib/voice-orders/voices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SetupBody {
  voiceSlug?: string;
  greetingStyle?: GreetingStyle;
  customFirstMessage?: string;
  twilioPhoneNumber?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
}

/**
 * POST /api/voice-orders/setup
 *
 * Idempotent: legt Agent + Phone Number an oder aktualisiert sie.
 * Workflow:
 *   1. Tenant-Daten + Speisekarte aus Supabase laden
 *   2. System-Prompt bauen
 *   3. Agent in ElevenLabs anlegen/aktualisieren
 *   4. Twilio-Nummer registrieren + an Agent koppeln (falls Daten da)
 *   5. tenants.voice_orders_* Spalten persistieren
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: userRes } = await sb.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('id, tenant_id, rolle')
    .eq('id', userRes.user.id)
    .maybeSingle();
  if (!emp?.tenant_id) {
    return NextResponse.json({ error: 'no tenant' }, { status: 403 });
  }
  if (!['manager', 'backoffice', 'admin'].includes(emp.rolle ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as SetupBody;
  const svc = createServiceClient();

  // Tenant + Speisekarte laden
  const { data: tenant } = await svc
    .from('tenants')
    .select(
      'id, name, voice_orders_elevenlabs_agent_id, voice_orders_elevenlabs_phone_number_id, voice_orders_voice_id, lieferradius_km, mindestbestellwert, liefergebuehr, oeffnungszeiten_json, adresse, stadt',
    )
    .eq('id', emp.tenant_id)
    .single();
  if (!tenant) return NextResponse.json({ error: 'tenant gone' }, { status: 404 });

  const { data: items } = await svc
    .from('menu_items')
    .select('name, preis, beschreibung, kategorie:menu_categories(name)')
    .eq('tenant_id', emp.tenant_id)
    .eq('verfuegbar', true)
    .order('sort_order')
    .limit(120);

  const voiceSlug = body.voiceSlug ?? 'sophia';
  const voice = VOICE_PROFILES.find((v) => v.slug === voiceSlug) ?? VOICE_PROFILES[0];
  const greetingStyle: GreetingStyle = body.greetingStyle ?? 'classic';
  const firstMessage =
    body.customFirstMessage?.trim() ||
    GREETING_TEMPLATES[greetingStyle](tenant.name);

  const oeffnungszeitenText = formatOeffnungszeiten(tenant.oeffnungszeiten_json);

  const systemPrompt = buildSystemPrompt({
    restaurantName: tenant.name,
    menuItems:
      (items ?? []).map((i: any) => ({
        name: i.name,
        preis: Number(i.preis),
        beschreibung: i.beschreibung,
        kategorie: i.kategorie?.name ?? null,
      })),
    oeffnungszeitenText,
    liefergebiet: tenant.lieferradius_km
      ? `${tenant.lieferradius_km} km um ${tenant.stadt ?? 'das Restaurant'}`
      : undefined,
    mindestbestellwert: tenant.mindestbestellwert
      ? Number(tenant.mindestbestellwert)
      : undefined,
    liefergebuehr: tenant.liefergebuehr ? Number(tenant.liefergebuehr) : undefined,
  });

  let agentId = tenant.voice_orders_elevenlabs_agent_id;
  let phoneNumberId = tenant.voice_orders_elevenlabs_phone_number_id;

  try {
    if (!agentId) {
      const created = await createAgent({
        name: tenant.name,
        voiceId: voice.voiceId,
        firstMessage,
        systemPrompt,
        language: 'de',
      });
      agentId = created.agent_id;
    } else {
      await updateAgent(agentId, {
        name: tenant.name,
        voiceId: voice.voiceId,
        firstMessage,
        systemPrompt,
        language: 'de',
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'elevenlabs', detail: String(err) },
      { status: 502 },
    );
  }

  // Twilio (optional in dieser Phase — Tenant trägt selber ein)
  let twilioRegistered = false;
  if (
    body.twilioPhoneNumber &&
    body.twilioAccountSid &&
    body.twilioAuthToken
  ) {
    try {
      // Falls bestehende Nummer da ist, erst löschen (Vereinfachung)
      if (phoneNumberId) {
        await deletePhoneNumber(phoneNumberId).catch(() => {});
      }
      const phoneRes = await createTwilioPhoneNumber({
        label: tenant.name,
        phoneNumber: body.twilioPhoneNumber,
        twilioAccountSid: body.twilioAccountSid,
        twilioAuthToken: body.twilioAuthToken,
      });
      phoneNumberId = phoneRes.phone_number_id;
      await assignPhoneNumberToAgent(phoneNumberId, agentId!);
      twilioRegistered = true;
    } catch (err) {
      return NextResponse.json(
        { error: 'twilio', detail: String(err), agentId },
        { status: 502 },
      );
    }
  }

  // Persistieren
  const update: Record<string, unknown> = {
    voice_orders_aktiv: true,
    voice_orders_voice_id: voice.voiceId,
    voice_orders_first_message: firstMessage,
    voice_orders_system_prompt: systemPrompt,
    voice_orders_elevenlabs_agent_id: agentId,
    voice_orders_setup_completed_at: new Date().toISOString(),
  };
  if (twilioRegistered) {
    update.voice_orders_twilio_phone_number = body.twilioPhoneNumber;
    update.voice_orders_twilio_account_sid = body.twilioAccountSid;
    update.voice_orders_twilio_auth_token = body.twilioAuthToken;
    update.voice_orders_elevenlabs_phone_number_id = phoneNumberId;
  }

  await svc.from('tenants').update(update).eq('id', emp.tenant_id);

  return NextResponse.json({
    ok: true,
    agentId,
    phoneNumberId: phoneNumberId ?? null,
    voiceSlug: voice.slug,
    twilioRegistered,
    menuItemsLoaded: items?.length ?? 0,
  });
}

function formatOeffnungszeiten(json: unknown): string {
  if (!Array.isArray(json)) return '';
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return (json as any[])
    .map((row) => {
      if (!row) return '';
      const day = typeof row.tag === 'number' ? days[row.tag] : row.tag;
      if (row.geschlossen) return `${day}: geschlossen`;
      return `${day}: ${row.von ?? ''} – ${row.bis ?? ''}`;
    })
    .filter(Boolean)
    .join('\n');
}
