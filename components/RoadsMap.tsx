"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DARK_TILES =
  "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const OVERPASS_URL =
  "https://overpass-api.de/api/interpreter?data=[out:json][timeout:30];(way[%22highway%22=%22motorway%22][%22name%22](-28.0,152.7,-27.0,153.6);way[%22highway%22=%22trunk%22][%22name%22](-28.0,152.7,-27.0,153.6);way[%22highway%22=%22motorway_link%22][%22ref%22](-28.0,152.7,-27.0,153.6););out geom;";

interface OverpassWay {
  type: "way";
  id: number;
  geometry: { lat: number; lon: number }[];
  tags: {
    name?: string;
    ref?: string;
    highway: string;
  };
}

export interface Road {
  name: string;
  highway: string;
  segments: [number, number][][];
}

function roadColor(highway: string): string {
  if (highway === "motorway" || highway === "motorway_link") return "#f97316";
  if (highway === "trunk") return "#eab308";
  return "#ffffff";
}

interface Props {
  targetRoad: string | null;
  onCorrect: () => void;
  onWrong: (roadName: string) => void;
  onRoadsLoaded: (roads: Road[]) => void;
}

export default function RoadsMap({
  targetRoad,
  onCorrect,
  onWrong,
  onRoadsLoaded,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visLinesRef = useRef<Map<string, L.Polyline[]>>(new Map());
  const defaultColorsRef = useRef<Map<string, string>>(new Map());
  const targetRoadRef = useRef<string | null>(targetRoad);
  const onCorrectRef = useRef(onCorrect);
  const onWrongRef = useRef(onWrong);
  const lastClickedRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    targetRoadRef.current = targetRoad;
  }, [targetRoad]);
  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);
  useEffect(() => {
    onWrongRef.current = onWrong;
  }, [onWrong]);

  useEffect(() => {
    if (!containerRef.current) return;
    const abortController = new AbortController();

    const map = L.map(containerRef.current, {
      center: [-27.47, 153.02],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer(DARK_TILES, {
      attribution: ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    fetch(OVERPASS_URL, { signal: abortController.signal })
      .then((r) => r.json())
      .then((data: { elements: OverpassWay[] }) => {
        if (abortController.signal.aborted) return;

        // Group ways by name/ref
        const roadMap = new Map<string, Road>();

        for (const way of data.elements) {
          if (way.type !== "way" || !way.geometry) continue;
          const name = way.tags.name ?? way.tags.ref;
          if (!name) continue;

          const coords: [number, number][] = way.geometry.map((p) => [
            p.lat,
            p.lon,
          ]);

          if (roadMap.has(name)) {
            roadMap.get(name)!.segments.push(coords);
          } else {
            roadMap.set(name, {
              name,
              highway: way.tags.highway,
              segments: [coords],
            });
          }
        }

        const roads = Array.from(roadMap.values());
        onRoadsLoaded(roads);

        for (const road of roads) {
          const color = roadColor(road.highway);
          const visLines: L.Polyline[] = [];

          for (const segment of road.segments) {
            // Wide transparent hit area for easy clicking
            const hitLine = L.polyline(segment, {
              color: "transparent",
              weight: 20,
              opacity: 0,
              interactive: true,
            });

            // Visible display line
            const visLine = L.polyline(segment, {
              color,
              weight: 3,
              opacity: 0.9,
              interactive: false,
            });

            hitLine.on("click", () => handleRoadClick(road.name));
            hitLine.bindTooltip(road.name, {
              sticky: true,
              className: "suburb-tooltip",
            });

            hitLine.addTo(map);
            visLine.addTo(map);
            visLines.push(visLine);
          }

          visLinesRef.current.set(road.name, visLines);
          defaultColorsRef.current.set(road.name, color);
        }

        setLoading(false);
      })
      .catch((err) => {
        if (abortController.signal.aborted) return;
        console.error("Failed to load roads from Overpass", err);
        setLoading(false);
      });

    return () => {
      abortController.abort();
      map.remove();
      mapRef.current = null;
      visLinesRef.current = new Map();
      defaultColorsRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetRoadStyle(name: string) {
    const lines = visLinesRef.current.get(name);
    const color = defaultColorsRef.current.get(name);
    if (lines && color) {
      lines.forEach((l) => l.setStyle({ color, weight: 3, opacity: 0.9 }));
    }
  }

  function highlightRoad(name: string, color: string) {
    const lines = visLinesRef.current.get(name);
    if (lines) {
      lines.forEach((l) => l.setStyle({ color, weight: 6, opacity: 1 }));
    }
  }

  function handleRoadClick(clickedName: string) {
    const target = targetRoadRef.current;
    if (!target) return;

    if (lastClickedRef.current) {
      resetRoadStyle(lastClickedRef.current);
    }

    lastClickedRef.current = clickedName;
    const isCorrect = clickedName.toLowerCase() === target.toLowerCase();

    if (isCorrect) {
      highlightRoad(clickedName, "#22c55e");
      onCorrectRef.current();
      setTimeout(() => {
        resetRoadStyle(clickedName);
        lastClickedRef.current = null;
      }, 1200);
    } else {
      highlightRoad(clickedName, "#ef4444");
      onWrongRef.current(clickedName);
      setTimeout(() => {
        resetRoadStyle(clickedName);
        lastClickedRef.current = null;
      }, 800);
    }
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/70">
          <div className="text-white text-xl font-semibold animate-pulse">
            도로 불러오는 중...
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
