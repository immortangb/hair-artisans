-- DEPRECATED COMPATIBILITY MIGRATION
-- Use supabase_hair_artisans_final_upgrade.sql for the complete current setup.
-- This file is kept so older instructions do not accidentally recreate the
-- previous `is_closed` schedule schema.

create table if not exists public.business_hours (day_of_week integer primary key);
alter table public.business_hours add column if not exists is_open boolean not null default true;
alter table public.business_hours add column if not exists open_time time;
alter table public.business_hours add column if not exists close_time time;
alter table public.business_hours add column if not exists break_start time;
alter table public.business_hours add column if not exists break_end time;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='business_hours' and column_name='is_closed') then
    execute 'update public.business_hours set is_open = not is_closed where is_closed is not null';
  end if;
end $$;

insert into public.business_hours(day_of_week,is_open,open_time,close_time,break_start,break_end)
select * from (values
  (0,true,time '10:00',time '17:00',time '12:00',time '12:30'),
  (1,false,null,null,null,null),
  (2,false,null,null,null,null),
  (3,true,time '10:00',time '17:00',time '12:00',time '12:30'),
  (4,true,time '10:00',time '17:00',time '12:00',time '12:30'),
  (5,true,time '10:00',time '17:00',time '12:00',time '12:30'),
  (6,true,time '10:00',time '17:00',time '12:00',time '12:30')
) seed(day_of_week,is_open,open_time,close_time,break_start,break_end)
where not exists (select 1 from public.business_hours);

update public.business_hours
set break_start=time '12:00', break_end=time '12:30'
where is_open=true and (break_start is null or break_end is null);
