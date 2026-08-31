-- Additive: employee avatars and public storage bucket.
-- Uploads happen only through the tenant/location-scoped service-role route.

begin;

alter table public.employees
  add column if not exists avatar_url text;

-- Ensure the public avatars bucket exists (2 MB, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The public endpoint serves this bucket without a SELECT policy. Remove legacy
-- policies so names cannot be listed and users cannot bypass the scoped route.
drop policy if exists "Avatar public read" on storage.objects;
drop policy if exists "Avatar authenticated write" on storage.objects;

commit;
