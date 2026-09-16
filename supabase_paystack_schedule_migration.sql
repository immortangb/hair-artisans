-- Hair Artisans Barbershop: payments, confirmations and editable weekly hours.
-- Run this once in Supabase SQL Editor AFTER supabase_setup.sql.

create table if not exists public.business_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  updated_at timestamptz not null default now(),
  constraint valid_business_hours check (
    (is_closed and open_time is null and close_time is null)
    or (not is_closed and open_time is not null and close_time is not null and open_time < close_time)
  ),
  constraint valid_break check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_start < break_end)
  )
);

-- 0=Sunday through 6=Saturday. Default lunch break is 12:00–12:30.
insert into public.business_hours(day_of_week, is_closed, open_time, close_time, break_start, break_end) values
  (0, false, '10:00', '17:00', '12:00', '12:30'),
  (1, true,  null,    null,    null,    null),
  (2, true,  null,    null,    null,    null),
  (3, false, '10:00', '17:00', '12:00', '12:30'),
  (4, false, '10:00', '17:00', '12:00', '12:30'),
  (5, false, '10:00', '17:00', '12:00', '12:30'),
  (6, false, '10:00', '17:00', '12:00', '12:30')
on conflict (day_of_week) do nothing;

alter table public.bookings add column if not exists payment_expires_at timestamptz;
alter table public.bookings add column if not exists paid_amount numeric(10,2) not null default 0;
alter table public.bookings add column if not exists payment_option text;

-- Keep the existing status type intact. Some installations use a PostgreSQL
-- enum referenced by RLS policies. Unpaid Paystack reservations use the
-- existing `pending` value and expire after 15 minutes.

create index if not exists bookings_payment_reference_idx on public.bookings(payment_reference);

create or replace function public.get_booked_times(p_appointment_date date)
returns table(start_time time, end_time time)
language sql security definer set search_path = public, pg_catalog stable as $$
  select b.start_time, b.end_time from public.bookings b
  where b.appointment_date = p_appointment_date
    and (lower(b.status::text) = 'confirmed'
      or (lower(b.status::text) = 'pending'
          and (b.payment_reference is null or b.payment_expires_at > now())))
  order by b.start_time;
$$;
grant execute on function public.get_booked_times(date) to anon, authenticated;

create or replace function public.create_paystack_booking(
  p_full_name text, p_phone text, p_email text, p_notes text, p_service_id bigint,
  p_appointment_date date, p_start_time time, p_payment_option text, p_payment_reference text
) returns table(booking_id bigint, amount numeric, reference text)
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_customer_id uuid; v_price numeric(10,2); v_duration integer; v_end time;
  v_hours public.business_hours%rowtype; v_amount numeric(10,2); v_booking bigint; v_today date;
begin
  p_full_name := btrim(coalesce(p_full_name, ''));
  p_phone := btrim(coalesce(p_phone, ''));
  p_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  p_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if length(p_full_name) < 2 or length(regexp_replace(p_phone, '[^0-9+]', '', 'g')) < 7 or p_email is null then
    raise exception 'Please provide a name, valid phone number and email address.' using errcode = '22023';
  end if;
  if p_payment_option not in ('deposit', 'full') or p_payment_reference is null or length(p_payment_reference) < 10 then
    raise exception 'Invalid payment details.' using errcode = '22023';
  end if;
  v_today := (now() at time zone 'Africa/Johannesburg')::date;
  if p_appointment_date < v_today or p_appointment_date > v_today + 60 then raise exception 'Please select a date within the booking window.'; end if;
  select * into v_hours from public.business_hours where day_of_week = extract(dow from p_appointment_date);
  if not found or v_hours.is_closed then raise exception 'The shop is closed on the selected day.'; end if;
  select price, duration_minutes into v_price, v_duration from public.services where id=p_service_id and active=true;
  if not found then raise exception 'The selected service is not available.'; end if;
  if extract(minute from p_start_time)::integer % 30 <> 0 or extract(second from p_start_time) <> 0 then raise exception 'Please select a 30-minute slot.'; end if;
  v_end := p_start_time + make_interval(mins => v_duration);
  if p_start_time < v_hours.open_time or v_end > v_hours.close_time then raise exception 'That service falls outside business hours.'; end if;
  if v_hours.break_start is not null and p_start_time < v_hours.break_end and v_end > v_hours.break_start then raise exception 'That service overlaps the lunch break.'; end if;
  perform pg_advisory_xact_lock(hashtext('hair-artisans-booking-' || p_appointment_date::text));
  if exists (select 1 from public.bookings b where b.appointment_date=p_appointment_date and (lower(b.status::text)='confirmed' or (lower(b.status::text)='pending' and (b.payment_reference is null or b.payment_expires_at > now()))) and b.start_time < v_end and b.end_time > p_start_time) then raise exception 'That time is no longer available.' using errcode='23P01'; end if;
  select id into v_customer_id from public.customers where regexp_replace(phone, '[^0-9+]', '', 'g')=regexp_replace(p_phone, '[^0-9+]', '', 'g') order by updated_at desc nulls last limit 1;
  if v_customer_id is null then insert into public.customers(full_name,phone,email) values(p_full_name,p_phone,p_email) returning id into v_customer_id;
  else update public.customers set full_name=p_full_name,phone=p_phone,email=p_email,updated_at=now() where id=v_customer_id; end if;
  v_amount := case when p_payment_option='full' then v_price else round(v_price * 0.30, 2) end;
  insert into public.bookings(customer_id,service_id,appointment_date,start_time,end_time,status,payment_status,service_price,deposit_amount,paid_amount,balance_amount,payment_reference,payment_option,payment_expires_at,notes)
  values(v_customer_id,p_service_id,p_appointment_date,p_start_time,v_end,'pending','pending',v_price,v_amount,0,v_price,p_payment_reference,p_payment_option,now()+interval '15 minutes',p_notes) returning id into v_booking;
  return query select v_booking,v_amount,p_payment_reference;
end; $$;
revoke all on function public.create_paystack_booking(text,text,text,text,bigint,date,time,text,text) from public;
grant execute on function public.create_paystack_booking(text,text,text,text,bigint,date,time,text,text) to service_role;

create or replace function public.confirm_paystack_booking(p_payment_reference text, p_paid_amount numeric)
returns table(booking_id bigint, customer_name text, customer_email text, service_name text, appointment_date date, start_time time, paid_amount numeric, balance_amount numeric, payment_status text, confirmation_sent boolean)
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where payment_reference=p_payment_reference for update;
  if not found then raise exception 'Booking not found.'; end if;
  if v_booking.status='confirmed' then null;
  elsif v_booking.status::text='pending' and v_booking.payment_expires_at > now() and p_paid_amount >= v_booking.deposit_amount then
    update public.bookings set status='confirmed', payment_status='paid', paid_amount=p_paid_amount, balance_amount=greatest(service_price-p_paid_amount,0), updated_at=now() where id=v_booking.id returning * into v_booking;
  else raise exception 'This payment can no longer confirm the booking.'; end if;
  return query select v_booking.id,c.full_name,c.email,s.name,v_booking.appointment_date,v_booking.start_time,v_booking.paid_amount,v_booking.balance_amount,v_booking.payment_status,v_booking.confirmation_sent from public.customers c join public.services s on s.id=v_booking.service_id where c.id=v_booking.customer_id;
end; $$;
revoke all on function public.confirm_paystack_booking(text,numeric) from public;
grant execute on function public.confirm_paystack_booking(text,numeric) to service_role;

create or replace function public.mark_booking_confirmation_sent(p_booking_id bigint) returns void language sql security definer set search_path=public,pg_catalog as $$ update public.bookings set confirmation_sent=true, updated_at=now() where id=p_booking_id; $$;
revoke all on function public.mark_booking_confirmation_sent(bigint) from public;
grant execute on function public.mark_booking_confirmation_sent(bigint) to service_role;

alter table public.business_hours enable row level security;
create policy business_hours_public_read on public.business_hours for select to anon, authenticated using (true);
create policy business_hours_admin_all on public.business_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.business_hours to anon, authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
