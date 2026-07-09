/**
 * Luu Travels & Logistics - Map Manager
 * Handles all map-related functionality including location selection, routing, and tracking
 */

class MapManager {
    constructor() {
        // Map instance
        this.map = null;
        this.mapContainer = null;
        
        // Markers
        this.pickupMarker = null;
        this.dropoffMarker = null;
        this.driverMarker = null;
        this.userMarker = null;
        
        // Layers
        this.routePolyline = null;
        this.routeLayer = null;
        this.trafficLayer = null;
        
        // Location data
        this.pickupLocation = null;
        this.dropoffLocation = null;
        this.currentLocation = null;
        this.driverLocation = null;
        
        // State
        this.isTracking = false;
        this.trackingInterval = null;
        this.isSelectingPickup = false;
        this.isSelectingDropoff = false;
        this.routeCalculated = false;
        
        // Geocoding cache
        this.geocodeCache = new Map();
        
        // Map configuration
        this.config = {
            center: MAP_CONFIG.defaultCenter,
            zoom: MAP_CONFIG.defaultZoom,
            maxZoom: MAP_CONFIG.maxZoom,
            minZoom: MAP_CONFIG.minZoom,
            tileLayer: MAP_CONFIG.tileLayer,
            tileAttribution: MAP_CONFIG.tileAttribution,
            bounds: [
                [SA_BOUNDS.south, SA_BOUNDS.west],
                [SA_BOUNDS.north, SA_BOUNDS.east]
            ]
        };
        
        // Initialize
        this.init();
    }

    /**
     * Initialize the map
     */
    init() {
        this.mapContainer = document.getElementById('map');
        if (!this.mapContainer) {
            console.warn('Map container not found');
            return;
        }

        try {
            this.createMap();
            this.setupControls();
            this.setupEventListeners();
            this.loadSavedLocations();
            
            console.log('Map manager initialized successfully');
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to initialize map. Please refresh the page.');
        }
    }

    /**
     * Create the map instance
     */
    createMap() {
        // Create map
        this.map = L.map(this.mapContainer, {
            center: this.config.center,
            zoom: this.config.zoom,
            maxZoom: this.config.maxZoom,
            minZoom: this.config.minZoom,
            zoomControl: true,
            fadeAnimation: true,
            attributionControl: true,
            wheelPxPerZoomLevel: 120,
            zoomSnap: 0.5,
            zoomDelta: 0.5
        });

        // Add tile layer
        L.tileLayer(this.config.tileLayer, {
            attribution: this.config.tileAttribution,
            maxZoom: this.config.maxZoom,
            minZoom: this.config.minZoom,
            subdomains: ['a', 'b', 'c']
        }).addTo(this.map);

        // Set bounds
        this.map.setMaxBounds(this.config.bounds);

        // Handle map resize
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.invalidateSize();
            }
        });
    }

    /**
     * Setup map controls
     */
    setupControls() {
        // Zoom control
        L.control.zoom({
            position: 'topright'
        }).addTo(this.map);

        // Scale control
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(this.map);

        // Custom controls
        this.addCustomControls();
    }

    /**
     * Add custom controls to the map
     */
    addCustomControls() {
        // Locate user button
        const locateControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.innerHTML = `
                    <a href="#" title="Locate me" style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 34px;
                        height: 34px;
                        background: white;
                        border-radius: 4px;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        cursor: pointer;
                        font-size: 20px;
                        text-decoration: none;
                        color: #333;
                    ">
                        📍
                    </a>
                `;
                container.onclick = (e) => {
                    e.preventDefault();
                    this.locateUser();
                };
                return container;
            }
        });

        this.map.addControl(new locateControl());

        // Reset view control
        const resetControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.innerHTML = `
                    <a href="#" title="Reset view" style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 34px;
                        height: 34px;
                        background: white;
                        border-radius: 4px;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        cursor: pointer;
                        font-size: 20px;
                        text-decoration: none;
                        color: #333;
                        margin-top: 5px;
                    ">
                        🏠
                    </a>
                `;
                container.onclick = (e) => {
                    e.preventDefault();
                    this.resetView();
                };
                return container;
            }
        });

        this.map.addControl(new resetControl());

        // Clear markers control
        const clearControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.innerHTML = `
                    <a href="#" title="Clear markers" style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 34px;
                        height: 34px;
                        background: white;
                        border-radius: 4px;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        cursor: pointer;
                        font-size: 20px;
                        text-decoration: none;
                        color: #333;
                        margin-top: 5px;
                    ">
                        🗑️
                    </a>
                `;
                container.onclick = (e) => {
                    e.preventDefault();
                    this.clearAllMarkers();
                };
                return container;
            }
        });

        this.map.addControl(new clearControl());
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Map click event
        this.map.on('click', (e) => this.handleMapClick(e));

        // Map zoom event
        this.map.on('zoomend', () => {
            this.updateMarkerVisibility();
        });

        // Map move event
        this.map.on('moveend', () => {
            this.updateMarkerVisibility();
        });

        // Map layer add event
        this.map.on('layeradd', (e) => {
            if (e.layer instanceof L.Marker) {
                this.updateMarkerVisibility();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case 'r':
                case 'R':
                    this.resetView();
                    break;
                case 'l':
                case 'L':
                    this.locateUser();
                    break;
                case 'c':
                case 'C':
                    this.clearAllMarkers();
                    break;
                case '1':
                    this.isSelectingPickup = !this.isSelectingPickup;
                    this.isSelectingDropoff = false;
                    this.updateSelectionMode();
                    break;
                case '2':
                    this.isSelectingDropoff = !this.isSelectingDropoff;
                    this.isSelectingPickup = false;
                    this.updateSelectionMode();
                    break;
                case 'Escape':
                    this.isSelectingPickup = false;
                    this.isSelectingDropoff = false;
                    this.updateSelectionMode();
                    break;
                default:
                    break;
            }
        });
    }

    /**
     * Handle map click events
     */
    handleMapClick(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // Check if in selection mode
        if (this.isSelectingPickup) {
            this.setPickupLocation(lat, lng);
            this.isSelectingPickup = false;
            this.updateSelectionMode();
            return;
        }

        if (this.isSelectingDropoff) {
            this.setDropoffLocation(lat, lng);
            this.isSelectingDropoff = false;
            this.updateSelectionMode();
            return;
        }

        // Default behavior - check if clicking near existing markers
        const clickedMarker = this.findMarkerAt(e.latlng);
        if (clickedMarker) {
            clickedMarker.openPopup();
            return;
        }

        // If no pickup set, set pickup
        if (!this.pickupLocation) {
            this.setPickupLocation(lat, lng);
        } 
        // If pickup set but no dropoff, set dropoff
        else if (this.pickupLocation && !this.dropoffLocation) {
            this.setDropoffLocation(lat, lng);
        }
        // If both set, reset and set new pickup
        else {
            this.clearAllMarkers();
            this.setPickupLocation(lat, lng);
        }
    }

    /**
     * Find marker at a location
     */
    findMarkerAt(latlng) {
        const markers = [
            this.pickupMarker,
            this.dropoffMarker,
            this.driverMarker,
            this.userMarker
        ];

        for (const marker of markers) {
            if (!marker) continue;
            const markerLatLng = marker.getLatLng();
            const distance = this.calculateDistance(
                latlng.lat, latlng.lng,
                markerLatLng.lat, markerLatLng.lng
            );
            if (distance < 0.1) { // 100 meters
                return marker;
            }
        }
        return null;
    }

    /**
     * Calculate distance between two points (in km)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Set pickup location
     */
    setPickupLocation(lat, lng, address = null) {
        this.pickupLocation = { lat, lng, address };

        // Create marker
        const icon = L.divIcon({
            className: 'pickup-marker',
            html: `
                <div style="
                    background: #28a745;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                ">
                    P
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        if (this.pickupMarker) {
            this.map.removeLayer(this.pickupMarker);
        }

        this.pickupMarker = L.marker([lat, lng], { icon: icon })
            .bindPopup(`<strong>Pickup Location</strong><br>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}`)
            .addTo(this.map);

        // Get address if not provided
        if (!address) {
            this.reverseGeocode(lat, lng).then(addr => {
                this.pickupLocation.address = addr;
                this.pickupMarker.setPopupContent(`<strong>Pickup Location</strong><br>${addr}`);
                this.updateLocationUI();
            });
        } else {
            this.updateLocationUI();
        }

        // If dropoff exists, calculate route
        if (this.dropoffLocation) {
            this.calculateRoute();
        }

        // Trigger event
        this.triggerEvent('pickupSet', this.pickupLocation);
    }

    /**
     * Set dropoff location
     */
    setDropoffLocation(lat, lng, address = null) {
        this.dropoffLocation = { lat, lng, address };

        // Create marker
        const icon = L.divIcon({
            className: 'dropoff-marker',
            html: `
                <div style="
                    background: #dc3545;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                ">
                    D
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        if (this.dropoffMarker) {
            this.map.removeLayer(this.dropoffMarker);
        }

        this.dropoffMarker = L.marker([lat, lng], { icon: icon })
            .bindPopup(`<strong>Dropoff Location</strong><br>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}`)
            .addTo(this.map);

        // Get address if not provided
        if (!address) {
            this.reverseGeocode(lat, lng).then(addr => {
                this.dropoffLocation.address = addr;
                this.dropoffMarker.setPopupContent(`<strong>Dropoff Location</strong><br>${addr}`);
                this.updateLocationUI();
            });
        } else {
            this.updateLocationUI();
        }

        // Calculate route if pickup exists
        if (this.pickupLocation) {
            this.calculateRoute();
        }

        // Trigger event
        this.triggerEvent('dropoffSet', this.dropoffLocation);
    }

    /**
     * Update location UI
     */
    updateLocationUI() {
        // Update pickup display
        const pickupDisplay = document.getElementById('pickupLocation');
        if (pickupDisplay) {
            pickupDisplay.textContent = this.pickupLocation?.address || 'Not set';
        }

        // Update dropoff display
        const dropoffDisplay = document.getElementById('dropoffLocation');
        if (dropoffDisplay) {
            dropoffDisplay.textContent = this.dropoffLocation?.address || 'Not set';
        }

        // Update distance and price
        if (this.pickupLocation && this.dropoffLocation) {
            this.updateDistanceAndPrice();
        }
    }

    /**
     * Update distance and price display
     */
    updateDistanceAndPrice() {
        if (!this.pickupLocation || !this.dropoffLocation) return;

        const distance = this.calculateDistance(
            this.pickupLocation.lat, this.pickupLocation.lng,
            this.dropoffLocation.lat, this.dropoffLocation.lng
        );

        const price = distance * RATE_PER_KM;

        const distanceDisplay = document.getElementById('distanceDisplay');
        const priceDisplay = document.getElementById('priceDisplay');

        if (distanceDisplay) {
            distanceDisplay.textContent = `${distance.toFixed(1)} km`;
        }

        if (priceDisplay) {
            priceDisplay.textContent = `R${price.toFixed(2)}`;
        }

        // Trigger event
        this.triggerEvent('distanceCalculated', { distance, price });
    }

    /**
     * Calculate and draw route
     */
    calculateRoute() {
        if (!this.pickupLocation || !this.dropoffLocation) return;

        // Clear existing route
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
            this.routePolyline = null;
        }

        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }

        // Create route points
        const points = [
            [this.pickupLocation.lat, this.pickupLocation.lng],
            [this.dropoffLocation.lat, this.dropoffLocation.lng]
        ];

        // Draw route line
        this.routePolyline = L.polyline(points, {
            color: '#f5a623',
            weight: 4,
            opacity: 0.8,
            dashArray: null,
            lineJoin: 'round',
            smoothFactor: 1
        }).addTo(this.map);

        // Add route labels
        this.addRouteLabels();

        // Fit bounds
        this.map.fitBounds(points, {
            padding: [50, 50],
            maxZoom: 13
        });

        this.routeCalculated = true;

        // Trigger event
        this.triggerEvent('routeCalculated', { points, distance: this.calculateDistance(
            this.pickupLocation.lat, this.pickupLocation.lng,
            this.dropoffLocation.lat, this.dropoffLocation.lng
        )});
    }

    /**
     * Add route labels
     */
    addRouteLabels() {
        if (!this.pickupLocation || !this.dropoffLocation) return;

        // Remove existing labels
        document.querySelectorAll('.route-label-container').forEach(el => el.remove());

        // Calculate midpoint for distance label
        const midLat = (this.pickupLocation.lat + this.dropoffLocation.lat) / 2;
        const midLng = (this.pickupLocation.lng + this.dropoffLocation.lng) / 2;
        const distance = this.calculateDistance(
            this.pickupLocation.lat, this.pickupLocation.lng,
            this.dropoffLocation.lat, this.dropoffLocation.lng
        );

        // Distance label
        const distanceLabel = L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'route-label-container',
                html: `
                    <div style="
                        background: rgba(255,255,255,0.9);
                        padding: 4px 12px;
                        border-radius: 20px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                        font-size: 12px;
                        font-weight: bold;
                        color: #333;
                        border: 2px solid #f5a623;
                    ">
                        ${distance.toFixed(1)} km
                        <br>
                        <span style="color:#f5a623;font-size:14px;">
                            R${(distance * RATE_PER_KM).toFixed(2)}
                        </span>
                    </div>
                `,
                iconSize: [80, 40],
                iconAnchor: [40, 20]
            })
        }).addTo(this.map);

        // Store for cleanup
        if (!this.routeLabels) this.routeLabels = [];
        this.routeLabels.push(distanceLabel);
    }

    /**
     * Reverse geocode coordinates
     */
    async reverseGeocode(lat, lng) {
        const cacheKey = `${lat},${lng}`;
        
        // Check cache
        if (this.geocodeCache.has(cacheKey)) {
            return this.geocodeCache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`
            );

            if (!response.ok) {
                throw new Error('Geocoding request failed');
            }

            const data = await response.json();

            if (data && data.display_name) {
                // Cache the result
                this.geocodeCache.set(cacheKey, data.display_name);
                return data.display_name;
            } else {
                throw new Error('No address found');
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    }

    /**
     * Geocode address to coordinates
     */
    async geocodeAddress(address) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
            );

            if (!response.ok) {
                throw new Error('Geocoding request failed');
            }

            const data = await response.json();

            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    display_name: data[0].display_name
                };
            } else {
                throw new Error('Location not found');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }

    /**
     * Locate user
     */
    locateUser() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by your browser');
            return;
        }

        // Show loading state
        this.showLoading('Locating...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.currentLocation = { lat: latitude, lng: longitude };
                
                // Add user marker
                if (this.userMarker) {
                    this.map.removeLayer(this.userMarker);
                }

                const icon = L.divIcon({
                    className: 'user-marker',
                    html: `
                        <div style="
                            background: #17a2b8;
                            width: 20px;
                            height: 20px;
                            border-radius: 50%;
                            border: 3px solid white;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                            animation: pulse 2s infinite;
                        ">
                        </div>
                    `,
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });

                this.userMarker = L.marker([latitude, longitude], { icon: icon })
                    .bindPopup('<strong>Your Location</strong>')
                    .addTo(this.map);

                // Center map on user
                this.map.setView([latitude, longitude], 15);

                // Hide loading
                this.hideLoading();

                // Trigger event
                this.triggerEvent('userLocated', this.currentLocation);

                // If no pickup set, set pickup
                if (!this.pickupLocation) {
                    this.setPickupLocation(latitude, longitude);
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                this.hideLoading();
                this.showError('Unable to locate you. Please check your location settings.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }

    /**
     * Reset map view
     */
    resetView() {
        this.map.setView(this.config.center, this.config.zoom);
    }

    /**
     * Clear all markers
     */
    clearAllMarkers() {
        if (this.pickupMarker) {
            this.map.removeLayer(this.pickupMarker);
            this.pickupMarker = null;
        }
        if (this.dropoffMarker) {
            this.map.removeLayer(this.dropoffMarker);
            this.dropoffMarker = null;
        }
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
        if (this.driverMarker) {
            this.map.removeLayer(this.driverMarker);
            this.driverMarker = null;
        }
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
            this.routePolyline = null;
        }
        if (this.routeLabels) {
            this.routeLabels.forEach(label => {
                if (label) this.map.removeLayer(label);
            });
            this.routeLabels = [];
        }

        this.pickupLocation = null;
        this.dropoffLocation = null;
        this.routeCalculated = false;

        // Update UI
        this.updateLocationUI();
        this.map.setView(this.config.center, this.config.zoom);
    }

    /**
     * Update marker visibility based on zoom
     */
    updateMarkerVisibility() {
        const zoom = this.map.getZoom();
        
        // Show/hide markers based on zoom level
        const markers = [
            this.pickupMarker,
            this.dropoffMarker,
            this.driverMarker,
            this.userMarker
        ];

        markers.forEach(marker => {
            if (!marker) return;
            const visible = zoom >= 5; // Show at zoom level 5 and above
            if (visible && !this.map.hasLayer(marker)) {
                marker.addTo(this.map);
            } else if (!visible && this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
    }

    /**
     * Update selection mode UI
     */
    updateSelectionMode() {
        const mapContainer = this.mapContainer;
        
        if (this.isSelectingPickup) {
            mapContainer.style.cursor = 'crosshair';
            mapContainer.title = 'Click on map to set pickup location';
            this.showNotification('Click on the map to set pickup location', 'info');
        } else if (this.isSelectingDropoff) {
            mapContainer.style.cursor = 'crosshair';
            mapContainer.title = 'Click on map to set dropoff location';
            this.showNotification('Click on the map to set dropoff location', 'info');
        } else {
            mapContainer.style.cursor = 'default';
            mapContainer.title = '';
        }
    }

    /**
     * Load saved locations from session storage
     */
    loadSavedLocations() {
        try {
            const saved = sessionStorage.getItem('mapLocations');
            if (saved) {
                const locations = JSON.parse(saved);
                if (locations.pickup) {
                    this.setPickupLocation(
                        locations.pickup.lat,
                        locations.pickup.lng,
                        locations.pickup.address
                    );
                }
                if (locations.dropoff) {
                    this.setDropoffLocation(
                        locations.dropoff.lat,
                        locations.dropoff.lng,
                        locations.dropoff.address
                    );
                }
            }
        } catch (error) {
            console.error('Error loading saved locations:', error);
        }
    }

    /**
     * Save locations to session storage
     */
    saveLocations() {
        try {
            const locations = {
                pickup: this.pickupLocation,
                dropoff: this.dropoffLocation
            };
            sessionStorage.setItem('mapLocations', JSON.stringify(locations));
        } catch (error) {
            console.error('Error saving locations:', error);
        }
    }

    /**
     * Show driver on map
     */
    showDriver(driverData) {
        if (!driverData || !driverData.current_location) {
            console.warn('No driver location data available');
            return;
        }

        const location = driverData.current_location;

        // Remove existing driver marker
        if (this.driverMarker) {
            this.map.removeLayer(this.driverMarker);
        }

        // Create driver marker
        const icon = L.divIcon({
            className: 'driver-marker',
            html: `
                <div style="
                    background: #f5a623;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    animation: pulse 2s infinite;
                ">
                    🚗
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        this.driverMarker = L.marker([location.lat, location.lng], { icon: icon })
            .bindPopup(`
                <strong>${driverData.full_name || 'Driver'}</strong><br>
                Vehicle: ${driverData.vehicle_model || 'N/A'}<br>
                Registration: ${driverData.vehicle_registration || 'N/A'}<br>
                <small>Last updated: ${new Date().toLocaleTimeString()}</small>
            `)
            .addTo(this.map);

        // Add pulsing circle
        if (this.driverCircle) {
            this.map.removeLayer(this.driverCircle);
        }

        this.driverCircle = L.circle([location.lat, location.lng], {
            radius: 50,
            color: '#f5a623',
            fillColor: '#f5a623',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(this.map);

        // Center on driver if not tracking
        if (!this.isTracking) {
            this.map.setView([location.lat, location.lng], 14);
        }

        this.driverLocation = location;
    }

    /**
     * Start real-time driver tracking
     */
    startTracking(bookingId, updateInterval = 10000) {
        this.isTracking = true;

        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }

        // Initial track
        this.updateDriverLocation(bookingId);

        // Set up interval
        this.trackingInterval = setInterval(() => {
            if (this.isTracking) {
                this.updateDriverLocation(bookingId);
            }
        }, updateInterval);
    }

    /**
     * Update driver location
     */
    async updateDriverLocation(bookingId) {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    trip:trips (
                        driver:drivers (
                            id,
                            full_name,
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

            if (data.trip.driver && data.trip.driver.current_location) {
                this.showDriver(data.trip.driver);
            }
        } catch (error) {
            console.error('Error updating driver location:', error);
        }
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

        if (this.driverCircle) {
            this.map.removeLayer(this.driverCircle);
            this.driverCircle = null;
        }

        this.driverLocation = null;
    }

    /**
     * Show loading indicator
     */
    showLoading(message = 'Loading...') {
        const existing = document.querySelector('.map-loading');
        if (existing) {
            existing.remove();
        }

        const loading = document.createElement('div');
        loading.className = 'map-loading';
        loading.innerHTML = `
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255,255,255,0.9);
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 12px;
            ">
                <div style="
                    width: 20px;
                    height: 20px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #f5a623;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                "></div>
                <span>${message}</span>
            </div>
        `;

        this.mapContainer.appendChild(loading);

        // Add spin animation if not exists
        if (!document.getElementById('spin-animation')) {
            const style = document.createElement('style');
            style.id = 'spin-animation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loading = document.querySelector('.map-loading');
        if (loading) {
            loading.remove();
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const existing = document.querySelector('.map-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'map-notification';
        notification.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 8px;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            color: white;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideUp 0.3s ease;
            max-width: 90%;
        `;
        notification.textContent = message;

        this.mapContainer.appendChild(notification);

        // Add slide up animation
        if (!document.getElementById('slideup-animation')) {
            const style = document.createElement('style');
            style.id = 'slideup-animation';
            style.textContent = `
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Trigger event
     */
    triggerEvent(eventName, data) {
        const event = new CustomEvent(`map:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }

    /**
     * Get current map instance
     */
    getMap() {
        return this.map;
    }

    /**
     * Get pickup location
     */
    getPickupLocation() {
        return this.pickupLocation;
    }

    /**
     * Get dropoff location
     */
    getDropoffLocation() {
        return this.dropoffLocation;
    }

    /**
     * Get distance between pickup and dropoff
     */
    getDistance() {
        if (!this.pickupLocation || !this.dropoffLocation) {
            return null;
        }
        return this.calculateDistance(
            this.pickupLocation.lat, this.pickupLocation.lng,
            this.dropoffLocation.lat, this.dropoffLocation.lng
        );
    }

    /**
     * Get price based on distance
     */
    getPrice() {
        const distance = this.getDistance();
        if (distance === null) {
            return null;
        }
        return distance * RATE_PER_KM;
    }

    /**
     * Destroy map
     */
    destroy() {
        this.stopTracking();
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        this.pickupMarker = null;
        this.dropoffMarker = null;
        this.driverMarker = null;
        this.userMarker = null;
        this.routePolyline = null;
        this.pickupLocation = null;
        this.dropoffLocation = null;
        this.driverLocation = null;
        this.currentLocation = null;
        this.routeCalculated = false;
        this.isTracking = false;
    }
}

// Initialize map manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const mapManager = new MapManager();
    window.mapManager = mapManager;
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapManager };
}

// Add CSS for map styles
const mapStyle = document.createElement('style');
mapStyle.textContent = `
    #map {
        width: 100%;
        height: 100%;
        min-height: 400px;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
    }
    
    .leaflet-control-zoom {
        margin-top: 10px;
    }
    
    .leaflet-control-zoom a {
        background: white;
        color: #333;
        font-weight: bold;
        text-decoration: none;
    }
    
    .leaflet-control-zoom a:hover {
        background: #f5a623;
        color: white;
    }
    
    .pickup-marker, .dropoff-marker, .driver-marker, .user-marker {
        background: none;
        border: none;
    }
    
    @keyframes pulse {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.3);
            opacity: 0.7;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }
    
    .driver-marker {
        animation: pulse 2s infinite;
    }
    
    .map-loading {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.7);
        z-index: 999;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .map-notification {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        max-width: 90%;
    }
    
    .route-label-container {
        background: none;
        border: none;
    }
    
    /* Responsive map */
    @media (max-width: 768px) {
        #map {
            min-height: 300px;
        }
    }
    
    @media (max-width: 480px) {
        #map {
            min-height: 250px;
        }
    }
`;
document.head.appendChild(mapStyle);