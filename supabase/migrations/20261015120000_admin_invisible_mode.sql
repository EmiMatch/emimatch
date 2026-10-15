-- EmiMatch: ocultar perfiles de administradores y permitir excepciones individuales.
-- Los perfiles de cuentas administrativas solo son visibles para su titular
-- y para usuarios autorizados explícitamente por ese administrador.

create table if not exists public.admin_profile_visibility (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  visible_to_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (admin_user_id, visible_to_user_id),
  constraint admin_profile_visibility_not_self check (admin_user_id <> visible_to_user_id)
);

alter table public.admin_profile_visibility enable row level security;

drop policy if exists admin_profile_visibility_read_own on public.admin_profile_visibility;
create policy admin_profile_visibility_read_own
on public.admin_profile_visibility for select to authenticated
using (admin_user_id = (select auth.uid()) and public.is_admin());

drop policy if exists admin_profile_visibility_add_own on public.admin_profile_visibility;
create policy admin_profile_visibility_add_own
on public.admin_profile_visibility for insert to authenticated
with check (
  admin_user_id = (select auth.uid())
  and visible_to_user_id <> (select auth.uid())
  and public.is_admin()
);

drop policy if exists admin_profile_visibility_remove_own on public.admin_profile_visibility;
create policy admin_profile_visibility_remove_own
on public.admin_profile_visibility for delete to authenticated
using (admin_user_id = (select auth.uid()) and public.is_admin());

grant select, insert, delete on public.admin_profile_visibility to authenticated;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_profile_id = (select auth.uid())
    or not exists (
      select 1
      from public.admin_users au
      where au.user_id = p_profile_id
    )
    or exists (
      select 1
      from public.admin_profile_visibility v
      where v.admin_user_id = p_profile_id
        and v.visible_to_user_id = (select auth.uid())
    );
$$;

revoke all on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;

-- Restrictive policy composes with existing profile policies instead of
-- replacing them, so current profile ownership/update rules remain in place.
drop policy if exists profiles_admin_visibility_guard on public.profiles;
create policy profiles_admin_visibility_guard
on public.profiles as restrictive
for select to authenticated
using (public.can_view_profile(id));

comment on table public.admin_profile_visibility is
  'Excepciones privadas que permiten a usuarios elegidos ver el perfil de una cuenta administradora.';
