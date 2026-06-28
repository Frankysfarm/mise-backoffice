import { describe, it, expect } from 'vitest';
import { evaluateRuleConditions } from '@/lib/loyalty/eligibility';
import { LoyaltyProgramRule, EligibilityCheckRequest } from '@/lib/loyalty/types';

describe('evaluateRuleConditions', () => {
  it('passes when min_order_value is null', () => {
    const rule: LoyaltyProgramRule = {
      id: '1',
      program_id: '1',
      name: 'No min',
      new_customers_only: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    const req: EligibilityCheckRequest = {
      location_id: 'loc1',
      bestellwert: 5,
      order_type: 'lieferung',
      kunde_email: 'test@test.de',
      kunde_telefon: '0123456789',
      cartCategories: [],
    };
    expect(evaluateRuleConditions(rule, req)).toBe(true);
  });

  it('fails when bestellwert < min_order_value', () => {
    const rule: LoyaltyProgramRule = {
      id: '1',
      program_id: '1',
      name: 'Min 20€',
      min_order_value: 20,
      new_customers_only: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    const req: EligibilityCheckRequest = {
      location_id: 'loc1',
      bestellwert: 15,
      order_type: 'lieferung',
      kunde_email: 'test@test.de',
      kunde_telefon: '0123456789',
      cartCategories: [],
    };
    expect(evaluateRuleConditions(rule, req)).toBe(false);
  });

  it('passes when bestellwert >= min_order_value', () => {
    const rule: LoyaltyProgramRule = {
      id: '1',
      program_id: '1',
      name: 'Min 20€',
      min_order_value: 20,
      new_customers_only: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    const req: EligibilityCheckRequest = {
      location_id: 'loc1',
      bestellwert: 25,
      order_type: 'lieferung',
      kunde_email: 'test@test.de',
      kunde_telefon: '0123456789',
      cartCategories: [],
    };
    expect(evaluateRuleConditions(rule, req)).toBe(true);
  });

  it('fails when order_type does not match', () => {
    const rule: LoyaltyProgramRule = {
      id: '1',
      program_id: '1',
      name: 'Delivery only',
      order_type: 'lieferung',
      new_customers_only: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    const req: EligibilityCheckRequest = {
      location_id: 'loc1',
      bestellwert: 25,
      order_type: 'abholung',
      kunde_email: 'test@test.de',
      kunde_telefon: '0123456789',
      cartCategories: [],
    };
    expect(evaluateRuleConditions(rule, req)).toBe(false);
  });

  it('passes when allowed_category_ids include cart', () => {
    const rule: LoyaltyProgramRule = {
      id: '1',
      program_id: '1',
      name: 'Drinks only',
      allowed_category_ids: 'cat-drinks, cat-beer',
      new_customers_only: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    const req: EligibilityCheckRequest = {
      location_id: 'loc1',
      bestellwert: 25,
      order_type: 'lieferung',
      kunde_email: 'test@test.de',
      kunde_telefon: '0123456789',
      cartCategories: ['cat-pizza', 'cat-drinks'],
    };
    expect(evaluateRuleConditions(rule, req)).toBe(true);
  });
});
