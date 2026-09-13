-- ============================================================
-- HAIR-ARTISAN'S BARBERSHOP: BOOKING HOURS MIGRATION
-- ============================================================
-- SAFE TO RUN ON AN EXISTING DATABASE.
-- This migration does NOT delete, update or cancel existing bookings.
-- Existing 09:00/09:30 bookings remain active.
-- It only changes the public booking function so NEW bookings
-- cannot start before 10:00. Closing time remains 17:00.
-- ============================================================

create or replace function public.create_hair_artisans_booking(
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_service_id bigint,
  p_appointment_date date,
  p_start_time time
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_customer_id uuid;
  v_service_price numeric(10,2);
  v_duration integer;
  v_end_time time;
  v_booking_id bigint;
  v_today date;
begin
  p_full_name := btrim(coalesce(p_full_name, ''));
  p_phone := btrim(coalesce(p_phone, ''));
  p_email := nullif(btrim(coalesce(p_email, '')), '');
  p_notes := nullif(btrim(coalesce(p_notes, '')), '');

  if length(p_full_name) < 2 then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;

  if length(regexp_replace(p_phone, '[^0-9+]', '', 'g')) < 7 then
    raise exception 'Please enter a valid phone number.' using errcode = '22023';
  end if;

  if p_appointment_date is null or p_start_time is null then
    raise exception 'Please select a date and time.' using errcode = '22023';
  end if;

  v_today := (now() at time zone 'Africa/Johannesburg')::date;

  if p_appointment_date < v_today then
    raise exception 'The selected date has already passed.' using errcode = '22023';
  end if;

  if p_appointment_date > v_today + 60 then
    raise exception 'The selected date is outside the booking window.' using errcode = '22023';
  end if;

  if extract(dow from p_appointment_date) in (1, 2) then
    raise exception 'The shop is closed on Monday and Tuesday.' using errcode = '22023';
  end if;

  if p_start_time < time '10:00' or p_start_time >= time '17:00' then
    raise exception 'The selected time is outside business hours.' using errcode = '22023';
  end if;

  if extract(minute from p_start_time)::integer % 30 <> 0
     or extract(second from p_start_time) <> 0 then
    raise exception 'Please select a 30-minute booking slot.' using errcode = '22023';
  end if;

  select s.price, s.duration_minutes
    into v_service_price, v_duration
  from public.services s
  where s.id = p_service_id
    and s.active = true;

  if not found then
    raise exception 'The selected service is not available.' using errcode = '22023';
  end if;

  if v_duration is null or v_duration <= 0 then
    raise exception 'The selected service has an invalid duration.' using errcode = '22023';
  end if;

  v_end_time := p_start_time + make_interval(mins => v_duration);

  if v_end_time > time '17:00' then
    raise exception 'That service cannot finish before closing time.' using errcode = '22023';
  end if;

  -- Prevent two customers from taking an overlapping slot at the same time.
  perform pg_advisory_xact_lock(hashtext('hair-artisans-booking-' || p_appointment_date::text));

  if exists (
    select 1
    from public.bookings b
    where b.appointment_date = p_appointment_date
      and lower(b.status::text) in ('pending', 'confirmed')
      and b.start_time < v_end_time
      and b.end_time > p_start_time
  ) then
    raise exception 'That time is no longer available.' using errcode = '23P01';
  end if;

  select c.id
    into v_customer_id
  from public.customers c
  where regexp_replace(c.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g')
  order by c.updated_at desc nulls last, c.created_at desc
  limit 1;

  if v_customer_id is null then
    insert into public.customers(full_name, phone, email)
    values (p_full_name, p_phone, p_email)
    returning id into v_customer_id;
  else
    update public.customers
    set full_name = p_full_name,
        phone = p_phone,
        email = p_email,
        updated_at = now()
    where id = v_customer_id;
  end if;

  insert into public.bookings(
    customer_id,
    service_id,
    appointment_date,
    start_time,
    end_time,
    status,
    service_price,
    deposit_amount,
    balance_amount,
    notes,
    created_at,
    updated_at
  )
  values (
    v_customer_id,
    p_service_id,
    p_appointment_date,
    p_start_time,
    v_end_time,
    'confirmed',
    v_service_price,
    0,
    coalesce(v_service_price, 0),
    p_notes,
    now(),
    now()
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_hair_artisans_booking(text,text,text,text,bigint,date,time without time zone) from public;
grant execute on function public.create_hair_artisans_booking(text,text,text,text,bigint,date,time without time zone) to anon, authenticated;
