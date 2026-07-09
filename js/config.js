/**
 * Luu Travels & Logistics - Configuration File
 * Contains all environment variables, API keys, and constants
 */

// ===== SUPABASE CONFIGURATION =====
const SUPABASE_CONFIG = {
    url: 'https://gwzpzvwermsfnputttdo.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3enB6dndlcm1zZm5wdXR0dGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzkxODYsImV4cCI6MjA5Nzk1NTE4Nn0.y4v8P0TxS4yfjj9DfWF_l1B8OBSl_ybv4vZBuVUN7Oc'
};

// ===== ADMIN CREDENTIALS =====
const ADMIN_CREDENTIALS = {
    email: 'princemahapa20@gmail.com',
    password: 'Prince@2001'
};

// ===== PRICING CONFIGURATION =====
const RATE_PER_KM = 2.50;
const MAX_SEATS_PER_TRIP = 14;
const MIN_BOOKING_SEATS = 1;

// ===== ROUTE CONFIGURATION =====
const ROUTES = {
    'Gauteng-Limpopo': {
        display: 'Gauteng → Limpopo',
        origin: 'Gauteng',
        destination: 'Limpopo'
    },
    'Limpopo-Gauteng': {
        display: 'Limpopo → Gauteng',
        origin: 'Limpopo',
        destination: 'Gauteng'
    }
};

// ===== PAYMENT CONFIGURATION =====
const PAYMENT_METHODS = {
    CASH: 'cash',
    CARD: 'card'
};

// ===== BOOKING STATUS =====
const BOOKING_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// ===== TRIP STATUS =====
const TRIP_STATUS = {
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// ===== DRIVER STATUS =====
const DRIVER_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};

// ===== MAP CONFIGURATION =====
const MAP_CONFIG = {
    defaultCenter: [-26.2041, 28.0473], // Gauteng center
    defaultZoom: 7,
    maxZoom: 18,
    minZoom: 5,
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttribution: '© OpenStreetMap contributors'
};

// ===== SOUTH AFRICA BOUNDS =====
const SA_BOUNDS = {
    north: -22.0,
    south: -35.0,
    west: 16.0,
    east: 33.0
};

// ===== GAUTENG BOUNDS =====
const GAUTENG_BOUNDS = {
    north: -25.0,
    south: -27.0,
    west: 27.0,
    east: 29.0
};

// ===== LIMPOPO BOUNDS =====
const LIMPOPO_BOUNDS = {
    north: -22.0,
    south: -25.0,
    west: 27.0,
    east: 31.0
};

// ===== NOTIFICATION CONFIGURATION =====
const NOTIFICATION_DURATION = 5000; // milliseconds
const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning'
};

// ===== DATE FORMATS =====
const DATE_FORMATS = {
    DISPLAY: 'DD/MM/YYYY HH:mm',
    DATABASE: 'YYYY-MM-DDTHH:mm:ss',
    TIME: 'HH:mm',
    DATE: 'DD/MM/YYYY'
};

// ===== VALIDATION RULES =====
const VALIDATION = {
    phoneRegex: /^[0-9]{10}$/,
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    idRegex: /^[0-9]{13}$/,
    passportRegex: /^[A-Z0-9]{6,9}$/,
    licenseRegex: /^[A-Z0-9]{6,12}$/,
    vehicleRegRegex: /^[A-Z0-9]{5,10}$/
};

// ===== API ENDPOINTS =====
const API_ENDPOINTS = {
    USERS: 'users',
    DRIVERS: 'drivers',
    TRIPS: 'trips',
    BOOKINGS: 'bookings',
    ADS: 'ads',
    TIME_SLOTS: 'time_slots',
    DRIVER_ASSIGNMENTS: 'driver_assignments'
};

// ===== STORAGE KEYS =====
const STORAGE_KEYS = {
    USER: 'luu_user',
    SESSION: 'luu_session',
    THEME: 'luu_theme',
    BOOKING_DRAFT: 'luu_booking_draft'
};

// ===== DEFAULT VEHICLE TYPES =====
const VEHICLE_TYPES = [
    'Toyota Quantum',
    'Mercedes Sprinter',
    'Ford Transit',
    'Volkswagen Crafter',
    'Hyundai H1',
    'Nissan NV350',
    'Isuzu N-Series',
    'Hino 300'
];

// ===== DEFAULT COLORS =====
const VEHICLE_COLORS = [
    'White',
    'Black',
    'Silver',
    'Blue',
    'Red',
    'Grey',
    'Green',
    'Gold'
];

// Export all configurations
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SUPABASE_CONFIG,
        ADMIN_CREDENTIALS,
        RATE_PER_KM,
        MAX_SEATS_PER_TRIP,
        MIN_BOOKING_SEATS,
        ROUTES,
        PAYMENT_METHODS,
        BOOKING_STATUS,
        TRIP_STATUS,
        DRIVER_STATUS,
        MAP_CONFIG,
        SA_BOUNDS,
        GAUTENG_BOUNDS,
        LIMPOPO_BOUNDS,
        NOTIFICATION_DURATION,
        NOTIFICATION_TYPES,
        DATE_FORMATS,
        VALIDATION,
        API_ENDPOINTS,
        STORAGE_KEYS,
        VEHICLE_TYPES,
        VEHICLE_COLORS
    };
}