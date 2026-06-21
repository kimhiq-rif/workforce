-- Create worker-photos storage bucket (public read, authenticated write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'worker-photos',
  'worker-photos',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Allow authenticated users to upload
create policy "worker_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'worker-photos');

-- Allow public read
create policy "worker_photos_select"
  on storage.objects for select
  to public
  using (bucket_id = 'worker-photos');

-- Allow authenticated users to update/delete their own uploads
create policy "worker_photos_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'worker-photos');

create policy "worker_photos_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'worker-photos');
