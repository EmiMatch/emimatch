-- EmiMatch: modo invisible para administradores con acceso selectivo.
-- Esta migración se prepara en una rama; no aplicar a producción hasta probarla.

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
using (admin_user_id = (select auth.uid()) and exists (
  select 1 from public.admin_users au where au.user_id = (select auth.uid())
));

revoke all on public.admin_profile_visibility from anon, authenticated;
grant select on public.admin_profile_visibility to authenticated;

create or replace function public.admin_set_profile_visibility(p_user_id uuid, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if v_admin_id is null or not exists (
    select 1 from public.admin_users au where au.user_id = v_admin_id
  ) then
    raise exception 'Acceso denegado: solo administradores';
  end if;

  if p_user_id is null or p_user_id = v_admin_id then
    raise exception 'Usuario no válido';
  end if;

  if exists (select 1 from public.admin_users au where au.user_id = p_user_id) then
    raise exception 'No se puede habilitar otro perfil administrativo';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'No se encontró el perfil';
  end if;

  if p_visible then
    insert into public.admin_profile_visibility (admin_user_id, visible_to_user_id)
    values (v_admin_id, p_user_id)
    on conflict (admin_user_id, visible_to_user_id) do nothing;

    -- Crear un match para reutilizar el chat existente. La visibilidad y el chat
    -- quedarán sujetos a la autorización; al revocarla no se borran mensajes.
    if not exists (
      select 1 from public.matches m
      where (m.user1_id = v_admin_id and m.user2_id = p_user_id)
         or (m.user1_id = p_user_id and m.user2_id = v_admin_id)
    ) then
      insert into public.matches (user1_id, user2_id)
      values (least(v_admin_id, p_user_id), greatest(v_admin_id, p_user_id));
    end if;
  else
    delete from public.admin_profile_visibility
    where admin_user_id = v_admin_id and visible_to_user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_profile_visibility(uuid, boolean) from public, anon;
grant execute on function public.admin_set_profile_visibility(uuid, boolean) to authenticated;

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
      select 1 from public.admin_users au where au.user_id = p_profile_id
    )
    or exists (
      select 1 from public.admin_profile_visibility v
      where v.admin_user_id = p_profile_id
        and v.visible_to_user_id = (select auth.uid())
    );
$$;

revoke all on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;

create or replace function public.can_access_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (m.user1_id = (select auth.uid()) or m.user2_id = (select auth.uid()))
      and (
        (
          not exists (select 1 from public.admin_users au where au.user_id = m.user1_id)
          and not exists (select 1 from public.admin_users au where au.user_id = m.user2_id)
        )
        or exists (
          select 1 from public.admin_profile_visibility v
          where (v.admin_user_id = m.user1_id and v.visible_to_user_id = m.user2_id)
             or (v.admin_user_id = m.user2_id and v.visible_to_user_id = m.user1_id)
        )
      )
  );
$$;

revoke all on function public.can_access_match(uuid) from public, anon;
grant execute on function public.can_access_match(uuid) to authenticated;

-- Mantener bloqueados los archivos de conversaciones cuando se revoca el acceso,
-- aunque el registro del match y los mensajes históricos se conserven.
drop policy if exists admin_visibility_chat_storage_select_guard on storage.objects;
create policy admin_visibility_chat_storage_select_guard
on storage.objects as restrictive for select to authenticated
using (
  case
    when bucket_id not in ('chat-media','chat-audio','chat-files') then true
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
create policy profiles_admin_visibility_guard
on public.profiles as restrictive
for select to authenticated
using (public.can_view_profile(id));

-- Los álbumes no deben filtrar fotos de administradores ocultos.
drop policy if exists profile_photos_admin_visibility_guard on public.profile_photos;
create policy profile_photos_admin_visibility_guard
on public.profile_photos as restrictive
for select to authenticated
using (public.can_view_profile(user_id));

-- Si el bucket avatars es privado, esta regla también protege las lecturas
-- autenticadas directas por ruta. Las URLs públicas antiguas requieren
-- migrar a URLs firmadas antes de poder garantizar privacidad fuera de la app.
drop policy if exists avatars_admin_visibility_guard on storage.objects;
create policy avatars_admin_visibility_guard
on storage.objects as restrictive
for select to authenticated
using (
  bucket_id <> 'avatars'
  or case
    when (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[2])::uuid)
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_access_match(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists admin_visibility_chat_storage_insert_guard on storage.objects;
create policy admin_visibility_chat_storage_insert_guard
on storage.objects as restrictive for insert to authenticated
with check (
  case
    when bucket_id not in ('chat-media','chat-audio','chat-files') then true
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
create policy profiles_admin_visibility_guard
on public.profiles as restrictive
for select to authenticated
using (public.can_view_profile(id));

-- Los álbumes no deben filtrar fotos de administradores ocultos.
drop policy if exists profile_photos_admin_visibility_guard on public.profile_photos;
create policy profile_photos_admin_visibility_guard
on public.profile_photos as restrictive
for select to authenticated
using (public.can_view_profile(user_id));

-- Si el bucket avatars es privado, esta regla también protege las lecturas
-- autenticadas directas por ruta. Las URLs públicas antiguas requieren
-- migrar a URLs firmadas antes de poder garantizar privacidad fuera de la app.
drop policy if exists avatars_admin_visibility_guard on storage.objects;
create policy avatars_admin_visibility_guard
on storage.objects as restrictive
for select to authenticated
using (
  bucket_id <> 'avatars'
  or case
    when (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[2])::uuid)
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_access_match(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists admin_visibility_chat_storage_update_guard on storage.objects;
create policy admin_visibility_chat_storage_update_guard
on storage.objects as restrictive for update to authenticated
using (
  case
    when bucket_id not in ('chat-media','chat-audio','chat-files') then true
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
create policy profiles_admin_visibility_guard
on public.profiles as restrictive
for select to authenticated
using (public.can_view_profile(id));

-- Los álbumes no deben filtrar fotos de administradores ocultos.
drop policy if exists profile_photos_admin_visibility_guard on public.profile_photos;
create policy profile_photos_admin_visibility_guard
on public.profile_photos as restrictive
for select to authenticated
using (public.can_view_profile(user_id));

-- Si el bucket avatars es privado, esta regla también protege las lecturas
-- autenticadas directas por ruta. Las URLs públicas antiguas requieren
-- migrar a URLs firmadas antes de poder garantizar privacidad fuera de la app.
drop policy if exists avatars_admin_visibility_guard on storage.objects;
create policy avatars_admin_visibility_guard
on storage.objects as restrictive
for select to authenticated
using (
  bucket_id <> 'avatars'
  or case
    when (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[2])::uuid)
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_access_match(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  case
    when bucket_id not in ('chat-media','chat-audio','chat-files') then true
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
create policy profiles_admin_visibility_guard
on public.profiles as restrictive
for select to authenticated
using (public.can_view_profile(id));

-- Los álbumes no deben filtrar fotos de administradores ocultos.
drop policy if exists profile_photos_admin_visibility_guard on public.profile_photos;
create policy profile_photos_admin_visibility_guard
on public.profile_photos as restrictive
for select to authenticated
using (public.can_view_profile(user_id));

-- Si el bucket avatars es privado, esta regla también protege las lecturas
-- autenticadas directas por ruta. Las URLs públicas antiguas requieren
-- migrar a URLs firmadas antes de poder garantizar privacidad fuera de la app.
drop policy if exists avatars_admin_visibility_guard on storage.objects;
create policy avatars_admin_visibility_guard
on storage.objects as restrictive
for select to authenticated
using (
  bucket_id <> 'avatars'
  or case
    when (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[2])::uuid)
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_access_match(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists admin_visibility_chat_storage_delete_guard on storage.objects;
create policy admin_visibility_chat_storage_delete_guard
on storage.objects as restrictive for delete to authenticated
using (
  case
    when bucket_id not in ('chat-media','chat-audio','chat-files') then true
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
create policy profiles_admin_visibility_guard
on public.profiles as restrictive
for select to authenticated
using (public.can_view_profile(id));

-- Los álbumes no deben filtrar fotos de administradores ocultos.
drop policy if exists profile_photos_admin_visibility_guard on public.profile_photos;
create policy profile_photos_admin_visibility_guard
on public.profile_photos as restrictive
for select to authenticated
using (public.can_view_profile(user_id));

-- Si el bucket avatars es privado, esta regla también protege las lecturas
-- autenticadas directas por ruta. Las URLs públicas antiguas requieren
-- migrar a URLs firmadas antes de poder garantizar privacidad fuera de la app.
drop policy if exists avatars_admin_visibility_guard on storage.objects;
create policy avatars_admin_visibility_guard
on storage.objects as restrictive
for select to authenticated
using (
  bucket_id <> 'avatars'
  or case
    when (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[2])::uuid)
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_access_match(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists profiles_admin_visibility_guard on public.profiles;
create policy profiles_admin_visibility_guard
on public.profiles as restrictive
for select to authenticated
using (public.can_view_profile(id));

-- Los álbumes no deben filtrar fotos de administradores ocultos.
drop policy if exists profile_photos_admin_visibility_guard on public.profile_photos;
create policy profile_photos_admin_visibility_guard
on public.profile_photos as restrictive
for select to authenticated
using (public.can_view_profile(user_id));

-- Si el bucket avatars es privado, esta regla también protege las lecturas
-- autenticadas directas por ruta. Las URLs públicas antiguas requieren
-- migrar a URLs firmadas antes de poder garantizar privacidad fuera de la app.
drop policy if exists avatars_admin_visibility_guard on storage.objects;
create policy avatars_admin_visibility_guard
on storage.objects as restrictive
for select to authenticated
using (
  bucket_id <> 'avatars'
  or case
    when (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[2])::uuid)
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';

      then public.can_view_profile(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists matches_admin_visibility_guard on public.matches;
create policy matches_admin_visibility_guard
on public.matches as restrictive
for select to authenticated
using (public.can_access_match(id));

drop policy if exists messages_admin_visibility_select_guard on public.messages;
create policy messages_admin_visibility_select_guard
on public.messages as restrictive
for select to authenticated
using (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_insert_guard on public.messages;
create policy messages_admin_visibility_insert_guard
on public.messages as restrictive
for insert to authenticated
with check (public.can_access_match(match_id));

drop policy if exists messages_admin_visibility_update_guard on public.messages;
create policy messages_admin_visibility_update_guard
on public.messages as restrictive
for update to authenticated
using (public.can_access_match(match_id))
with check (public.can_access_match(match_id));

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.admin_users au where au.user_id = p_user_id
  );
$;

revoke all on function public.is_admin_user(uuid) from public, anon;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists profile_views_hide_admin_visitors on public.profile_views;
create policy profile_views_hide_admin_visitors
on public.profile_views as restrictive
for select to authenticated
using (viewer_id is null or not public.is_admin_user(viewer_id));

comment on table public.admin_profile_visibility is
  'Permisos privados que habilitan a usuarios elegidos a ver el perfil y conversar con una cuenta administradora.';
