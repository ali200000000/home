-- Run this once in Supabase: SQL Editor → New query → Run.
create table if not exists public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.app_state (
  id integer primary key check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_members enable row level security;
alter table public.app_state enable row level security;

revoke all on public.app_members from anon, authenticated;
revoke all on public.app_state from anon, authenticated;
grant select, insert, update on public.app_state to authenticated;

create or replace function public.app_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_members m where m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.app_is_member() from public, anon;
grant execute on function public.app_is_member() to authenticated;

drop policy if exists "members can read shared app state" on public.app_state;
create policy "members can read shared app state"
  on public.app_state for select to authenticated
  using ((select public.app_is_member()));

drop policy if exists "members can create shared app state" on public.app_state;
create policy "members can create shared app state"
  on public.app_state for insert to authenticated
  with check (id = 1 and (select public.app_is_member()));

drop policy if exists "members can update shared app state" on public.app_state;
create policy "members can update shared app state"
  on public.app_state for update to authenticated
  using ((select public.app_is_member()))
  with check (id = 1 and (select public.app_is_member()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end;
$$;

-- Private recipe photos: only household members can upload or read images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'];

drop policy if exists "household members read recipe images" on storage.objects;
create policy "household members read recipe images" on storage.objects for select to authenticated
using (bucket_id = 'recipe-images' and (select public.app_is_member()));
drop policy if exists "household members upload recipe images" on storage.objects;
create policy "household members upload recipe images" on storage.objects for insert to authenticated
with check (bucket_id = 'recipe-images' and (select public.app_is_member()) and (storage.foldername(name))[1] = (select auth.uid())::text);
