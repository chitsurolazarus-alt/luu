/**
 * Luu Travels & Logistics - Admin Manager
 * Handles all admin dashboard functionality
 */

class AdminManager {
    constructor() {
        // Initialize Supabase client
        this.supabase = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        
        this.currentSection = 'dashboard';
        this.isLoading = false;
        
        // Initialize
        this.init();
    }

    /**
     * Initialize admin manager
     */
    async init() {
        // Check admin authentication
        await this.checkAdminAuth();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load dashboard data
        await this.loadDashboardData();
        
        // Load drivers for dropdown
        await this.loadDriversForDropdown();
        
        console.log('Admin manager initialized');
    }

    /**
     * Check admin authentication
     */
    async checkAdminAuth() {
        const { data: { session } } = await this.supabase.auth.getSession();
        
        if (!session) {
            window.location.href = 'admin-login.html';
            return;
        }

        // Check if user is admin
        const user = session.user;
        if (user.email !== ADMIN_CREDENTIALS.email) {
            await this.supabase.auth.signOut();
            alert('Unauthorized access');
            window.location.href = 'admin-login.html';
            return;
        }

        // Display admin email
        document.getElementById('adminEmail').textContent = user.email;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.admin-nav a[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
            });
        });

        // Logout
        document.getElementById('adminLogout').addEventListener('click', () => {
            this.logout();
        });

        // Add driver form
        document.getElementById('addDriverForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addDriver();
        });

        // Add trip form
        document.getElementById('addTripForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTrip();
        });

        // Add ad form
        document.getElementById('addAdForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addAd();
        });

        // Add time slot form
        document.getElementById('addTimeSlotForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTimeSlot();
        });

        // Refresh button
        document.querySelector('.btn-refresh')?.addEventListener('click', () => {
            this.loadSectionData(this.currentSection);
        });
    }

    /**
     * Show a section
     */
    showSection(section) {
        this.currentSection = section;
        
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(el => {
            el.style.display = 'none';
        });

        // Show selected section
        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // Update nav active state
        document.querySelectorAll('.admin-nav a').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.section === section) {
                link.classList.add('active');
            }
        });

        // Load section data
        this.loadSectionData(section);
    }

    /**
     * Load section data
     */
    async loadSectionData(section) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            switch(section) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'drivers':
                    await this.loadDrivers();
                    break;
                case 'trips':
                    await this.loadTrips();
                    break;
                case 'bookings':
                    await this.loadBookings();
                    break;
                case 'ads':
                    await this.loadAds();
                    break;
                case 'timeslots':
                    await this.loadTimeSlots();
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${section}:`, error);
            this.showNotification(`Error loading ${section}`, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            // Get counts
            const [driversResult, tripsResult, bookingsResult] = await Promise.all([
                this.supabase.from('drivers').select('*', { count: 'exact', head: true }),
                this.supabase.from('trips').select('*', { count: 'exact', head: true }),
                this.supabase.from('bookings').select('*', { count: 'exact', head: true })
            ]);

            // Update stats
            document.getElementById('totalDrivers').textContent = driversResult.count || 0;
            document.getElementById('totalTrips').textContent = tripsResult.count || 0;
            document.getElementById('totalBookings').textContent = bookingsResult.count || 0;

            // Get pending bookings count
            const { count: pendingCount } = await this.supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('booking_status', 'pending');

            const pendingElement = document.getElementById('pendingBookings');
            if (pendingElement) {
                pendingElement.textContent = pendingCount || 0;
            }

            // Load recent bookings
            const { data: recentBookings } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    users (full_name, email),
                    trip:trips (route, departure_time)
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            this.displayRecentBookings(recentBookings);

            // Load recent trips
            const { data: recentTrips } = await this.supabase
                .from('trips')
                .select(`
                    *,
                    drivers (full_name)
                `)
                .order('departure_time', { ascending: false })
                .limit(5);

            this.displayRecentTrips(recentTrips);

        } catch (error) {
            console.error('Error loading dashboard:', error);
            throw error;
        }
    }

    /**
     * Display recent bookings
     */
    displayRecentBookings(bookings) {
        const container = document.getElementById('recentBookings');
        if (!container) return;

        if (!bookings || bookings.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No recent bookings</td></tr>';
            return;
        }

        container.innerHTML = bookings.map(booking => `
            <tr>
                <td>${booking.users?.full_name || 'Unknown'}</td>
                <td>${booking.trip?.route || 'Unknown'}</td>
                <td>${new Date(booking.trip?.departure_time || booking.created_at).toLocaleDateString()}</td>
                <td>R${booking.total_price?.toFixed(2) || '0.00'}</td>
                <td><span class="status ${booking.booking_status}">${booking.booking_status}</span></td>
            </tr>
        `).join('');
    }

    /**
     * Display recent trips
     */
    displayRecentTrips(trips) {
        const container = document.getElementById('recentTrips');
        if (!container) return;

        if (!trips || trips.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No recent trips</td></tr>';
            return;
        }

        container.innerHTML = trips.map(trip => `
            <tr>
                <td>${trip.route}</td>
                <td>${trip.drivers?.full_name || 'Unassigned'}</td>
                <td>${new Date(trip.departure_time).toLocaleString()}</td>
                <td><span class="status ${trip.status}">${trip.status}</span></td>
            </tr>
        `).join('');
    }

    /**
     * Load drivers
     */
    async loadDrivers() {
        try {
            const { data, error } = await this.supabase
                .from('drivers')
                .select(`
                    *,
                    users (
                        full_name,
                        email,
                        phone
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const container = document.getElementById('driversList');
            if (!container) return;

            if (!data || data.length === 0) {
                container.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No drivers found</td></tr>';
                return;
            }

            container.innerHTML = data.map(driver => `
                <tr>
                    <td>
                        <strong>${driver.users?.full_name || driver.full_name}</strong>
                        <br>
                        <small class="text-muted">${driver.users?.email || driver.email}</small>
                    </td>
                    <td>${driver.users?.phone || driver.phone || 'N/A'}</td>
                    <td>
                        ${driver.vehicle_model}
                        <br>
                        <small class="text-muted">${driver.vehicle_color} • ${driver.vehicle_registration}</small>
                    </td>
                    <td>
                        <span class="status ${driver.is_approved ? 'approved' : 'pending'}">
                            ${driver.is_approved ? 'Approved' : 'Pending'}
                        </span>
                        <br>
                        <small class="text-muted">Capacity: ${driver.capacity || 14}</small>
                    </td>
                    <td>
                        <span class="status ${driver.is_active ? 'active' : 'inactive'}">
                            ${driver.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <div class="btn-group">
                            ${!driver.is_approved ? 
                                `<button class="btn-action approve" onclick="adminManager.approveDriver('${driver.id}')">Approve</button>` :
                                ''
                            }
                            <button class="btn-action toggle" onclick="adminManager.toggleDriverStatus('${driver.id}')">
                                ${driver.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button class="btn-action delete" onclick="adminManager.deleteDriver('${driver.id}')">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading drivers:', error);
            throw error;
        }
    }

    /**
     * Add a new driver
     */
    async addDriver() {
        const form = document.getElementById('addDriverForm');
        const formData = new FormData(form);

        const driverData = {
            full_name: formData.get('driverName'),
            email: formData.get('driverEmail'),
            phone: formData.get('driverPhone'),
            license_number: formData.get('licenseNumber'),
            prdp_number: formData.get('prdpNumber') || null,
            vehicle_registration: formData.get('vehicleReg'),
            vehicle_model: formData.get('vehicleModel'),
            vehicle_color: formData.get('vehicleColor'),
            capacity: parseInt(formData.get('vehicleCapacity')) || 14,
            is_approved: true,
            is_active: true
        };

        // Validate
        if (!driverData.full_name || !driverData.email || !driverData.phone) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || 'Add Driver';
        if (submitBtn) {
            submitBtn.textContent = 'Adding...';
            submitBtn.disabled = true;
        }

        try {
            // First, create user account
            const tempPassword = this.generateTempPassword();
            const { data: userData, error: userError } = await this.supabase.auth.signUp({
                email: driverData.email,
                password: tempPassword,
                options: {
                    data: {
                        full_name: driverData.full_name,
                        phone: driverData.phone,
                        role: 'driver'
                    }
                }
            });

            if (userError) {
                throw userError;
            }

            // Add driver record
            const { error } = await this.supabase
                .from('drivers')
                .insert([{
                    user_id: userData.user.id,
                    full_name: driverData.full_name,
                    email: driverData.email,
                    phone: driverData.phone,
                    license_number: driverData.license_number,
                    prdp_number: driverData.prdp_number,
                    vehicle_registration: driverData.vehicle_registration,
                    vehicle_model: driverData.vehicle_model,
                    vehicle_color: driverData.vehicle_color,
                    capacity: driverData.capacity,
                    is_approved: true,
                    is_active: true
                }]);

            if (error) {
                throw error;
            }

            this.showNotification('Driver added successfully!', 'success');
            form.reset();
            await this.loadDrivers();
            await this.loadDriversForDropdown();

        } catch (error) {
            console.error('Error adding driver:', error);
            this.showNotification('Error adding driver: ' + error.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Approve a driver
     */
    async approveDriver(driverId) {
        if (!confirm('Are you sure you want to approve this driver?')) return;

        try {
            const { error } = await this.supabase
                .from('drivers')
                .update({ is_approved: true })
                .eq('id', driverId);

            if (error) {
                throw error;
            }

            this.showNotification('Driver approved successfully!', 'success');
            await this.loadDrivers();
        } catch (error) {
            console.error('Error approving driver:', error);
            this.showNotification('Error approving driver: ' + error.message, 'error');
        }
    }

    /**
     * Toggle driver active status
     */
    async toggleDriverStatus(driverId) {
        try {
            // Get current status
            const { data, error: fetchError } = await this.supabase
                .from('drivers')
                .select('is_active')
                .eq('id', driverId)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            const newStatus = !data.is_active;

            const { error } = await this.supabase
                .from('drivers')
                .update({ is_active: newStatus })
                .eq('id', driverId);

            if (error) {
                throw error;
            }

            this.showNotification(`Driver ${newStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
            await this.loadDrivers();
        } catch (error) {
            console.error('Error toggling driver status:', error);
            this.showNotification('Error updating driver status: ' + error.message, 'error');
        }
    }

    /**
     * Delete a driver
     */
    async deleteDriver(driverId) {
        if (!confirm('Are you sure you want to delete this driver?')) return;

        try {
            const { error } = await this.supabase
                .from('drivers')
                .delete()
                .eq('id', driverId);

            if (error) {
                throw error;
            }

            this.showNotification('Driver deleted successfully!', 'success');
            await this.loadDrivers();
            await this.loadDriversForDropdown();
        } catch (error) {
            console.error('Error deleting driver:', error);
            this.showNotification('Error deleting driver: ' + error.message, 'error');
        }
    }

    /**
     * Load trips
     */
    async loadTrips() {
        try {
            const { data, error } = await this.supabase
                .from('trips')
                .select(`
                    *,
                    drivers (
                        full_name,
                        vehicle_model,
                        vehicle_color
                    )
                `)
                .order('departure_time', { ascending: false });

            if (error) {
                throw error;
            }

            const container = document.getElementById('tripsList');
            if (!container) return;

            if (!data || data.length === 0) {
                container.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No trips found</td></tr>';
                return;
            }

            container.innerHTML = data.map(trip => `
                <tr>
                    <td>
                        <strong>${trip.route}</strong>
                        <br>
                        <small class="text-muted">${trip.pickup_location} → ${trip.dropoff_location}</small>
                    </td>
                    <td>${trip.drivers?.full_name || 'Unassigned'}</td>
                    <td>${new Date(trip.departure_time).toLocaleString()}</td>
                    <td>${trip.available_seats || 0}</td>
                    <td>R${trip.price?.toFixed(2) || '0.00'}</td>
                    <td><span class="status ${trip.status}">${trip.status}</span></td>
                    <td>
                        <div class="btn-group">
                            <button class="btn-action edit" onclick="adminManager.editTrip('${trip.id}')">Edit</button>
                            <button class="btn-action delete" onclick="adminManager.deleteTrip('${trip.id}')">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading trips:', error);
            throw error;
        }
    }

    /**
     * Add a new trip
     */
    async addTrip() {
        const form = document.getElementById('addTripForm');
        const formData = new FormData(form);

        const tripData = {
            driver_id: formData.get('tripDriver') || null,
            route: formData.get('tripRoute'),
            pickup_location: formData.get('pickupLocation'),
            dropoff_location: formData.get('dropoffLocation'),
            departure_time: formData.get('departureTime'),
            available_seats: parseInt(formData.get('availableSeats')) || 14,
            price: parseFloat(formData.get('tripPrice')) || 0,
            status: 'scheduled'
        };

        // Validate
        if (!tripData.route || !tripData.pickup_location || !tripData.dropoff_location || !tripData.departure_time) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (tripData.price <= 0) {
            this.showNotification('Price must be greater than 0', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || 'Add Trip';
        if (submitBtn) {
            submitBtn.textContent = 'Adding...';
            submitBtn.disabled = true;
        }

        try {
            const { error } = await this.supabase
                .from('trips')
                .insert([tripData]);

            if (error) {
                throw error;
            }

            this.showNotification('Trip added successfully!', 'success');
            form.reset();
            await this.loadTrips();

        } catch (error) {
            console.error('Error adding trip:', error);
            this.showNotification('Error adding trip: ' + error.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Edit a trip
     */
    async editTrip(tripId) {
        // Implement edit functionality
        this.showNotification('Edit functionality coming soon', 'info');
    }

    /**
     * Delete a trip
     */
    async deleteTrip(tripId) {
        if (!confirm('Are you sure you want to delete this trip?')) return;

        try {
            const { error } = await this.supabase
                .from('trips')
                .delete()
                .eq('id', tripId);

            if (error) {
                throw error;
            }

            this.showNotification('Trip deleted successfully!', 'success');
            await this.loadTrips();
        } catch (error) {
            console.error('Error deleting trip:', error);
            this.showNotification('Error deleting trip: ' + error.message, 'error');
        }
    }

    /**
     * Load bookings
     */
    async loadBookings() {
        try {
            const { data, error } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    users (full_name, email, phone),
                    trip:trips (route, departure_time, drivers (full_name))
                `)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const container = document.getElementById('bookingsList');
            if (!container) return;

            if (!data || data.length === 0) {
                container.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No bookings found</td></tr>';
                return;
            }

            container.innerHTML = data.map(booking => `
                <tr>
                    <td>
                        <strong>${booking.users?.full_name || 'Unknown'}</strong>
                        <br>
                        <small class="text-muted">${booking.users?.email || 'No email'}</small>
                    </td>
                    <td>${booking.trip?.route || 'Unknown'}</td>
                    <td>${booking.trip?.drivers?.full_name || 'Unassigned'}</td>
                    <td>${booking.number_of_seats}</td>
                    <td>R${booking.total_price?.toFixed(2) || '0.00'}</td>
                    <td>${booking.payment_method}</td>
                    <td><span class="status ${booking.booking_status}">${booking.booking_status}</span></td>
                    <td>
                        <select class="status-select" onchange="adminManager.updateBookingStatus('${booking.id}', this.value)">
                            <option value="pending" ${booking.booking_status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="confirmed" ${booking.booking_status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="completed" ${booking.booking_status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${booking.booking_status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button class="btn-action delete" onclick="adminManager.deleteBooking('${booking.id}')">Delete</button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading bookings:', error);
            throw error;
        }
    }

    /**
     * Update booking status
     */
    async updateBookingStatus(bookingId, status) {
        try {
            const { error } = await this.supabase
                .from('bookings')
                .update({ booking_status: status })
                .eq('id', bookingId);

            if (error) {
                throw error;
            }

            this.showNotification('Booking status updated!', 'success');
            await this.loadBookings();
            await this.loadDashboardData();
        } catch (error) {
            console.error('Error updating booking:', error);
            this.showNotification('Error updating booking: ' + error.message, 'error');
        }
    }

    /**
     * Delete a booking
     */
    async deleteBooking(bookingId) {
        if (!confirm('Are you sure you want to delete this booking?')) return;

        try {
            const { error } = await this.supabase
                .from('bookings')
                .delete()
                .eq('id', bookingId);

            if (error) {
                throw error;
            }

            this.showNotification('Booking deleted successfully!', 'success');
            await this.loadBookings();
            await this.loadDashboardData();
        } catch (error) {
            console.error('Error deleting booking:', error);
            this.showNotification('Error deleting booking: ' + error.message, 'error');
        }
    }

    /**
     * Load ads
     */
    async loadAds() {
        try {
            const { data, error } = await this.supabase
                .from('ads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const container = document.getElementById('adsList');
            if (!container) return;

            if (!data || data.length === 0) {
                container.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No ads found</td></tr>';
                return;
            }

            container.innerHTML = data.map(ad => `
                <tr>
                    <td>
                        <strong>${ad.title}</strong>
                        <br>
                        <small class="text-muted">${ad.content.substring(0, 50)}${ad.content.length > 50 ? '...' : ''}</small>
                    </td>
                    <td>${ad.image_url ? '📷 Yes' : 'No image'}</td>
                    <td><span class="status ${ad.is_active ? 'active' : 'inactive'}">
                        ${ad.is_active ? 'Active' : 'Inactive'}
                    </span></td>
                    <td>
                        <div class="btn-group">
                            <button class="btn-action toggle" onclick="adminManager.toggleAdStatus('${ad.id}')">
                                ${ad.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button class="btn-action delete" onclick="adminManager.deleteAd('${ad.id}')">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading ads:', error);
            throw error;
        }
    }

    /**
     * Add a new ad
     */
    async addAd() {
        const form = document.getElementById('addAdForm');
        const formData = new FormData(form);

        const adData = {
            title: formData.get('adTitle'),
            content: formData.get('adContent'),
            image_url: formData.get('adImage') || null,
            is_active: true
        };

        // Validate
        if (!adData.title || !adData.content) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || 'Add Ad';
        if (submitBtn) {
            submitBtn.textContent = 'Adding...';
            submitBtn.disabled = true;
        }

        try {
            const { error } = await this.supabase
                .from('ads')
                .insert([adData]);

            if (error) {
                throw error;
            }

            this.showNotification('Ad added successfully!', 'success');
            form.reset();
            await this.loadAds();

        } catch (error) {
            console.error('Error adding ad:', error);
            this.showNotification('Error adding ad: ' + error.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Toggle ad status
     */
    async toggleAdStatus(adId) {
        try {
            // Get current status
            const { data, error: fetchError } = await this.supabase
                .from('ads')
                .select('is_active')
                .eq('id', adId)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            const newStatus = !data.is_active;

            const { error } = await this.supabase
                .from('ads')
                .update({ is_active: newStatus })
                .eq('id', adId);

            if (error) {
                throw error;
            }

            this.showNotification(`Ad ${newStatus ? 'activated' : 'deactivated'}!`, 'success');
            await this.loadAds();
        } catch (error) {
            console.error('Error toggling ad status:', error);
            this.showNotification('Error updating ad: ' + error.message, 'error');
        }
    }

    /**
     * Delete an ad
     */
    async deleteAd(adId) {
        if (!confirm('Are you sure you want to delete this ad?')) return;

        try {
            const { error } = await this.supabase
                .from('ads')
                .delete()
                .eq('id', adId);

            if (error) {
                throw error;
            }

            this.showNotification('Ad deleted successfully!', 'success');
            await this.loadAds();
        } catch (error) {
            console.error('Error deleting ad:', error);
            this.showNotification('Error deleting ad: ' + error.message, 'error');
        }
    }

    /**
     * Load time slots
     */
    async loadTimeSlots() {
        try {
            const { data, error } = await this.supabase
                .from('time_slots')
                .select('*')
                .order('departure_time');

            if (error) {
                throw error;
            }

            const container = document.getElementById('timeSlotsList');
            if (!container) return;

            if (!data || data.length === 0) {
                container.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No time slots found</td></tr>';
                return;
            }

            container.innerHTML = data.map(slot => `
                <tr>
                    <td><strong>${slot.route}</strong></td>
                    <td>${slot.departure_time}</td>
                    <td><span class="status ${slot.is_active ? 'active' : 'inactive'}">
                        ${slot.is_active ? 'Active' : 'Inactive'}
                    </span></td>
                    <td>
                        <div class="btn-group">
                            <button class="btn-action toggle" onclick="adminManager.toggleTimeSlot('${slot.id}')">
                                ${slot.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button class="btn-action delete" onclick="adminManager.deleteTimeSlot('${slot.id}')">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading time slots:', error);
            throw error;
        }
    }

    /**
     * Add a new time slot
     */
    async addTimeSlot() {
        const form = document.getElementById('addTimeSlotForm');
        const formData = new FormData(form);

        const slotData = {
            route: formData.get('slotRoute'),
            departure_time: formData.get('slotTime'),
            is_active: true
        };

        // Validate
        if (!slotData.route || !slotData.departure_time) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || 'Add Time Slot';
        if (submitBtn) {
            submitBtn.textContent = 'Adding...';
            submitBtn.disabled = true;
        }

        try {
            const { error } = await this.supabase
                .from('time_slots')
                .insert([slotData]);

            if (error) {
                throw error;
            }

            this.showNotification('Time slot added successfully!', 'success');
            form.reset();
            await this.loadTimeSlots();

        } catch (error) {
            console.error('Error adding time slot:', error);
            this.showNotification('Error adding time slot: ' + error.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Toggle time slot active status
     */
    async toggleTimeSlot(slotId) {
        try {
            // Get current status
            const { data, error: fetchError } = await this.supabase
                .from('time_slots')
                .select('is_active')
                .eq('id', slotId)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            const newStatus = !data.is_active;

            const { error } = await this.supabase
                .from('time_slots')
                .update({ is_active: newStatus })
                .eq('id', slotId);

            if (error) {
                throw error;
            }

            this.showNotification(`Time slot ${newStatus ? 'activated' : 'deactivated'}!`, 'success');
            await this.loadTimeSlots();
        } catch (error) {
            console.error('Error toggling time slot:', error);
            this.showNotification('Error updating time slot: ' + error.message, 'error');
        }
    }

    /**
     * Delete a time slot
     */
    async deleteTimeSlot(slotId) {
        if (!confirm('Are you sure you want to delete this time slot?')) return;

        try {
            const { error } = await this.supabase
                .from('time_slots')
                .delete()
                .eq('id', slotId);

            if (error) {
                throw error;
            }

            this.showNotification('Time slot deleted successfully!', 'success');
            await this.loadTimeSlots();
        } catch (error) {
            console.error('Error deleting time slot:', error);
            this.showNotification('Error deleting time slot: ' + error.message, 'error');
        }
    }

    /**
     * Load drivers for dropdown
     */
    async loadDriversForDropdown() {
        try {
            const { data, error } = await this.supabase
                .from('drivers')
                .select('id, full_name, is_approved, is_active')
                .eq('is_approved', true)
                .eq('is_active', true);

            if (error) {
                throw error;
            }

            const select = document.getElementById('tripDriver');
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = '<option value="">Select Driver</option>';
            
            if (data && data.length > 0) {
                data.forEach(driver => {
                    const option = document.createElement('option');
                    option.value = driver.id;
                    option.textContent = driver.full_name;
                    select.appendChild(option);
                });
            }

            select.value = currentValue;
        } catch (error) {
            console.error('Error loading drivers for dropdown:', error);
        }
    }

    /**
     * Generate temporary password
     */
    generateTempPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    /**
     * Logout admin
     */
    async logout() {
        if (!confirm('Are you sure you want to logout?')) return;

        try {
            await this.supabase.auth.signOut();
            window.location.href = 'admin-login.html';
        } catch (error) {
            console.error('Error logging out:', error);
            this.showNotification('Error logging out: ' + error.message, 'error');
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }
}

// Initialize admin manager
const adminManager = new AdminManager();

// Expose for inline onclick handlers
window.adminManager = adminManager;

// Add CSS for admin notifications
const adminNotificationStyle = document.createElement('style');
adminNotificationStyle.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        animation: slideInRight 0.5s ease;
        max-width: 400px;
        transition: all 0.3s ease;
    }
    
    .notification.success {
        background: #28a745;
    }
    
    .notification.error {
        background: #dc3545;
    }
    
    .notification.info {
        background: #17a2b8;
    }
    
    .notification.warning {
        background: #ffc107;
        color: #333;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .btn-group {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }
    
    .text-center {
        text-align: center;
    }
    
    .text-muted {
        color: #888;
    }
    
    .status-select {
        padding: 4px 8px;
        border: 2px solid #ddd;
        border-radius: 4px;
        font-size: 0.8rem;
        background: white;
        cursor: pointer;
        margin-bottom: 4px;
    }
    
    .status-select:focus {
        outline: none;
        border-color: #f5a623;
    }
`;
document.head.appendChild(adminNotificationStyle);