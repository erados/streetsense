"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const GEOJSON_URL =
  "https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer/0/query?where=STATE_CODE_2021%3D%273%27&outFields=sal_name_2021&f=geojson&returnGeometry=true&outSR=4326";

const DARK_TILES =
  "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

type SuburbFeature = GeoJSON.Feature<GeoJSON.Geometry, { sal_name_2021: string }>;

interface Props {
  targetSuburb: string | null;
  onCorrect: () => void;
  onWrong: () => void;
  onFeaturesLoaded: (features: SuburbFeature[]) => void;
  flashResult: "correct" | "wrong" | null;
}

export default function Map({
  targetSuburb,
  onCorrect,
  onWrong,
  onFeaturesLoaded,
  flashResult,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const lastClickedRef = useRef<L.Layer | null>(null);
  // Use a ref for targetSuburb so click handlers always see current value
  const targetSuburbRef = useRef<string | null>(targetSuburb);
  const onCorrectRef = useRef(onCorrect);
  const onWrongRef = useRef(onWrong);
  const [loading, setLoading] = useState(true);

  // Keep refs in sync
  useEffect(() => {
    targetSuburbRef.current = targetSuburb;
  }, [targetSuburb]);
  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);
  useEffect(() => {
    onWrongRef.current = onWrong;
  }, [onWrong]);

  // Init map once (uses refs to avoid stale closure issues)
  useEffect(() => {
    if (!containerRef.current) return;

    const abortController = new AbortController();

    const map = L.map(containerRef.current, {
      center: [-27.47, 153.02],
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer(DARK_TILES, {
      attribution: ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Fetch GeoJSON with abort support
    fetch(GEOJSON_URL, { signal: abortController.signal })
      .then((r) => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        if (abortController.signal.aborted) return;

        const features = data.features as SuburbFeature[];
        onFeaturesLoaded(features);

        const layer = L.geoJSON(data, {
          style: () => ({
            color: "#555",
            weight: 1,
            fillColor: "#333",
            fillOpacity: 0.3,
          }),
          onEachFeature: (feature, lyr) => {
            const name: string = (
              feature.properties as { sal_name_2021: string }
            ).sal_name_2021;
            lyr.on("click", () => handleClick(name, lyr));
            lyr.bindTooltip(name, { sticky: true, className: "suburb-tooltip" });
          },
        });

        layer.addTo(map);
        geoLayerRef.current = layer;
        setLoading(false);
      })
      .catch((err) => {
        if (abortController.signal.aborted) return;
        console.error("Failed to load GeoJSON", err);
        setLoading(false);
      });

    return () => {
      abortController.abort();
      map.remove();
      mapRef.current = null;
      geoLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick(clickedName: string, layer: L.Layer) {
    const target = targetSuburbRef.current;
    if (!target) return;

    // Reset previous clicked layer
    if (lastClickedRef.current && geoLayerRef.current) {
      geoLayerRef.current.resetStyle(lastClickedRef.current as L.Path);
    }

    lastClickedRef.current = layer;
    const isCorrect = clickedName.toLowerCase() === target.toLowerCase();

    (layer as L.Path).setStyle(
      isCorrect
        ? { fillColor: "#22c55e", fillOpacity: 0.7, color: "#16a34a", weight: 2 }
        : { fillColor: "#ef4444", fillOpacity: 0.7, color: "#dc2626", weight: 2 }
    );

    if (isCorrect) {
      onCorrectRef.current();
      setTimeout(() => {
        if (lastClickedRef.current && geoLayerRef.current) {
          geoLayerRef.current.resetStyle(lastClickedRef.current as L.Path);
          lastClickedRef.current = null;
        }
      }, 1200);
    } else {
      onWrongRef.current();
      setTimeout(() => {
        if (lastClickedRef.current && geoLayerRef.current) {
          geoLayerRef.current.resetStyle(lastClickedRef.current as L.Path);
          lastClickedRef.current = null;
        }
      }, 800);
    }
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/70">
          <div className="text-white text-xl font-semibold animate-pulse">
            지도 불러오는 중...
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
