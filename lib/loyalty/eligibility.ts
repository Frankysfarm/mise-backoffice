import { LoyaltyProgramRule, EligibilityCheckRequest, TimeWindow } from './types';

export function evaluateRuleConditions(
  rule: LoyaltyProgramRule,
  request: EligibilityCheckRequest
): boolean {
  // Check minimum order value
  if (rule.min_order_value !== undefined && rule.min_order_value !== null) {
    if (request.bestellwert < rule.min_order_value) {
      return false;
    }
  }

  // Check order type
  if (rule.order_type !== undefined && rule.order_type !== null) {
    if (request.order_type !== rule.order_type) {
      return false;
    }
  }

  // Check new customers only (stub for now)
  if (rule.new_customers_only) {
    // TODO: query order history from DB
  }

  // Check allowed categories
  if (rule.allowed_category_ids && rule.allowed_category_ids.length > 0) {
    const allowedCats = rule.allowed_category_ids.split(',').map(c => c.trim());
    const hasAllowedItem = request.cartCategories.some(cat => allowedCats.includes(cat));
    if (!hasAllowedItem) {
      return false;
    }
  }

  // Check time windows
  if (rule.time_windows && rule.time_windows.length > 0) {
    if (!isWithinTimeWindow(rule.time_windows)) {
      return false;
    }
  }

  // Check allowed days
  if (rule.allowed_days && rule.allowed_days.length > 0) {
    if (!isAllowedDay(rule.allowed_days)) {
      return false;
    }
  }

  return true;
}

function isWithinTimeWindow(windows: TimeWindow[]): boolean {
  const now = new Date();
  const currentDayMap: { [key: number]: string } = {
    0: 'su',
    1: 'mo',
    2: 'tu',
    3: 'we',
    4: 'th',
    5: 'fr',
    6: 'sa',
  };
  const currentDay = currentDayMap[now.getDay()];
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMin = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHour}:${currentMin}`;

  return windows.some(w => {
    if (w.day !== currentDay) return false;
    return currentTime >= w.start && currentTime <= w.end;
  });
}

function isAllowedDay(allowedDays: string[]): boolean {
  const now = new Date();
  const dayMap: { [key: number]: string } = {
    0: 'su',
    1: 'mo',
    2: 'tu',
    3: 'we',
    4: 'th',
    5: 'fr',
    6: 'sa',
  };
  const currentDay = dayMap[now.getDay()];
  return allowedDays.includes(currentDay);
}
