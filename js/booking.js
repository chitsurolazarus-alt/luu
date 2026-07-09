/* =====================================================================
   LUU TRAVELS & LOGISTICS - BOOKING MANAGER
   ===================================================================== */

const BookingState = {
    currentUser: null,
    trips: [],
    selectedTrip: null,
    routeFilter: 'all',
    seats: 1,
    paymentMethod: 'cash',
    distance: 0
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = await AuthManager.requireAuth('login.html');
    if (!user) return;
    BookingState.currentUser = user;

    MapManager.init('booking-map');
    setupMapClicks();
    await loadTrips();
    setupUIHandlers();
});

// Map click handler: first click sets pickup, second sets dropoff, third click resets and starts over
let clickStage = 'pickup';
function setupMapClicks() {
    MapManager.map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (clickStage === 'pickup') {
            MapManager.setPickup(lat, lng);
            clickStage = 'dropoff';
        } else if (clickStage === 'dropoff') {
            MapManager.setDropoff(lat, lng);
            clickStage = 'done';
        } else {
            MapManager.clearAll();
            MapManager.setPickup(lat, lng);
            clickStage = 'dropoff';
        }
    });

    document.addEventListener('routeUpdated', (e) => {
        BookingState.distance = e.detail.distance;
        document.getElementById('distanceValue').textContent = `${e.detail.distance.toFixed(1)} km`;
        const estimated = e.detail.distance * APP_CONFIG.pricePerKm;
        document.getElementById('estimatedPriceValue').textContent = formatCurrency(estimated);
    });

    document.getElementById('clearMapBtn').addEventListener('click', () => {
        MapManager.clearAll();
        clickStage = 'pickup';
        document.getElementById('distanceValue').textContent = '— km';
        document.getElementById('estimatedPriceValue').textContent = 'R0.00';
    });
}

async function loadTrips() {
    const { data, error } = await supabaseClient
        .from('trips')
        .select('*, drivers(full_name, vehicle_model, vehicle_color, phone)')
        .eq('status', 'scheduled')
        .gt('available_seats', 0)
        .order('departure_time', { ascending: true });

    if (error) {
        showToast('Could not load trips: ' + error.message, 'error');
        return;
    }
    BookingState.trips = data || [];
    renderTrips();
}

function renderTrips() {
    const list = document.getElementById('tripList');
    const filtered = BookingState.routeFilter === 'all'
        ? BookingState.trips
        : BookingState.trips.filter(t => t.route === BookingState.routeFilter);

    if (filtered.length === 0) {
        list.innerHTML = '<div class="trip-empty">No trips available for this route right now. Please check back later.</div>';
        return;
    }

    list.innerHTML = filtered.map(trip => {
        const departure = new Date(trip.departure_time);
        const driverName = trip.drivers ? trip.drivers.full_name : 'To be assigned';
        const vehicle = trip.drivers ? `${trip.drivers.vehicle_color} ${trip.drivers.vehicle_model}` : 'N/A';
        return `
            <div class="trip-card" data-trip-id="${trip.id}">
                <div class="trip-card-top">
                    <span class="trip-card-route">${trip.route.replace('-', ' → ')}</span>
                    <span class="trip-card-price">${formatCurrency(trip.total_price)}</span>
                </div>
                <div class="trip-card-meta">
                    <span>🕐 ${departure.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <span>👤 ${driverName}</span>
                    <span>🚐 ${vehicle}</span>
                    <span>💺 ${trip.available_seats} seats left</span>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.trip-card').forEach(card => {
        card.addEventListener('click', () => selectTrip(card.dataset.tripId));
    });
}

function selectTrip(tripId) {
    BookingState.selectedTrip = BookingState.trips.find(t => t.id === tripId);
    document.querySelectorAll('.trip-card').forEach(c => c.classList.toggle('selected', c.dataset.tripId === tripId));

    const card = document.getElementById('bookingFormCard');
    card.style.display = 'block';
    BookingState.seats = 1;
    document.getElementById('seatCount').value = 1;
    document.getElementById('seatsAvailableLabel').textContent = `of ${BookingState.selectedTrip.available_seats} available`;
    updatePriceSummary();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updatePriceSummary() {
    if (!BookingState.selectedTrip) return;
    const perSeat = Number(BookingState.selectedTrip.total_price);
    document.getElementById('pricePerSeat').textContent = formatCurrency(perSeat);
    document.getElementById('seatsSummary').textContent = BookingState.seats;
    document.getElementById('totalPrice').textContent = formatCurrency(perSeat * BookingState.seats);
}

function setupUIHandlers() {
    document.querySelectorAll('.route-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.route-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            BookingState.routeFilter = chip.dataset.route;
            renderTrips();
        });
    });

    document.getElementById('seatMinus').addEventListener('click', () => {
        if (BookingState.seats > 1) { BookingState.seats--; document.getElementById('seatCount').value = BookingState.seats; updatePriceSummary(); }
    });
    document.getElementById('seatPlus').addEventListener('click', () => {
        const max = Math.min(APP_CONFIG.maxSeats, BookingState.selectedTrip ? BookingState.selectedTrip.available_seats : APP_CONFIG.maxSeats);
        if (BookingState.seats < max) { BookingState.seats++; document.getElementById('seatCount').value = BookingState.seats; updatePriceSummary(); }
    });

    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.addEventListener('click', () => {
            if (opt.dataset.method === 'card') {
                showToast('Card payments are coming soon. Please select Cash for now.', 'info');
                return;
            }
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            BookingState.paymentMethod = opt.dataset.method;
        });
    });

    document.getElementById('confirmBookingBtn').addEventListener('click', confirmBooking);

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await AuthManager.logout();
        window.location.href = '../index.html';
    });
}

async function confirmBooking() {
    if (!BookingState.selectedTrip) {
        showToast('Please select a trip first.', 'error');
        return;
    }
    const trip = BookingState.selectedTrip;
    const pickupLocation = MapManager.pickupMarker
        ? `${MapManager.pickupMarker.getLatLng().lat.toFixed(5)}, ${MapManager.pickupMarker.getLatLng().lng.toFixed(5)}`
        : trip.pickup_location;
    const dropoffLocation = MapManager.dropoffMarker
        ? `${MapManager.dropoffMarker.getLatLng().lat.toFixed(5)}, ${MapManager.dropoffMarker.getLatLng().lng.toFixed(5)}`
        : trip.dropoff_location;

    const btn = document.getElementById('confirmBookingBtn');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    try {
        const { error } = await supabaseClient.from('bookings').insert([{
            user_id: BookingState.currentUser.id,
            trip_id: trip.id,
            number_of_seats: BookingState.seats,
            total_price: Number(trip.total_price) * BookingState.seats,
            payment_method: BookingState.paymentMethod,
            pickup_location: pickupLocation,
            dropoff_location: dropoffLocation,
            pickup_coordinates: MapManager.pickupMarker ? { lat: MapManager.pickupMarker.getLatLng().lat, lng: MapManager.pickupMarker.getLatLng().lng } : null,
            dropoff_coordinates: MapManager.dropoffMarker ? { lat: MapManager.dropoffMarker.getLatLng().lat, lng: MapManager.dropoffMarker.getLatLng().lng } : null,
            special_requests: document.getElementById('specialRequests').value.trim() || null
        }]);

        if (error) throw error;

        showToast('Booking confirmed! Redirecting to your dashboard...', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
    } catch (err) {
        showToast(err.message || 'Booking failed. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Confirm Booking';
    }
}
