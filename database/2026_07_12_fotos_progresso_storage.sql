-- 2026_07_12_fotos_progresso_storage.sql
-- Gym Vym — bucket privado + policies pras fotos de progresso

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false);

create policy "progress_photos_storage_select" on storage.objects
  for select using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress_photos_storage_insert" on storage.objects
  for insert with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress_photos_storage_update" on storage.objects
  for update using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress_photos_storage_delete" on storage.objects
  for delete using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
