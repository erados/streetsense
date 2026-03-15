"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const MapComponent = dynamic(() => import("@/components/Map"), { ssr: false });

type SuburbFeature = GeoJSON.Feature<GeoJSON.Geometry, { sal_name_2021: string }>;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type ToastType = "correct" | "wrong" | null;

export default function Home() {
  const [features, setFeatures] = useState<SuburbFeature[]>([]);
  const [targetSuburb, setTargetSuburb] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [toast, setToast] = useState<ToastType>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashResult, setFlashResult] = useState<"correct" | "wrong" | null>(null);

  const showToast = (type: ToastType) => {
    setToast(type);
    setTimeout(() => setToast(null), 1500);
  };

  const nextSuburb = useCallback(
    (feats: SuburbFeature[]) => {
      const pool = feats.length > 0 ? feats : features;
      if (pool.length === 0) return;
      const picked = pickRandom(pool);
      setTargetSuburb(picked.properties.sal_name_2021);
      setFlashResult(null);
    },
    [features]
  );

  const handleFeaturesLoaded = useCallback(
    (feats: SuburbFeature[]) => {
      setFeatures(feats);
      nextSuburb(feats);
    },
    [nextSuburb]
  );

  const handleCorrect = useCallback(() => {
    setCorrect((c) => c + 1);
    setFlashResult("correct");
    showToast("correct");
    setTimeout(() => {
      nextSuburb([]);
    }, 1200);
  }, [nextSuburb]);

  const handleWrong = useCallback(() => {
    setWrong((w) => w + 1);
    setFlashResult("wrong");
    setShakeKey((k) => k + 1);
    showToast("wrong");
  }, []);

  const handleSkip = useCallback(() => {
    nextSuburb([]);
  }, [nextSuburb]);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <MapComponent
          targetSuburb={targetSuburb}
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          onFeaturesLoaded={handleFeaturesLoaded}
          flashResult={flashResult}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
        {/* Prompt */}
        <div
          key={shakeKey}
          className={`flex-1 text-center ${flashResult === "wrong" ? "shake" : ""}`}
        >
          {targetSuburb ? (
            <p className="text-white text-base sm:text-lg font-medium">
              클릭하세요:{" "}
              <span className="text-yellow-300 font-bold text-lg sm:text-xl">
                {targetSuburb}
              </span>
            </p>
          ) : (
            <p className="text-white/50 text-sm">지도 불러오는 중...</p>
          )}
        </div>

        {/* Score */}
        <div className="ml-4 flex items-center gap-3 text-sm font-semibold whitespace-nowrap">
          <span className="text-green-400">맞음: {correct}</span>
          <span className="text-white/30">/</span>
          <span className="text-red-400">틀림: {wrong}</span>
        </div>
      </div>

      {/* Skip button */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <button
          onClick={handleSkip}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-full border border-white/20 backdrop-blur-sm transition-colors"
        >
          모르겠어요 →
        </button>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] toast-enter pointer-events-none">
          <div
            className={`px-6 py-3 rounded-xl text-white font-bold text-lg shadow-2xl border ${
              toast === "correct"
                ? "bg-green-600/90 border-green-400"
                : "bg-red-600/90 border-red-400"
            }`}
          >
            {toast === "correct" ? "✅ 정답!" : "❌ 틀렸어요"}
          </div>
        </div>
      )}
    </div>
  );
}
