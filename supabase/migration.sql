-- Apply once to a new, private Supabase project. Service-role server access only.
create table if not exists public.expenses (
 id text primary key, date text not null, category text not null,
 description text not null, cents integer not null check(cents>0), method text not null,
 cash_source text not null default 'unknown', spent_by text,
 receipt_key text, receipt_name text, receipt_type text,
 created_at text not null, updated_at text not null
);
create index if not exists expenses_date_idx on public.expenses(date desc,created_at desc);
alter table public.expenses enable row level security;
revoke all on public.expenses from anon, authenticated;
grant all on public.expenses to service_role;
create table if not exists public.receipt_uploads (
 id uuid primary key, user_id uuid not null, expense_id text not null,
 name text not null, path text not null unique, size integer not null,
 expires_at timestamptz not null
);
alter table public.receipt_uploads enable row level security;
revoke all on public.receipt_uploads from anon, authenticated;
grant all on public.receipt_uploads to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('expense-receipts','expense-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
