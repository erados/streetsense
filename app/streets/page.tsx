"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { Street } from "@/components/StreetsMap";

const StreetsMap = dynamic(() => import("@/components/StreetsMap"), { ssr: false });

const SUBURBS = [
  // Inner
  "Brisbane City", "Fortitude Valley", "New Farm", "Newstead", "West End", "South Bank",
  "Kangaroo Point", "Woolloongabba", "Paddington", "Milton", "Spring Hill", "Kelvin Grove",
  "Teneriffe", "Bowen Hills", "Highgate Hill", "Dutton Park", "Auchenflower",
  // North
  "Windsor", "Gordon Park", "Lutwyche", "Clayfield", "Ascot", "Hamilton",
  "Nundah", "Wavell Heights", "Chermside", "Stafford", "Everton Park", "Keperra",
  "Gaythorne", "Enoggera", "Alderley", "Newmarket", "Wilston",
  // West
  "Toowong", "Indooroopilly", "Taringa", "St Lucia", "Bardon", "Red Hill",
  "Ashgrove", "The Gap", "Ferny Grove", "Keperra", "Kenmore",
  // South
  "Sunnybank", "Sunnybank Hills", "Runcorn", "Calamvale", "Algester",
  "Acacia Ridge", "Coopers Plains", "Salisbury", "Moorooka", "Rocklea",
  "Annerley", "Yeronga", "Tennyson", "Fairfield", "Greenslopes",
  "Holland Park", "Mount Gravatt", "Upper Mount Gravatt", "Eight Mile Plains",
  "Wishart", "Mansfield", "Macgregor", "Robertson", "Sunnybank",
  // East
  "Coorparoo", "Camp Hill", "Carina", "Carindale", "Tingalpa", "Wynnum",
  "Manly", "Hemmant", "Murarrie", "Morningside", "Norman Park", "Hawthorne",
  "Balmoral", "Bulimba", "Cannon Hill",
].filter((v, i, a) => a.indexOf(v) === i).sort();

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type ToastState = { type: "correct" | "wrong"; message?: string } | null;

export default function StreetsPage() {
  const [selectedSuburb, setSelectedSuburb] = useState<string | null>(null);
  const [streets, setStreets] = useState<Street[]>([]);
  const [targetStreet, setTargetStreet] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [toast, setToast] = useState<ToastState>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashResult, setFlashResult] = useState<"correct" | "wrong" | null>(null);

  const showToast = (type: "correct" | "wrong", message?: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 1500);
  };

  const nextStreet = useCallback(
    (streetList: Street[]) => {
      const pool = streetList.length > 0 ? streetList : streets;
      if (pool.length === 0) return;
      const picked = pickRandom(pool);
      setTargetStreet(picked.name);
      setFlashResult(null);
    },
    [streets]
  );

  const handleStreetsLoaded = useCallback(
    (loadedStreets: Street[]) => {
      setStreets(loadedStreets);
      nextStreet(loadedStreets);
    },
    [nextStreet]
  );

  const handleCorrect = useCallback(() => {
    setCorrect((c) => c + 1);
    setFlashResult("correct");
    showToast("correct");
    setTimeout(() => nextStreet([]), 1200);
  }, [nextStreet]);

  const handleWrong = useCallback((streetName: string) => {
    setWrong((w) => w + 1);
    setFlashResult("wrong");
    setShakeKey((k) => k + 1);
    showToast("wrong", streetName);
  }, []);

  const handleSkip = useCallback(() => nextStreet([]), [nextStreet]);

  const handleSuburbChange = (suburb: string) => {
    setSelectedSuburb(suburb);
    setStreets([]);
    setTargetStreet(null);
    setCorrect(0);
    setWrong(0);
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <StreetsMap
          selectedSuburb={selectedSuburb}
          targetStreet={targetStreet}
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          onStreetsLoaded={handleStreetsLoaded}
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
          <Link
            href="/roads"
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-full border border-white/20 backdrop-blur-sm transition-colors"
          >
            🛣️ 도로
          </Link>
          <span className="px-3 py-1 bg-white/25 text-white text-xs rounded-full border border-white/40">
            🏙️ 거리
          </span>
        </div>

        {/* Suburb selector + Prompt */}
        <div
          key={shakeKey}
          className={`flex-1 flex items-center justify-center gap-3 ${flashResult === "wrong" ? "shake" : ""}`}
        >
          <select
            value={selectedSuburb ?? ""}
            onChange={(e) => e.target.value && handleSuburbChange(e.target.value)}
            className="bg-black/60 text-white text-xs rounded-full border border-white/30 px-3 py-1 backdrop-blur-sm"
          >
            <option value="">서버브 선택...</option>
            {SUBURBS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {targetStreet ? (
            <p className="text-white text-base sm:text-lg font-medium">
              클릭하세요:{" "}
              <span className="text-yellow-300 font-bold text-lg sm:text-xl">
                {targetStreet}
              </span>
            </p>
          ) : selectedSuburb ? (
            <p className="text-white/50 text-sm">거리 불러오는 중...</p>
          ) : (
            <p className="text-white/50 text-sm">서버브를 선택하세요</p>
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
      {targetStreet && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
          <button
            onClick={handleSkip}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-full border border-white/20 backdrop-blur-sm transition-colors"
          >
            모르겠어요 →
          </button>
        </div>
      )}

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
            {toast.type === "correct" ? "✅ 정답!" : `❌ ${toast.message} 틀렸어요`}
          </div>
        </div>
      )}
    </div>
  );
}
