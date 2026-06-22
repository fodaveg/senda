-- Borrado de cuenta (RGPD / "derecho al olvido") — SPECS_V4.
--
-- ⚠️ NO está aplicado en el proyecto. Hay que ejecutarlo a mano en el SQL Editor
-- de Supabase para que exista la función `public.delete_account`. Hasta entonces,
-- la app NO debe asumir que existe (llamarla daría error). El cliente no puede
-- borrar su propio usuario de `auth.users` desde el SDK anónimo; por eso se
-- expone como RPC `security definer` que SOLO borra al usuario que la invoca.
--
-- Efecto: borra la fila de `auth.users` del usuario con sesión; el resto de sus
-- datos (route_marks, outings, checklists, custom_gear, preferences, profiles)
-- desaparece en cascada gracias a `references auth.users on delete cascade`
-- (ver schema.sql). La analítica es anónima (sin user_id), así que no hay nada
-- que borrar allí. El script es RE-EJECUTABLE (create or replace + revoke/grant).

create or replace function public.delete_account()
  returns void
  language sql
  -- security definer: corre con los privilegios del propietario (puede tocar
  -- auth.users), pero el WHERE la limita al propio usuario → nadie borra a otro.
  security definer
  -- search_path vacío: evita el secuestro de la función vía search_path.
  set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Solo los usuarios autenticados pueden invocarla (y solo se borran a sí mismos).
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
