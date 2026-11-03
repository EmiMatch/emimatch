-- EmiMatch: historial privado de las últimas búsquedas en Descubrir.
-- Cada usuario solo puede leer, insertar y borrar sus propios registros.
create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint search_history_filters_object check (jsonb_typeof(filters) = 'object')
);

create index if not exists search_history_user_created_idx
  on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;
revoke all on table public.search_history from anon, public;
grant select, insert, delete on table public.search_history to authenticated;

drop policy if exists search_history_select_own on public.search_history;
create policy search_history_select_own
  on public.search_history for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists search_history_insert_own on public.search_history;
create policy search_history_insert_own
  on public.search_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists search_history_delete_own on public.search_history;
create policy search_history_delete_own
  on public.search_history for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.search_history is
  'Historial privado de búsquedas recientes de Descubrir en EmiMatch; cada usuario accede únicamente a sus propios registros.';
comment on column public.search_history.filters is
  'Filtros usados en la búsqueda: edad mínima, edad máxima, ciudad y grupos de género seleccionados.';
