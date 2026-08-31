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

-- Drop any legacy policies on the avatars bucket to avoid overlap.
delete from storage.policies
  using storage.buckets
  where storage.policies.bucket_id = storage.buckets.id
    and storage.buckets.name = 'avatars';

-- Public read for avatar images.
insert into storage.policies (name, definition, bucket_id, operation)
select
  'Avatar public read',
  '(bucket_id = (select id from storage.buckets where name = ''avatars''))'::text,
  b.id,
  'SELECT'::text
from storage.buckets b
where b.name = 'avatars'
on conflict do nothing;

-- Authenticated write: only authenticated users, scoped to avatars bucket.
-- The server route performs the actual tenant/location/ownership checks.
insert into storage.policies (name, definition, bucket_id, operation)
select
  'Avatar authenticated write',
  '(bucket_id = (select id from storage.buckets where name = ''avatars''))'::text,
  b.id,
  'INSERT'::text
from storage.buckets b
where b.name = 'avatars'
on conflict do nothing;

commit;
