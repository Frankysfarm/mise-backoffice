/**
 * lib/delivery/referral-program.ts
 *
 * Smart Referral Program Engine — Phase 190
 *
 * Kunden werben Kunden: automatische Code-Generierung, Validierung bei Checkout,
 * Belohnungs-Ausstellung via Gutscheine nach erfolgreicher Lieferung.
 *
 * Flow:
 *  1. Kunde fragt seinen Code ab → getOrCreateReferralCode()
 *  2. Neukunde gibt Code beim Checkout ein → applyReferralCode()
 *     → Konversion landet als 'pending' in der DB
 *  3. Nach Lieferung (Cron) → processReferralConversions()
 *     → Status 'delivered' → Gutscheine ausstellen → Status 'rewarded'
 *  4. Admin sieht Dashboard via getDashboard()
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferralProgram {
  id: string;
  location_id: string;
  is_enabled: boolean;
  referrer_reward_eur: number;
  referee_reward_eur: number;
  min_order_eur: number;
  valid_days: number;
  max_referrals_per_user: number;
  requires_first_order: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralCode {
  id: string;
  location_id: string;
  customer_token: string;
  code: string;
  uses_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralConversion {
  id: string;
  location_id: string;
  referral_code_id: string;
  referee_token: string;
  order_id: string | null;
  status: 'pending' | 'delivered' | 'rewarded' | 'expired' | 'cancelled';
  referrer_reward_eur: number;
  referee_reward_eur: number;
  referrer_voucher_id: string | null;
  referee_voucher_id: string | null;
  rewarded_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralStats {
  location_id: string;
  total_referral_codes: number;
  active_referrers: number;
  total_conversions: number;
  rewarded_conversions: number;
  pending_conversions: number;
  total_rewards_eur: number;
  conversion_rate_pct: number;
}

export interface TopReferrer {
  code_id: string;
  location_id: string;
  customer_token: string;
  code: string;
  uses_count: number;
  created_at: string;
  rewarded_count: number;
  total_earned_eur: number;
}

export interface ReferralDashboard {
  program: ReferralProgram | null;
  stats: ReferralStats | null;
  top_referrers: TopReferrer[];
  recent_conversions: ReferralConversion[];
}

export interface UpsertProgramParams {
  is_enabled?: boolean;
  referrer_reward_eur?: number;
  referee_reward_eur?: number;
  min_order_eur?: number;
  valid_days?: number;
  max_referrals_per_user?: number;
  requires_first_order?: boolean;
}

export interface ApplyReferralResult {
  ok: boolean;
  conversion_id?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne O/0/I/1 (Verwechslungsgefahr)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueCode(sb: ReturnType<typeof createServiceClient>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const { data } = await sb
      .from('referral_codes')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Fallback mit Timestamp-Suffix (extrem unwahrscheinlich)
  return generateCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Programm-Verwaltung
// ─────────────────────────────────────────────────────────────────────────────

export async function getProgram(locationId: string): Promise<ReferralProgram | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('referral_programs')
    .select('id,location_id,is_enabled,referrer_reward_eur,referee_reward_eur,min_order_eur,valid_days,max_referrals_per_user,requires_first_order,created_at,updated_at')
    .eq('location_id', locationId)
    .maybeSingle();
  return (data as ReferralProgram | null);
}

export async function upsertProgram(
  locationId: string,
  params: UpsertProgramParams,
): Promise<ReferralProgram> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('referral_programs')
    .upsert(
      { location_id: locationId, ...params },
      { onConflict: 'location_id' },
    )
    .select('id,location_id,is_enabled,referrer_reward_eur,referee_reward_eur,min_order_eur,valid_days,max_referrals_per_user,requires_first_order,created_at,updated_at')
    .single();
  if (error) throw new Error(`upsertProgram: ${error.message}`);
  return data as ReferralProgram;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code-Verwaltung
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrCreateReferralCode(
  locationId: string,
  customerToken: string,
): Promise<ReferralCode | null> {
  const sb = createServiceClient();

  // Programm prüfen
  const program = await getProgram(locationId);
  if (!program?.is_enabled) return null;

  // Bestehenden Code suchen
  const { data: existing } = await sb
    .from('referral_codes')
    .select('id,location_id,customer_token,code,uses_count,is_active,created_at,updated_at')
    .eq('location_id', locationId)
    .eq('customer_token', customerToken)
    .maybeSingle();
  if (existing) return existing as ReferralCode;

  // Neuen Code erstellen
  const code = await generateUniqueCode(sb);
  const { data: created, error } = await sb
    .from('referral_codes')
    .insert({ location_id: locationId, customer_token: customerToken, code })
    .select('id,location_id,customer_token,code,uses_count,is_active,created_at,updated_at')
    .single();
  if (error) throw new Error(`getOrCreateReferralCode: ${error.message}`);
  return created as ReferralCode;
}

export async function getReferralCode(code: string): Promise<ReferralCode | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('referral_codes')
    .select('id,location_id,customer_token,code,uses_count,is_active,created_at,updated_at')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();
  return (data as ReferralCode | null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Empfehlungs-Konversion
// ─────────────────────────────────────────────────────────────────────────────

export async function applyReferralCode(
  code: string,
  refereeToken: string,
  locationId: string,
  orderId?: string,
): Promise<ApplyReferralResult> {
  const sb = createServiceClient();

  // Programm validieren
  const program = await getProgram(locationId);
  if (!program?.is_enabled) {
    return { ok: false, error: 'Referral-Programm nicht aktiv' };
  }

  // Code validieren
  const referralCode = await getReferralCode(code);
  if (!referralCode) {
    return { ok: false, error: 'Ungültiger oder inaktiver Code' };
  }
  if (referralCode.location_id !== locationId) {
    return { ok: false, error: 'Code gehört zu einem anderen Standort' };
  }
  if (referralCode.customer_token === refereeToken) {
    return { ok: false, error: 'Eigener Code kann nicht verwendet werden' };
  }

  // Max-Referrals-Limit prüfen
  if (referralCode.uses_count >= program.max_referrals_per_user) {
    return { ok: false, error: 'Code hat maximale Nutzungsanzahl erreicht' };
  }

  // Duplikat-Check: Hat dieser Geworbene diesen Code schon genutzt?
  const { data: existing } = await sb
    .from('referral_conversions')
    .select('id,status')
    .eq('referral_code_id', referralCode.id)
    .eq('referee_token', refereeToken)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'Du hast diesen Code bereits verwendet' };
  }

  // Wenn requires_first_order: prüfen ob Geworbener schon bestellt hat
  if (program.requires_first_order) {
    const { count } = await sb
      .from('referral_conversions')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('referee_token', refereeToken);
    if ((count ?? 0) > 0) {
      return { ok: false, error: 'Nur für Erstkunden verfügbar' };
    }
  }

  // Konversion anlegen
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90 Tage bis Ablauf pending

  const { data: conversion, error: convErr } = await sb
    .from('referral_conversions')
    .insert({
      location_id:        locationId,
      referral_code_id:   referralCode.id,
      referee_token:      refereeToken,
      order_id:           orderId ?? null,
      status:             'pending',
      referrer_reward_eur: program.referrer_reward_eur,
      referee_reward_eur:  program.referee_reward_eur,
      expires_at:         expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (convErr) {
    // UNIQUE-Constraint-Verletzung: Race-Condition abfangen
    if (convErr.code === '23505') {
      return { ok: false, error: 'Code bereits in Bearbeitung' };
    }
    throw new Error(`applyReferralCode: ${convErr.message}`);
  }

  // uses_count erhöhen (fire-and-forget, kein Block)
  sb.from('referral_codes')
    .update({ uses_count: referralCode.uses_count + 1 })
    .eq('id', referralCode.id)
    .then(() => {});

  return { ok: true, conversion_id: conversion.id };
}

// Konversion auf 'delivered' setzen (nach Lieferung aufgerufen)
export async function markConversionDelivered(conversionId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('referral_conversions')
    .update({ status: 'delivered' })
    .eq('id', conversionId)
    .eq('status', 'pending');
}

// ─────────────────────────────────────────────────────────────────────────────
// Belohnungs-Verarbeitung (Cron)
// ─────────────────────────────────────────────────────────────────────────────

async function issueVoucher(
  sb: ReturnType<typeof createServiceClient>,
  locationId: string,
  customerToken: string,
  discountEur: number,
  validDays: number,
  description: string,
): Promise<string | null> {
  const code = 'REF-' + Math.random().toString(36).slice(2, 9).toUpperCase();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validDays);

  const { data } = await sb
    .from('vouchers')
    .insert({
      location_id:          locationId,
      code,
      voucher_type:         'flat_eur',
      discount_value:       discountEur,
      min_order_eur:        0,
      max_discount_eur:     discountEur,
      max_uses:             1,
      max_uses_per_customer: 1,
      valid_from:           new Date().toISOString(),
      valid_until:          validUntil.toISOString(),
      is_active:            true,
      description,
      campaign_name:        'referral_reward',
    })
    .select('id')
    .single();

  if (!data) return null;

  // Push to customer_reorder_profiles or similar: store voucher association
  // (Gutschein-Zuordnung via customer_token — der Kunde löst ihn beim nächsten Kauf ein)
  // In production wird der Code dem Kunden per Push/E-Mail übermittelt.
  // Hier: Log via comms-log oder direct-Link; Voucher-Code reicht als Identifier.
  return data.id as string;
}

export async function processReferralConversions(locationId: string): Promise<{
  processed: number;
  rewarded: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const program = await getProgram(locationId);
  if (!program?.is_enabled) return { processed: 0, rewarded: 0, errors: 0 };

  // Alle 'delivered' Konversionen für diese Location holen
  const { data: conversions } = await sb
    .from('referral_conversions')
    .select('id,referral_code_id,referee_token,referrer_reward_eur,referee_reward_eur')
    .eq('location_id', locationId)
    .eq('status', 'delivered')
    .limit(50);

  if (!conversions?.length) return { processed: 0, rewarded: 0, errors: 0 };

  let rewarded = 0;
  let errors = 0;

  for (const conv of conversions) {
    try {
      // Empfehler-Token aus referral_codes holen
      const { data: codeRow } = await sb
        .from('referral_codes')
        .select('customer_token')
        .eq('id', conv.referral_code_id)
        .maybeSingle();

      const referrerToken = codeRow?.customer_token ?? null;

      // Gutscheine ausstellen
      const referrerVoucherId = referrerToken && conv.referrer_reward_eur > 0
        ? await issueVoucher(
            sb, locationId, referrerToken,
            Number(conv.referrer_reward_eur), program.valid_days,
            `Empfehlungs-Belohnung: ${conv.referrer_reward_eur} €`,
          )
        : null;

      const refereeVoucherId = conv.referee_reward_eur > 0
        ? await issueVoucher(
            sb, locationId, conv.referee_token,
            Number(conv.referee_reward_eur), program.valid_days,
            `Willkommens-Gutschein: ${conv.referee_reward_eur} €`,
          )
        : null;

      // Konversion als 'rewarded' markieren
      await sb
        .from('referral_conversions')
        .update({
          status:               'rewarded',
          referrer_voucher_id:  referrerVoucherId,
          referee_voucher_id:   refereeVoucherId,
          rewarded_at:          new Date().toISOString(),
        })
        .eq('id', conv.id);

      rewarded++;
    } catch {
      errors++;
    }
  }

  return { processed: conversions.length, rewarded, errors };
}

export async function processAllLocations(): Promise<{
  locations: number;
  rewarded: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: programs } = await sb
    .from('referral_programs')
    .select('location_id')
    .eq('is_enabled', true);

  if (!programs?.length) return { locations: 0, rewarded: 0, errors: 0 };

  let totalRewarded = 0;
  let totalErrors = 0;

  await Promise.all(
    programs.map(async (p) => {
      try {
        const result = await processReferralConversions(p.location_id as string);
        totalRewarded += result.rewarded;
        totalErrors += result.errors;
      } catch {
        totalErrors++;
      }
    }),
  );

  return { locations: programs.length, rewarded: totalRewarded, errors: totalErrors };
}

export async function expireStaleConversions(): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('expire_stale_referral_conversions');
  return (data as number | null) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard & Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<ReferralDashboard> {
  const sb = createServiceClient();

  const [program, statsData, topReferrersData, recentConvData] = await Promise.all([
    getProgram(locationId),

    sb.from('v_referral_stats')
      .select('location_id,total_referral_codes,active_referrers,total_conversions,rewarded_conversions,pending_conversions,total_rewards_eur,conversion_rate_pct')
      .eq('location_id', locationId)
      .maybeSingle(),

    sb.from('v_top_referrers')
      .select('code_id,location_id,customer_token,code,uses_count,created_at,rewarded_count,total_earned_eur')
      .eq('location_id', locationId)
      .order('rewarded_count', { ascending: false })
      .limit(10),

    sb.from('referral_conversions')
      .select('id,location_id,referral_code_id,referee_token,order_id,status,referrer_reward_eur,referee_reward_eur,referrer_voucher_id,referee_voucher_id,rewarded_at,expires_at,created_at,updated_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return {
    program,
    stats:              (statsData.data as ReferralStats | null),
    top_referrers:      (topReferrersData.data ?? []) as TopReferrer[],
    recent_conversions: (recentConvData.data ?? []) as ReferralConversion[],
  };
}

export async function getTopReferrers(
  locationId: string,
  limit = 20,
): Promise<TopReferrer[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_top_referrers')
    .select('code_id,location_id,customer_token,code,uses_count,created_at,rewarded_count,total_earned_eur')
    .eq('location_id', locationId)
    .order('rewarded_count', { ascending: false })
    .limit(Math.min(limit, 100));
  return (data ?? []) as TopReferrer[];
}
