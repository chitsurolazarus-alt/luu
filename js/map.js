/* =====================================================================
   LUU TRAVELS & LOGISTICS - MAP MANAGER (Leaflet.js)
   ===================================================================== */

const MapManager = {
    map: null,
    pickupMarker: null,
    dropoffMarker: null,
    routeLine: null,
    driverMarker: null,
    trackingInterval: null,

    // Init a map centered roughly between Gauteng and Limpopo
    init(elementId, center = [-24.6, 29.0], zoom = 7) {
        this.map = L.map(elementId).setView(center, zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);
        return this.map;
    },

    greenIcon() {
        return L.divIcon({
            className: 'custom-marker marker-pickup',
            html: '<div class="marker-pin marker-pin-green"></div>',
            iconSize: [26, 36],
            iconAnchor: [13, 36]
        });
    },

    redIcon() {
        return L.divIcon({
            className: 'custom-marker marker-dropoff',
            html: '<div class="marker-pin marker-pin-red"></div>',
            iconSize: [26, 36],
            iconAnchor: [13, 36]
        });
    },

    driverIcon() {
        return L.divIcon({
            className: 'custom-marker marker-driver',
            html: '<div class="marker-pin marker-pin-gold">🚐</div>',
            iconSize: [30, 40],
            iconAnchor: [15, 40]
        });
    },

    setPickup(lat, lng) {
        if (this.pickupMarker) this.map.removeLayer(this.pickupMarker);
        this.pickupMarker = L.marker([lat, lng], { icon: this.greenIcon() })
            .addTo(this.map)
            .bindPopup('Pickup location');
        this.drawRouteIfReady();
    },

    setDropoff(lat, lng) {
        if (this.dropoffMarker) this.map.removeLayer(this.dropoffMarker);
        this.dropoffMarker = L.marker([lat, lng], { icon: this.redIcon() })
            .addTo(this.map)
            .bindPopup('Drop-off location');
        this.drawRouteIfReady();
    },

    drawRouteIfReady() {
        if (!this.pickupMarker || !this.dropoffMarker) return;
        if (this.routeLine) this.map.removeLayer(this.routeLine);

        const p = this.pickupMarker.getLatLng();
        const d = this.dropoffMarker.getLatLng();
        this.routeLine = L.polyline([p, d], { color: '#F5A623', weight: 4, dashArray: '8 6' }).addTo(this.map);
        this.map.fitBounds(this.routeLine.getBounds(), { padding: [40, 40] });

        const distance = calculateDistanceKm(p.lat, p.lng, d.lat, d.lng);
        const event = new CustomEvent('routeUpdated', { detail: { distance, pickup: p, dropoff: d } });
        document.dispatchEvent(event);
    },

    clearAll() {
        if (this.pickupMarker) this.map.removeLayer(this.pickupMarker);
        if (this.dropoffMarker) this.map.removeLayer(this.dropoffMarker);
        if (this.routeLine) this.map.removeLayer(this.routeLine);
        this.pickupMarker = this.dropoffMarker = this.routeLine = null;
    },

    // ---- Driver tracking (customer dashboard side) ----
    showDriverLocation(lat, lng, popupHtml) {
        if (this.driverMarker) {
            this.driverMarker.setLatLng([lat, lng]);
        } else {
            this.driverMarker = L.marker([lat, lng], { icon: this.driverIcon() }).addTo(this.map);
        }
        if (popupHtml) this.driverMarker.bindPopup(popupHtml);
        this.map.panTo([lat, lng]);
    },

    // Poll Supabase every 10s for the driver's current_location on a given driverId
    startTracking(driverId, onUpdate) {
        this.stopTracking();
        const poll = async () => {
            const { data, error } = await supabaseClient
                .from('drivers')
                .select('current_location, full_name, vehicle_model, vehicle_color, phone')
                .eq('id', driverId)
                .single();
            if (!error && data && data.current_location) {
                const { lat, lng } = data.current_location;
                const popup = `<strong>${data.full_name}</strong><br>${data.vehicle_color} ${data.vehicle_model}<br>${data.phone}`;
                this.showDriverLocation(lat, lng, popup);
                if (onUpdate) onUpdate(data);
            }
        };
        poll();
        this.trackingInterval = setInterval(poll, 10000);
    },

    stopTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
    }
};
