-- =====================================================================
-- Informe Trabajo Social · Comisaría de Familia (Morales, Cauca)
-- Esquema inicial: perfiles de profesionales, informes con código único,
-- consecutivo anual y políticas de seguridad (RLS).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfiles (uno por usuario de auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null,
  nombre text not null,
  tarjeta_profesional text,
  cargo text not null default 'Trabajador(a) Social',
  seccion text not null default 'Trabajo Social - Comisaría de Familia',
  dirigido_a text,
  -- Firma como data URL PNG (se incrusta en el PDF)
  firma text,
  rol text not null default 'profesional' check (rol in ('admin', 'profesional')),
  activo boolean not null default true,
  debe_cambiar_clave boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.perfiles is 'Profesionales y administradores que usan la aplicación.';

-- ---------------------------------------------------------------------
-- Consecutivo anual para el código de los informes (ITS-AAAA-0001)
-- ---------------------------------------------------------------------
create table if not exists public.consecutivos (
  anio integer primary key,
  ultimo integer not null default 0
);

-- ---------------------------------------------------------------------
-- Informes
-- ---------------------------------------------------------------------
create table if not exists public.informes (
  -- El id lo genera el dispositivo para poder crear informes sin conexión
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  anio integer,
  consecutivo integer,
  autor_id uuid not null references public.perfiles (id),
  nna_nombres text,
  nna_apellidos text,
  nna_documento text,
  fecha_elaboracion date,
  estado text not null default 'borrador' check (estado in ('borrador', 'finalizado')),
  datos jsonb not null default '{}'::jsonb,
  eliminado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.informes is 'Informes de valoración sociofamiliar (F-PM-096). El campo datos contiene el formulario completo.';

create index if not exists informes_autor_idx on public.informes (autor_id, actualizado_en desc);
create index if not exists informes_nna_idx on public.informes (nna_documento);
create index if not exists informes_codigo_idx on public.informes (codigo);

-- ---------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo
  );
$$;

create or replace function public.esta_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles p where p.id = auth.uid() and p.activo
  );
$$;

-- Asigna el código ITS-AAAA-NNNN al insertar (si no viene ya asignado)
create or replace function public.asignar_codigo_informe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio integer;
  v_num integer;
begin
  if new.codigo is not null then
    return new;
  end if;
  v_anio := extract(year from coalesce(new.fecha_elaboracion, current_date))::integer;
  insert into public.consecutivos (anio, ultimo) values (v_anio, 1)
    on conflict (anio) do update set ultimo = public.consecutivos.ultimo + 1
    returning ultimo into v_num;
  new.anio := v_anio;
  new.consecutivo := v_num;
  new.codigo := 'ITS-' || v_anio::text || '-' || lpad(v_num::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_informes_codigo on public.informes;
create trigger trg_informes_codigo
  before insert on public.informes
  for each row execute function public.asignar_codigo_informe();

-- Mantiene actualizado_en y copia nombre/documento del NNA desde el formulario
create or replace function public.informes_antes_de_guardar()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := greatest(coalesce(new.actualizado_en, now()), old.actualizado_en + interval '1 millisecond') ;
  new.nna_nombres := coalesce(new.datos->>'nombres', new.nna_nombres);
  new.nna_apellidos := coalesce(new.datos->>'apellidos', new.nna_apellidos);
  new.nna_documento := coalesce(new.datos->>'doc_numero', new.nna_documento);
  if (new.datos->>'fecha_elaboracion') ~ '^\d{4}-\d{2}-\d{2}$' then
    new.fecha_elaboracion := (new.datos->>'fecha_elaboracion')::date;
  end if;
  -- Solo un administrador puede cambiar el autor (reasignar)
  if new.autor_id <> old.autor_id and not public.es_admin() then
    raise exception 'Solo el administrador puede reasignar un informe';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_informes_update on public.informes;
create trigger trg_informes_update
  before update on public.informes
  for each row execute function public.informes_antes_de_guardar();

create or replace function public.informes_antes_de_insertar()
returns trigger
language plpgsql
as $$
begin
  new.nna_nombres := coalesce(new.datos->>'nombres', new.nna_nombres);
  new.nna_apellidos := coalesce(new.datos->>'apellidos', new.nna_apellidos);
  new.nna_documento := coalesce(new.datos->>'doc_numero', new.nna_documento);
  if (new.datos->>'fecha_elaboracion') ~ '^\d{4}-\d{2}-\d{2}$' then
    new.fecha_elaboracion := (new.datos->>'fecha_elaboracion')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_informes_insert on public.informes;
create trigger trg_informes_insert
  before insert on public.informes
  for each row execute function public.informes_antes_de_insertar();

-- Un profesional no puede cambiar su rol, su estado ni su correo
create or replace function public.perfiles_antes_de_actualizar()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  if not public.es_admin() then
    new.rol := old.rol;
    new.activo := old.activo;
    new.correo := old.correo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfiles_update on public.perfiles;
create trigger trg_perfiles_update
  before update on public.perfiles
  for each row execute function public.perfiles_antes_de_actualizar();

-- Crea el perfil automáticamente al crear el usuario en auth (metadatos del admin)
create or replace function public.crear_perfil_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, correo, nombre, tarjeta_profesional, cargo, rol, debe_cambiar_clave)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nombre', split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_user_meta_data->>'tarjeta_profesional', ''),
    coalesce(nullif(new.raw_user_meta_data->>'cargo', ''), 'Trabajador(a) Social'),
    case when new.raw_user_meta_data->>'rol' = 'admin' then 'admin' else 'profesional' end,
    coalesce((new.raw_user_meta_data->>'debe_cambiar_clave')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_desde_auth();

-- Reasignación de informes (solo admin)
create or replace function public.reasignar_informe(p_informe uuid, p_nuevo_autor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede reasignar informes';
  end if;
  if not exists (select 1 from public.perfiles where id = p_nuevo_autor and activo) then
    raise exception 'El profesional destino no existe o está inactivo';
  end if;
  update public.informes set autor_id = p_nuevo_autor where id = p_informe;
end;
$$;

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.informes enable row level security;
alter table public.consecutivos enable row level security;

drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_admin());

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- La inserción y eliminación de perfiles se hace con la clave de servicio (función Edge)

drop policy if exists informes_select on public.informes;
create policy informes_select on public.informes
  for select to authenticated
  using (autor_id = auth.uid() or public.es_admin());

drop policy if exists informes_insert on public.informes;
create policy informes_insert on public.informes
  for insert to authenticated
  with check (autor_id = auth.uid() and public.esta_activo());

drop policy if exists informes_update on public.informes;
create policy informes_update on public.informes
  for update to authenticated
  using ((autor_id = auth.uid() and public.esta_activo()) or public.es_admin())
  with check ((autor_id = auth.uid() and public.esta_activo()) or public.es_admin());

drop policy if exists informes_delete on public.informes;
create policy informes_delete on public.informes
  for delete to authenticated
  using (autor_id = auth.uid() or public.es_admin());

-- Los consecutivos solo se tocan desde el trigger (security definer)
drop policy if exists consecutivos_select on public.consecutivos;
create policy consecutivos_select on public.consecutivos
  for select to authenticated using (public.es_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.informes to authenticated;
grant select, update on public.perfiles to authenticated;
grant select on public.consecutivos to authenticated;
grant execute on function public.es_admin(), public.esta_activo(), public.reasignar_informe(uuid, uuid) to authenticated;
