-- Each authenticated musician can access only their own profile.
create table public.practice_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 1 and 32),
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and data ? 'settings' and data ? 'progress'
    and jsonb_typeof(data->'settings') = 'object'
    and jsonb_typeof(data->'progress') = 'object'
    and octet_length(data::text) <= 1000000
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.practice_profiles enable row level security;
revoke all on public.practice_profiles from anon, public, authenticated;
grant select, insert, update on public.practice_profiles to authenticated;
create policy "Read my practice" on public.practice_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create my practice" on public.practice_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Save my practice" on public.practice_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Small idempotency receipts make a lost network response safe to retry.
create table public.practice_writes (
  user_id uuid not null references auth.users(id) on delete cascade,
  write_id uuid not null,
  primary key (user_id,write_id)
);
alter table public.practice_writes enable row level security;
revoke all on public.practice_writes from anon, public, authenticated;
grant select, insert on public.practice_writes to authenticated;
create policy "My sync receipts" on public.practice_writes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Record my sync" on public.practice_writes for insert to authenticated with check ((select auth.uid()) = user_id);

-- Compare-and-swap prevents a stale phone/computer snapshot overwriting newer work.
create function public.save_practice_profile(expected_revision bigint, profile_name text, profile_data jsonb, mutation_id uuid, expected_user_id uuid)
returns setof public.practice_profiles language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() <> expected_user_id then
    raise sqlstate 'PT403' using message = 'The signed-in account changed. Reconnect before syncing.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if exists(select 1 from public.practice_writes where user_id=auth.uid() and write_id=mutation_id) then
    return query select * from public.practice_profiles where user_id=auth.uid();
    return;
  end if;
  return query
    insert into public.practice_profiles as profiles (user_id, username, data)
    values (auth.uid(), btrim(profile_name), profile_data)
    on conflict (user_id) do update
      set username = excluded.username, data = excluded.data,
          revision = profiles.revision + 1, updated_at = now()
      where profiles.revision = expected_revision
    returning profiles.*;
  if not found then
    raise sqlstate 'PT409' using message = 'Practice changed on another device. Merge and retry.';
  end if;
  insert into public.practice_writes(user_id,write_id) values(auth.uid(),mutation_id);
end;
$$;
revoke all on function public.save_practice_profile(bigint,text,jsonb,uuid,uuid) from public, anon;
grant execute on function public.save_practice_profile(bigint,text,jsonb,uuid,uuid) to authenticated;
