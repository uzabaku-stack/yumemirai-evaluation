create table if not exists public.yumemirai_app_data (
  id text primary key,
  next_ids jsonb not null default '{}'::jsonb,
  staff jsonb not null default '[]'::jsonb,
  job_roles jsonb not null default '[]'::jsonb,
  evaluation_items jsonb not null default '[]'::jsonb,
  rating_criteria jsonb not null default '[]'::jsonb,
  evaluations jsonb not null default '[]'::jsonb,
  evaluation_scores jsonb not null default '[]'::jsonb,
  evaluation_cycles jsonb not null default '[]'::jsonb,
  users jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.yumemirai_app_data enable row level security;

drop policy if exists allow_app_anon_read on public.yumemirai_app_data;
create policy allow_app_anon_read
  on public.yumemirai_app_data
  for select
  using (true);

drop policy if exists allow_app_anon_insert on public.yumemirai_app_data;
create policy allow_app_anon_insert
  on public.yumemirai_app_data
  for insert
  with check (true);

drop policy if exists allow_app_anon_update on public.yumemirai_app_data;
create policy allow_app_anon_update
  on public.yumemirai_app_data
  for update
  using (true)
  with check (true);

insert into public.yumemirai_app_data (id)
values ('default')
on conflict (id) do nothing;
