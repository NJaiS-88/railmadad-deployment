import React, { useEffect, useRef } from 'react';

export default function LeafletMap({ lat, lng, address }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const latitude = parseFloat(lat) || 17.4334;
    const longitude = parseFloat(lng) || 78.5024;

    // Load Leaflet JS dynamically if not loaded
    const initMap = () => {
      if (!window.L || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = window.L.map(mapRef.current).setView([latitude, longitude], 14);
      mapInstanceRef.current = map;

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const marker = window.L.marker([latitude, longitude]).addTo(map);
      marker.bindPopup(`<b>Issue Geolocation</b><br>${address || 'Live Passenger GPS'}`).openPopup();
    };

    if (window.L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, address]);

  return (
    <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
