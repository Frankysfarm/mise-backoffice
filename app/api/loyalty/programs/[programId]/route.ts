import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function PUT(
  req: NextRequest,
  { params: { programId } }: { params: { programId: string } }
) {
  try {
    const body = await req.json();
    const { name, description, is_active, max_redemptions_per_customer_per_month } = body;

    const svc = createServiceClient();
    const { data, error } = await svc
      .from('loyalty_programs')
      .update({
        name,
        description,
        is_active,
        max_redemptions_per_customer_per_month,
        updated_at: new Date().toISOString(),
      })
      .eq('id', programId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params: { programId } }: { params: { programId: string } }
) {
  try {
    const svc = createServiceClient();

    await svc.from('loyalty_program_items').delete().eq('program_id', programId);
    await svc.from('loyalty_program_rules').delete().eq('program_id', programId);
    await svc.from('loyalty_redemptions').delete().eq('program_id', programId);

    const { error } = await svc.from('loyalty_programs').delete().eq('id', programId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
