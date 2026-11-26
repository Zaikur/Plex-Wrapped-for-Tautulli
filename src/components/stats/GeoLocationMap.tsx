// src/components/stats/GeoLocationMap.tsx
// 3D streaming globe rendered with MapLibre GL on free OpenFreeMap vector tiles (no API key).

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Hand, Loader2, MousePointerClick, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StreamingLocation } from "@/types/tautulli";

interface GeoLocationMapProps {
  locations: StreamingLocation[];
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
const SOURCE_ID = "streaming-locations";
// The globe sways slowly to each side of the streaming locations (one full sway per period),
// by a fixed distance on screen so it looks the same at any zoom
const SWAY_PERIOD_MS = 30000;
const SWAY_PIXELS = 40;
// On slow connections the style and first tiles can take a while; after this we show a retry option
const LOAD_TIMEOUT_MS = 20000;

type MapStatus = "loading" | "ready" | "failed" | "lost";

const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Reads a theme color variable ("173 80% 50%") and converts it to hex for MapLibre
const cssHsl = (varName: string, fallback: string) => {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    const match = raw.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
    if (!match) return fallback;
    const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number) =>
      Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
        .toString(16)
        .padStart(2, "0");
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  } catch {
    return fallback;
  }
};

const hasWebGL = () => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

// Degrees of longitude per screen pixel at a zoom level (512px tiles)
const degreesPerPixel = (zoom: number) => 360 / (512 * 2 ** zoom);

// The session-weighted middle of the streaming locations as [lng, lat]. Averaged on the sphere,
// so locations on both sides of the date line don't average out to the far side of the world.
const focusOf = (locations: StreamingLocation[]): [number, number] => {
  let x = 0;
  let y = 0;
  let z = 0;
  let total = 0;
  for (const l of locations) {
    const lat = (l.lat * Math.PI) / 180;
    const lon = (l.lon * Math.PI) / 180;
    const weight = Math.max(l.sessionCount, 1);
    x += weight * Math.cos(lat) * Math.cos(lon);
    y += weight * Math.cos(lat) * Math.sin(lon);
    z += weight * Math.sin(lat);
    total += weight;
  }
  // Locations spread evenly around the globe have no meaningful middle: use the busiest one
  if (Math.hypot(x, y, z) < 0.1 * total) {
    const busiest = locations.reduce((a, b) => (b.sessionCount > a.sessionCount ? b : a));
    return [busiest.lon, busiest.lat];
  }
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
};

const toGeoJSON = (locations: StreamingLocation[]): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: "FeatureCollection",
  features: locations.map((loc, index) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [loc.lon, loc.lat] },
    properties: { index, sessionCount: loc.sessionCount },
  })),
});

// Popup content is built with DOM nodes (textContent) so location and user names are never parsed as HTML
const buildPopup = (loc: StreamingLocation): HTMLElement => {
  const root = document.createElement("div");
  root.className = "pwft-map-popup-body";

  const place = document.createElement("div");
  place.className = "pwft-map-popup-title";
  place.textContent = loc.city !== "Unknown" ? loc.city : loc.region || loc.country;
  root.appendChild(place);

  if (loc.city !== "Unknown" && loc.country !== loc.city) {
    const country = document.createElement("div");
    country.className = "pwft-map-popup-muted";
    country.textContent = `${loc.country} ${getFlagEmoji(loc.countryCode)}`;
    root.appendChild(country);
  }

  const dates = Array.from(new Set(loc.sessionDates || []));
  const streams = document.createElement("button");
  streams.type = "button";
  streams.className = "pwft-map-popup-toggle";
  streams.textContent = `${loc.sessionCount} stream${loc.sessionCount !== 1 ? "s" : ""}${dates.length > 0 ? " ▾" : ""}`;
  streams.disabled = dates.length === 0;
  root.appendChild(streams);

  if (dates.length > 0) {
    const list = document.createElement("div");
    list.className = "pwft-map-popup-dates";
    list.hidden = true;
    dates.slice(0, 10).forEach((d) => {
      const row = document.createElement("div");
      row.textContent = d;
      list.appendChild(row);
    });
    if (dates.length > 10) {
      const more = document.createElement("div");
      more.className = "pwft-map-popup-more";
      more.textContent = `+ ${dates.length - 10} more sessions`;
      list.appendChild(more);
    }
    streams.addEventListener("click", () => {
      list.hidden = !list.hidden;
    });
    root.appendChild(list);
  }
  return root;
};

const GeoLocationMap = ({ locations }: GeoLocationMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const locationsRef = useRef(locations);
  const swayRef = useRef<{ focus: (center: [number, number]) => void; stop: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [unsupported] = useState(() => !hasWebGL());
  const [status, setStatus] = useState<MapStatus>("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Until it's tapped or clicked, a layer over the globe takes the touches, so swiping through
  // the report scrolls past it instead of turning it. It locks again once scrolled off screen.
  const [locked, setLocked] = useState(true);
  const [coarsePointer] = useState(() => window.matchMedia?.("(pointer: coarse)").matches ?? false);

  locationsRef.current = locations;

  const unlock = () => {
    setLocked(false);
    swayRef.current?.stop();
    // Keyboard users keep their place: the arrow keys turn the globe
    mapRef.current?.getCanvas().focus({ preventScroll: true });
  };

  // Initialize the map (again when the user retries)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current || unsupported) return;

    setStatus("loading");
    setErrorText(null);
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [0, 20],
        zoom: 1.2,
        scrollZoom: false,
        attributionControl: { compact: true },
      });
    } catch (error) {
      setErrorText((error as Error).message);
      setStatus("failed");
      return;
    }
    mapRef.current = map;

    // Keep the last error so a failed load can say why
    let loaded = false;
    let lastError: string | null = null;
    map.on("error", (e) => {
      lastError = e.error?.message || "Unknown error";
    });
    const loadTimeout = window.setTimeout(() => {
      if (loaded) return;
      setErrorText(lastError);
      setStatus("failed");
    }, LOAD_TIMEOUT_MS);

    // Mobile browsers can drop WebGL contexts (e.g. when switching apps); MapLibre redraws when it's restored
    map.on("webglcontextlost", () => setStatus("lost"));
    map.on("webglcontextrestored", () => setStatus(loaded ? "ready" : "loading"));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("style.load", () => {
      map.setProjection({ type: "globe" });
    });

    map.on("load", () => {
      const cyan = cssHsl("--cyan", "#1ad1bd");
      const purple = cssHsl("--purple", "#9c2ee6");
      map.addSource(SOURCE_ID, { type: "geojson", data: toGeoJSON([]) });
      map.addLayer({
        id: "streaming-locations-glow",
        type: "circle",
        source: SOURCE_ID,
        paint: { "circle-radius": ["+", 14, ["*", 20, ["get", "weight"]]], "circle-color": cyan, "circle-opacity": 0.15, "circle-blur": 1 },
      });
      map.addLayer({
        id: "streaming-locations",
        type: "circle",
        source: SOURCE_ID,
        paint: {
          // Same sizing as before: 8px + up to 17px for the busiest location
          "circle-radius": ["+", 8, ["*", 17, ["get", "weight"]]],
          "circle-color": cyan,
          "circle-opacity": 0.7,
          "circle-stroke-color": purple,
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.9,
        },
      });

      map.on("click", "streaming-locations", (e) => {
        const feature = e.features?.[0];
        const loc = feature ? locationsRef.current[Number(feature.properties?.index)] : undefined;
        if (!loc) return;
        new maplibregl.Popup({ maxWidth: "250px", className: "pwft-map-popup" })
          .setLngLat([loc.lon, loc.lat])
          .setDOMContent(buildPopup(loc))
          .addTo(map);
      });
      map.on("mouseenter", "streaming-locations", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "streaming-locations", () => (map.getCanvas().style.cursor = ""));
      loaded = true;
      window.clearTimeout(loadTimeout);
      setReady(true);
      setStatus("ready");
    });

    // A slow sway around the streaming locations hints that the globe can be turned. It only
    // runs while the globe is on screen (so it hasn't drifted off by the time someone scrolls
    // to it) and stops for good once the user takes over.
    let swayCenter: [number, number] | null = null;
    let swayElapsed = 0;
    let lastFrame: number | null = null;
    let onScreen = false;
    let frame: number | null = null;
    const swayStep = (now: number) => {
      frame = null;
      if (!swayCenter || !onScreen) return;
      if (lastFrame !== null) swayElapsed += now - lastFrame;
      lastFrame = now;
      const drift = Math.sin((2 * Math.PI * swayElapsed) / SWAY_PERIOD_MS) * SWAY_PIXELS * degreesPerPixel(map.getZoom());
      map.jumpTo({ center: [swayCenter[0] + drift, swayCenter[1]] });
      frame = requestAnimationFrame(swayStep);
    };
    const runSway = () => {
      if (frame !== null || !swayCenter || !onScreen) return;
      lastFrame = null;
      frame = requestAnimationFrame(swayStep);
    };
    const pauseSway = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const stopSway = () => {
      swayCenter = null;
      pauseSway();
    };
    swayRef.current = {
      focus: (center) => {
        swayCenter = center;
        swayElapsed = 0;
        runSway();
      },
      stop: stopSway,
    };
    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) {
          runSway();
        } else {
          pauseSway();
          setLocked(true);
        }
      },
      { threshold: 0.3 }
    );
    visibility.observe(container);
    map.on("mousedown", stopSway);
    map.on("touchstart", stopSway);
    // Zoom buttons and keyboard controls: camera moves the user started carry their original event
    map.on("movestart", (e) => {
      if (e.originalEvent) stopSway();
    });

    return () => {
      window.clearTimeout(loadTimeout);
      visibility.disconnect();
      stopSway();
      swayRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [unsupported, attempt]);

  // Update markers + camera when locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const maxSessions = Math.max(...locations.map((l) => l.sessionCount), 1);
    const data = toGeoJSON(locations);
    data.features.forEach((f) => {
      f.properties!.weight = (f.properties!.sessionCount as number) / maxSessions;
    });
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);

    if (locations.length === 0) return;
    // Zoom to fit every location, centred on where most of the streaming happened
    const focus = focusOf(locations);
    if (locations.length === 1) {
      map.jumpTo({ center: focus as LngLatLike, zoom: 4 });
    } else {
      const bounds = new maplibregl.LngLatBounds();
      locations.forEach((l) => bounds.extend([l.lon, l.lat]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 6, animate: false });
      map.jumpTo({ center: focus as LngLatLike });
    }

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) swayRef.current?.focus(focus);
  }, [locations, ready]);

  if (unsupported) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
        The streaming globe needs WebGL, which isn't available in this browser.
      </div>
    );
  }

  const UnlockIcon = coarsePointer ? Hand : MousePointerClick;

  return (
    // The locked class sits on this wrapper: MapLibre adds its own classes to the map container
    <div className={`relative h-full w-full${locked ? " pwft-globe-locked" : ""}`}>
      <div ref={containerRef} className="pwft-globe h-full w-full" aria-label="Streaming locations globe" />
      {status === "ready" && locked && (
        <button
          type="button"
          onClick={unlock}
          aria-label="Explore the streaming globe"
          className="absolute inset-0 z-[5] flex items-end justify-center pb-6 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm">
            <UnlockIcon className="w-3.5 h-3.5 text-cyan" />
            {coarsePointer ? "Tap to explore" : "Click to explore"}
          </span>
        </button>
      )}
      {status !== "ready" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          {status === "loading" ? (
            <>
              <Loader2 className="w-8 h-8 text-cyan animate-spin" />
              <span>Loading globe…</span>
            </>
          ) : (
            <>
              <span>{status === "lost" ? "The globe was paused by your browser." : "The globe couldn't be loaded."}</span>
              {status === "failed" && errorText && <span className="text-xs opacity-70 max-w-xs break-words">{errorText}</span>}
              <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload globe
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GeoLocationMap;
