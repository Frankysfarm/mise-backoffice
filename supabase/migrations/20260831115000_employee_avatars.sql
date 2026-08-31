-- Additive: employee avatars and public storage bucket.
-- Public read keeps org chart fast; write happens only through the server route
-- using service role, so the RLS policy below is defense-in-depth.

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

-- Public read for avatar images.
drop policy if exists "Avatar public read" on storage.objects;
create policy "Avatar public read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Authenticated write: only authenticated users, scoped to avatars bucket.
-- The server route performs the actual tenant/location/ownership checks.
drop policy if exists "Avatar authenticated write" on storage.objects;
create policy "Avatar authenticated write"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars');

commit;
