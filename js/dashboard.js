/**
 * Luu Travels & Logistics - Dashboard Manager
 * Handles user dashboard functionality
 */

class DashboardManager {
    constructor() {
        // Initialize Supabase client
        this.supabase = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        
        this.user = auth.getCurrentUser();
        this.trackMap = null;
        this.trackingInterval = null;
        this.isTracking = false;
        this.selectedBookingId = null;
        
        // Initialize
        this.init();
    }

    /**
     * Initialize dashboard manager
     */
    async init() {
        // Check authentication
        if (!this.user) {
            window.location.href = 'login.html';
            return;
        }

        // Load dashboard data
        await this.loadUserInfo();
        await this.loadBookings();
        await this.loadTrackOptions();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Dashboard manager initialized');
    }

    /**
     * Load user information
     */
    async loadUserInfo() {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', this.user.id)
                .single();

            if (error) {
                throw error;
            }

            const container = document.getElementById('userInfo');
            if (!container) return;

            container.innerHTML = `
                <div class="user-profile">
                    <div class="user-avatar">
                        <span>${(data.full_name || 'U').charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="user-details">
                        <p><strong>Full Name:</strong> ${data.full_name || 'N/A'}</p>
                        <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${data.phone || 'N/A'}</p>
                        <p><strong>ID Number:</strong> ${data.id_number || 'N/A'}</p>
                        ${data.passport_number ? `<p><strong>Passport:</strong> ${data.passport_number}</p>` : ''}
                        <p><strong>Member Since:</strong> ${new Date(data.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading user info:', error);
            this.showNotification('Error loading profile information', 'error');
        }
    }

    /**
     * Load user bookings
     */
    async loadBookings() {
        try {
            const { data, error } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    trip:trips (
                        id,
                        route,
                        departure_time,
                        pickup_location,
                        dropoff_location,
                        price,
                        drivers (
                            id,
                            full_name,
                            phone,
                            vehicle_model,
                            vehicle_color,
                            vehicle_registration
                        )
                    )
                `)
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const container = document.getElementById('myBookings');
            if (!container) return;

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📋</span>
                        <h4>No Bookings Yet</h4>
                        <p>You haven't made any bookings. Start your journey with us!</p>
                        <a href="booking.html" class="btn-link">Book a Trip Now →</a>
                    </div>
                `;
                return;
            }

            container.innerHTML = data.map(booking => `
                <div class="booking-item" data-booking-id="${booking.id}">
                    <div class="booking-header">
                        <span class="status ${booking.booking_status}">${booking.booking_status}</span>
                        <span class="booking-date">
                            ${new Date(booking.created_at).toLocaleDateString()}
                            <br>
                            <small>${new Date(booking.created_at).toLocaleTimeString()}</small>
                        </span>
                    </div>
                    <div class="booking-details">
                        <p><strong>Route:</strong> ${booking.trip?.route || 'Unknown'}</p>
                        <p><strong>Departure:</strong> ${booking.trip?.departure_time ? new Date(booking.trip.departure_time).toLocaleString() : 'N/A'}</p>
                        <p><strong>Pickup:</strong> ${booking.pickup_location || booking.trip?.pickup_location || 'N/A'}</p>
                        <p><strong>Dropoff:</strong> ${booking.dropoff_location || booking.trip?.dropoff_location || 'N/A'}</p>
                        <p><strong>Driver:</strong> ${booking.trip?.drivers?.full_name || 'To be assigned'}</p>
                        <p><strong>Vehicle:</strong> ${booking.trip?.drivers?.vehicle_model || 'N/A'} ${booking.trip?.drivers?.vehicle_color ? `(${booking.trip.drivers.vehicle_color})` : ''}</p>
                        <p><strong>Seats:</strong> ${booking.number_of_seats}</p>
                        <p><strong>Total:</strong> <span class="total-price">R${booking.total_price?.toFixed(2) || '0.00'}</span></p>
                        <p><strong>Payment:</strong> ${booking.payment_method || 'N/A'}</p>
                        ${booking.booking_status === 'confirmed' || booking.booking_status === 'completed' ? 
                            `<button class="btn-track" onclick="dashboardManager.trackBooking('${booking.id}')">
                                🚗 Track Driver
                            </button>` : 
                            ''
                        }
                        ${booking.booking_status === 'pending' ? 
                            `<button class="btn-cancel" onclick="dashboardManager.cancelBooking('${booking.id}')">
                                Cancel Booking
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading bookings:', error);
            this.showNotification('Error loading your bookings', 'error');
        }
    }

    /**
     * Load tracking options
     */
    async loadTrackOptions() {
        try {
            const { data, error } = await this.supabase
                .from('bookings')
                .select('id, trip:trips (route)')
                .eq('user_id', this.user.id)
                .in('booking_status', ['confirmed', 'completed']);

            if (error) {
                throw error;
            }

            const select = document.getElementById('bookingSelect');
            if (!select) return;

            select.innerHTML = '<option value="">Select a booking to track</option>';
            
            if (data && data.length > 0) {
                data.forEach(booking => {
                    const option = document.createElement('option');
                    option.value = booking.id;
                    option.textContent = `${booking.trip?.route || 'Trip'} - ${new Date(booking.created_at).toLocaleDateString()}`;
                    select.appendChild(option);
                });
            } else {
                select.innerHTML += '<option value="" disabled>No bookings available for tracking</option>';
            }
        } catch (error) {
            console.error('Error loading track options:', error);
        }
    }

    /**
     * Track a booking
     */
    async trackBooking(bookingId) {
        if (this.isTracking && this.selectedBookingId === bookingId) {
            // Stop tracking if already tracking this booking
            this.stopTracking();
            return;
        }

        // Stop any existing tracking
        this.stopTracking();

        this.selectedBookingId = bookingId;
        
        // Show tracking container
        document.getElementById('driverLocation').style.display = 'block';
        document.getElementById('trackMap').style.display = 'block';
        
        // Update button text
        const trackBtn = document.querySelector(`[data-booking-id="${bookingId}"] .btn-track`);
        if (trackBtn) {
            trackBtn.textContent = '⏳ Loading...';
            trackBtn.disabled = true;
        }

        try {
            // Get booking details with driver info
            const { data, error } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    trip:trips (
                        *,
                        driver:drivers (
                            id,
                            full_name,
                            phone,
                            current_location,
                            vehicle_model,
                            vehicle_color,
                            vehicle_registration,
                            is_active
                        )
                    )
                `)
                .eq('id', bookingId)
                .single();

            if (error) {
                throw error;
            }

            if (!data.trip.driver) {
                this.showNotification('Driver not assigned yet', 'warning');
                document.getElementById('driverLocation').style.display = 'none';
                return;
            }

            if (!data.trip.driver.current_location) {
                this.showNotification('Driver location not available yet. Please check back later.', 'info');
                document.getElementById('driverLocation').style.display = 'none';
                return;
            }

            // Display driver info
            document.getElementById('driverName').textContent = data.trip.driver.full_name;
            document.getElementById('driverPhone').textContent = data.trip.driver.phone || 'N/A';
            document.getElementById('driverVehicle').textContent = 
                `${data.trip.driver.vehicle_model} (${data.trip.driver.vehicle_color}) - ${data.trip.driver.vehicle_registration}`;
            document.getElementById('driverStatus').textContent = data.trip.driver.is_active ? 'Active' : 'Inactive';
            document.getElementById('driverStatus').className = `status ${data.trip.driver.is_active ? 'active' : 'inactive'}`;

            // Show driver location on map
            this.showDriverLocation(data.trip.driver.current_location);
            
            // Start real-time tracking
            this.startTracking(bookingId);

            // Update button
            if (trackBtn) {
                trackBtn.textContent = '⏹ Stop Tracking';
                trackBtn.disabled = false;
            }

            this.showNotification('Tracking started!', 'success');

        } catch (error) {
            console.error('Error tracking booking:', error);
            this.showNotification('Error tracking driver: ' + error.message, 'error');
            document.getElementById('driverLocation').style.display = 'none';
            
            if (trackBtn) {
                trackBtn.textContent = '🚗 Track Driver';
                trackBtn.disabled = false;
            }
        }
    }

    /**
     * Show driver location on map
     */
    showDriverLocation(location) {
        const mapContainer = document.getElementById('trackMap');
        if (!mapContainer) return;

        // Create map if not exists
        if (!this.trackMap) {
            this.trackMap = L.map('trackMap', {
                center: [location.lat, location.lng],
                zoom: 14,
                zoomControl: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(this.trackMap);

            L.control.scale({
                position: 'bottomleft',
                metric: true,
                imperial: false
            }).addTo(this.trackMap);
        } else {
            this.trackMap.setView([location.lat, location.lng], 14);
        }

        // Remove existing marker
        if (this.driverMarker) {
            this.trackMap.removeLayer(this.driverMarker);
        }

        // Create custom driver marker
        const icon = L.divIcon({
            className: 'driver-marker',
            html: `
                <div style="background:#f5a623;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;animation:pulse 2s infinite;">
                    🚗
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        this.driverMarker = L.marker([location.lat, location.lng], { icon: icon })
            .bindPopup(`
                <strong>Current Location</strong><br>
                Lat: ${location.lat.toFixed(6)}<br>
                Lng: ${location.lng.toFixed(6)}<br>
                <small>Updated: ${new Date().toLocaleTimeString()}</small>
            `)
            .addTo(this.trackMap);

        // Add a circle around driver
        if (this.driverCircle) {
            this.trackMap.removeLayer(this.driverCircle);
        }
        
        this.driverCircle = L.circle([location.lat, location.lng], {
            radius: 100,
            color: '#f5a623',
            fillColor: '#f5a623',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(this.trackMap);

        // Update popup with timestamp
        setInterval(() => {
            if (this.driverMarker) {
                this.driverMarker.setPopupContent(`
                    <strong>Current Location</strong><br>
                    Lat: ${location.lat.toFixed(6)}<br>
                    Lng: ${location.lng.toFixed(6)}<br>
                    <small>Updated: ${new Date().toLocaleTimeString()}</small>
                `);
            }
        }, 10000);

        // Show map
        mapContainer.style.display = 'block';
    }

    /**
     * Start real-time tracking
     */
    startTracking(bookingId) {
        this.isTracking = true;
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }

        // Update every 10 seconds
        this.trackingInterval = setInterval(async () => {
            if (!this.isTracking || this.selectedBookingId !== bookingId) {
                return;
            }

            try {
                const { data, error } = await this.supabase
                    .from('bookings')
                    .select(`
                        trip:trips (
                            driver:drivers (
                                current_location
                            )
                        )
                    `)
                    .eq('id', bookingId)
                    .single();

                if (error) {
                    throw error;
                }

                if (data.trip.driver && data.trip.driver.current_location) {
                    this.showDriverLocation(data.trip.driver.current_location);
                }
            } catch (error) {
                console.error('Error updating tracking:', error);
            }
        }, 10000);
    }

    /**
     * Stop tracking
     */
    stopTracking() {
        this.isTracking = false;
        this.selectedBookingId = null;
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }

        // Reset UI
        document.getElementById('driverLocation').style.display = 'none';
        
        // Update all track buttons
        document.querySelectorAll('.btn-track').forEach(btn => {
            btn.textContent = '🚗 Track Driver';
            btn.disabled = false;
        });
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(bookingId) {
        if (!confirm('Are you sure you want to cancel this booking?')) return;

        try {
            // Get booking details to restore seats
            const { data: booking, error: fetchError } = await this.supabase
                .from('bookings')
                .select('trip_id, number_of_seats')
                .eq('id', bookingId)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            // Update booking status
            const { error } = await this.supabase
                .from('bookings')
                .update({ 
                    booking_status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

            if (error) {
                throw error;
            }

            // Restore seats
            if (booking.trip_id) {
                await this.supabase
                    .from('trips')
                    .update({
                        available_seats: this.supabase.raw('available_seats + ?', [booking.number_of_seats])
                    })
                    .eq('id', booking.trip_id);
            }

            this.showNotification('Booking cancelled successfully!', 'success');
            
            // Refresh bookings list
            await this.loadBookings();
            await this.loadTrackOptions();

        } catch (error) {
            console.error('Error cancelling booking:', error);
            this.showNotification('Error cancelling booking: ' + error.message, 'error');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            auth.signOut();
        });

        // Track button from track section
        document.getElementById('trackBtn')?.addEventListener('click', () => {
            const select = document.getElementById('bookingSelect');
            if (select && select.value) {
                this.trackBooking(select.value);
            } else {
                this.showNotification('Please select a booking to track', 'warning');
            }
        });

        // Refresh button
        document.querySelector('.btn-refresh')?.addEventListener('click', () => {
            this.loadBookings();
            this.loadTrackOptions();
            this.showNotification('Dashboard refreshed!', 'success');
        });
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

// Initialize dashboard manager
const dashboardManager = new DashboardManager();

// Expose for inline onclick handlers
window.dashboardManager = dashboardManager;

// Add CSS for dashboard styles
const dashboardStyle = document.createElement('style');
dashboardStyle.textContent = `
    .user-profile {
        display: flex;
        gap: 20px;
        align-items: flex-start;
    }
    
    .user-avatar {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: #f5a623;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: bold;
        flex-shrink: 0;
    }
    
    .user-details {
        flex: 1;
    }
    
    .user-details p {
        padding: 4px 0;
        border-bottom: 1px solid #f4f4f4;
        font-size: 0.9rem;
    }
    
    .user-details p:last-child {
        border-bottom: none;
    }
    
    .user-details strong {
        color: #1a3c5e;
        min-width: 120px;
        display: inline-block;
    }
    
    .btn-track {
        padding: 6px 16px;
        background: #17a2b8;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 5px;
    }
    
    .btn-track:hover {
        background: #138496;
        transform: translateY(-1px);
    }
    
    .btn-cancel {
        padding: 6px 16px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 5px;
        margin-left: 5px;
    }
    
    .btn-cancel:hover {
        background: #c82333;
        transform: translateY(-1px);
    }
    
    #trackMap {
        width: 100%;
        height: 300px;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid #ddd;
        margin-top: 10px;
        display: none;
    }
    
    .driver-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 20px;
        margin: 10px 0;
        padding: 10px;
        background: #f9f9f9;
        border-radius: 8px;
    }
    
    .driver-info-grid p {
        font-size: 0.9rem;
        padding: 2px 0;
    }
    
    .driver-info-grid strong {
        color: #1a3c5e;
    }
    
    #driverLocation {
        display: none;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
    }
    
    .driver-marker {
        animation: pulse 2s infinite;
    }
    
    .empty-state {
        text-align: center;
        padding: 30px 20px;
        color: #888;
    }
    
    .empty-state .empty-icon {
        font-size: 3rem;
        display: block;
        margin-bottom: 10px;
    }
    
    .empty-state h4 {
        color: #333;
        margin-bottom: 5px;
    }
    
    .empty-state .btn-link {
        display: inline-block;
        margin-top: 10px;
        color: #f5a623;
        font-weight: 600;
        text-decoration: none;
    }
    
    .empty-state .btn-link:hover {
        text-decoration: underline;
    }
    
    .booking-item .btn-track {
        margin-top: 8px;
    }
`;
document.head.appendChild(dashboardStyle);