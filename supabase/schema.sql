-- Celiac Tracker cloud storage. Paste into Supabase: SQL Editor > New query > Run.
-- Safe to run more than once.

-- Every record from the app, one row each, owned by the signed-in user.
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tbl        text        not null,
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,
  seq        bigint      not null default 0,
  primary key (user_id, tbl, id)
);

-- A rising number on every change, so each device can ask "what changed since N?".
create sequence if not exists public.records_seq;

create or replace function public.records_bump_seq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.seq := nextval('public.records_seq');
  return new;
end
$$;

-- Only the trigger runs it; nobody calls it through the API.
revoke all on function public.records_bump_seq() from public, anon, authenticated;

drop trigger if exists records_seq on public.records;
create trigger records_seq
  before insert or update on public.records
  for each row execute function public.records_bump_seq();

create index if not exists records_user_seq on public.records (user_id, seq);

-- Only you can see or change your rows.
alter table public.records enable row level security;
drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Upload a batch. The newest change wins: an older change never overwrites a newer one.
create or replace function public.push_records(rows jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.records (user_id, tbl, id, data, deleted, updated_at)
  select auth.uid(),
         r ->> 'tbl',
         r ->> 'id',
         r -> 'data',
         coalesce((r ->> 'deleted')::boolean, false),
         (r ->> 'updated_at')::timestamptz
  from jsonb_array_elements(rows) as r
  on conflict (user_id, tbl, id) do update
    set data = excluded.data,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at
    where public.records.updated_at <= excluded.updated_at;
$$;

revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
