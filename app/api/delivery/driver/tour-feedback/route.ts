import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { submitTourFeedback, getExistingFeedback } from '@/lib/delivery/tour-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const url    = new URL(req.url);
  const batchId  = url.searchParams.get('batch_id');
  const driverId = url.searchParams.get('driver_id');

  if (!batchId || !driverId) {
    return NextResponse.json({ error: 'batch_id und driver_id erforderlich' }, { status: 400 });
  }

  const existing = await getExistingFeedback(batchId, driverId);
  return NextResponse.json({ feedback: existing });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    batch_id: string;
    driver_id: string;
    location_id: string;
    difficulty_rating?: number;
    traffic_rating?: number;
    customer_rating?: number;
    had_parking_issue?: boolean;
    had_customer_issue?: boolean;
    had_nav_issue?: boolean;
    had_address_issue?: boolean;
    driver_notes?: string;
  };

  if (!body.batch_id || !body.driver_id || !body.location_id) {
    return NextResponse.json({ error: 'batch_id, driver_id, location_id erforderlich' }, { status: 400 });
  }

  const feedback = await submitTourFeedback({
    locationId:        body.location_id,
    batchId:           body.batch_id,
    driverId:          body.driver_id,
    difficultyRating:  body.difficulty_rating,
    trafficRating:     body.traffic_rating,
    customerRating:    body.customer_rating,
    hadParkingIssue:   body.had_parking_issue,
    hadCustomerIssue:  body.had_customer_issue,
    hadNavIssue:       body.had_nav_issue,
    hadAddressIssue:   body.had_address_issue,
    driverNotes:       body.driver_notes,
  });

  return NextResponse.json({ feedback });
}
