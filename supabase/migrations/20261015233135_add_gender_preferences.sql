-- EmiMatch: identidad de género y preferencias de descubrimiento.
alter table public.profiles
  add column if not exists gender_identity text;

comment on column public.profiles.gender_identity is
  'Identidad de género elegida por el usuario para personalizar su experiencia en EmiMatch.';

-- Las preferencias de búsqueda se mantienen en una tabla privada.
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_genders text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
grant select, insert, update, delete on public.user_preferences to authenticated;

drop policy if exists "Users can read own gender preferences" on public.user_preferences;
create policy "Users can read own gender preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own gender preferences" on public.user_preferences;
create policy "Users can insert own gender preferences"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own gender preferences" on public.user_preferences;
create policy "Users can update own gender preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own gender preferences" on public.user_preferences;
create policy "Users can delete own gender preferences"
  on public.user_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.user_preferences is
  'Preferencias privadas de búsqueda de cada usuario de EmiMatch.';
comment on column public.user_preferences.preferred_genders is
  'Grupos de género que el usuario desea conocer: women, men, nonbinary, other.';
