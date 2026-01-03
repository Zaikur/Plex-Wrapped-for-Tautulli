// src/components/stats/GeoLocationMap.tsx

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { StreamingLocation } from "@/types/tautulli";

interface GeoLocationMapProps {
  locations: StreamingLocation[];
}

const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const cssHsl = (varName: string, fallbackHsl: string) => {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return raw ? `hsl(${raw})` : fallbackHsl;
  } catch {
    return fallbackHsl;
  }
};

const GeoLocationMap = ({ locations }: GeoLocationMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  const defaultCenter = useMemo<[number, number]>(() => {
    if (locations.length === 0) return [20, 0];
    const avgLat = locations.reduce((sum, l) => sum + l.lat, 0) / locations.length;
    const avgLon = locations.reduce((sum, l) => sum + l.lon, 0) / locations.length;
    return [avgLat, avgLon];
  }, [locations]);

  // Initialize Leaflet map (once)
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
      preferCanvas: true,
    });

    mapRef.current = map;

    const tile = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    );

    tile.addTo(map);
    tileRef.current = tile;

    const markers = L.layerGroup();
    markers.addTo(map);
    markersRef.current = markers;

    map.setView(defaultCenter, 2);

    const t = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        // ignore
      }
    }, 0);

    return () => {
      window.clearTimeout(t);
      try {
        map.remove();
      } finally {
        mapRef.current = null;
        markersRef.current = null;
        tileRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers + fit bounds when locations change
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    markers.clearLayers();

    if (locations.length === 0) {
      map.setView([20, 0], 2);
      return;
    }

    const cyan = cssHsl("--cyan", "hsl(173 80% 50%)");
    const purple = cssHsl("--purple", "hsl(280 80% 55%)");

    const maxSessions = Math.max(...locations.map((l) => l.sessionCount), 1);

    locations.forEach((loc) => {
      const radius = 8 + (loc.sessionCount / maxSessions) * 17;

      const circle = L.circleMarker([loc.lat, loc.lon], {
        radius,
        color: purple,
        weight: 2,
        opacity: 0.9,
        fillColor: cyan,
        fillOpacity: 0.7,
      });

      const place = loc.city !== "Unknown" ? loc.city : loc.region || loc.country;
      const countryLine =
        loc.city !== "Unknown" && loc.country !== loc.city
          ? `${loc.country} ${getFlagEmoji(loc.countryCode)}`
          : "";
      const streams = `${loc.sessionCount} stream${loc.sessionCount !== 1 ? "s" : ""}`;

      const popupId = `popup-${loc.lat}-${loc.lon}`.replace(/\./g, '-');

      const rawDates = loc.sessionDates || [];
      const dates = Array.from(new Set(rawDates));
      const displayDates = dates.slice(0, 10);
      const hasMoreDates = dates.length > 10;

      const datesListHtml = dates.length > 0
        ? `<div id="${popupId}-dates" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); max-height: 150px; overflow-y: auto;">
            ${displayDates.map(d => `<div style="font-size: 11px; opacity: 0.85; padding: 2px 0;">${d}</div>`).join('')}
            ${hasMoreDates ? `<div style="font-size: 11px; opacity: 0.6; font-style: italic; padding-top: 4px;">+ ${dates.length - 10} more sessions</div>` : ''}
           </div>`
        : '';

      const html = `
        <div style="font-size: 12px; line-height: 1.2; min-width: 140px;">
          <div style="font-weight: 700;">${place}</div>
          ${countryLine ? `<div style="opacity: .75; margin-top: 2px;">${countryLine}</div>` : ""}
          <div style="margin-top: 6px;">
            <span 
              id="${popupId}-toggle"
              style="font-weight: 600; ${dates.length > 0 ? 'cursor: pointer; text-decoration: underline; text-decoration-style: dotted;' : ''}"
              ${dates.length > 0 ? `onclick="(function() {
                var dates = document.getElementById('${popupId}-dates');
                var toggle = document.getElementById('${popupId}-toggle');
                if (dates) {
                  if (dates.style.display === 'none') {
                    dates.style.display = 'block';
                    toggle.style.textDecorationStyle = 'solid';
                  } else {
                    dates.style.display = 'none';
                    toggle.style.textDecorationStyle = 'dotted';
                  }
                }
              })()"` : ''}
            >${streams}</span>
            ${dates.length > 0 ? '<span style="font-size: 10px; opacity: 0.6; margin-left: 4px;">▼</span>' : ''}
          </div>
          ${datesListHtml}
        </div>
      `;

      circle.bindPopup(html, { maxWidth: 250 });
      circle.addTo(markers);
    });

    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lon], 6);
      return;
    }

    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
  }, [locations]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Streaming locations map"
    />
  );
};

export default GeoLocationMap;