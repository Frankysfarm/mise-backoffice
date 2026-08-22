import { NextRequest, NextResponse } from 'next/server';
import {
  badRequest,
  generateOtp,
  hashOtp,
  normalizePhone,
  OTP_TTL_MINUTES,
  sb,
} from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  phone: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Ungültiges JSON');
  }

  const phone = body.phone ? normalizePhone(body.phone) : '';
  if (phone.replace(/\D/g, '').length < 8) {
    return badRequest('Ungültige Telefonnummer');
  }

  // Throttle: max 3 OTPs pro 60s
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await sb()
    .from('mise_driver_otp_codes')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', since);
  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen — versuch es in einer Minute nochmal.' },
      { status: 429 },
    );
  }

  const code = generateOtp();
  const code_hash = hashOtp(code);
  const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  const { data: ins, error } = await sb()
    .from('mise_driver_otp_codes')
    .insert({ phone, code_hash, expires_at })
    .select('id')
    .single();
  if (error || !ins) {
    return NextResponse.json({ error: 'Konnte Code nicht anlegen' }, { status: 500 });
  }

  const hasSmsProvider =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;

  if (hasSmsProvider) {
    return NextResponse.json({ ok: true, otp_id: ins.id });
  }
  return NextResponse.json({ ok: true, otp_id: ins.id, dev_code: code });
}
