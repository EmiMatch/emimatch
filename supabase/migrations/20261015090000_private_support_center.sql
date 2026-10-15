-- EmiMatch: centro privado de consultas y respuestas de soporte.
create table if not exists public.support_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check (category in ('consulta','sugerencia','problema','cuenta_premium')),
 subject text not null check (char_length(trim(subject)) between 3 and 100),
 message text not null check (char_length(trim(message)) between 10 and 3000),
 status text not null default 'recibida' check (status in ('recibida','en_revision','respondida')),
 admin_response text,
 responded_by uuid references auth.users(id) on delete set null,
 responded_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint support_response_length check (admin_response is null or char_length(admin_response) <= 3000)
);
create index if not exists support_requests_user_created_idx on public.support_requests(user_id,created_at desc);
create index if not exists support_requests_status_created_idx on public.support_requests(status,created_at desc);
alter table public.support_requests enable row level security;
drop policy if exists support_requests_read_own_or_admin on public.support_requests;
create policy support_requests_read_own_or_admin on public.support_requests for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.admin_users au where au.user_id=(select auth.uid()))
);
drop policy if exists support_requests_create_own on public.support_requests;
create policy support_requests_create_own on public.support_requests for insert to authenticated with check (
 user_id=(select auth.uid()) and status='recibida' and admin_response is null and responded_by is null and responded_at is null
);
drop policy if exists support_requests_update_admin_only on public.support_requests;
create policy support_requests_update_admin_only on public.support_requests for update to authenticated
 using(exists(select 1 from public.admin_users au where au.user_id=(select auth.uid())))
 with check(exists(select 1 from public.admin_users au where au.user_id=(select auth.uid())));
grant select,insert,update on public.support_requests to authenticated;
create or replace function public.set_support_request_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at:=now();
 if new.admin_response is distinct from old.admin_response then
  if new.admin_response is null or length(trim(new.admin_response))=0 then
   new.responded_by:=null; new.responded_at:=null;
   if new.status='respondida' then new.status:='en_revision'; end if;
  else
   new.responded_by:=(select auth.uid()); new.responded_at:=now(); new.status:='respondida';
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists support_requests_updated_at on public.support_requests;
create trigger support_requests_updated_at before update on public.support_requests for each row execute function public.set_support_request_updated_at();
comment on table public.support_requests is 'Consultas privadas de EmiMatch protegidas por RLS.';
