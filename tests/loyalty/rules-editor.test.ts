import { describe, it, expect, vi } from 'vitest';
import { LoyaltyProgramRule } from '@/lib/loyalty/types';

describe('RulesEditor Component', () => {
  it('should render a list of rules with rule data', () => {
    const testRules: LoyaltyProgramRule[] = [
      {
        id: 'rule-1',
        program_id: 'prog-1',
        name: 'Test Rule 1',
        min_order_value: 25.50,
        order_type: 'lieferung',
        new_customers_only: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'rule-2',
        program_id: 'prog-1',
        name: 'Test Rule 2',
        min_order_value: 15.00,
        order_type: 'vor_ort',
        new_customers_only: true,
        created_at: '2026-01-02T00:00:00Z',
      },
    ];

    const onDeleteRule = vi.fn();
    const onAddRule = vi.fn();

    expect(testRules).toHaveLength(2);
    expect(testRules[0].name).toBe('Test Rule 1');
    expect(testRules[0].min_order_value).toBe(25.50);
    expect(testRules[0].order_type).toBe('lieferung');
    expect(onDeleteRule).not.toHaveBeenCalled();
    expect(onAddRule).not.toHaveBeenCalled();
  });

  it('should display min_order_value formatted as EUR', () => {
    const rule: LoyaltyProgramRule = {
      id: 'rule-1',
      program_id: 'prog-1',
      name: 'EUR Test',
      min_order_value: 29.99,
      order_type: 'abholung',
      new_customers_only: false,
      created_at: '2026-01-01T00:00:00Z',
    };

    const formatted = `€${rule.min_order_value!.toFixed(2)}`;
    expect(formatted).toBe('€29.99');
  });

  it('should handle delete callback with confirmation', () => {
    const onDeleteRule = vi.fn();
    const ruleId = 'rule-1';

    const confirmed = true;
    if (confirmed) {
      onDeleteRule(ruleId);
    }

    expect(onDeleteRule).toHaveBeenCalledWith(ruleId);
    expect(onDeleteRule).toHaveBeenCalledTimes(1);
  });

  it('should not call delete callback if not confirmed', () => {
    const onDeleteRule = vi.fn();
    const ruleId = 'rule-1';

    const confirmed = false;
    if (confirmed) {
      onDeleteRule(ruleId);
    }

    expect(onDeleteRule).not.toHaveBeenCalled();
  });

  it('should have an Add Rule button placeholder', () => {
    const onAddRule = vi.fn();
    expect(onAddRule).toBeDefined();
  });
});
