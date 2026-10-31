create table if not exists public.clip_deposit_reports (
 id text primary key, deposit_date date not null, payload jsonb not null,
 synced_at timestamptz not null default now()
);
create index if not exists clip_deposit_date_idx on public.clip_deposit_reports(deposit_date);
alter table public.clip_deposit_reports enable row level security;
revoke all on public.clip_deposit_reports from anon, authenticated;
grant all on public.clip_deposit_reports to service_role;
create table if not exists public.clip_sync_state (
 id text primary key, attempted_at timestamptz not null, succeeded_at timestamptz,
 failed_reports integer not null default 0, error text
);
alter table public.clip_sync_state enable row level security;
revoke all on public.clip_sync_state from anon, authenticated;
grant all on public.clip_sync_state to service_role;
alter table public.clip_sync_state add column if not exists lock_until timestamptz;
create or replace function public.acquire_clip_sync() returns boolean
language plpgsql security definer set search_path=public as $$
begin
 insert into public.clip_sync_state(id,attempted_at) values('deposits',now()) on conflict(id) do nothing;
 update public.clip_sync_state set lock_until=now()+interval '6 minutes',attempted_at=now(),error='Sincronización en curso; mostrando datos guardados.'
 where id='deposits' and (lock_until is null or lock_until<now());
 return found;
end $$;
revoke all on function public.acquire_clip_sync() from public,anon,authenticated;
grant execute on function public.acquire_clip_sync() to service_role;
alter table public.clip_sync_state add column if not exists history_from date;
