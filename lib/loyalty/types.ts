// Program configuration
export interface LoyaltyProgram {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  max_redemptions_per_customer_per_month: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyProgramRule {
  id: string;
  program_id: string;
  name: string;
  min_order_value?: number;
  order_type?: 'lieferung' | 'abholung' | 'vor_ort';
  new_customers_only: boolean;
  allowed_category_ids?: string;
  time_windows?: TimeWindow[];
  allowed_days?: string[];
  created_at: string;
}

export interface TimeWindow {
  day: 'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' | 'su';
  start: string;
  end: string;
}

export interface LoyaltyProgramItem {
  id: string;
  program_id: string;
  rule_id: string;
  menu_item_id: string;
  is_optional: boolean;
  max_quantity_per_redemption: number;
  created_at: string;
}

export interface LoyaltyItemDisplay extends LoyaltyProgramItem {
  name: string;
  beschreibung?: string;
  preis: number;
}

export interface EligibilityCheckRequest {
  location_id: string;
  bestellwert: number;
  order_type: 'lieferung' | 'abholung' | 'vor_ort';
  kunde_email: string;
  kunde_telefon: string;
  cartCategories: string[];
}

export interface EligibilityCheckResponse {
  eligible: boolean;
  program_id?: string;
  available_items?: LoyaltyItemDisplay[];
  message?: string;
  rule_matched_id?: string;
}

export interface LoyaltyRedemptionRequest {
  order_id: string;
  program_id: string;
  selected_menu_item_ids: string[];
  kunde_email: string;
  kunde_telefon: string;
}

export interface LoyaltyRedemptionResponse {
  success: boolean;
  order_id: string;
  redeemed_items: Array<{ menu_item_id: string; quantity: number }>;
  error?: string;
}

export interface LoyaltyProgramConfig {
  program: LoyaltyProgram;
  rules: LoyaltyProgramRule[];
  items: LoyaltyProgramItem[];
}
