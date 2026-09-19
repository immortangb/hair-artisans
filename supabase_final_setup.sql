-- ============================================================
-- HAIR ARTISANS BARBERSHOP: FINAL SETUP SCRIPT
-- ============================================================
-- PASTE THIS WHOLE FILE INTO SUPABASE -> SQL EDITOR -> RUN.
-- Safe to run more than once. Does NOT delete or change any of
-- your existing bookings, customers, services or photos.
--
-- What this sets up:
--   1. `business_hours` table - lets you edit opening days/times
--      and the lunch break from Admin -> Hours, instead of them
--      being hardcoded in the app.
--   2. Seeds it with Wed-Sun 10:00-17:00 and a 12:00-12:30 lunch
--      break every open day (only if the table is currently empty
--      - it will never overwrite hours you've already customised).
--   3. Rewrites create_hair_artisans_booking() so every booking:
--        - reads open/closed days, hours and the lunch break from
--          business_hours
--        - takes a 30% minimum deposit (or the full price, if the
--          client chooses to pay in full)
--        - is created as "pending" until Paystack confirms payment
--   4. Updates get_booked_times() so an abandoned, unpaid booking
--      automatically frees its slot after 30 minutes instead of
--      blocking it forever.
--   5. Adds admin_reschedule_booking() so you can change the date
--      and time of an existing booking from Admin -> Dashboard,
--      with the same open-hours / lunch-break / double-booking
--      checks as a new booking.
-- ============================================================

-- ============================================================
-- 1. BUSINESS HOURS TABLE
-- ============================================================
-- Uses "create table if not exists" + "add column if not exists"
-- for every column (rather than relying on the CREATE TABLE's
-- column list) so this repairs itself even if a business_hours
-- table already existed in your project with different or missing
-- columns - it only ever adds what's missing, never drops data.
create table if not exists public.business_hours (
  day_of_week integer primary key
);

alter table public.business_hours add column if not exists is_open boolean not null default true;
alter table public.business_hours add column if not exists open_time time;
alter table public.business_hours add column if not exists close_time time;
alter table public.business_hours add column if not exists break_start time;
alter table public.business_hours add column if not exists break_end time;
alter table public.business_hours add column if not exists updated_at timestamptz not null default now();

alter table public.business_hours drop constraint if exists business_hours_day_range;
alter table public.business_hours add constraint business_hours_day_range check (day_of_week between 0 and 6);

insert into public.business_hours (day_of_week, is_open, open_time, close_time, break_start, break_end)
select * from (values
  (0, true,  time '10:00', time '17:00', time '12:00', time '12:30'), -- Sunday
  (1, false, null,          null,          null,          null),        -- Monday - closed
  (2, false, null,          null,          null,          null),        -- Tuesday - closed
  (3, true,  time '10:00', time '17:00', time '12:00', time '12:30'), -- Wednesday
  (4, true,  time '10:00', time '17:00', time '12:00', time '12:30'), -- Thursday
  (5, true,  time '10:00', time '17:00', time '12:00', time '12:30'), -- Friday
  (6, true,  time '10:00', time '17:00', time '12:00', time '12:30')  -- Saturday
) as seed(day_of_week, is_open, open_time, close_time, break_start, break_end)
where not exists (select 1 from public.business_hours);

alter table public.business_hours enable row level security;

drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read on public.business_hours
for select to anon, authenticated
using (true);

drop policy if exists business_hours_admin_all on public.business_hours;
create policy business_hours_admin_all on public.business_hours
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.business_hours to anon, authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;

-- ============================================================
-- 2. DEPOSIT-AWARE, SCHEDULE-AWARE PUBLIC BOOKING FUNCTION
-- ============================================================
drop function if exists public.create_hair_artisans_booking(text,text,text,text,bigint,date,time without time zone);
drop function if exists public.create_hair_artisans_booking(text,text,text,text,bigint,date,time without time zone,boolean);

create or replace function public.create_hair_artisans_booking(
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_service_id bigint,
  p_appointment_date date,
  p_start_time time,
  p_pay_full boolean default false
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
  v_day_of_week integer;
  v_hours public.business_hours%rowtype;
  v_deposit numeric(10,2);
  v_balance numeric(10,2);
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

  -- An email is required: Paystack needs it to process the payment.
  if p_email is null then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
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

  -- Look up that day's schedule from business_hours instead of a
  -- hardcoded Mon/Tue-closed, 10:00-17:00 rule.
  v_day_of_week := extract(dow from p_appointment_date)::integer;

  select * into v_hours
  from public.business_hours
  where day_of_week = v_day_of_week;

  if not found or v_hours.is_open is not true or v_hours.open_time is null or v_hours.close_time is null then
    raise exception 'The shop is closed on the selected day.' using errcode = '22023';
  end if;

  if p_start_time < v_hours.open_time or p_start_time >= v_hours.close_time then
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

  if v_end_time > v_hours.close_time then
    raise exception 'That service cannot finish before closing time.' using errcode = '22023';
  end if;

  -- Block the lunch break: the appointment may not overlap it.
  if v_hours.break_start is not null and v_hours.break_end is not null
     and p_start_time < v_hours.break_end and v_end_time > v_hours.break_start
  then
    raise exception 'That time overlaps the lunch break. Please choose another time.' using errcode = '22023';
  end if;

  -- Prevent two customers from taking an overlapping slot at the same time.
  perform pg_advisory_xact_lock(hashtext('hair-artisans-booking-' || p_appointment_date::text));

  if exists (
    select 1
    from public.bookings b
    where b.appointment_date = p_appointment_date
      and (
        lower(b.status::text) = 'confirmed'
        or (
          lower(b.status::text) = 'pending'
          and b.created_at > now() - interval '30 minutes'
        )
      )
      and b.start_time < v_end_time
      and b.end_time > p_start_time
  ) then
    raise exception 'That time is no longer available.' using errcode = '23P01';
  end if;

  -- Work out the deposit: the full price if the client chose to
  -- pay in full, otherwise the 30% minimum deposit.
  if p_pay_full then
    v_deposit := v_service_price;
  else
    v_deposit := round(v_service_price * 0.30, 2);
  end if;

  v_balance := v_service_price - v_deposit;

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

  -- The booking starts life as "pending" with payment_status
  -- "pending". A server-side process (app/api/payments/verify or
  -- app/api/payments/webhook) flips it to "confirmed" /
  -- "deposit_paid" or "paid_full" once Paystack confirms the
  -- charge - never before.
  insert into public.bookings(
    customer_id,
    service_id,
    appointment_date,
    start_time,
    end_time,
    status,
    payment_status,
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
    'pending',
    'pending',
    v_service_price,
    v_deposit,
    v_balance,
    p_notes,
    now(),
    now()
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_hair_artisans_booking(text,text,text,text,bigint,date,time without time zone,boolean) from public;
grant execute on function public.create_hair_artisans_booking(text,text,text,text,bigint,date,time without time zone,boolean) to anon, authenticated;

-- ============================================================
-- 3. AVAILABILITY: IGNORE ABANDONED, UNPAID "PENDING" BOOKINGS
-- ============================================================
-- Once a booking has been pending for more than 30 minutes without
-- being paid, it stops blocking the slot for other customers. Paid
-- ("confirmed") bookings always block the slot.
drop function if exists public.get_booked_times(date);

create or replace function public.get_booked_times(p_appointment_date date)
returns table(start_time time, end_time time)
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select b.start_time, b.end_time
  from public.bookings b
  where b.appointment_date = p_appointment_date
    and (
      lower(b.status::text) = 'confirmed'
      or (
        lower(b.status::text) = 'pending'
        and b.created_at > now() - interval '30 minutes'
      )
    )
  order by b.start_time;
$$;

revoke all on function public.get_booked_times(date) from public;
grant execute on function public.get_booked_times(date) to anon, authenticated;

-- ============================================================
-- 4. ADMIN: RESCHEDULE AN EXISTING BOOKING (edit date/time)
-- ============================================================
-- Only an admin (checked via public.is_admin()) can call this.
-- Recomputes the end time from the service's duration and runs
-- the exact same open-hours / lunch-break / double-booking checks
-- as a brand new booking, so a reschedule can never move a booking
-- to a closed day, outside hours, into the lunch break, or on top
-- of another confirmed/pending booking.
drop function if exists public.admin_reschedule_booking(bigint, date, time without time zone);

create or replace function public.admin_reschedule_booking(
  p_booking_id bigint,
  p_new_date date,
  p_new_start_time time
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_duration integer;
  v_end_time time;
  v_day_of_week integer;
  v_hours public.business_hours%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_new_date is null or p_new_start_time is null then
    raise exception 'Please select a date and time.' using errcode = '22023';
  end if;

  select s.duration_minutes
    into v_duration
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.id = p_booking_id;

  if not found then
    raise exception 'Booking not found.' using errcode = '22023';
  end if;

  v_day_of_week := extract(dow from p_new_date)::integer;

  select * into v_hours
  from public.business_hours
  where day_of_week = v_day_of_week;

  if not found or v_hours.is_open is not true or v_hours.open_time is null or v_hours.close_time is null then
    raise exception 'The shop is closed on the selected day.' using errcode = '22023';
  end if;

  if p_new_start_time < v_hours.open_time or p_new_start_time >= v_hours.close_time then
    raise exception 'The selected time is outside business hours.' using errcode = '22023';
  end if;

  v_end_time := p_new_start_time + make_interval(mins => v_duration);

  if v_end_time > v_hours.close_time then
    raise exception 'That service cannot finish before closing time.' using errcode = '22023';
  end if;

  if v_hours.break_start is not null and v_hours.break_end is not null
     and p_new_start_time < v_hours.break_end and v_end_time > v_hours.break_start
  then
    raise exception 'That time overlaps the lunch break.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('hair-artisans-booking-' || p_new_date::text));

  if exists (
    select 1
    from public.bookings b
    where b.id <> p_booking_id
      and b.appointment_date = p_new_date
      and (
        lower(b.status::text) = 'confirmed'
        or (
          lower(b.status::text) = 'pending'
          and b.created_at > now() - interval '30 minutes'
        )
      )
      and b.start_time < v_end_time
      and b.end_time > p_new_start_time
  ) then
    raise exception 'That time is no longer available.' using errcode = '23P01';
  end if;

  update public.bookings
  set appointment_date = p_new_date,
      start_time = p_new_start_time,
      end_time = v_end_time,
      updated_at = now()
  where id = p_booking_id;
end;
$$;

revoke all on function public.admin_reschedule_booking(bigint, date, time without time zone) from public;
grant execute on function public.admin_reschedule_booking(bigint, date, time without time zone) to authenticated;

-- ============================================================
-- DONE. Reload your site - business hours, deposits, Paystack
-- and rescheduling are now all live.
-- ============================================================
