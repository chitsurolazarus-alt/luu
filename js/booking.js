/**
 * Luu Travels & Logistics - Booking Manager
 * Handles trip booking, map integration, and ride tracking
 */

class BookingManager {
    constructor() {
        // Initialize Supabase client
        this.supabase = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        
        // Map related properties
        this.map = null;
        this.pickupMarker = null;
        this.dropoffMarker = null;
        this.routePolyline = null;
        this.driverMarker = null;
        
        // Location properties
        this.pickupLocation = null;
        this.dropoffLocation = null;
        this.distanceMatrix = null;
        this.selectedTrip = null;
        
        // State
        this.isTracking = false;
        this.trackingInterval = null;
        this.availableTrips = [];
        this.timeSlots = [];
        this.ads = [];
        
        // Initialize
        this.init();
    }

    /**
     * Initialize booking manager
     */
    init() {
        // Check authentication
        if (!auth.isAuthenticated()) {
            // Redirect to login if not authenticated
            const isBookingPage = window.location.pathname.includes('booking.html');
            if (isBookingPage) {
                sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                window.location.href = 'login.html';
                return;
            }
        }
        
        // Initialize map
        this.initMap();
        
        // Load data
        this.loadTimeSlots();
        this.loadAvailableTrips();
        this.loadAds();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Booking manager initialized');
    }

    /**
     * Initialize the map
     */
    initMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.warn('Map container not found');
            return;
        }

        try {
            // Create map instance
            this.map = L.map('map', {
                center: MAP_CONFIG.defaultCenter,
                zoom: MAP_CONFIG.defaultZoom,
                zoomControl: true,
                fadeAnimation: true,
                attributionControl: true
            });

            // Add tile layer
            L.tileLayer(MAP_CONFIG.tileLayer, {
                attribution: MAP_CONFIG.tileAttribution,
                maxZoom: MAP_CONFIG.maxZoom,
                minZoom: MAP_CONFIG.minZoom
            }).addTo(this.map);

            // Add scale control
            L.control.scale({
                position: 'bottomleft',
                metric: true,
                imperial: false
            }).addTo(this.map);

            // Set bounds to South Africa
            this.map.setMaxBounds([
                [SA_BOUNDS.south, SA_BOUNDS.west],
                [SA_BOUNDS.north, SA_BOUNDS.east]
            ]);

            // Add click handler for selecting locations
            this.map.on('click', (e) => this.handleMapClick(e));

            console.log('Map initialized successfully');
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showNotification('Error loading map. Please refresh the page.', 'error');
        }
    }

    /**
     * Handle map click events
     */
    handleMapClick(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Reverse geocode the coordinates
        this.reverseGeocode(lat, lng).then(address => {
            if (!this.pickupLocation) {
                this.setPickupLocation(lat, lng, address);
            } else if (!this.dropoffLocation) {
                this.setDropoffLocation(lat, lng, address);
            } else {
                // If both locations are set, allow resetting by clicking again
                this.resetLocations();
                this.setPickupLocation(lat, lng, address);
            }
        }).catch(error => {
            console.error('Reverse geocoding error:', error);
            // Use coordinates as fallback
            const fallbackAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            if (!this.pickupLocation) {
                this.setPickupLocation(lat, lng, fallbackAddress);
            } else if (!this.dropoffLocation) {
                this.setDropoffLocation(lat, lng, fallbackAddress);
            }
        });
    }

    /**
     * Reverse geocode coordinates to address
     */
    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`
            );
            
            if (!response.ok) {
                throw new Error('Geocoding request failed');
            }
            
            const data = await response.json();
            
            if (data && data.display_name) {
                return data.display_name;
            } else {
                throw new Error('No address found');
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            throw error;
        }
    }

    /**
     * Set pickup location
     */
    setPickupLocation(lat, lng, address) {
        this.pickupLocation = { lat, lng, address };
        
        // Update marker
        if (this.pickupMarker) {
            this.map.removeLayer(this.pickupMarker);
        }
        
        const icon = L.divIcon({
            className: 'custom-marker pickup-marker',
            html: '<div style="background:#28a745;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        this.pickupMarker = L.marker([lat, lng], { icon: icon })
            .bindPopup(`<strong>Pickup:</strong><br>${address}`)
            .addTo(this.map);

        // Update UI
        document.getElementById('pickupLocation').textContent = address;
        
        // Calculate distance if both locations are set
        if (this.pickupLocation && this.dropoffLocation) {
            this.calculateDistance();
            this.drawRoute();
        }
    }

    /**
     * Set dropoff location
     */
    setDropoffLocation(lat, lng, address) {
        this.dropoffLocation = { lat, lng, address };
        
        // Update marker
        if (this.dropoffMarker) {
            this.map.removeLayer(this.dropoffMarker);
        }
        
        const icon = L.divIcon({
            className: 'custom-marker dropoff-marker',
            html: '<div style="background:#dc3545;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        this.dropoffMarker = L.marker([lat, lng], { icon: icon })
            .bindPopup(`<strong>Dropoff:</strong><br>${address}`)
            .addTo(this.map);

        // Update UI
        document.getElementById('dropoffLocation').textContent = address;
        
        // Calculate distance if both locations are set
        if (this.pickupLocation && this.dropoffLocation) {
            this.calculateDistance();
            this.drawRoute();
        }
    }

    /**
     * Calculate distance and price using Haversine formula
     */
    calculateDistance() {
        if (!this.pickupLocation || !this.dropoffLocation) return;

        const R = 6371; // Earth's radius in km
        const lat1 = this.pickupLocation.lat * Math.PI / 180;
        const lon1 = this.pickupLocation.lng * Math.PI / 180;
        const lat2 = this.dropoffLocation.lat * Math.PI / 180;
        const lon2 = this.dropoffLocation.lng * Math.PI / 180;

        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // Calculate price
        const price = distance * RATE_PER_KM;

        this.distanceMatrix = {
            distance: Math.round(distance * 10) / 10,
            price: Math.round(price * 100) / 100
        };

        // Update UI
        document.getElementById('distanceDisplay').textContent = `${this.distanceMatrix.distance} km`;
        document.getElementById('priceDisplay').textContent = `R${this.distanceMatrix.price.toFixed(2)}`;
    }

    /**
     * Draw route on map
     */
    drawRoute() {
        if (!this.pickupLocation || !this.dropoffLocation) return;

        const latlngs = [
            [this.pickupLocation.lat, this.pickupLocation.lng],
            [this.dropoffLocation.lat, this.dropoffLocation.lng]
        ];

        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
        }

        this.routePolyline = L.polyline(latlngs, {
            color: '#f5a623',
            weight: 4,
            opacity: 0.8,
            dashArray: null,
            lineJoin: 'round'
        }).addTo(this.map);

        // Fit map to route
        this.map.fitBounds(latlngs, {
            padding: [50, 50],
            maxZoom: 13
        });

        // Add start and end markers with labels
        this.addRouteLabels();
    }

    /**
     * Add route labels
     */
    addRouteLabels() {
        // Remove existing labels
        document.querySelectorAll('.route-label').forEach(el => el.remove());

        if (!this.pickupLocation || !this.dropoffLocation) return;

        // Pickup label
        const pickupLabel = L.marker([this.pickupLocation.lat, this.pickupLocation.lng], {
            icon: L.divIcon({
                className: 'route-label',
                html: '<div style="background:#28a745;color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;">PICKUP</div>',
                iconSize: [60, 20],
                iconAnchor: [30, 0]
            })
        }).addTo(this.map);

        // Dropoff label
        const dropoffLabel = L.marker([this.dropoffLocation.lat, this.dropoffLocation.lng], {
            icon: L.divIcon({
                className: 'route-label',
                html: '<div style="background:#dc3545;color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;">DROPOFF</div>',
                iconSize: [65, 20],
                iconAnchor: [32, 0]
            })
        }).addTo(this.map);
    }

    /**
     * Reset locations
     */
    resetLocations() {
        this.pickupLocation = null;
        this.dropoffLocation = null;
        this.distanceMatrix = null;
        
        if (this.pickupMarker) {
            this.map.removeLayer(this.pickupMarker);
            this.pickupMarker = null;
        }
        
        if (this.dropoffMarker) {
            this.map.removeLayer(this.dropoffMarker);
            this.dropoffMarker = null;
        }
        
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
            this.routePolyline = null;
        }
        
        document.getElementById('pickupLocation').textContent = 'Not set';
        document.getElementById('dropoffLocation').textContent = 'Not set';
        document.getElementById('distanceDisplay').textContent = '0 km';
        document.getElementById('priceDisplay').textContent = 'R0.00';
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Book trip button
        const bookBtn = document.getElementById('bookTripBtn');
        if (bookBtn) {
            bookBtn.addEventListener('click', () => this.bookTrip());
        }

        // Route select
        const routeSelect = document.getElementById('routeSelect');
        if (routeSelect) {
            routeSelect.addEventListener('change', () => this.loadAvailableTrips());
        }

        // Seats input
        const seatsInput = document.getElementById('seatsInput');
        if (seatsInput) {
            seatsInput.addEventListener('change', () => this.updateTotalPrice());
            seatsInput.addEventListener('input', () => this.updateTotalPrice());
        }

        // Payment method change
        document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
            input.addEventListener('change', () => this.updateTotalPrice());
        });
    }

    /**
     * Load time slots
     */
    async loadTimeSlots() {
        try {
            const { data, error } = await this.supabase
                .from('time_slots')
                .select('*')
                .eq('is_active', true)
                .order('departure_time');

            if (error) {
                throw error;
            }

            this.timeSlots = data || [];
            this.displayTimeSlots();
        } catch (error) {
            console.error('Error loading time slots:', error);
            this.showNotification('Error loading time slots', 'error');
        }
    }

    /**
     * Display time slots
     */
    displayTimeSlots() {
        const container = document.getElementById('timeSlots');
        if (!container) return;

        if (this.timeSlots.length === 0) {
            container.innerHTML = '<p class="text-muted">No time slots available</p>';
            return;
        }

        container.innerHTML = this.timeSlots.map(slot => `
            <div class="time-slot" data-route="${slot.route}">
                <span>${slot.route}</span>
                <span>${slot.departure_time}</span>
            </div>
        `).join('');
    }

    /**
     * Load available trips
     */
    async loadAvailableTrips() {
        try {
            const route = document.getElementById('routeSelect')?.value;
            
            let query = this.supabase
                .from('trips')
                .select(`
                    *,
                    drivers:drivers (
                        id,
                        full_name,
                        vehicle_model,
                        vehicle_color,
                        vehicle_registration,
                        capacity
                    )
                `)
                .eq('status', 'scheduled')
                .gte('departure_time', new Date().toISOString());

            if (route && route !== 'all') {
                query = query.eq('route', route);
            }

            const { data, error } = await query.order('departure_time');

            if (error) {
                throw error;
            }

            this.availableTrips = data || [];
            this.displayAvailableTrips();
        } catch (error) {
            console.error('Error loading trips:', error);
            this.showNotification('Error loading available trips', 'error');
        }
    }

    /**
     * Display available trips
     */
    displayAvailableTrips() {
        const container = document.getElementById('availableTrips');
        if (!container) return;

        if (this.availableTrips.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🚌</span>
                    <h4>No Trips Available</h4>
                    <p>There are currently no trips scheduled. Please check back later.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.availableTrips.map(trip => `
            <div class="trip-card ${this.selectedTrip === trip.id ? 'selected' : ''}" 
                 data-trip-id="${trip.id}"
                 onclick="bookingManager.selectTrip('${trip.id}')">
                <h4>${trip.route}</h4>
                <p>Departure: ${new Date(trip.departure_time).toLocaleString()}</p>
                <p>Driver: ${trip.drivers?.full_name || 'To be assigned'}</p>
                <p>Vehicle: ${trip.drivers?.vehicle_model || 'N/A'} (${trip.drivers?.vehicle_color || 'N/A'})</p>
                <p>Available: ${trip.available_seats} seats</p>
                <p class="price">R${trip.price}</p>
                <button class="btn-select" data-trip-id="${trip.id}">Select</button>
            </div>
        `).join('');

        // Add click handlers for select buttons
        container.querySelectorAll('.btn-select').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tripId = btn.dataset.tripId;
                this.selectTrip(tripId);
            });
        });
    }

    /**
     * Select a trip
     */
    selectTrip(tripId) {
        this.selectedTrip = tripId;
        
        // Update UI
        document.querySelectorAll('.trip-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.querySelector(`[data-trip-id="${tripId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        // Enable book button
        const bookBtn = document.getElementById('bookTripBtn');
        if (bookBtn) {
            bookBtn.disabled = false;
        }

        // Update total price
        this.updateTotalPrice();
    }

    /**
     * Update total price based on seats
     */
    updateTotalPrice() {
        if (!this.selectedTrip || !this.distanceMatrix) {
            return;
        }

        const seats = parseInt(document.getElementById('seatsInput')?.value || 1);
        const total = this.distanceMatrix.price * seats;
        
        const totalDisplay = document.getElementById('totalPriceDisplay');
        if (totalDisplay) {
            totalDisplay.textContent = `R${total.toFixed(2)}`;
        }
    }

    /**
     * Book a trip
     */
    async bookTrip() {
        // Check authentication
        if (!auth.isAuthenticated()) {
            this.showNotification('Please login to book a trip', 'error');
            window.location.href = 'login.html';
            return;
        }

        // Validate selection
        if (!this.selectedTrip) {
            this.showNotification('Please select a trip', 'error');
            return;
        }

        if (!this.pickupLocation || !this.dropoffLocation) {
            this.showNotification('Please set pickup and dropoff locations on the map', 'error');
            return;
        }

        const seats = parseInt(document.getElementById('seatsInput')?.value || 1);
        if (seats < MIN_BOOKING_SEATS) {
            this.showNotification('Please select at least 1 seat', 'error');
            return;
        }

        // Get selected trip
        const trip = this.availableTrips.find(t => t.id === this.selectedTrip);
        if (!trip) {
            this.showNotification('Selected trip not found', 'error');
            return;
        }

        // Check seat availability
        if (seats > trip.available_seats) {
            this.showNotification(`Only ${trip.available_seats} seats available`, 'error');
            return;
        }

        // Get payment method
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        if (!paymentMethod) {
            this.showNotification('Please select a payment method', 'error');
            return;
        }

        // Calculate total price
        const totalPrice = this.distanceMatrix.price * seats;

        // Prepare booking data
        const bookingData = {
            user_id: auth.getCurrentUser().id,
            trip_id: this.selectedTrip,
            number_of_seats: seats,
            total_price: totalPrice,
            payment_method: paymentMethod,
            pickup_location: this.pickupLocation.address,
            dropoff_location: this.dropoffLocation.address,
            pickup_coordinates: {
                lat: this.pickupLocation.lat,
                lng: this.pickupLocation.lng
            },
            dropoff_coordinates: {
                lat: this.dropoffLocation.lat,
                lng: this.dropoffLocation.lng
            },
            special_requests: document.getElementById('specialRequests')?.value || '',
            booking_status: 'pending'
        };

        // Show loading state
        const bookBtn = document.getElementById('bookTripBtn');
        const originalText = bookBtn?.textContent || 'Book Now';
        if (bookBtn) {
            bookBtn.textContent = 'Processing...';
            bookBtn.disabled = true;
        }

        try {
            // Create booking
            const { data, error } = await this.supabase
                .from('bookings')
                .insert([bookingData])
                .select();

            if (error) {
                throw error;
            }

            // Update trip available seats
            await this.supabase
                .from('trips')
                .update({
                    available_seats: trip.available_seats - seats
                })
                .eq('id', this.selectedTrip);

            // Show success
            this.showNotification('Booking confirmed! Check your dashboard for details.', 'success');
            
            // Reset form
            this.resetForm();
            
            // Redirect to dashboard after short delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);

        } catch (error) {
            console.error('Booking error:', error);
            this.showNotification('Error creating booking: ' + error.message, 'error');
        } finally {
            // Restore button
            if (bookBtn) {
                bookBtn.textContent = originalText;
                bookBtn.disabled = false;
            }
        }
    }

    /**
     * Reset booking form
     */
    resetForm() {
        this.selectedTrip = null;
        this.pickupLocation = null;
        this.dropoffLocation = null;
        this.distanceMatrix = null;
        
        // Reset map
        if (this.pickupMarker) {
            this.map.removeLayer(this.pickupMarker);
            this.pickupMarker = null;
        }
        if (this.dropoffMarker) {
            this.map.removeLayer(this.dropoffMarker);
            this.dropoffMarker = null;
        }
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
            this.routePolyline = null;
        }
        
        // Reset UI
        document.getElementById('pickupLocation').textContent = 'Not set';
        document.getElementById('dropoffLocation').textContent = 'Not set';
        document.getElementById('distanceDisplay').textContent = '0 km';
        document.getElementById('priceDisplay').textContent = 'R0.00';
        document.getElementById('seatsInput').value = 1;
        document.getElementById('specialRequests').value = '';
        
        document.querySelectorAll('.trip-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const bookBtn = document.getElementById('bookTripBtn');
        if (bookBtn) {
            bookBtn.disabled = true;
        }

        // Center map
        this.map.setView(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom);
    }

    /**
     * Load ads
     */
    async loadAds() {
        try {
            const { data, error } = await this.supabase
                .from('ads')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.ads = data || [];
            this.displayAds();
        } catch (error) {
            console.error('Error loading ads:', error);
        }
    }

    /**
     * Display ads
     */
    displayAds() {
        const container = document.getElementById('adsContainer');
        if (!container) return;

        if (this.ads.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = this.ads.map(ad => `
            <div class="ad-card">
                ${ad.image_url ? `<img src="${ad.image_url}" alt="${ad.title}" onerror="this.style.display='none'">` : ''}
                <h4>${ad.title}</h4>
                <p>${ad.content}</p>
            </div>
        `).join('');
    }

    /**
     * Track driver location
     */
    async trackDriver(bookingId) {
        try {
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
                            vehicle_registration
                        )
                    )
                `)
                .eq('id', bookingId)
                .single();

            if (error) {
                throw error;
            }

            if (!data.trip.driver.current_location) {
                this.showNotification('Driver location not available yet', 'info');
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error tracking driver:', error);
            this.showNotification('Error tracking driver', 'error');
            return null;
        }
    }

    /**
     * Show driver on map
     */
    showDriverOnMap(driverData) {
        if (!this.map) return;

        const location = driverData.trip.driver.current_location;
        
        // Center map on driver
        this.map.setView([location.lat, location.lng], 14);

        // Update or create driver marker
        if (this.driverMarker) {
            this.map.removeLayer(this.driverMarker);
        }

        const icon = L.divIcon({
            className: 'driver-marker',
            html: `
                <div style="background:#f5a623;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">
                    🚗
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        this.driverMarker = L.marker([location.lat, location.lng], { icon: icon })
            .bindPopup(`
                <strong>${driverData.trip.driver.full_name}</strong><br>
                Vehicle: ${driverData.trip.driver.vehicle_model}<br>
                Registration: ${driverData.trip.driver.vehicle_registration}
            `)
            .addTo(this.map);

        // Add pulsing animation
        const pulseStyle = document.createElement('style');
        pulseStyle.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.3); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
            }
            .driver-marker {
                animation: pulse 2s infinite;
            }
        `;
        document.head.appendChild(pulseStyle);
    }

    /**
     * Start tracking driver location in real-time
     */
    startTracking(bookingId) {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }

        this.isTracking = true;

        // Initial track
        this.trackDriver(bookingId).then(data => {
            if (data) {
                this.showDriverOnMap(data);
            }
        });

        // Set up interval
        this.trackingInterval = setInterval(async () => {
            if (!this.isTracking) return;
            
            const data = await this.trackDriver(bookingId);
            if (data) {
                this.showDriverOnMap(data);
            }
        }, 5000); // Update every 5 seconds
    }

    /**
     * Stop tracking
     */
    stopTracking() {
        this.isTracking = false;
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        if (this.driverMarker) {
            this.map.removeLayer(this.driverMarker);
            this.driverMarker = null;
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

// Initialize booking manager
const bookingManager = new BookingManager();

// Expose for inline onclick handlers
window.bookingManager = bookingManager;

// Add CSS for custom markers
const markerStyle = document.createElement('style');
markerStyle.textContent = `
    .custom-marker {
        background: none;
        border: none;
    }
    
    .pickup-marker {
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    
    .dropoff-marker {
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    
    .route-label {
        background: none;
        border: none;
        font-weight: bold;
    }
    
    .driver-marker {
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
    }
`;
document.head.appendChild(markerStyle);