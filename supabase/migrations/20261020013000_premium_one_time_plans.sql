-- EmiMatch Premium: one-time duration purchases.
-- Safe additive migration: existing recurring subscriptions keep their current behavior.
ALTER TABLE public.premium_subscriptions
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'recurring',
  ADD COLUMN IF NOT EXISTS duration_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS purchase_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS purchase_currency text NOT NULL DEFAULT 'ARS';

ALTER TABLE public.premium_subscriptions
  DROP CONSTRAINT IF EXISTS premium_subscriptions_purchase_type_check;
ALTER TABLE public.premium_subscriptions
  ADD CONSTRAINT premium_subscriptions_purchase_type_check
  CHECK (purchase_type IN ('recurring', 'one_time'));

ALTER TABLE public.premium_subscriptions
  DROP CONSTRAINT IF EXISTS premium_subscriptions_duration_months_check;
ALTER TABLE public.premium_subscriptions
  ADD CONSTRAINT premium_subscriptions_duration_months_check
  CHECK (duration_months IN (1, 3, 6, 12));

COMMENT ON COLUMN public.premium_subscriptions.purchase_type IS
  'recurring for legacy Mercado Pago subscriptions; one_time for fixed-duration purchases.';
COMMENT ON COLUMN public.premium_subscriptions.duration_months IS
  'Premium duration in months for one-time purchases.';
COMMENT ON COLUMN public.premium_subscriptions.purchase_amount IS
  'Server-authoritative expected amount for one-time checkout verification.';
