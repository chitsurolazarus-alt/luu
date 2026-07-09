/* =====================================================================
   LUU TRAVELS & LOGISTICS - GLOBAL CONFIGURATION
   ===================================================================== */

const SUPABASE_URL = 'https://gwzpzvwermsfnputttdo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3enB6dndlcm1zZm5wdXR0dGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzkxODYsImV4cCI6MjA5Nzk1NTE4Nn0.y4v8P0TxS4yfjj9DfWF_l1B8OBSl_ybv4vZBuVUN7Oc';

// Single shared Supabase client (supabase-js must be loaded before this file)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App-wide constants
const APP_CONFIG = {
    companyName: 'Luu Travels & Logistics',
    tagline: 'Moving People. Delivering Trust.',
    phone: '076 845 7061',
    email: 'LuuTravels611@gmail.com',
    address: 'Windmill Park Ext 32, Boksburg, Gauteng, South Africa',
    pricePerKm: 2.50,
    maxSeats: 14,
    routes: ['Gauteng-Limpopo', 'Limpopo-Gauteng'],
    currency: 'R',
};

// Helper: figure out relative path prefix so links work from both / and /pages/
function pathPrefix() {
    return window.location.pathname.includes('/pages/') ? '' : 'pages/';
}

// Helper: format a number as Rand currency
function formatCurrency(amount) {
    const value = Number(amount || 0);
    return `R${value.toFixed(2)}`;
}

// Helper: haversine distance in km between two [lat, lng] points
function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Helper: simple toast notification, reused across all pages
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
