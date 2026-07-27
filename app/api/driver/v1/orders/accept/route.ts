import { NextRequest } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';
import { acceptAsTechnicalAck } from '../../_lib/accept-as-ack';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const auth = await getDriverFromBearer(req);
  if (!auth) return unauthorized();
  return acceptAsTechnicalAck(sb(), auth.driver.id, await req.json().catch(() => ({})));
}
