import { NextRequest, NextResponse } from 'next/server';

export function isInternalCronRequest(req: NextRequest): boolean {
  const cronKey = req.headers.get('x-cron-key');
  const expectedCronKey = process.env.INTERNAL_CRON_KEY;
  if (expectedCronKey && cronKey === expectedCronKey) return true;

  const internalToken = req.headers.get('x-internal-token');
  const expectedInternalToken = process.env.BISS_INTERNAL_TOKEN;
  if (expectedInternalToken && internalToken === expectedInternalToken) return true;

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization');
  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

export function internalCronUnauthorized() {
  return NextResponse.json(
    { ok: false, error: 'unauthorized' },
    { status: 401 },
  );
}
