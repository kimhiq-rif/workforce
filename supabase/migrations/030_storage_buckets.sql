-- Define all storage buckets with proper security configuration.
-- attendance-photos: private (face images + GPS data, PDPA-sensitive)
-- receipt-photos: private (financial documents, PDPA-sensitive)
-- site-photos: public (construction site photos, no PII)
-- calendar-photos: public with proper RLS (was missing policies)

-- attendance-photos: private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attendance-photos',
  'attendance-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set public = false;

-- receipt-photos: private bucket (financial documents)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipt-photos',
  'receipt-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set public = false;

-- site-photos: public bucket (site progress photos, no PII)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-photos',
  'site-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- RLS policies for attendance-photos (authenticated-only, no public access)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_insert'
  ) then
    create policy "attendance_photos_insert"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'attendance-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_select'
  ) then
    create policy "attendance_photos_select"
      on storage.objects for select
      to authenticated
      using (bucket_id = 'attendance-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_update'
  ) then
    create policy "attendance_photos_update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'attendance-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attendance_photos_delete'
  ) then
    create policy "attendance_photos_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'attendance-photos');
  end if;
end $$;

-- RLS policies for receipt-photos (authenticated-only, no public access)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'receipt_photos_insert'
  ) then
    create policy "receipt_photos_insert"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'receipt-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'receipt_photos_select'
  ) then
    create policy "receipt_photos_select"
      on storage.objects for select
      to authenticated
      using (bucket_id = 'receipt-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'receipt_photos_update'
  ) then
    create policy "receipt_photos_update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'receipt-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'receipt_photos_delete'
  ) then
    create policy "receipt_photos_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'receipt-photos');
  end if;
end $$;

-- RLS policies for site-photos (public read, authenticated write)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'site_photos_insert'
  ) then
    create policy "site_photos_insert"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'site-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'site_photos_select'
  ) then
    create policy "site_photos_select"
      on storage.objects for select
      to public
      using (bucket_id = 'site-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'site_photos_update'
  ) then
    create policy "site_photos_update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'site-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'site_photos_delete'
  ) then
    create policy "site_photos_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'site-photos');
  end if;
end $$;

-- Fix calendar-photos: add missing RLS policies (bucket exists with 0 policies)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'calendar_photos_insert'
  ) then
    create policy "calendar_photos_insert"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'calendar-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'calendar_photos_select'
  ) then
    create policy "calendar_photos_select"
      on storage.objects for select
      to public
      using (bucket_id = 'calendar-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'calendar_photos_update'
  ) then
    create policy "calendar_photos_update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'calendar-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'calendar_photos_delete'
  ) then
    create policy "calendar_photos_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'calendar-photos');
  end if;
end $$;
