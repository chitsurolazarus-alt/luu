-- =====================================================================
-- LUU TRAVELS & LOGISTICS - DATABASE SCHEMA
-- Run this entire file in the Supabase SQL Editor (Project > SQL Editor)
-- =====================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =====================================================================
-- TABLES
-- =====================================================================

create table if not exists users (
    id uuid primary key references auth.users(id) on delete cascade,
    email varchar(255) unique not null,
    full_name varchar(255) not null,
    phone varchar(20) not null,
    role varchar(20) default 'customer' check (role in ('customer', 'driver', 'admin')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists drivers (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references users(id) on delete cascade,
    full_name varchar(255) not null,
    email varchar(255) unique not null,
    phone varchar(20) not null,
    license_number varchar(50) not null,
    prdp_number varchar(50),
    vehicle_registration varchar(50) not null,
    vehicle_model varchar(100) not null,
    vehicle_color varchar(50) not null,
    vehicle_capacity integer default 14,
    is_approved boolean default false,
    is_active boolean default true,
    current_location jsonb,
    rating decimal(3,2) default 0,
    total_trips integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists trips (
    id uuid default gen_random_uuid() primary key,
    driver_id uuid references drivers(id) on delete set null,
    route varchar(50) not null check (route in ('Gauteng-Limpopo', 'Limpopo-Gauteng')),
    pickup_location text not null,
    dropoff_location text not null,
    pickup_coordinates jsonb,
    dropoff_coordinates jsonb,
    distance decimal(10,2),
    base_price decimal(10,2),
    price_per_km decimal(10,2) default 2.50,
    total_price decimal(10,2),
    departure_time timestamp with time zone not null,
    estimated_arrival timestamp with time zone,
    available_seats integer default 14,
    booked_seats integer default 0,
    status varchar(20) default 'scheduled' check (status in ('scheduled', 'in-progress', 'completed', 'cancelled')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists bookings (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references users(id) on delete cascade,
    trip_id uuid references trips(id) on delete cascade,
    number_of_seats integer not null check (number_of_seats > 0),
    total_price decimal(10,2) not null,
    payment_method varchar(20) not null check (payment_method in ('cash', 'card')),
    payment_status varchar(20) default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
    booking_status varchar(20) default 'pending' check (booking_status in ('pending', 'confirmed', 'completed', 'cancelled')),
    pickup_location text not null,
    dropoff_location text not null,
    pickup_coordinates jsonb,
    dropoff_coordinates jsonb,
    special_requests text,
    booking_reference varchar(20) unique,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists ads (
    id uuid default gen_random_uuid() primary key,
    title varchar(255) not null,
    content text not null,
    image_url varchar(500),
    is_active boolean default true,
    display_order integer default 0,
    created_at timestamp with time zone default now(),
    expires_at timestamp with time zone,
    updated_at timestamp with time zone default now()
);

create table if not exists time_slots (
    id uuid default gen_random_uuid() primary key,
    route varchar(50) not null check (route in ('Gauteng-Limpopo', 'Limpopo-Gauteng')),
    departure_time time not null,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists driver_assignments (
    id uuid default gen_random_uuid() primary key,
    trip_id uuid references trips(id) on delete cascade,
    driver_id uuid references drivers(id) on delete cascade,
    assigned_by uuid references users(id),
    assigned_at timestamp with time zone default now(),
    notes text,
    unique(trip_id, driver_id)
);

create table if not exists invoices (
    id uuid default gen_random_uuid() primary key,
    booking_id uuid references bookings(id) on delete cascade,
    invoice_number varchar(20) unique not null,
    amount decimal(10,2) not null,
    tax_amount decimal(10,2) default 0,
    total_amount decimal(10,2) not null,
    status varchar(20) default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists tracking_history (
    id uuid default gen_random_uuid() primary key,
    driver_id uuid references drivers(id) on delete cascade,
    trip_id uuid references trips(id) on delete cascade,
    latitude decimal(10,7) not null,
    longitude decimal(10,7) not null,
    speed decimal(5,2),
    heading decimal(5,2),
    recorded_at timestamp with time zone default now()
);

-- =====================================================================
-- INDEXES
-- =====================================================================
create index if not exists idx_trips_route on trips(route);
create index if not exists idx_trips_departure on trips(departure_time);
create index if not exists idx_bookings_user on bookings(user_id);
create index if not exists idx_bookings_trip on bookings(trip_id);
create index if not exists idx_tracking_driver on tracking_history(driver_id, recorded_at desc);

-- =====================================================================
-- HELPER: BOOKING REFERENCE GENERATOR (format LUU-YYMMDD-XXXX)
-- =====================================================================
create or replace function generate_booking_reference()
returns text as $$
declare
    ref text;
begin
    ref := 'LUU-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');
    return ref;
end;
$$ language plpgsql;

create or replace function set_booking_reference()
returns trigger as $$
begin
    if new.booking_reference is null then
        new.booking_reference := generate_booking_reference();
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_booking_reference on bookings;
create trigger trg_set_booking_reference
before insert on bookings
for each row execute function set_booking_reference();

-- Keep booked_seats / available_seats in sync when a booking is made/cancelled
create or replace function adjust_trip_seats()
returns trigger as $$
begin
    if (tg_op = 'INSERT') then
        update trips
        set booked_seats = booked_seats + new.number_of_seats,
            available_seats = available_seats - new.number_of_seats
        where id = new.trip_id;
    elsif (tg_op = 'UPDATE') then
        if new.booking_status = 'cancelled' and old.booking_status <> 'cancelled' then
            update trips
            set booked_seats = booked_seats - old.number_of_seats,
                available_seats = available_seats + old.number_of_seats
            where id = old.trip_id;
        end if;
    elsif (tg_op = 'DELETE') then
        update trips
        set booked_seats = booked_seats - old.number_of_seats,
            available_seats = available_seats + old.number_of_seats
        where id = old.trip_id;
    end if;
    return null;
end;
$$ language plpgsql;

drop trigger if exists trg_adjust_trip_seats on bookings;
create trigger trg_adjust_trip_seats
after insert or update or delete on bookings
for each row execute function adjust_trip_seats();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table users enable row level security;
alter table drivers enable row level security;
alter table trips enable row level security;
alter table bookings enable row level security;
alter table ads enable row level security;
alter table time_slots enable row level security;
alter table driver_assignments enable row level security;
alter table invoices enable row level security;
alter table tracking_history enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean as $$
    select exists (
        select 1 from users where id = auth.uid() and role = 'admin'
    );
$$ language sql security definer;

-- USERS: a person can read/update their own row; admins can read/manage all
create policy "Users can view own profile" on users for select using (auth.uid() = id or is_admin());
create policy "Users can update own profile" on users for update using (auth.uid() = id or is_admin());
create policy "Users can insert own profile" on users for insert with check (auth.uid() = id);
create policy "Admins can delete users" on users for delete using (is_admin());

-- DRIVERS: public read of approved+active drivers (for trip display), admin full control
create policy "Anyone can view approved drivers" on drivers for select using (is_approved = true or is_admin());
create policy "Admins manage drivers" on drivers for insert with check (is_admin());
create policy "Admins update drivers" on drivers for update using (is_admin());
create policy "Admins delete drivers" on drivers for delete using (is_admin());

-- TRIPS: anyone (incl. anonymous) can view scheduled trips; only admins manage
create policy "Anyone can view trips" on trips for select using (true);
create policy "Admins insert trips" on trips for insert with check (is_admin());
create policy "Admins update trips" on trips for update using (is_admin());
create policy "Admins delete trips" on trips for delete using (is_admin());

-- BOOKINGS: users see their own, admins see all
create policy "Users view own bookings" on bookings for select using (auth.uid() = user_id or is_admin());
create policy "Users create own bookings" on bookings for insert with check (auth.uid() = user_id);
create policy "Users update own bookings" on bookings for update using (auth.uid() = user_id or is_admin());
create policy "Admins delete bookings" on bookings for delete using (is_admin());

-- ADS: anyone can view active ads, only admins manage
create policy "Anyone can view active ads" on ads for select using (is_active = true or is_admin());
create policy "Admins insert ads" on ads for insert with check (is_admin());
create policy "Admins update ads" on ads for update using (is_admin());
create policy "Admins delete ads" on ads for delete using (is_admin());

-- TIME SLOTS: anyone can view active slots, only admins manage
create policy "Anyone can view active time slots" on time_slots for select using (is_active = true or is_admin());
create policy "Admins insert time slots" on time_slots for insert with check (is_admin());
create policy "Admins update time slots" on time_slots for update using (is_admin());
create policy "Admins delete time slots" on time_slots for delete using (is_admin());

-- DRIVER ASSIGNMENTS: admin only
create policy "Admins manage assignments" on driver_assignments for all using (is_admin()) with check (is_admin());

-- INVOICES: owner of booking + admin
create policy "Users view own invoices" on invoices for select using (
    is_admin() or exists (select 1 from bookings b where b.id = booking_id and b.user_id = auth.uid())
);
create policy "Admins manage invoices" on invoices for insert with check (is_admin());
create policy "Admins update invoices" on invoices for update using (is_admin());
create policy "Admins delete invoices" on invoices for delete using (is_admin());

-- TRACKING HISTORY: anyone can view (needed for customer live tracking), admins/drivers write
create policy "Anyone can view tracking" on tracking_history for select using (true);
create policy "Admins insert tracking" on tracking_history for insert with check (is_admin());

-- =====================================================================
-- SEED DATA: default time slots (admin can edit later)
-- =====================================================================
insert into time_slots (route, departure_time) values
    ('Gauteng-Limpopo', '06:00'),
    ('Gauteng-Limpopo', '10:00'),
    ('Gauteng-Limpopo', '14:00'),
    ('Gauteng-Limpopo', '18:00'),
    ('Limpopo-Gauteng', '06:00'),
    ('Limpopo-Gauteng', '10:00'),
    ('Limpopo-Gauteng', '14:00'),
    ('Limpopo-Gauteng', '18:00')
on conflict do nothing;

-- =====================================================================
-- NOTE ON ADMIN ACCOUNT
-- Supabase Auth users must be created via the Auth API/Dashboard (Authentication > Users),
-- not by inserting directly into auth.users. After creating the admin auth user with
-- email princemahapa20@gmail.com, run the statement below (replace <ADMIN_AUTH_UID> with
-- the UUID shown in the Auth dashboard) to grant admin role:
--
-- insert into users (id, email, full_name, phone, role)
-- values ('<ADMIN_AUTH_UID>', 'princemahapa20@gmail.com', 'Prince Mahapa', '0000000000', 'admin')
-- on conflict (id) do update set role = 'admin';
-- =====================================================================
