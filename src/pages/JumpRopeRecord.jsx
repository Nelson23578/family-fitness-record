// src/pages/JumpRopeRecord.jsx
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp
} from "firebase/firestore";

// ---------- Firebase 初始化 (同原本設定) ----------
const firebaseConfig = {
  apiKey: "AIzaSyAEDoV8VzgmyYcvIqkj_G9oDPVvpHdyFPM",
  authDomain: "family-fitness-record-31bb0.firebaseapp.com",
  projectId: "family-fitness-record-31bb0",
  storageBucket: "family-fitness-record-31bb0.firebasestorage.app",
  messagingSenderId: "695651933387",
  appId: "1:695651933387:web:47488d1c7c7cb5ffb4cf4e"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function JumpRopeRecord() {
  const nav = useNavigate();

  const [goalReps, setGoalReps] = useState("");
  const [goalSets, setGoalSets] = useState("");
  const [mode, setMode] = useState("input");      // input｜running｜completed
  const [secs, setSecs] = useState(0);
  const timerRef = useRef(null);

  const [actualReps, setActualReps] = useState("");
  const [calories, setCalories]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);  // 是否已存檔

  // 開始計時
  const start = () => {
    if (!goalReps.trim() || !goalSets.trim()) {
      return alert("請輸入每組次數與組數");
    }
    setMode("running");
    setSecs(0);
    timerRef.current = setInterval(() => {
      setSecs(v => v + 1);
    }, 1000);
  };

  // 完成計算
  const complete = () => {
    clearInterval(timerRef.current);
    const total = parseInt(goalReps, 10) * parseInt(goalSets, 10);
    setActualReps(total.toString());
    // MET=12, 體重假設69kg, 時間(hr)=secs/3600
    const kcal = Math.round(12 * 69 * (secs / 3600));
    setCalories(kcal.toString());
    setMode("completed");
  };

  // 存進 Firestore
  const save = async () => {
    if (!actualReps) return alert("請先完成後再儲存");
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await addDoc(collection(db, "JumpRopeRecord"), {
        date: today,
        reps: actualReps,
        sets: goalSets,
        timeSec: secs,
        calories,
        createdAt: Timestamp.now()
      });
      setSaved(true);           // 設為已存檔
      alert("✅ 已儲存！");      
    } catch (err) {
      alert("❌ 儲存失敗：" + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 格式化秒數為 MM:SS
  const fmt = s => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-white to-green-100 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-center">🤸‍♀️ 跳繩紀錄</h1>

      {/* 輸入模式 */}
      {mode === "input" && (
        <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
          <div className="mb-4">
            <label className="block mb-1 text-gray-700">每組目標次數</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={goalReps}
              onChange={e => setGoalReps(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="block mb-1 text-gray-700">目標組數</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={goalSets}
              onChange={e => setGoalSets(e.target.value)}
            />
          </div>
          <button
            onClick={start}
            className="btn bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded w-full"
          >
            開始
          </button>
        </div>
      )}

      {/* 計時中 */}
      {mode === "running" && (
        <div className="max-w-md mx-auto bg-white p-6 rounded shadow text-center">
          <div className="text-4xl font-mono mb-6">{fmt(secs)}</div>
          <button
            onClick={complete}
            className="btn bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded"
          >
            完成
          </button>
        </div>
      )}

      {/* 完成後 */}
      {mode === "completed" && (
        <div className="max-w-md mx-auto bg-white p-6 rounded shadow space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">完成次數</span>
            <input
              type="number"
              className="border rounded px-3 py-1 w-24"
              value={actualReps}
              onChange={e => setActualReps(e.target.value)}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">歷時</span>
            <span className="font-mono">{fmt(secs)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">卡路里</span>
            <span>{calories} kcal</span>
          </div>

          {/* 如果還沒存檔，顯示「儲存」按鈕；存檔成功後顯示「返回」按鈕 */}
          {!saved ? (
            <button
              onClick={save}
              disabled={saving}
              className="btn bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded w-full"
            >
              {saving ? "儲存中..." : "💾 儲存"}
            </button>
          ) : (
            <button
              onClick={() => nav("/mom")}
              className="btn bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded w-full"
            >
              ← 返回
            </button>
          )}
        </div>
      )}
    </div>
  );
}
