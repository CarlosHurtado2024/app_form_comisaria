-- Endurecimiento según el linter de seguridad de Supabase
alter function public.informes_antes_de_insertar() set search_path = public;
alter function public.informes_antes_de_guardar() set search_path = public;
alter function public.perfiles_antes_de_actualizar() set search_path = public;

-- Las funciones de trigger no deben poder invocarse por la API
revoke execute on function public.asignar_codigo_informe() from public, anon, authenticated;
revoke execute on function public.crear_perfil_desde_auth() from public, anon, authenticated;
revoke execute on function public.informes_antes_de_insertar() from public, anon, authenticated;
revoke execute on function public.informes_antes_de_guardar() from public, anon, authenticated;
revoke execute on function public.perfiles_antes_de_actualizar() from public, anon, authenticated;

-- Las funciones de apoyo solo para usuarios autenticados (las usan las políticas RLS y la app)
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.esta_activo() from public, anon;
revoke execute on function public.reasignar_informe(uuid, uuid) from public, anon;
grant execute on function public.es_admin(), public.esta_activo(), public.reasignar_informe(uuid, uuid) to authenticated;
