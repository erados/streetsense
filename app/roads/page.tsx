"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { Road } from "@/components/RoadsMap";

const RoadsMap = dynamic(() => import("@/components/RoadsMap"), { ssr: false });

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type ToastState = { type: "correct" | "wrong"; message?: string } | null;

export default function RoadsPage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [targetRoad, setTargetRoad] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [toast, setToast] = useState<ToastState>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashResult, setFlashResult] = useState<"correct" | "wrong" | null>(null);

  const showToast = (type: "correct" | "wrong", message?: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 1500);
  };

  const nextRoad = useCallback(
    (roadList: Road[]) => {
      const pool = roadList.length > 0 ? roadList : roads;
      if (pool.length === 0) return;
      const picked = pickRandom(pool);
      setTargetRoad(picked.name);
      setFlashResult(null);
    },
    [roads]
  );

  const handleRoadsLoaded = useCallback(
    (loadedRoads: Road[]) => {
      setRoads(loadedRoads);
      nextRoad(loadedRoads);
    },
    [nextRoad]
  );

  const handleCorrect = useCallback(() => {
    setCorrect((c) => c + 1);
    setFlashResult("correct");
    showToast("correct");
    setTimeout(() => nextRoad([]), 1200);
  }, [nextRoad]);

  const handleWrong = useCallback(
    (roadName: string) => {
      setWrong((w) => w + 1);
      setFlashResult("wrong");
      setShakeKey((k) => k + 1);
      showToast("wrong", roadName);
    },
    []
  );

  const handleSkip = useCallback(() => {
    nextRoad([]);
  }, [nextRoad]);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <RoadsMap
          targetRoad={targetRoad}
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          onRoadsLoaded={handleRoadsLoaded}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
        {/* Nav pills */}
        <div className="flex gap-2 shrink-0">
          <Link
            href="/"
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-full border border-white/20 backdrop-blur-sm transition-colors"
          >
            🏘️ 서버브
          </Link>
          <span className="px-3 py-1 bg-white/25 text-white text-xs rounded-full border border-white/40">
            🛣️ 도로
          </span>
          <Link
            href="/streets"
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-full border border-white/20 backdrop-blur-sm transition-colors"
          >
            🏙️ 거리
          </Link>
        </div>

        {/* Prompt */}
        <div
          key={shakeKey}
          className={`flex-1 text-center ${flashResult === "wrong" ? "shake" : ""}`}
        >
          {targetRoad ? (
            <p className="text-white text-base sm:text-lg font-medium">
              클릭하세요:{" "}
              <span className="text-yellow-300 font-bold text-lg sm:text-xl">
                {targetRoad}
              </span>
            </p>
          ) : (
            <p className="text-white/50 text-sm">도로 불러오는 중...</p>
          )}
        </div>

        {/* Score */}
        <div className="ml-4 flex items-center gap-3 text-sm font-semibold whitespace-nowrap shrink-0">
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
              toast.type === "correct"
                ? "bg-green-600/90 border-green-400"
                : "bg-red-600/90 border-red-400"
            }`}
          >
            {toast.type === "correct"
              ? "✅ 정답!"
              : `❌ ${toast.message} 틀렸어요`}
          </div>
        </div>
      )}
    </div>
  );
}
