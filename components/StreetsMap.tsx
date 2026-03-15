"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DARK_TILES =
  "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface OverpassWay {
  type: "way";
  id: number;
  geometry: { lat: number; lon: number }[];
  tags: { name?: string; highway: string };
}

export interface Street {
  name: string;
  segments: [number, number][][];
}

interface Props {
  selectedSuburb: string | null;
  targetStreet: string | null;
  onCorrect: () => void;
  onWrong: (streetName: string) => void;
  onStreetsLoaded: (streets: Street[]) => void;
}

export default function StreetsMap({
  selectedSuburb,
  targetStreet,
  onCorrect,
  onWrong,
  onStreetsLoaded,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const visLinesRef = useRef<Map<string, L.Polyline[]>>(new Map());
  const targetStreetRef = useRef<string | null>(targetStreet);
  const onCorrectRef = useRef(onCorrect);
  const onWrongRef = useRef(onWrong);
  const lastClickedRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    targetStreetRef.current = targetStreet;
  }, [targetStreet]);
  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);
  useEffect(() => {
    onWrongRef.current = onWrong;
  }, [onWrong]);

  // Map init (once)
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-27.47, 153.02],
      zoom: 14,
      zoomControl: true,
    });
    L.tileLayer(DARK_TILES, {
      attribution: ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Streets fetch (when suburb changes)
  useEffect(() => {
    if (!selectedSuburb) return;

    const map = mapRef.current as L.Map;
    const layerGroup = layerGroupRef.current as L.LayerGroup;
    if (!map || !layerGroup) return;

    const abortController = new AbortController();
    setLoading(true);

    // Clear previous streets
    layerGroup.clearLayers();
    visLinesRef.current = new Map();
    lastClickedRef.current = null;

    async function fetchStreets() {
      try {
        // 1. Get bbox from Nominatim
        const nominatimRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            selectedSuburb + " Brisbane Queensland"
          )}&format=json&limit=1`,
          { signal: abortController.signal }
        );
        const nominatimData = await nominatimRes.json();
        if (!nominatimData.length) {
          setLoading(false);
          return;
        }

        // boundingbox: [south, north, west, east]
        const [south, north, west, east] = nominatimData[0].boundingbox;

        // 2. Query Overpass for streets in bbox
        const overpassQuery = `[out:json][timeout:30];way["highway"~"residential|secondary|tertiary|unclassified|living_street"]["name"](${south},${west},${north},${east});out geom;`;
        const overpassRes = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`,
          { signal: abortController.signal }
        );
        const overpassData: { elements: OverpassWay[] } = await overpassRes.json();

        if (abortController.signal.aborted) return;

        // Group segments by street name
        const streetMap = new Map<string, Street>();
        const allCoords: [number, number][] = [];

        for (const way of overpassData.elements) {
          if (way.type !== "way" || !way.geometry || !way.tags.name) continue;
          const name = way.tags.name;
          const coords: [number, number][] = way.geometry.map((p) => [p.lat, p.lon]);
          coords.forEach((c) => allCoords.push(c));

          if (streetMap.has(name)) {
            streetMap.get(name)!.segments.push(coords);
          } else {
            streetMap.set(name, { name, segments: [coords] });
          }
        }

        const streets = Array.from(streetMap.values());
        onStreetsLoaded(streets);

        // Render streets on map
        for (const street of streets) {
          const visLines: L.Polyline[] = [];

          for (const segment of street.segments) {
            // Wide transparent hit area for easy clicking
            const hitLine = L.polyline(segment, {
              color: "transparent",
              weight: 20,
              opacity: 0,
              interactive: true,
            });
            // Visible display line
            const visLine = L.polyline(segment, {
              color: "#aaaaaa",
              weight: 2,
              opacity: 0.8,
              interactive: false,
            });

            hitLine.on("click", () => handleStreetClick(street.name));
            hitLine.bindTooltip(street.name, {
              sticky: true,
              className: "suburb-tooltip",
            });

            layerGroup.addLayer(hitLine);
            layerGroup.addLayer(visLine);
            visLines.push(visLine);
          }

          visLinesRef.current.set(street.name, visLines);
        }

        // Zoom to fit all streets
        if (allCoords.length > 0) {
          map.fitBounds(L.latLngBounds(allCoords), { padding: [20, 20] });
        }

        setLoading(false);
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error("Failed to load streets", err);
        setLoading(false);
      }
    }

    fetchStreets();

    return () => abortController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSuburb]);

  function resetStreetStyle(name: string) {
    const lines = visLinesRef.current.get(name);
    if (lines) lines.forEach((l) => l.setStyle({ color: "#aaaaaa", weight: 2, opacity: 0.8 }));
  }

  function highlightStreet(name: string, color: string) {
    const lines = visLinesRef.current.get(name);
    if (lines) lines.forEach((l) => l.setStyle({ color, weight: 5, opacity: 1 }));
  }

  function handleStreetClick(clickedName: string) {
    const target = targetStreetRef.current;
    if (!target) return;

    if (lastClickedRef.current) {
      resetStreetStyle(lastClickedRef.current);
    }

    lastClickedRef.current = clickedName;
    const isCorrect = clickedName.toLowerCase() === target.toLowerCase();

    if (isCorrect) {
      highlightStreet(clickedName, "#22c55e");
      onCorrectRef.current();
      setTimeout(() => {
        resetStreetStyle(clickedName);
        lastClickedRef.current = null;
      }, 1200);
    } else {
      highlightStreet(clickedName, "#ef4444");
      onWrongRef.current(clickedName);
      setTimeout(() => {
        resetStreetStyle(clickedName);
        lastClickedRef.current = null;
      }, 800);
    }
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/70">
          <div className="text-white text-xl font-semibold animate-pulse">
            거리 불러오는 중...
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
