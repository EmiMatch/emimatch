-- EmiMatch: 30 free Likes per Argentina calendar day; Premium subscribers have unlimited Likes.
-- Enforcement is server-side so direct REST/upsert calls cannot bypass the limit.

create or replace function public.can_send_like()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_premium boolean;
  v_count integer := 0;
  v_limit integer := 30;
  v_day_start timestamptz :=
    date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
    at time zone 'America/Argentina/Buenos_Aires';
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  v_is_premium := coalesce(public.is_premium(), false);

  if v_is_premium then
    return jsonb_build_object(
      'allowed', true, 'is_premium', true,
      'sent', null, 'remaining', null, 'limit', null
    );
  end if;

  select count(*)::integer into v_count
  from public.swipes
  where user_id = v_user_id
    and action = 'like'
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
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
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

  -- An upsert that keeps an existing Like is not a new Like.
  if tg_op = 'UPDATE' and old.action = 'like' and new.action = 'like' then
    return new;
  end if;

  -- Serialize simultaneous Like attempts from the same account.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if coalesce(public.is_premium(), false) then
    new.created_at := now();
    return new;
  end if;

  select count(*)::integer into v_count
  from public.swipes
  where user_id = v_user_id
    and action = 'like'
    and created_at >= v_day_start
    and created_at < v_day_start + interval '1 day';

  if v_count >= 30 then
    raise exception using
      errcode = 'P0001',
      message = 'FREE_LIKE_LIMIT',
      detail = 'Alcanzaste el límite de 30 Me gusta gratuitos por hoy.',
      hint = 'EmiMatch Premium permite Me gusta ilimitados.';
  end if;

  -- A new Like, including dislike -> like, counts from this moment.
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
