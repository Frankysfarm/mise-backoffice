import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { evaluateRuleConditions } from '@/lib/loyalty/eligibility';
import { EligibilityCheckRequest, EligibilityCheckResponse } from '@/lib/loyalty/types';

export async function POST(req: NextRequest) {
  try {
    const body: EligibilityCheckRequest = await req.json();
    const { location_id, bestellwert, order_type, kunde_email, kunde_telefon, cartCategories } = body;

    if (!location_id || bestellwert === undefined || !order_type) {
      return NextResponse.json(
        { eligible: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const svc = createServiceClient();
    
    // Get active loyalty program + rules + items
    const { data: program } = await svc
      .from('loyalty_programs')
      .select('*')
      .eq('tenant_id', location_id)
      .eq('is_active', true)
      .single();

    if (!program) {
      return NextResponse.json(
        { eligible: false, message: 'No active loyalty program' },
        { status: 200 }
      );
    }

    // Get rules
    const { data: rules } = await svc
      .from('loyalty_program_rules')
      .select('*')
      .eq('program_id', program.id);

    // Get items
    const { data: items } = await svc
      .from('loyalty_program_items')
      .select('*, menu_item:menu_items(name, beschreibung, preis)')
      .eq('program_id', program.id);

    // Check monthly redemption limit
    const monthStart = new Date();
    monthStart.setDate(1);
    const { count: monthlyCount } = await svc
      .from('loyalty_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', program.id)
      .eq('kunde_email', kunde_email)
      .eq('kunde_telefon', kunde_telefon)
      .gte('redeemed_at', monthStart.toISOString());

    if ((monthlyCount || 0) >= program.max_redemptions_per_customer_per_month) {
      return NextResponse.json(
        { eligible: false, message: 'Monthly bonus limit reached' },
        { status: 200 }
      );
    }

    // Evaluate rules
    let matchedRule = null;
    let eligibleItemIds: string[] = [];

    for (const rule of (rules || [])) {
      if (evaluateRuleConditions(rule, { location_id, bestellwert, order_type, kunde_email, kunde_telefon, cartCategories })) {
        matchedRule = rule;
        const ruleItems = (items || []).filter(item => item.rule_id === rule.id);
        eligibleItemIds = ruleItems.map(item => item.menu_item_id);
        break;
      }
    }

    if (!matchedRule || eligibleItemIds.length === 0) {
      return NextResponse.json(
        { eligible: false, message: 'Not eligible for bonus' },
        { status: 200 }
      );
    }

    const response: EligibilityCheckResponse = {
      eligible: true,
      program_id: program.id,
      rule_matched_id: matchedRule.id,
      available_items: (items || [])
        .filter(item => item.rule_id === matchedRule.id)
        .map(item => ({
          id: item.id,
          program_id: item.program_id,
          rule_id: item.rule_id,
          menu_item_id: item.menu_item_id,
          is_optional: item.is_optional,
          max_quantity_per_redemption: item.max_quantity_per_redemption,
          created_at: item.created_at,
          name: item.menu_item?.name || '',
          beschreibung: item.menu_item?.beschreibung,
          preis: item.menu_item?.preis || 0,
        })),
      message: `You're eligible for a free ${(items || [])[0]?.menu_item?.name}!`,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Eligibility check error:', error);
    return NextResponse.json(
      { eligible: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
