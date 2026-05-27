import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  // Einfach zurück zu den Settings — dort neuer Onboarding-Link
  return NextResponse.redirect(`${origin}/settings/restaurant?stripe=refresh`);
}
