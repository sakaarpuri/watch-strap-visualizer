create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  image_url text not null,
  watch_brand text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_straps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  category text not null,
  strap_a_url text not null,
  strap_b_url text not null,
  material text,
  hardware_finish text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorite_straps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('library', 'saved')),
  library_strap_id text,
  saved_strap_id uuid references public.saved_straps (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorite_target_check check (
    (source_type = 'library' and library_strap_id is not null and saved_strap_id is null) or
    (source_type = 'saved' and saved_strap_id is not null and library_strap_id is null)
  )
);

create table if not exists public.saved_looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  image_url text not null,
  watch_label text,
  watch_source_type text check (watch_source_type in ('uploaded', 'saved')),
  saved_watch_id uuid references public.saved_watches (id) on delete set null,
  strap_label text,
  strap_source_type text check (strap_source_type in ('library', 'saved', 'uploaded')),
  library_strap_id text,
  saved_strap_id uuid references public.saved_straps (id) on delete set null,
  fit_settings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists favorite_library_unique
on public.favorite_straps (user_id, library_strap_id)
where source_type = 'library';

create unique index if not exists favorite_saved_unique
on public.favorite_straps (user_id, saved_strap_id)
where source_type = 'saved';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists saved_watches_set_updated_at on public.saved_watches;
create trigger saved_watches_set_updated_at
  before update on public.saved_watches
  for each row execute procedure public.set_updated_at();

drop trigger if exists saved_straps_set_updated_at on public.saved_straps;
create trigger saved_straps_set_updated_at
  before update on public.saved_straps
  for each row execute procedure public.set_updated_at();

drop trigger if exists saved_looks_set_updated_at on public.saved_looks;
create trigger saved_looks_set_updated_at
  before update on public.saved_looks
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.saved_watches enable row level security;
alter table public.saved_straps enable row level security;
alter table public.favorite_straps enable row level security;
alter table public.saved_looks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own') then
    create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own') then
    create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own') then
    create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_watches' and policyname = 'saved_watches_select_own') then
    create policy saved_watches_select_own on public.saved_watches for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_watches' and policyname = 'saved_watches_insert_own') then
    create policy saved_watches_insert_own on public.saved_watches for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_watches' and policyname = 'saved_watches_update_own') then
    create policy saved_watches_update_own on public.saved_watches for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_watches' and policyname = 'saved_watches_delete_own') then
    create policy saved_watches_delete_own on public.saved_watches for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_straps' and policyname = 'saved_straps_select_own') then
    create policy saved_straps_select_own on public.saved_straps for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_straps' and policyname = 'saved_straps_insert_own') then
    create policy saved_straps_insert_own on public.saved_straps for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_straps' and policyname = 'saved_straps_update_own') then
    create policy saved_straps_update_own on public.saved_straps for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_straps' and policyname = 'saved_straps_delete_own') then
    create policy saved_straps_delete_own on public.saved_straps for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favorite_straps' and policyname = 'favorite_straps_select_own') then
    create policy favorite_straps_select_own on public.favorite_straps for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favorite_straps' and policyname = 'favorite_straps_insert_own') then
    create policy favorite_straps_insert_own on public.favorite_straps for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favorite_straps' and policyname = 'favorite_straps_delete_own') then
    create policy favorite_straps_delete_own on public.favorite_straps for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_looks' and policyname = 'saved_looks_select_own') then
    create policy saved_looks_select_own on public.saved_looks for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_looks' and policyname = 'saved_looks_insert_own') then
    create policy saved_looks_insert_own on public.saved_looks for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_looks' and policyname = 'saved_looks_update_own') then
    create policy saved_looks_update_own on public.saved_looks for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_looks' and policyname = 'saved_looks_delete_own') then
    create policy saved_looks_delete_own on public.saved_looks for delete using (auth.uid() = user_id);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('user-watches', 'user-watches', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('user-straps', 'user-straps', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('user-looks', 'user-looks', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_read_user_watches') then
    create policy public_read_user_watches on storage.objects for select using (bucket_id = 'user-watches');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_read_user_straps') then
    create policy public_read_user_straps on storage.objects for select using (bucket_id = 'user-straps');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_read_user_looks') then
    create policy public_read_user_looks on storage.objects for select using (bucket_id = 'user-looks');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_upload_watches') then
    create policy user_upload_watches on storage.objects for insert to authenticated with check (
      bucket_id = 'user-watches' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_update_watches') then
    create policy user_update_watches on storage.objects for update to authenticated using (
      bucket_id = 'user-watches' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_delete_watches') then
    create policy user_delete_watches on storage.objects for delete to authenticated using (
      bucket_id = 'user-watches' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_upload_straps') then
    create policy user_upload_straps on storage.objects for insert to authenticated with check (
      bucket_id = 'user-straps' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_update_straps') then
    create policy user_update_straps on storage.objects for update to authenticated using (
      bucket_id = 'user-straps' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_delete_straps') then
    create policy user_delete_straps on storage.objects for delete to authenticated using (
      bucket_id = 'user-straps' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_upload_looks') then
    create policy user_upload_looks on storage.objects for insert to authenticated with check (
      bucket_id = 'user-looks' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_update_looks') then
    create policy user_update_looks on storage.objects for update to authenticated using (
      bucket_id = 'user-looks' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_delete_looks') then
    create policy user_delete_looks on storage.objects for delete to authenticated using (
      bucket_id = 'user-looks' and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;
