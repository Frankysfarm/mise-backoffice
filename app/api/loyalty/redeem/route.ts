import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { LoyaltyRedemptionRequest, LoyaltyRedemptionResponse } from '@/lib/loyalty/types';

export async function POST(req: NextRequest) {
  try {
    const body: LoyaltyRedemptionRequest = await req.json();
    const { order_id, program_id, selected_menu_item_ids, kunde_email, kunde_telefon } = body;

    if (!order_id || !program_id || !selected_menu_item_ids || selected_menu_item_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const svc = createServiceClient();

    // Check if order already has a redemption
    const { data: existing } = await svc
      .from('loyalty_redemptions')
      .select('id')
      .eq('order_id', order_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Bonus already redeemed for this order' },
        { status: 409 }
      );
    }

    // Insert redemption
    const { data: redemption, error } = await svc
      .from('loyalty_redemptions')
      .insert({
        program_id,
        order_id,
        redeemed_menu_item_ids: selected_menu_item_ids,
        kunde_email,
        kunde_telefon,
      })
      .select()
      .single();

    if (error) {
      console.error('Redemption insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to redeem bonus' },
        { status: 500 }
      );
    }

    const response: LoyaltyRedemptionResponse = {
      success: true,
      order_id,
      redeemed_items: selected_menu_item_ids.map(id => ({
        menu_item_id: id,
        quantity: 1,
      })),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Redemption error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
