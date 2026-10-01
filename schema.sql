-- Markup database setup
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is safe to run more than once.

-- ─── Tables ────────────────────────────────────────────────────────────────

-- A project is one page you want feedback on: either a live website address
-- or an uploaded screenshot.
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  site_url        text check (site_url ~* '^https?://'),
  screenshot_path text,
  page_height     integer not null default 3000 check (page_height between 600 and 20000),
  share_token     uuid not null unique default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  check (site_url is not null or screenshot_path is not null)
);

-- A comment is either a pin (has x/y, no parent) or a reply to a pin
-- (has a parent, no x/y). Positions are percentages of the page size.
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  parent_id   uuid,
  x_pct       numeric(6, 3) check (x_pct between 0 and 100),
  y_pct       numeric(6, 3) check (y_pct between 0 and 100),
  body        text not null check (char_length(body) between 1 and 5000),
  author_name text not null check (char_length(author_name) between 1 and 100),
  is_owner    boolean not null default false,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, project_id),
  -- A reply must belong to the same project as the pin it answers.
  foreign key (parent_id, project_id) references public.comments (id, project_id) on delete cascade,
  check (
    (parent_id is null and x_pct is not null and y_pct is not null)
    or (parent_id is not null and x_pct is null and y_pct is null)
  )
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists comments_project_id_idx on public.comments (project_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);

-- ─── Access rules ──────────────────────────────────────────────────────────
-- Signed-in owners can see and change only their own projects and the
-- comments on them. Logged-out visitors get no direct table access at all;
-- clients reach a project only through the review_* functions below, and
-- only if they have its secret share link.

alter table public.projects enable row level security;
alter table public.comments enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on public.projects, public.comments from anon;
grant select, insert, update, delete on public.projects, public.comments to authenticated;

drop policy if exists "Owners manage their projects" on public.projects;
create policy "Owners manage their projects" on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners manage comments on their projects" on public.comments;
create policy "Owners manage comments on their projects" on public.comments
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = comments.project_id and p.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = comments.project_id and p.owner_id = (select auth.uid())
  ));

-- ─── Client review functions (used by the share link) ──────────────────────

create or replace function public.review_get_project(p_token uuid)
returns table (id uuid, name text, site_url text, screenshot_path text, page_height integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.site_url, p.screenshot_path, p.page_height
  from public.projects p
  where p.share_token = p_token;
$$;

create or replace function public.review_list_comments(p_token uuid)
returns setof public.comments
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.comments c
  join public.projects p on p.id = c.project_id
  where p.share_token = p_token
  order by c.created_at;
$$;

create or replace function public.review_add_comment(
  p_token       uuid,
  p_body        text,
  p_author_name text,
  p_x           numeric default null,
  p_y           numeric default null,
  p_parent_id   uuid default null
)
returns public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_row public.comments;
begin
  select p.id into v_project_id
  from public.projects p
  where p.share_token = p_token;

  if v_project_id is null then
    raise exception 'Review link not found';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.comments c
    where c.id = p_parent_id and c.project_id = v_project_id and c.parent_id is null
  ) then
    raise exception 'Comment not found';
  end if;

  insert into public.comments (project_id, parent_id, x_pct, y_pct, body, author_name, is_owner)
  values (v_project_id, p_parent_id, p_x, p_y, btrim(p_body), btrim(p_author_name), false)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.review_get_project(uuid) from public;
revoke all on function public.review_list_comments(uuid) from public;
revoke all on function public.review_add_comment(uuid, text, text, numeric, numeric, uuid) from public;
grant execute on function public.review_get_project(uuid) to anon, authenticated;
grant execute on function public.review_list_comments(uuid) to anon, authenticated;
grant execute on function public.review_add_comment(uuid, text, text, numeric, numeric, uuid) to anon, authenticated;

-- ─── Screenshot storage ────────────────────────────────────────────────────
-- Screenshots are readable by anyone with the (random, unguessable) file
-- link so clients can see them. Only the signed-in owner can upload or
-- delete, and only inside their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', true, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners upload screenshots" on storage.objects;
create policy "Owners upload screenshots" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners delete screenshots" on storage.objects;
create policy "Owners delete screenshots" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
