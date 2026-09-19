-- Hair-Artisans Barbershop final booking/payment/status upgrade
-- Run after the existing Supabase setup scripts. Safe for existing bookings.

-- South African local schedule is represented by date/time columns; application/server
-- logic consistently uses Africa/Johannesburg. Lunch below means 12:00-12:30 (noon),
-- not midnight.

alter table public.bookings add column if not exists confirmation_number text;

-- Give existing bookings a stable confirmation number.
update public.bookings
set confirmation_number = 'HAB-' || to_char(coalesce(created_at, now()) at time zone 'Africa/Johannesburg', 'YYYYMMDD') || '-' || lpad(id::text, 6, '0')
where confirmation_number is null or btrim(confirmation_number) = '';

create unique index if not exists bookings_confirmation_number_uidx
on public.bookings(confirmation_number);

-- Ensure the schedule uses the current column names and South African default hours.
alter table public.business_hours add column if not exists is_open boolean not null default true;
alter table public.business_hours add column if not exists open_time time;
alter table public.business_hours add column if not exists close_time time;
alter table public.business_hours add column if not exists break_start time;
alter table public.business_hours add column if not exists break_end time;

insert into public.business_hours(day_of_week, is_open, open_time, close_time, break_start, break_end)
select * from (values
  (0, true,  time '10:00', time '17:00', time '12:00', time '12:30'),
  (1, false, null, null, null, null),
  (2, false, null, null, null, null),
  (3, true,  time '10:00', time '17:00', time '12:00', time '12:30'),
  (4, true,  time '10:00', time '17:00', time '12:00', time '12:30'),
  (5, true,  time '10:00', time '17:00', time '12:00', time '12:30'),
  (6, true,  time '10:00', time '17:00', time '12:00', time '12:30')
) as seed(day_of_week,is_open,open_time,close_time,break_start,break_end)
where not exists (select 1 from public.business_hours);

-- Set the requested lunch break for existing open days only when no
-- lunch break has already been configured by the shop owner.
update public.business_hours
set break_start = time '12:00', break_end = time '12:30'
where is_open = true and (break_start is null or break_end is null);

-- Correct any old migration's is_closed column if it exists by copying it once.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='business_hours' and column_name='is_closed') then
    execute 'update public.business_hours set is_open = not is_closed where is_closed is not null';
  end if;
end $$;

-- Rebuild booking function so every new booking gets a confirmation number.
create or replace function public.create_hair_artisans_booking(
  p_full_name text, p_phone text, p_email text, p_notes text,
  p_service_id bigint, p_appointment_date date, p_start_time time, p_pay_full boolean default false
) returns bigint
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_customer_id uuid; v_service_price numeric(10,2); v_duration integer; v_end_time time;
  v_booking_id bigint; v_today date; v_day integer; v_hours public.business_hours%rowtype;
  v_paid numeric(10,2); v_balance numeric(10,2);
begin
  p_full_name := btrim(coalesce(p_full_name,'')); p_phone := btrim(coalesce(p_phone,''));
  p_email := nullif(btrim(coalesce(p_email,'')),''); p_notes := nullif(btrim(coalesce(p_notes,'')),'');
  if length(p_full_name) < 2 then raise exception 'Please enter your full name.' using errcode='22023'; end if;
  if length(regexp_replace(p_phone,'[^0-9+]','','g')) < 7 then raise exception 'Please enter a valid phone number.' using errcode='22023'; end if;
  if p_email is null then raise exception 'Please enter a valid email address.' using errcode='22023'; end if;
  v_today := (now() at time zone 'Africa/Johannesburg')::date;
  if p_appointment_date < v_today then raise exception 'The selected date has already passed.' using errcode='22023'; end if;
  if p_appointment_date > v_today + 60 then raise exception 'The selected date is outside the booking window.' using errcode='22023'; end if;
  v_day := extract(dow from p_appointment_date)::integer;
  select * into v_hours from public.business_hours where day_of_week=v_day;
  if not found or not v_hours.is_open or v_hours.open_time is null or v_hours.close_time is null then raise exception 'The shop is closed on the selected day.' using errcode='22023'; end if;
  if p_start_time < v_hours.open_time or p_start_time >= v_hours.close_time then raise exception 'The selected time is outside business hours.' using errcode='22023'; end if;
  if extract(minute from p_start_time)::integer % 30 <> 0 or extract(second from p_start_time) <> 0 then raise exception 'Please select a 30-minute booking slot.' using errcode='22023'; end if;
  select s.price,s.duration_minutes into v_service_price,v_duration from public.services s where s.id=p_service_id and s.active=true;
  if not found then raise exception 'The selected service is not available.' using errcode='22023'; end if;
  v_end_time := p_start_time + make_interval(mins=>v_duration);
  if v_end_time > v_hours.close_time then raise exception 'That service cannot finish before closing time.' using errcode='22023'; end if;
  if v_hours.break_start is not null and v_hours.break_end is not null and p_start_time < v_hours.break_end and v_end_time > v_hours.break_start then raise exception 'That time overlaps the lunch break. Please choose another time.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext('hair-artisans-booking-'||p_appointment_date::text));
  if exists (select 1 from public.bookings b where b.appointment_date=p_appointment_date and (lower(b.status)='confirmed' or (lower(b.status)='pending' and b.created_at > now()-interval '30 minutes')) and b.start_time < v_end_time and b.end_time > p_start_time) then raise exception 'That time is no longer available.' using errcode='23P01'; end if;
  if p_pay_full then v_paid := v_service_price; else v_paid := round(v_service_price*0.30,2); end if;
  v_balance := v_service_price-v_paid;
  select c.id into v_customer_id from public.customers c where regexp_replace(c.phone,'[^0-9+]','','g')=regexp_replace(p_phone,'[^0-9+]','','g') order by c.updated_at desc nulls last limit 1;
  if v_customer_id is null then insert into public.customers(full_name,phone,email) values(p_full_name,p_phone,p_email) returning id into v_customer_id;
  else update public.customers set full_name=p_full_name,phone=p_phone,email=p_email,updated_at=now() where id=v_customer_id; end if;
  insert into public.bookings(customer_id,service_id,appointment_date,start_time,end_time,status,payment_status,service_price,deposit_amount,balance_amount,notes)
  values(v_customer_id,p_service_id,p_appointment_date,p_start_time,v_end_time,'pending','pending',v_service_price,v_paid,v_balance,p_notes) returning id into v_booking_id;
  update public.bookings set confirmation_number='HAB-'||to_char((now() at time zone 'Africa/Johannesburg')::date,'YYYYMMDD')||'-'||lpad(v_booking_id::text,6,'0') where id=v_booking_id;
  return v_booking_id;
end; $$;

grant execute on function public.create_hair_artisans_booking(text,text,text,text,bigint,date,time,boolean) to anon, authenticated;
