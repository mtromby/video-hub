-- Optional profile photo URL for performer cards and catalog UI
alter table public.performers
  add column if not exists image_url text;

comment on column public.performers.image_url is 'Optional HTTPS URL for profile photo (public read).';
