-- Values already used by delivery read filters and reports. Existing German
-- states and transition validation remain untouched.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'abgeschlossen';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelled';
