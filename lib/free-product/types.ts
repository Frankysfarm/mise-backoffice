export type FpTriggerMode = 'immer' | 'ab_betrag' | 'nach_sekunden' | 'erster_kauf' | 'nach_x_bestellungen';
export type FpPlacement   = 'cart' | 'checkout' | 'popup';

export type FreeProductConfig = {
  id: string;
  tenant_id: string;
  aktiv: boolean;
  eligible_item_ids: string[];
  trigger_mode: FpTriggerMode;
  trigger_ab_betrag: number | null;
  trigger_nach_sekunden: number | null;
  placement: FpPlacement;
  cooldown_tage: number;
  trigger_nach_bestellungen: number | null;
  anzeige_titel: string | null;
  anzeige_text: string | null;
  max_nutzungen_gesamt: number | null;
  konfig_typ: string;
  created_at: string;
  updated_at: string;
};

export type EligibilityResult =
  | { eligible: true; config_id: string; eligible_item_ids: string[]; placement: FpPlacement; trigger_nach_sekunden: number | null; trigger_nach_bestellungen: number | null }
  | { eligible: false; reason: 'feature_inactive' | 'not_eligible' | 'no_items_configured' | 'min_betrag_not_reached' | 'cooldown_active'; trigger_ab_betrag?: number; cooldown_ends_at?: string };
