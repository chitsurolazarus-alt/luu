/* =====================================================================
   LUU TRAVELS & LOGISTICS - ADMIN DASHBOARD MANAGER
   ===================================================================== */

const AdminState = {
    drivers: [],
    trips: [],
    bookings: [],
    ads: [],
    slots: []
};

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await AuthManager.requireAdmin('admin-login.html');
    if (!auth) return;
    document.getElementById('adminUserLabel').textContent = `${auth.profile.full_name} (Admin)`;

    setupNavigation();
    setupModals();
    setupForms();

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await AuthManager.logout();
        window.location.href = 'admin-login.html';
    });

    await refreshAll();
});

/* ---------------------------- NAVIGATION ---------------------------- */
function setupNavigation() {
    const titles = {
        dashboard: 'Dashboard Overview',
        drivers: 'Driver Management',
        trips: 'Trip Management',
        bookings: 'Booking Management',
        ads: 'Advertisement Management',
        timeslots: 'Time Slot Management'
    };
    document.querySelectorAll('.admin-nav-item[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.admin-nav-item[data-section]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
            document.getElementById('sectionTitle').textContent = titles[btn.dataset.section];
        });
    });
}

/* ------------------------------ MODALS ------------------------------ */
function setupModals() {
    document.getElementById('addDriverBtn').addEventListener('click', () => openModal('driverModal'));
    document.getElementById('addTripBtn').addEventListener('click', () => openModal('tripModal'));
    document.getElementById('addAdBtn').addEventListener('click', () => openModal('adModal'));
    document.getElementById('addSlotBtn').addEventListener('click', () => openModal('slotModal'));

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.getElementById(id).querySelector('form')?.reset(); }

/* ------------------------------- LOAD -------------------------------- */
async function refreshAll() {
    await Promise.all([loadDrivers(), loadTrips(), loadBookings(), loadAds(), loadSlots()]);
    renderDashboardStats();
    renderRecentTables();
}

async function loadDrivers() {
    const { data, error } = await supabaseClient.from('drivers').select('*').order('created_at', { ascending: false });
    if (error) { showToast('Error loading drivers: ' + error.message, 'error'); return; }
    AdminState.drivers = data || [];
    renderDrivers();
    populateDriverSelect();
}

async function loadTrips() {
    const { data, error } = await supabaseClient
        .from('trips')
        .select('*, drivers(full_name)')
        .order('departure_time', { ascending: false });
    if (error) { showToast('Error loading trips: ' + error.message, 'error'); return; }
    AdminState.trips = data || [];
    renderTrips();
}

async function loadBookings() {
    const { data, error } = await supabaseClient
        .from('bookings')
        .select('*, users(full_name, email), trips(route)')
        .order('created_at', { ascending: false });
    if (error) { showToast('Error loading bookings: ' + error.message, 'error'); return; }
    AdminState.bookings = data || [];
    renderBookings();
}

async function loadAds() {
    const { data, error } = await supabaseClient.from('ads').select('*').order('display_order', { ascending: true });
    if (error) { showToast('Error loading ads: ' + error.message, 'error'); return; }
    AdminState.ads = data || [];
    renderAds();
}

async function loadSlots() {
    const { data, error } = await supabaseClient.from('time_slots').select('*').order('route').order('departure_time');
    if (error) { showToast('Error loading time slots: ' + error.message, 'error'); return; }
    AdminState.slots = data || [];
    renderSlots();
}

/* ---------------------------- DASHBOARD ------------------------------ */
function renderDashboardStats() {
    document.getElementById('statDrivers').textContent = AdminState.drivers.length;
    document.getElementById('statTrips').textContent = AdminState.trips.length;
    document.getElementById('statBookings').textContent = AdminState.bookings.length;
    document.getElementById('statPending').textContent = AdminState.bookings.filter(b => b.booking_status === 'pending').length;
}

function renderRecentTables() {
    const recentBookings = AdminState.bookings.slice(0, 5);
    document.querySelector('#recentBookingsTable tbody').innerHTML = recentBookings.map(b => `
        <tr>
            <td>${b.booking_reference}</td>
            <td>${b.users ? b.users.full_name : '—'}</td>
            <td>${b.trips ? b.trips.route.replace('-', ' → ') : '—'}</td>
            <td>${b.number_of_seats}</td>
            <td>${formatCurrency(b.total_price)}</td>
            <td><span class="badge badge-${b.booking_status}">${b.booking_status}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; color:var(--gray-600);">No bookings yet.</td></tr>';

    const recentTrips = AdminState.trips.slice(0, 5);
    document.querySelector('#recentTripsTable tbody').innerHTML = recentTrips.map(t => `
        <tr>
            <td>${t.route.replace('-', ' → ')}</td>
            <td>${t.drivers ? t.drivers.full_name : 'Unassigned'}</td>
            <td>${new Date(t.departure_time).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}</td>
            <td>${t.available_seats}</td>
            <td>${formatCurrency(t.total_price)}</td>
            <td><span class="badge badge-active">${t.status}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; color:var(--gray-600);">No trips yet.</td></tr>';
}

/* ------------------------------ DRIVERS ------------------------------ */
function renderDrivers() {
    document.querySelector('#driversTable tbody').innerHTML = AdminState.drivers.map(d => `
        <tr>
            <td>${d.full_name}</td>
            <td>${d.email}<br><small style="color:var(--gray-600);">${d.phone}</small></td>
            <td>${d.vehicle_color} ${d.vehicle_model}<br><small style="color:var(--gray-600);">${d.vehicle_registration}</small></td>
            <td>${d.vehicle_capacity}</td>
            <td>
                <span class="badge ${d.is_approved ? 'badge-confirmed' : 'badge-pending'}">${d.is_approved ? 'Approved' : 'Pending'}</span>
                <span class="badge ${d.is_active ? 'badge-active' : 'badge-inactive'}">${d.is_active ? 'Active' : 'Inactive'}</span>
            </td>
            <td class="table-actions">
                ${!d.is_approved ? `<button class="btn btn-success btn-sm" data-approve="${d.id}">Approve</button>` : ''}
                <button class="btn ${d.is_active ? 'btn-outline' : 'btn-navy'} btn-sm" data-toggle-active="${d.id}" data-active="${d.is_active}" style="${d.is_active ? 'color:var(--primary); border-color:var(--primary);' : ''}">${d.is_active ? 'Deactivate' : 'Activate'}</button>
                <button class="btn btn-danger btn-sm" data-delete-driver="${d.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; color:var(--gray-600);">No drivers added yet.</td></tr>';

    document.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', () => approveDriver(btn.dataset.approve)));
    document.querySelectorAll('[data-toggle-active]').forEach(btn => btn.addEventListener('click', () => toggleDriverActive(btn.dataset.toggleActive, btn.dataset.active === 'true')));
    document.querySelectorAll('[data-delete-driver]').forEach(btn => btn.addEventListener('click', () => deleteDriver(btn.dataset.deleteDriver)));
}

function populateDriverSelect() {
    const select = document.getElementById('tripDriver');
    const approved = AdminState.drivers.filter(d => d.is_approved && d.is_active);
    select.innerHTML = '<option value="">Select driver</option>' + approved.map(d => `<option value="${d.id}">${d.full_name} — ${d.vehicle_model}</option>`).join('');
}

async function approveDriver(id) {
    const { error } = await supabaseClient.from('drivers').update({ is_approved: true }).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Driver approved.', 'success');
    await loadDrivers();
}

async function toggleDriverActive(id, isActive) {
    const { error } = await supabaseClient.from('drivers').update({ is_active: !isActive }).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Driver ${!isActive ? 'activated' : 'deactivated'}.`, 'success');
    await loadDrivers();
}

async function deleteDriver(id) {
    if (!confirm('Delete this driver permanently?')) return;
    const { error } = await supabaseClient.from('drivers').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Driver deleted.', 'success');
    await loadDrivers();
}

/* ------------------------------- TRIPS -------------------------------- */
function renderTrips() {
    document.querySelector('#tripsTable tbody').innerHTML = AdminState.trips.map(t => `
        <tr>
            <td>${t.route.replace('-', ' → ')}</td>
            <td>${t.drivers ? t.drivers.full_name : 'Unassigned'}</td>
            <td>${new Date(t.departure_time).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}</td>
            <td>${t.available_seats} / ${t.available_seats + t.booked_seats}</td>
            <td>${formatCurrency(t.total_price)}</td>
            <td><span class="badge badge-active">${t.status}</span></td>
            <td class="table-actions">
                <button class="btn btn-danger btn-sm" data-delete-trip="${t.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center; color:var(--gray-600);">No trips added yet.</td></tr>';

    document.querySelectorAll('[data-delete-trip]').forEach(btn => btn.addEventListener('click', () => deleteTrip(btn.dataset.deleteTrip)));
}

async function deleteTrip(id) {
    if (!confirm('Delete this trip? Any related bookings will also be removed.')) return;
    const { error } = await supabaseClient.from('trips').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Trip deleted.', 'success');
    await loadTrips();
    renderDashboardStats();
    renderRecentTables();
}

/* ------------------------------ BOOKINGS ------------------------------ */
function renderBookings() {
    const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    document.querySelector('#bookingsTable tbody').innerHTML = AdminState.bookings.map(b => `
        <tr>
            <td>${b.booking_reference}</td>
            <td>${b.users ? `${b.users.full_name}<br><small style="color:var(--gray-600);">${b.users.email}</small>` : '—'}</td>
            <td>${b.trips ? b.trips.route.replace('-', ' → ') : '—'}</td>
            <td>${b.number_of_seats}</td>
            <td>${formatCurrency(b.total_price)}</td>
            <td style="text-transform:capitalize;">${b.payment_method} · ${b.payment_status}</td>
            <td>
                <select class="select-status" data-status-for="${b.id}">
                    ${statuses.map(s => `<option value="${s}" ${s === b.booking_status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td class="table-actions">
                <button class="btn btn-danger btn-sm" data-delete-booking="${b.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center; color:var(--gray-600);">No bookings yet.</td></tr>';

    document.querySelectorAll('[data-status-for]').forEach(sel => {
        sel.addEventListener('change', () => updateBookingStatus(sel.dataset.statusFor, sel.value));
    });
    document.querySelectorAll('[data-delete-booking]').forEach(btn => btn.addEventListener('click', () => deleteBooking(btn.dataset.deleteBooking)));
}

async function updateBookingStatus(id, status) {
    const { error } = await supabaseClient.from('bookings').update({ booking_status: status }).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Booking status updated.', 'success');
    await loadBookings();
    renderDashboardStats();
    renderRecentTables();
}

async function deleteBooking(id) {
    if (!confirm('Delete this booking permanently?')) return;
    const { error } = await supabaseClient.from('bookings').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Booking deleted.', 'success');
    await loadBookings();
    renderDashboardStats();
    renderRecentTables();
}

/* -------------------------------- ADS ---------------------------------- */
function renderAds() {
    document.querySelector('#adsTable tbody').innerHTML = AdminState.ads.map(ad => `
        <tr>
            <td>${ad.title}</td>
            <td>${ad.content.length > 60 ? ad.content.slice(0, 60) + '…' : ad.content}</td>
            <td><span class="badge ${ad.is_active ? 'badge-active' : 'badge-inactive'}">${ad.is_active ? 'Active' : 'Inactive'}</span></td>
            <td class="table-actions">
                <button class="btn ${ad.is_active ? 'btn-outline' : 'btn-navy'} btn-sm" data-toggle-ad="${ad.id}" data-active="${ad.is_active}" style="${ad.is_active ? 'color:var(--primary); border-color:var(--primary);' : ''}">${ad.is_active ? 'Deactivate' : 'Activate'}</button>
                <button class="btn btn-danger btn-sm" data-delete-ad="${ad.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--gray-600);">No ads posted yet.</td></tr>';

    document.querySelectorAll('[data-toggle-ad]').forEach(btn => btn.addEventListener('click', () => toggleAdActive(btn.dataset.toggleAd, btn.dataset.active === 'true')));
    document.querySelectorAll('[data-delete-ad]').forEach(btn => btn.addEventListener('click', () => deleteAd(btn.dataset.deleteAd)));
}

async function toggleAdActive(id, isActive) {
    const { error } = await supabaseClient.from('ads').update({ is_active: !isActive }).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    await loadAds();
}

async function deleteAd(id) {
    if (!confirm('Delete this ad?')) return;
    const { error } = await supabaseClient.from('ads').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Ad deleted.', 'success');
    await loadAds();
}

/* ----------------------------- TIME SLOTS ------------------------------ */
function renderSlots() {
    document.querySelector('#slotsTable tbody').innerHTML = AdminState.slots.map(s => `
        <tr>
            <td>${s.route.replace('-', ' → ')}</td>
            <td>${s.departure_time}</td>
            <td><span class="badge ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
            <td class="table-actions">
                <button class="btn ${s.is_active ? 'btn-outline' : 'btn-navy'} btn-sm" data-toggle-slot="${s.id}" data-active="${s.is_active}" style="${s.is_active ? 'color:var(--primary); border-color:var(--primary);' : ''}">${s.is_active ? 'Deactivate' : 'Activate'}</button>
                <button class="btn btn-danger btn-sm" data-delete-slot="${s.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--gray-600);">No time slots added yet.</td></tr>';

    document.querySelectorAll('[data-toggle-slot]').forEach(btn => btn.addEventListener('click', () => toggleSlotActive(btn.dataset.toggleSlot, btn.dataset.active === 'true')));
    document.querySelectorAll('[data-delete-slot]').forEach(btn => btn.addEventListener('click', () => deleteSlot(btn.dataset.deleteSlot)));
}

async function toggleSlotActive(id, isActive) {
    const { error } = await supabaseClient.from('time_slots').update({ is_active: !isActive }).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    await loadSlots();
}

async function deleteSlot(id) {
    if (!confirm('Delete this time slot?')) return;
    const { error } = await supabaseClient.from('time_slots').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Time slot deleted.', 'success');
    await loadSlots();
}

/* ------------------------------- FORMS --------------------------------- */
function setupForms() {
    // Auto-calculate trip price when distance changes
    document.getElementById('tripDistance').addEventListener('input', (e) => {
        const distance = parseFloat(e.target.value) || 0;
        document.getElementById('tripPrice').value = (distance * APP_CONFIG.pricePerKm).toFixed(2);
    });

    document.getElementById('driverForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            full_name: document.getElementById('driverName').value.trim(),
            email: document.getElementById('driverEmail').value.trim(),
            phone: document.getElementById('driverPhone').value.trim(),
            license_number: document.getElementById('driverLicense').value.trim(),
            prdp_number: document.getElementById('driverPrdp').value.trim() || null,
            vehicle_registration: document.getElementById('vehicleReg').value.trim(),
            vehicle_model: document.getElementById('vehicleModel').value.trim(),
            vehicle_color: document.getElementById('vehicleColor').value.trim(),
            vehicle_capacity: parseInt(document.getElementById('vehicleCapacity').value, 10),
            is_approved: true // admin-added drivers are pre-approved
        };
        const { error } = await supabaseClient.from('drivers').insert([payload]);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Driver added successfully.', 'success');
        closeModal('driverModal');
        await loadDrivers();
        renderDashboardStats();
    });

    document.getElementById('tripForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const distance = parseFloat(document.getElementById('tripDistance').value);
        const seats = parseInt(document.getElementById('tripSeats').value, 10);
        const payload = {
            driver_id: document.getElementById('tripDriver').value || null,
            route: document.getElementById('tripRoute').value,
            pickup_location: document.getElementById('tripPickup').value.trim(),
            dropoff_location: document.getElementById('tripDropoff').value.trim(),
            distance,
            price_per_km: APP_CONFIG.pricePerKm,
            total_price: parseFloat(document.getElementById('tripPrice').value),
            departure_time: new Date(document.getElementById('tripDeparture').value).toISOString(),
            available_seats: seats,
            status: 'scheduled'
        };
        const { error } = await supabaseClient.from('trips').insert([payload]);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Trip added successfully.', 'success');
        closeModal('tripModal');
        await loadTrips();
        renderDashboardStats();
        renderRecentTables();
    });

    document.getElementById('adForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            title: document.getElementById('adTitle').value.trim(),
            content: document.getElementById('adContent').value.trim(),
            image_url: document.getElementById('adImage').value.trim() || null,
            is_active: true
        };
        const { error } = await supabaseClient.from('ads').insert([payload]);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Ad posted successfully.', 'success');
        closeModal('adModal');
        await loadAds();
    });

    document.getElementById('slotForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            route: document.getElementById('slotRoute').value,
            departure_time: document.getElementById('slotTime').value,
            is_active: true
        };
        const { error } = await supabaseClient.from('time_slots').insert([payload]);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Time slot added successfully.', 'success');
        closeModal('slotModal');
        await loadSlots();
    });
}
