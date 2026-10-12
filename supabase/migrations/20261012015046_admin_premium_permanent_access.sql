-- Permanent Premium for accounts explicitly registered as EmiMatch administrators.
-- Paid subscription logic and the free-user quotas remain unchanged.
CREATE OR REPLACE FUNCTION public.is_premium()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.admin_users au
        WHERE au.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.premium_subscriptions ps
        WHERE ps.user_id = auth.uid()
          AND ps.status = 'active'
          AND (ps.current_period_start IS NULL OR ps.current_period_start <= now())
          AND (ps.current_period_end IS NULL OR ps.current_period_end > now())
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_send_like()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_premium boolean := false;
  v_count integer := 0;
  v_limit integer := 30;
  v_day_start timestamptz :=
    date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')
    AT TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  v_is_premium := COALESCE(public.is_premium(), false);

  IF v_is_premium THEN
    RETURN jsonb_build_object('allowed', true, 'is_premium', true,
      'sent', null, 'remaining', null, 'limit', null);
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.like_events
  WHERE user_id = v_user_id
    AND created_at >= v_day_start
    AND created_at < v_day_start + interval '1 day';

  RETURN jsonb_build_object(
    'allowed', v_count < v_limit,
    'is_premium', false,
    'sent', v_count,
    'remaining', greatest(v_limit - v_count, 0),
    'limit', v_limit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_daily_like_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_premium boolean := false;
  v_count integer := 0;
  v_existing_like boolean := false;
  v_day_start timestamptz :=
    date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')
    AT TIME ZONE 'America/Argentina/Buenos_Aires';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '28000', message = 'NOT_AUTHENTICATED';
  END IF;

  IF new.user_id <> v_user_id THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'SWIPE_OWNER_MISMATCH';
  END IF;

  IF new.action <> 'like' THEN
    RETURN new;
  END IF;

  IF tg_op = 'UPDATE'
     AND old.action = 'like'
     AND new.action = 'like'
     AND old.user_id = new.user_id
     AND old.target_user_id = new.target_user_id THEN
    RETURN new;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  IF tg_op = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.user_id = v_user_id
        AND s.target_user_id = new.target_user_id
        AND s.action = 'like'
    ) INTO v_existing_like;

    IF v_existing_like THEN
      new.created_at := now();
      RETURN new;
    END IF;
  END IF;

  v_is_premium := COALESCE(public.is_premium(), false);

  IF v_is_premium THEN
    new.created_at := now();
    RETURN new;
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.like_events
  WHERE user_id = v_user_id
    AND created_at >= v_day_start
    AND created_at < v_day_start + interval '1 day';

  IF v_count >= 30 THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'FREE_LIKE_LIMIT',
      detail = 'Alcanzaste el límite de 30 Me gusta gratuitos por hoy.',
      hint = 'EmiMatch Premium permite Me gusta ilimitados.';
  END IF;

  INSERT INTO public.like_events (user_id, target_user_id, created_at)
  VALUES (v_user_id, new.target_user_id, now());

  new.created_at := now();
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_premium_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_subscription public.premium_subscriptions%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'is_premium', false,
      'status', 'not_authenticated', 'subscription_id', null,
      'current_period_start', null, 'current_period_end', null);
  END IF;

  IF public.is_admin() THEN
    RETURN jsonb_build_object('success', true, 'is_premium', true,
      'is_admin', true, 'status', 'admin', 'subscription_id', null,
      'current_period_start', null, 'current_period_end', null);
  END IF;

  SELECT * INTO v_subscription
  FROM public.premium_subscriptions
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'is_premium', false,
      'status', 'none', 'subscription_id', null,
      'current_period_start', null, 'current_period_end', null);
  END IF;

  RETURN jsonb_build_object('success', true,
    'is_premium', v_subscription.status = 'active'
      AND (v_subscription.current_period_start IS NULL OR v_subscription.current_period_start <= now())
      AND (v_subscription.current_period_end IS NULL OR v_subscription.current_period_end > now()),
    'status', v_subscription.status,
    'subscription_id', v_subscription.id,
    'current_period_start', v_subscription.current_period_start,
    'current_period_end', v_subscription.current_period_end);
END;
$function$;
