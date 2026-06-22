-- Hosted company branding for all generated reports.
alter table workday_settings
  add column if not exists hosted_company_name text,
  add column if not exists hosted_company_logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-assets',
  'report-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'report_assets_insert'
  ) then
    create policy "report_assets_insert"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'report-assets');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'report_assets_select'
  ) then
    create policy "report_assets_select"
      on storage.objects for select
      to public
      using (bucket_id = 'report-assets');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'report_assets_update'
  ) then
    create policy "report_assets_update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'report-assets')
      with check (bucket_id = 'report-assets');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'report_assets_delete'
  ) then
    create policy "report_assets_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'report-assets');
  end if;
end $$;
