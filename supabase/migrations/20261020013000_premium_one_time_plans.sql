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


-- Atomic, idempotent entitlement grant for one-time payments.
-- The row lock on auth.users serializes separate purchases for the same user.
ALTER TABLE public.premium_payments
  ADD COLUMN IF NOT EXISTS premium_period_granted_at timestamptz;

COMMENT ON COLUMN public.premium_payments.premium_period_granted_at IS
  'Set in the same transaction that grants a one-time Premium period; prevents duplicate extensions.';

-- Keep the privileged implementation in a non-exposed schema.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.grant_one_time_premium_period(
  p_subscription_id uuid,
  p_provider_payment_id text,
  p_amount numeric,
  p_currency text,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_subscription public.premium_subscriptions%ROWTYPE;
  v_payment public.premium_payments%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_active_end timestamptz;
BEGIN
  IF p_provider_payment_id IS NULL OR btrim(p_provider_payment_id) = '' THEN
    RAISE EXCEPTION 'Mercado Pago payment ID is required';
  END IF;

  SELECT *
    INTO v_subscription
    FROM public.premium_subscriptions
   WHERE id = p_subscription_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premium purchase not found';
  END IF;

  IF v_subscription.purchase_type IS DISTINCT FROM 'one_time'
     OR v_subscription.provider IS DISTINCT FROM 'mercadopago' THEN
    RAISE EXCEPTION 'Purchase is not a Mercado Pago one-time plan';
  END IF;

  IF v_subscription.duration_months NOT IN (1, 3, 6, 12) THEN
    RAISE EXCEPTION 'Invalid one-time Premium duration';
  END IF;

  IF p_amount IS NULL
     OR v_subscription.purchase_amount IS NULL
     OR p_amount <> v_subscription.purchase_amount
     OR p_currency IS NULL
     OR upper(btrim(p_currency)) <> upper(btrim(v_subscription.purchase_currency)) THEN
    RAISE EXCEPTION 'Mercado Pago amount or currency does not match the stored purchase';
  END IF;

  -- Serialize grants for different purchases made by the same account.
  PERFORM id FROM auth.users WHERE id = v_subscription.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premium user not found';
  END IF;

  INSERT INTO public.premium_payments (
    user_id, subscription_id, provider, provider_payment_id,
    amount, currency, status, paid_at
  ) VALUES (
    v_subscription.user_id, v_subscription.id, 'mercadopago',
    p_provider_payment_id, p_amount, upper(btrim(p_currency)),
    'approved', coalesce(p_paid_at, now())
  )
  ON CONFLICT DO NOTHING;

  SELECT *
    INTO v_payment
    FROM public.premium_payments
   WHERE provider = 'mercadopago'
     AND provider_payment_id = p_provider_payment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not lock the Mercado Pago payment record';
  END IF;

  IF v_payment.user_id IS DISTINCT FROM v_subscription.user_id
     OR v_payment.subscription_id IS DISTINCT FROM v_subscription.id
     OR v_payment.amount <> p_amount
     OR upper(btrim(v_payment.currency)) <> upper(btrim(p_currency)) THEN
    RAISE EXCEPTION 'Payment ID is already associated with a different purchase';
  END IF;

  -- A late approval notification must never restore a purchase already
  -- marked refunded, charged back, cancelled, or rejected.
  IF lower(coalesce(v_payment.status, '')) IN ('refunded', 'charged_back', 'cancelled', 'rejected') THEN
    RETURN jsonb_build_object(
      'granted', false,
      'duplicate', false,
      'blocked', true,
      'reason', 'payment_has_terminal_non_approved_status',
      'payment_id', v_payment.id,
      'subscription_id', v_subscription.id,
      'current_period_end', v_subscription.current_period_end
    );
  END IF;

  IF v_payment.premium_period_granted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'duplicate', true,
      'payment_id', v_payment.id,
      'subscription_id', v_subscription.id,
      'current_period_end', v_subscription.current_period_end
    );
  END IF;

  UPDATE public.premium_payments
     SET status = 'approved',
         paid_at = coalesce(p_paid_at, v_payment.paid_at, now())
   WHERE id = v_payment.id;

  v_start := coalesce(p_paid_at, now());

  SELECT max(current_period_end)
    INTO v_active_end
    FROM public.premium_subscriptions
   WHERE user_id = v_subscription.user_id
     AND status = 'active'
     AND id <> v_subscription.id
     AND current_period_end > v_start;

  IF v_active_end IS NOT NULL AND v_active_end > v_start THEN
    v_start := v_active_end;
  END IF;

  v_end := v_start + make_interval(months => v_subscription.duration_months);

  UPDATE public.premium_subscriptions
     SET status = 'active',
         current_period_start = v_start,
         current_period_end = v_end,
         cancelled_at = NULL,
         updated_at = now()
   WHERE id = v_subscription.id;

  UPDATE public.premium_payments
     SET premium_period_granted_at = now()
   WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'granted', true,
    'duplicate', false,
    'payment_id', v_payment.id,
    'subscription_id', v_subscription.id,
    'current_period_start', v_start,
    'current_period_end', v_end
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.grant_one_time_premium_period(uuid, text, numeric, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.grant_one_time_premium_period(uuid, text, numeric, text, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION private.grant_one_time_premium_period(uuid, text, numeric, text, timestamptz) TO service_role;

-- Public RPC endpoint is invoker-only and executable solely by the server role.
CREATE OR REPLACE FUNCTION public.grant_one_time_premium_period(
  p_subscription_id uuid,
  p_provider_payment_id text,
  p_amount numeric,
  p_currency text,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  SELECT private.grant_one_time_premium_period(
    p_subscription_id, p_provider_payment_id, p_amount, p_currency, p_paid_at
  );
$function$;

REVOKE ALL ON FUNCTION public.grant_one_time_premium_period(uuid, text, numeric, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_one_time_premium_period(uuid, text, numeric, text, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_one_time_premium_period(uuid, text, numeric, text, timestamptz) TO service_role;
