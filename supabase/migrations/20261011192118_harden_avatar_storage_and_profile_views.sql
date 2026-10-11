-- Harden profile-photo storage ownership and repair profile-view access.
-- Preserve the two existing upload path layouts used by the web client:
--   <user-id>/profile/<file>
--   profiles/<user-id>/<file>

grant select, insert on table public.profile_views to authenticated;

drop policy if exists "EmiMatch avatars - subida" on storage.objects;
drop policy if exists "EmiMatch avatars - modificar" on storage.objects;
drop policy if exists "EmiMatch avatars - eliminar" on storage.objects;

drop policy if exists "EmiMatch avatars - subida propia" on storage.objects;
create policy "EmiMatch avatars - subida propia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
);

drop policy if exists "EmiMatch avatars - modificar propia" on storage.objects;
create policy "EmiMatch avatars - modificar propia"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
)
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
);

drop policy if exists "EmiMatch avatars - eliminar propia" on storage.objects;
create policy "EmiMatch avatars - eliminar propia"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
);

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'avatars';

drop policy if exists profile_views_insert_own on public.profile_views;
create policy profile_views_insert_own
on public.profile_views for insert to authenticated
with check ((select auth.uid()) = viewer_id and viewer_id <> profile_id);

drop policy if exists profile_views_select_received on public.profile_views;
create policy profile_views_select_received
on public.profile_views for select to authenticated
using ((select auth.uid()) = profile_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.profile_photos'::regclass and contype='p') then
    alter table public.profile_photos add constraint profile_photos_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.profile_views'::regclass and contype='p') then
    alter table public.profile_views add constraint profile_views_pkey primary key (id);
  end if;
end $$;

create index if not exists block_blocked_user_id_idx on public.block (blocked_user_id);
create index if not exists message_reactions_user_id_idx on public.message_reactions (user_id);

-- All references to application tables and helper functions in these routines
-- are schema-qualified; an empty search_path avoids object-shadowing attacks.
alter function public.can_send_like() set search_path = '';
alter function public.can_send_message() set search_path = '';
alter function public.get_premium_status() set search_path = '';
alter function public.get_received_likes() set search_path = '';
alter function public.has_mutual_like(uuid) set search_path = '';
alter function public.is_admin() set search_path = '';
alter function public.is_premium() set search_path = '';
alter function public.mark_match_messages_read(uuid) set search_path = '';
alter function public.prepare_premium_subscription() set search_path = '';
alter function public.handle_updated_at() set search_path = '';
