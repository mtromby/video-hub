-- Clips: timed segments of catalog videos, with their own categories/tags for filtering.

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  start_seconds double precision not null default 0,
  title text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clips_start_seconds_nonneg check (start_seconds >= 0),
  constraint clips_slug_unique unique (slug)
);

create index clips_video_id_idx on public.clips (video_id);

create table public.clip_categories (
  clip_id uuid not null references public.clips (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (clip_id, category_id)
);

create table public.clip_tags (
  clip_id uuid not null references public.clips (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (clip_id, tag_id)
);

comment on table public.clips is 'A playback segment starting at start_seconds on a catalog video; feed can show the same file multiple times with different starts/metadata.';
comment on column public.clips.start_seconds is 'Offset in seconds from the start of the parent video file (0 = whole video as a clip row).';

create or replace function public.set_clips_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clips_set_updated_at
  before update on public.clips
  for each row
  execute function public.set_clips_updated_at();

alter table public.clips enable row level security;
alter table public.clip_categories enable row level security;
alter table public.clip_tags enable row level security;

create policy "clips_select_public"
  on public.clips
  for select
  to anon, authenticated
  using (true);

create policy "clips_insert_admin"
  on public.clips
  for insert
  to authenticated
  with check (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  );

create policy "clips_update_admin"
  on public.clips
  for update
  to authenticated
  using (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  );

create policy "clips_delete_admin"
  on public.clips
  for delete
  to authenticated
  using (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  );

create policy "clip_categories_select_public"
  on public.clip_categories
  for select
  to anon, authenticated
  using (true);

create policy "clip_categories_insert_admin"
  on public.clip_categories
  for insert
  to authenticated
  with check (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  );

create policy "clip_categories_delete_admin"
  on public.clip_categories
  for delete
  to authenticated
  using (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  );

create policy "clip_tags_select_public"
  on public.clip_tags
  for select
  to anon, authenticated
  using (true);

create policy "clip_tags_insert_admin"
  on public.clip_tags
  for insert
  to authenticated
  with check (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  );

create policy "clip_tags_delete_admin"
  on public.clip_tags
  for delete
  to authenticated
  using (
    exists (select 1 from public.admin_users u where u.user_id = (select auth.uid()))
  );
