-- ============================================================
-- LUU TRAVELS & LOGISTICS - SUPABASE DATABASE SCHEMA
-- ============================================================
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. ENABLE EXTENSIONS
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. USERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    passport_number VARCHAR(50),
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'driver', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Stores user profile information';
COMMENT ON COLUMN users.id_number IS 'South African ID number (13 digits)';
COMMENT ON COLUMN users.passport_number IS 'Passport number for international clients (optional)';

-- ============================================================
-- 3. DRIVERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    prdp_number VARCHAR(50),
    vehicle_registration VARCHAR(50) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    vehicle_color VARCHAR(50) NOT NULL,
    vehicle_capacity INTEGER DEFAULT 14,
    is_approved BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    current_location JSONB,
    rating DECIMAL(3,2) DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE drivers IS 'Stores driver and vehicle information';
COMMENT ON COLUMN drivers.prdp_number IS 'Professional Driving Permit number';
COMMENT ON COLUMN drivers.current_location IS 'Current GPS coordinates as JSON {lat, lng, updated_at}';
COMMENT ON COLUMN drivers.rating IS 'Driver rating from 0 to 5';

-- ============================================================
-- 4. TRIPS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    route VARCHAR(50) NOT NULL CHECK (route IN ('Gauteng-Limpopo', 'Limpopo-Gauteng')),
    pickup_location TEXT NOT NULL,
    dropoff_location TEXT NOT NULL,
    pickup_coordinates JSONB,
    dropoff_coordinates JSONB,
    distance DECIMAL(10,2),
    base_price DECIMAL(10,2),
    price_per_km DECIMAL(10,2) DEFAULT 2.50,
    total_price DECIMAL(10,2),
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    available_seats INTEGER DEFAULT 14,
    booked_seats INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE trips IS 'Stores trip information and schedules';
COMMENT ON COLUMN trips.route IS 'Route direction: Gauteng to Limpopo or Limpopo to Gauteng';
COMMENT ON COLUMN trips.pickup_coordinates IS 'Pickup GPS coordinates as JSON {lat, lng}';
COMMENT ON COLUMN trips.dropoff_coordinates IS 'Dropoff GPS coordinates as JSON {lat, lng}';
COMMENT ON COLUMN trips.distance IS 'Distance in kilometers';
COMMENT ON COLUMN trips.total_price IS 'Total price calculated as distance * price_per_km';

-- ============================================================
-- 5. BOOKINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    number_of_seats INTEGER NOT NULL CHECK (number_of_seats > 0),
    total_price DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
    booking_status VARCHAR(20) DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    pickup_location TEXT NOT NULL,
    dropoff_location TEXT NOT NULL,
    pickup_coordinates JSONB,
    dropoff_coordinates JSONB,
    special_requests TEXT,
    booking_reference VARCHAR(20) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE bookings IS 'Stores all customer bookings';
COMMENT ON COLUMN bookings.booking_reference IS 'Unique booking reference for tracking';

-- ============================================================
-- 6. ADS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE ads IS 'Stores advertisements displayed on the website';

-- ============================================================
-- 7. TIME SLOTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS time_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route VARCHAR(50) NOT NULL CHECK (route IN ('Gauteng-Limpopo', 'Limpopo-Gauteng')),
    departure_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE time_slots IS 'Stores available departure time slots for each route';

-- ============================================================
-- 8. DRIVER ASSIGNMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    UNIQUE(trip_id, driver_id)
);

COMMENT ON TABLE driver_assignments IS 'Tracks driver assignments to trips';

-- ============================================================
-- 9. INVOICES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE invoices IS 'Stores invoice information for bookings';

-- ============================================================
-- 10. TRACKING HISTORY TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS tracking_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    speed DECIMAL(5,2),
    heading DECIMAL(5,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE tracking_history IS 'Historical tracking data for drivers';

-- ============================================================
-- 11. CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Drivers indexes
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers(email);
CREATE INDEX IF NOT EXISTS idx_drivers_is_approved ON drivers(is_approved);
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON drivers(is_active);
CREATE INDEX IF NOT EXISTS idx_drivers_created_at ON drivers(created_at);

-- Trips indexes
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_departure_time ON trips(departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);

-- Ads indexes
CREATE INDEX IF NOT EXISTS idx_ads_is_active ON ads(is_active);
CREATE INDEX IF NOT EXISTS idx_ads_display_order ON ads(display_order);
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON ads(created_at);

-- Time slots indexes
CREATE INDEX IF NOT EXISTS idx_time_slots_route ON time_slots(route);
CREATE INDEX IF NOT EXISTS idx_time_slots_is_active ON time_slots(is_active);

-- Driver assignments indexes
CREATE INDEX IF NOT EXISTS idx_driver_assignments_trip_id ON driver_assignments(trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver_id ON driver_assignments(driver_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Tracking history indexes
CREATE INDEX IF NOT EXISTS idx_tracking_driver_id ON tracking_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_tracking_trip_id ON tracking_history(trip_id);
CREATE INDEX IF NOT EXISTS idx_tracking_recorded_at ON tracking_history(recorded_at);

-- ============================================================
-- 12. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_slots_updated_at BEFORE UPDATE ON time_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 13. GENERATE BOOKING REFERENCE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TRIGGER AS $$
DECLARE
    ref TEXT;
    done BOOLEAN;
BEGIN
    done := FALSE;
    WHILE NOT done LOOP
        ref := 'LUU-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
               LPAD(CAST(FLOOR(RANDOM() * 10000) AS TEXT), 4, '0');
        BEGIN
            PERFORM 1 FROM bookings WHERE booking_reference = ref;
            IF NOT FOUND THEN
                NEW.booking_reference := ref;
                done := TRUE;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                done := FALSE;
        END;
    END LOOP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_booking_reference_trigger
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION generate_booking_reference();

-- ============================================================
-- 14. INSERT DEFAULT DATA
-- ============================================================

-- Insert default time slots
INSERT INTO time_slots (route, departure_time) VALUES
('Gauteng-Limpopo', '06:00'),
('Gauteng-Limpopo', '08:00'),
('Gauteng-Limpopo', '10:00'),
('Gauteng-Limpopo', '12:00'),
('Gauteng-Limpopo', '14:00'),
('Gauteng-Limpopo', '16:00'),
('Gauteng-Limpopo', '18:00'),
('Gauteng-Limpopo', '20:00'),
('Limpopo-Gauteng', '06:00'),
('Limpopo-Gauteng', '08:00'),
('Limpopo-Gauteng', '10:00'),
('Limpopo-Gauteng', '12:00'),
('Limpopo-Gauteng', '14:00'),
('Limpopo-Gauteng', '16:00'),
('Limpopo-Gauteng', '18:00');

-- Insert default ads
INSERT INTO ads (title, content, is_active, display_order) VALUES
('Welcome to Luu Travels', 'Book your shuttle between Gauteng and Limpopo with ease. Safe, reliable, and affordable!', TRUE, 1),
('Special Offer', 'Book 5 trips and get 10% off your 6th trip. T&C apply.', TRUE, 2),
('Corporate Discount', 'Corporate clients enjoy special rates on bulk bookings. Contact us for details.', TRUE, 3);

-- ============================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_history ENABLE ROW LEVEL SECURITY;

-- USERS POLICIES
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admin can view all users"
    ON users FOR ALL
    USING (auth.jwt() ->> 'email' = 'princemahapa20@gmail.com');

-- DRIVERS POLICIES
CREATE POLICY "Everyone can view approved drivers"
    ON drivers FOR SELECT
    USING (is_approved = TRUE);

CREATE POLICY "Admin can manage drivers"
    ON drivers FOR ALL
    USING (auth.jwt() ->> 'email' = 'princemahapa20@gmail.com');

CREATE POLICY "Drivers can view and update their own profile"
    ON drivers FOR ALL
    USING (auth.uid() = user_id);

-- TRIPS POLICIES
CREATE POLICY "Everyone can view active trips"
    ON trips FOR SELECT
    USING (status IN ('scheduled', 'in-progress'));

CREATE POLICY "Admin can manage trips"
    ON trips FOR ALL
    USING (auth.jwt() ->> 'email' = 'princemahapa20@gmail.com');

-- BOOKINGS POLICIES
CREATE POLICY "Users can view their own bookings"
    ON bookings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings"
    ON bookings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage all bookings"
    ON bookings FOR ALL
    USING (auth.jwt() ->> 'email' = 'princemahapa20@gmail.com');

-- ADS POLICIES
CREATE POLICY "Everyone can view active ads"
    ON ads FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Admin can manage ads"
    ON ads FOR ALL
    USING (auth.jwt() ->> 'email' = 'princemahapa20@gmail.com');

-- TIME SLOTS POLICIES
CREATE POLICY "Everyone can view time slots"
    ON time_slots FOR SELECT
    USING (TRUE);

CREATE POLICY "Admin can manage time slots"
    ON time_slots FOR ALL
    USING (auth.jwt() ->> 'email' = 'princemahapa20@gmail.com');

-- ============================================================
-- 16. CREATE ADMIN USER (Optional - Run if needed)
-- ============================================================

-- Note: This creates a user record for the admin.
-- The auth user must be created separately through the auth system.
INSERT INTO users (id, email, full_name, phone, id_number, role)
VALUES (
    gen_random_uuid(),
    'princemahapa20@gmail.com',
    'Mokhontedi Prince Mahapa',
    '0768457061',
    '0000000000000',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 17. HELPER FUNCTIONS
-- ============================================================

-- Function to calculate distance between two coordinates
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL,
    lng1 DECIMAL,
    lat2 DECIMAL,
    lng2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 6371;
    dlat DECIMAL;
    dlng DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dlat := RADIANS(lat2 - lat1);
    dlng := RADIANS(lng2 - lng1);
    a := SIN(dlat/2) * SIN(dlat/2) + 
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
         SIN(dlng/2) * SIN(dlng/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql;

-- Function to get available seats for a trip
CREATE OR REPLACE FUNCTION get_available_seats(trip_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_seats INTEGER;
    booked_seats INTEGER;
BEGIN
    SELECT available_seats INTO total_seats FROM trips WHERE id = trip_id;
    SELECT COALESCE(SUM(number_of_seats), 0) INTO booked_seats 
    FROM bookings 
    WHERE trip_id = trip_id AND booking_status NOT IN ('cancelled');
    RETURN total_seats - booked_seats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 18. VIEWS FOR COMMON QUERIES
-- ============================================================

-- View for active trips with driver details
CREATE OR REPLACE VIEW active_trips_view AS
SELECT 
    t.id,
    t.route,
    t.pickup_location,
    t.dropoff_location,
    t.departure_time,
    t.available_seats,
    t.status,
    t.total_price,
    d.full_name AS driver_name,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_registration,
    d.rating AS driver_rating,
    (t.available_seats - COALESCE(b.booked_seats, 0)) AS seats_available
FROM trips t
LEFT JOIN drivers d ON t.driver_id = d.id
LEFT JOIN (
    SELECT trip_id, SUM(number_of_seats) AS booked_seats
    FROM bookings
    WHERE booking_status NOT IN ('cancelled')
    GROUP BY trip_id
) b ON t.id = b.trip_id
WHERE t.status = 'scheduled' AND t.departure_time > NOW();

-- View for customer bookings with details
CREATE OR REPLACE VIEW customer_bookings_view AS
SELECT 
    b.id,
    b.booking_reference,
    b.number_of_seats,
    b.total_price,
    b.booking_status,
    b.payment_method,
    b.pickup_location,
    b.dropoff_location,
    b.created_at,
    t.route,
    t.departure_time,
    t.pickup_location AS trip_pickup,
    t.dropoff_location AS trip_dropoff,
    d.full_name AS driver_name,
    d.vehicle_model,
    d.vehicle_color,
    u.full_name AS customer_name,
    u.email AS customer_email,
    u.phone AS customer_phone
FROM bookings b
JOIN users u ON b.user_id = u.id
LEFT JOIN trips t ON b.trip_id = t.id
LEFT JOIN drivers d ON t.driver_id = d.id
ORDER BY b.created_at DESC;

-- ============================================================
-- 19. VERIFICATION QUERIES
-- ============================================================

-- Check if all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if all functions were created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- Check if all triggers were created
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- ============================================================
-- 20. CLEANUP (Optional - Uncomment if needed)
-- ============================================================

-- DROP TABLE IF EXISTS tracking_history CASCADE;
-- DROP TABLE IF EXISTS invoices CASCADE;
-- DROP TABLE IF EXISTS driver_assignments CASCADE;
-- DROP TABLE IF EXISTS time_slots CASCADE;
-- DROP TABLE IF EXISTS ads CASCADE;
-- DROP TABLE IF EXISTS bookings CASCADE;
-- DROP TABLE IF EXISTS trips CASCADE;
-- DROP TABLE IF EXISTS drivers CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
-- DROP FUNCTION IF EXISTS generate_booking_reference() CASCADE;
-- DROP FUNCTION IF EXISTS calculate_distance(dec, dec, dec, dec) CASCADE;
-- DROP FUNCTION IF EXISTS get_available_seats(uuid) CASCADE;

-- DROP VIEW IF EXISTS active_trips_view CASCADE;
-- DROP VIEW IF EXISTS customer_bookings_view CASCADE;

-- ============================================================
-- END OF SCHEMA
-- ============================================================