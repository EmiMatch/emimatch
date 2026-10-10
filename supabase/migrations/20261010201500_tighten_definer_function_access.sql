-- Tighten direct RPC permissions for trigger-only SECURITY DEFINER functions.
-- Existing database triggers continue to execute their attached functions.
revoke all on function public.crear_match_automatico() from public, anon, authenticated;
revoke all on function public.crear_match_si_corresponde() from public, anon, authenticated;
revoke all on function public.enforce_message_limit() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_premium_updated_at() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Use the dedicated admin allow-list; profiles.role is not a valid source of admin status.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.admin_users au
       where au.user_id = auth.uid()
     );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Keep the like quota private to the authenticated app flow; event rows remain server-managed.
revoke all on table public.like_events from anon, authenticated;
