-- Keep the visible daily quota and server-side enforcement on the same source: like_events.
-- A new event is recorded only when a user creates a Like or changes a swipe to Like.
create or replace function public.can_send_like()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_premium boolean := false;
  v_count integer := 0;
  v_limit integer := 30;
  v_day_start timestamptz :=
    date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
    at time zone 'America/Argentina/Buenos_Aires';
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  select exists (
    select 1
    from public.premium_subscriptions ps
    where ps.user_id = v_user_id
      and ps.status = 'active'
      and (ps.current_period_start is null or ps.current_period_start <= now())
      and (ps.current_period_end is null or ps.current_period_end > now())
  ) into v_is_premium;

  if v_is_premium then
    return jsonb_build_object(
      'allowed', true, 'is_premium', true,
      'sent', null, 'remaining', null, 'limit', null
    );
  end if;

  select count(*)::integer into v_count
  from public.like_events
  where user_id = v_user_id
    and created_at >= v_day_start
    and created_at < v_day_start + interval '1 day';

  return jsonb_build_object(
    'allowed', v_count < v_limit,
    'is_premium', false,
    'sent', v_count,
    'remaining', greatest(v_limit - v_count, 0),
    'limit', v_limit
  );
end;
$$;

revoke all on function public.can_send_like() from public, anon;
grant execute on function public.can_send_like() to authenticated;

create or replace function public.enforce_daily_like_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_premium boolean := false;
  v_count integer := 0;
  v_day_start timestamptz :=
    date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
    at time zone 'America/Argentina/Buenos_Aires';
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'NOT_AUTHENTICATED';
  end if;

  if new.user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'SWIPE_OWNER_MISMATCH';
  end if;

  if new.action <> 'like' then
    return new;
  end if;

  -- Re-saving an existing Like for the same target does not consume another daily Like.
  if tg_op = 'UPDATE'
     and old.action = 'like'
     and new.action = 'like'
     and old.user_id = new.user_id
     and old.target_user_id = new.target_user_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select exists (
    select 1
    from public.premium_subscriptions ps
    where ps.user_id = v_user_id
      and ps.status = 'active'
      and (ps.current_period_start is null or ps.current_period_start <= now())
      and (ps.current_period_end is null or ps.current_period_end > now())
  ) into v_is_premium;

  if v_is_premium then
    new.created_at := now();
    return new;
  end if;

  select count(*)::integer into v_count
  from public.like_events
  where user_id = v_user_id
    and created_at >= v_day_start
    and created_at < v_day_start + interval '1 day';

  if v_count >= 30 then
    raise exception using
      errcode = 'P0001',
      message = 'FREE_LIKE_LIMIT',
      detail = 'Alcanzaste el límite de 30 Me gusta gratuitos por hoy.',
      hint = 'EmiMatch Premium permite Me gusta ilimitados.';
  end if;

  insert into public.like_events (user_id, target_user_id, created_at)
  values (v_user_id, new.target_user_id, now());

  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.enforce_daily_like_limit() from public, anon, authenticated;

drop trigger if exists enforce_daily_like_limit_trigger on public.swipes;
create trigger enforce_daily_like_limit_trigger
before insert or update of action on public.swipes
for each row
execute function public.enforce_daily_like_limit();

-- Backfill any Likes already recorded today, without duplicating an existing event.
insert into public.like_events (user_id, target_user_id, created_at)
select s.user_id, s.target_user_id, s.created_at
from public.swipes s
where s.action = 'like'
  and s.created_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
  and s.created_at < ((date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires') + interval '1 day')
  and not exists (
    select 1 from public.like_events e
    where e.user_id = s.user_id
      and e.target_user_id = s.target_user_id
      and e.created_at = s.created_at
  );