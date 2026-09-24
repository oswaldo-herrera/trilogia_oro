-- =============================================================
--  Galardón Trilogía de Oro · Registro de asistentes
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
--  Al final se muestra la LLAVE del panel privado. Guárdala.
-- =============================================================

-- 1) Tabla de registros (el folio arranca en 100 y es automático)
create table if not exists public.registros_trilogia_oro (
  folio        bigint generated always as identity (start with 100) primary key,
  nombre       text not null check (char_length(nombre) between 3 and 120),
  whatsapp     text not null check (whatsapp ~ '^\d{10,13}$'),
  correo       text not null unique check (correo ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  created_at   timestamptz not null default now(),
  asistio      boolean not null default false,
  hora_llegada timestamptz
);

-- RLS activo y SIN políticas: nadie puede leer/escribir la tabla directo
-- desde la web. Todo pasa por las funciones de abajo.
alter table public.registros_trilogia_oro enable row level security;

-- 2) Llave secreta del panel (tabla invisible desde la web)
create table if not exists public.admin_llave (
  llave text primary key
);
alter table public.admin_llave enable row level security;

insert into public.admin_llave (llave)
select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.admin_llave);

create or replace function public._validar_llave(p_llave text)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_llave is null or not exists (select 1 from admin_llave where llave = p_llave) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end;
$$;

-- 3) Registro público: guarda y devuelve el folio.
--    Si el correo ya existe, devuelve el folio que ya tenía.
create or replace function public.registrar(p_nombre text, p_whatsapp text, p_correo text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_correo text := lower(trim(p_correo));
  v_folio  bigint;
begin
  select folio into v_folio from registros_trilogia_oro where correo = v_correo;
  if v_folio is not null then
    return v_folio;
  end if;

  insert into registros_trilogia_oro (nombre, whatsapp, correo)
  values (regexp_replace(trim(p_nombre), '\s+', ' ', 'g'),
          regexp_replace(p_whatsapp, '\D', '', 'g'),
          v_correo)
  on conflict (correo) do nothing
  returning folio into v_folio;

  if v_folio is null then   -- otra persona lo registró en el mismo instante
    select folio into v_folio from registros_trilogia_oro where correo = v_correo;
  end if;

  return v_folio;
end;
$$;

-- 4) Panel: listar registros (requiere llave)
drop function if exists public.admin_listar(text);
drop function if exists public.admin_marcar(text, bigint, boolean);

create or replace function public.admin_listar(p_llave text)
returns setof public.registros_trilogia_oro
language plpgsql stable security definer set search_path = public
as $$
begin
  perform _validar_llave(p_llave);
  return query select * from registros_trilogia_oro order by folio;
end;
$$;

-- 5) Panel: marcar / desmarcar llegada (requiere llave)
create or replace function public.admin_marcar(p_llave text, p_folio bigint, p_asistio boolean)
returns public.registros_trilogia_oro
language plpgsql security definer set search_path = public
as $$
declare
  v public.registros_trilogia_oro;
begin
  perform _validar_llave(p_llave);
  update registros_trilogia_oro
     set asistio = p_asistio,
         hora_llegada = case when p_asistio then now() else null end
   where folio = p_folio
  returning * into v;
  return v;
end;
$$;

-- Permisos de ejecución
revoke all on function public._validar_llave(text)                  from public, anon, authenticated;
revoke all on function public.registrar(text, text, text)           from public;
revoke all on function public.admin_listar(text)                    from public;
revoke all on function public.admin_marcar(text, bigint, boolean)   from public;
grant execute on function public.registrar(text, text, text)         to anon, authenticated;
grant execute on function public.admin_listar(text)                  to anon, authenticated;
grant execute on function public.admin_marcar(text, bigint, boolean) to anon, authenticated;

-- 6) Tu llave del panel (cópiala):
select llave as "LLAVE DEL PANEL" from public.admin_llave;
