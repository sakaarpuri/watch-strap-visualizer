create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null,
  visitor_id text not null,
  session_id text not null,
  user_id uuid null references auth.users(id) on delete set null,
  strap_id text null,
  strap_label text null,
  strap_category text null,
  tool_name text null,
  watch_source text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_visitor_id_idx
  on public.analytics_events (visitor_id);

create index if not exists analytics_events_strap_id_idx
  on public.analytics_events (strap_id);

alter table public.analytics_events enable row level security;

drop policy if exists "allow anon insert analytics_events" on public.analytics_events;
create policy "allow anon insert analytics_events"
on public.analytics_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "deny direct reads analytics_events" on public.analytics_events;
create policy "deny direct reads analytics_events"
on public.analytics_events
for select
to authenticated
using (false);
