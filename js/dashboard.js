/* =====================================================================
   LUU TRAVELS & LOGISTICS - USER DASHBOARD MANAGER
   ===================================================================== */

const DashboardState = {
    profile: null,
    bookings: [],
    statusFilter: 'all',
    openTrackingId: null
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = await AuthManager.requireAuth('login.html');
    if (!user) return;

    DashboardState.profile = await AuthManager.getProfile(user.id);
    renderProfile();
    await loadBookings(user.id);
    setupHandlers();

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await AuthManager.logout();
        window.location.href = '../index.html';
    });
});

function renderProfile() {
    const p = DashboardState.profile;
    document.getElementById('welcomeText').textContent = `Welcome back, ${p.full_name.split(' ')[0]}`;
    document.getElementById('avatarInitial').textContent = p.full_name.charAt(0).toUpperCase();
    document.getElementById('profileName').textContent = p.full_name;
    document.getElementById('profileEmail').textContent = p.email;
    document.getElementById('profilePhone').textContent = p.phone;
    document.getElementById('profileSince').textContent = new Date(p.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' });
}

async function loadBookings(userId) {
    const { data, error } = await supabaseClient
        .from('bookings')
        .select('*, trips(route, departure_time, pickup_location, dropoff_location, drivers(id, full_name, vehicle_model, vehicle_color, phone))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        showToast('Could not load bookings: ' + error.message, 'error');
        return;
    }
    DashboardState.bookings = data || [];
    renderBookings();
}

function renderBookings() {
    const list = document.getElementById('bookingsList');
    const filtered = DashboardState.statusFilter === 'all'
        ? DashboardState.bookings
        : DashboardState.bookings.filter(b => b.booking_status === DashboardState.statusFilter);

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="icon">📭</div>No bookings found in this category.</div>';
        return;
    }

    list.innerHTML = filtered.map(b => {
        const trip = b.trips || {};
        const departure = trip.departure_time ? new Date(trip.departure_time).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
        const canCancel = b.booking_status === 'pending';
        const canTrack = ['confirmed', 'completed'].includes(b.booking_status) && trip.drivers;

        return `
            <div class="booking-card">
                <div class="booking-card-top">
                    <div>
                        <div class="booking-ref">${b.booking_reference}</div>
                        <div class="booking-route">${trip.route ? trip.route.replace('-', ' → ') : ''}</div>
                    </div>
                    <span class="badge badge-${b.booking_status}">${b.booking_status}</span>
                </div>
                <div class="booking-details">
                    <div><div class="label">Departure</div><div class="value">${departure}</div></div>
                    <div><div class="label">Seats</div><div class="value">${b.number_of_seats}</div></div>
                    <div><div class="label">Total</div><div class="value">${formatCurrency(b.total_price)}</div></div>
                    <div><div class="label">Payment</div><div class="value" style="text-transform:capitalize;">${b.payment_method} · ${b.payment_status}</div></div>
                </div>
                <div class="booking-actions">
                    ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${b.id}">Cancel Trip</button>` : ''}
                    ${canTrack ? `<button class="btn btn-navy btn-sm" data-track="${b.id}" data-driver="${trip.drivers.id}">Track Driver</button>` : ''}
                </div>
                <div class="tracking-panel" id="tracking-${b.id}">
                    <div id="tracking-map-${b.id}" style="height:320px;"></div>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('[data-cancel]').forEach(btn => {
        btn.addEventListener('click', () => cancelBooking(btn.dataset.cancel));
    });
    list.querySelectorAll('[data-track]').forEach(btn => {
        btn.addEventListener('click', () => toggleTracking(btn.dataset.track, btn.dataset.driver));
    });
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this trip?')) return;
    const { error } = await supabaseClient
        .from('bookings')
        .update({ booking_status: 'cancelled' })
        .eq('id', bookingId);

    if (error) {
        showToast('Could not cancel booking: ' + error.message, 'error');
        return;
    }
    showToast('Booking cancelled.', 'success');
    const user = await AuthManager.getCurrentUser();
    await loadBookings(user.id);
}

function toggleTracking(bookingId, driverId) {
    const panel = document.getElementById(`tracking-${bookingId}`);
    const isOpen = panel.classList.contains('open');

    // Close any other open tracking panel first
    if (DashboardState.openTrackingId && DashboardState.openTrackingId !== bookingId) {
        const prev = document.getElementById(`tracking-${DashboardState.openTrackingId}`);
        if (prev) prev.classList.remove('open');
        MapManager.stopTracking();
    }

    if (isOpen) {
        panel.classList.remove('open');
        MapManager.stopTracking();
        DashboardState.openTrackingId = null;
        return;
    }

    panel.classList.add('open');
    DashboardState.openTrackingId = bookingId;

    // Initialize a fresh map instance for this panel each time it's opened
    setTimeout(() => {
        MapManager.map = null;
        MapManager.driverMarker = null;
        MapManager.init(`tracking-map-${bookingId}`, [-24.6, 29.0], 8);
        MapManager.startTracking(driverId);
    }, 50);
}

function setupHandlers() {
    document.querySelectorAll('.dash-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            DashboardState.statusFilter = tab.dataset.status;
            renderBookings();
        });
    });
}
