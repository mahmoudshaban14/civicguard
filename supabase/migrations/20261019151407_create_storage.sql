-- Private bucket, max 5 MB, images only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-images',
  'report-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
);

-- Citizen uploads only inside a folder named with their own user id
create policy "citizen upload own images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Citizen reads only their own images
create policy "citizen read own images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin reads all report images
create policy "admin read all images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-images'
    and public.is_admin()
  );