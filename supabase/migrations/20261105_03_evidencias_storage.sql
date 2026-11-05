-- Evidencia fotográfica de los informes: bucket privado de Storage.
-- Ruta de cada archivo: <autor_id>/<informe_id>/<foto_id>.jpg
-- Los metadatos (descripción, orden) viajan dentro de informes.datos->'evidencias'.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- El usuario puede ver/borrar las fotos de su propia carpeta o de informes que le pertenecen
-- (aunque la carpeta sea de otro autor, si el informe fue reasignado). El admin ve todo.
create or replace function public.puede_ver_evidencia(nombre text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin()
    or (storage.foldername(nombre))[1] = auth.uid()::text
    or exists (
      select 1 from public.informes i
      where i.id::text = (storage.foldername(nombre))[2]
        and i.autor_id = auth.uid()
    );
$$;

revoke execute on function public.puede_ver_evidencia(text) from public, anon;
grant execute on function public.puede_ver_evidencia(text) to authenticated;

drop policy if exists evidencias_select on storage.objects;
create policy evidencias_select on storage.objects
  for select to authenticated
  using (bucket_id = 'evidencias' and public.puede_ver_evidencia(name));

drop policy if exists evidencias_insert on storage.objects;
create policy evidencias_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.esta_activo()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists evidencias_update on storage.objects;
create policy evidencias_update on storage.objects
  for update to authenticated
  using (bucket_id = 'evidencias' and public.esta_activo() and public.puede_ver_evidencia(name))
  with check (bucket_id = 'evidencias' and public.puede_ver_evidencia(name));

drop policy if exists evidencias_delete on storage.objects;
create policy evidencias_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidencias' and public.puede_ver_evidencia(name));
