// src/pages/TreadmillRecord.jsx
import React, { useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from "firebase/firestore";

/* ---------- Firebase ---------- */
initializeApp({
  apiKey: "AIzaSyAEDoV8VzgmyYcvIqkj_G9oDPVvpHdyFPM",
  authDomain: "family-fitness-record-31bb0.firebaseapp.com",
  projectId: "family-fitness-record-31bb0",
  storageBucket: "family-fitness-record-31bb0.firebasestorage.app",
  messagingSenderId: "695651933387",
  appId: "1:695651933387:web:47488d1c7c7cb5ffb4cf4e",
});
const db = getFirestore();

/* ---------- 共用小工具 ---------- */
const isComplete = (r) =>
  r &&
  ["timeMin", "timeSec", "speed", "distance", "calories"].every(
    (k) => r[k]?.toString().trim()
  );
const dec = (n) =>
  n.length === 2 ? `${n[0]}.${n[1]}` : n.length === 3 ? `${n[0]}.${n.slice(1)}` : n;

/* ====================================================== */
export default function TreadmillRecord() {
  /* refs / state --------------------------------------- */
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState("none"); // none｜camera｜result｜manual
  const [image, setImage] = useState(null);
  const [ocr, setOcr] = useState("");
  const [data, setData] = useState(null); // 自動解析結果
  const [busy, setBusy] = useState(false);
  const [savedAuto, setSavedAuto] = useState(false);

  const [manual, setManual] = useState({
    timeMin: "",
    timeSec: "",
    speed: "",
    distance: "",
    calories: "",
  });
  const [saving, setSaving] = useState(false);
  const [savedManual, setSavedManual] = useState(false);

  /* ---------- 相機 ---------- */
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      setMode("camera");
    } catch (e) {
      alert("無法開啟相機：" + e.message);
    }
  };

  const capture = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setImage(c.toDataURL("image/jpeg"));
    setMode("result");
  };

  /* ---------- 上傳圖片 ---------- */
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
          const v = Math.min(255, Math.max(0, (g - 128) * 1.4 + 128));
          d[i] = d[i + 1] = d[i + 2] = v;
        }
        ctx.putImageData(id, 0, 0);
        setImage(c.toDataURL("image/jpeg"));
        setMode("result");
      };
    };
    reader.readAsDataURL(file);
  };

  /* ---------- OCR ---------- */
  const runOCR = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const txt = await vision(image.replace(/^data:image\/\w+;base64,/, ""));
      setOcr(txt);
      setData(parse(txt));
      setSavedAuto(false);
    } catch (e) {
      alert("OCR 錯誤：" + e.message);
    } finally {
      setBusy(false);
    }
  };

  async function vision(content) {
    const apiKey = "AIzaSyB5OlJ9OSfWdi1ape5xxbcoXXwVw4CSDcs";
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            { image: { content }, features: [{ type: "TEXT_DETECTION" }] },
          ],
        }),
      }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.error?.message || "API error");
    return j.responses?.[0]?.fullTextAnnotation?.text || "";
  }

  /* ---------- 文字解析 ---------- */
  function parse(text) {
    let s = text
      .replace(/S/g, "5")
      .replace(/B/g, "8")
      .replace(/O/g, "0")
      .replace(/l/g, "1")
      .replace(/：/g, ":")
      .replace(/\s+/g, " ")
      .trim();

    const toks = s.split(" ");
    const merged = [];
    for (let i = 0; i < toks.length; i++) {
      let t = toks[i];
      if (i < toks.length - 1 && /^\d{1,3}$/.test(t) && /^\d{2}$/.test(toks[i + 1])) {
        merged.push(`${t}:${toks[i + 1]}`);
        i++;
        continue;
      }
      if (
        i < toks.length - 2 &&
        /^\d{2,3}$/.test(toks[i]) &&
        /^\d{2,3}$/.test(toks[i + 1]) &&
        /^\d{2,4}$/.test(toks[i + 2])
      ) {
        merged.push(dec(toks[i]), dec(toks[i + 1]), toks[i + 2]);
        i += 2;
        continue;
      }
      if (/^\d{2,3}$/.test(t)) t = dec(t);
      merged.push(t);
    }

    let timeMin = "0",
      timeSec = "0",
      speed = "",
      distance = "",
      calories = "";
    merged.forEach((t) => {
      if (/^\d{1,3}:\d{2}$/.test(t)) {
        [timeMin, timeSec] = t.split(":");
        return;
      }
      const f = parseFloat(t),
        n = parseInt(t, 10);
      if (!speed && f >= 3 && f <= 20) {
        speed = t;
        return;
      }
      if (!distance && f >= 0.5 && f <= 20) {
        distance = t;
        return;
      }
      if (!calories && n >= 100 && n <= 2000) {
        calories = t;
      }
    });
    return { timeMin, timeSec, speed, distance, calories };
  }

  /* ---------- 儲存 ---------- */
  async function saveToDb(record) {
    if (!isComplete(record)) {
      alert("請填滿所有欄位！");
      return false;
    }
    const today = new Date().toISOString().slice(0, 10);
    await addDoc(collection(db, "treadmillRecords"), {
      date: today,
      ...record,
      createdAt: Timestamp.now(),
    });
    return true;
  }

  const handleAutoSave = async () => {
    if (!isComplete(data)) {
      alert("請填滿所有欄位！");
      return;
    }
    try {
      await saveToDb(data);
      alert("✅ 儲存成功！");
      setSavedAuto(true);
    } catch (e) {
      alert("❌ " + e.message);
    }
  };

  const handleManualSave = async () => {
    try {
      setSaving(true);
      if (await saveToDb(manual)) {
        alert("✅ 儲存成功！");
        setSavedManual(true);
      }
    } catch (e) {
      alert("❌ " + e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen p-4 md:p-8 bg-blue-50 font-sans">
      <h1 className="text-3xl font-bold text-center mb-6 text-blue-800">
        🏃‍♀️ 跑步機紀錄系統
      </h1>

      {/* -------- 首頁按鈕 -------- */}
      {mode === "none" && (
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <button
            onClick={openCamera}
            className="btn bg-blue-600 text-white px-6 py-3 rounded shadow w-64"
          >
            📷 開啟相機
          </button>

          <label className="btn bg-green-600 text-white px-6 py-3 rounded shadow w-64 flex items-center justify-center cursor-pointer">
            📂 上傳圖片
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>

          <button
            onClick={() => {
              setMode("manual");
              setSavedManual(false);
            }}
            className="btn bg-yellow-500 text-white px-6 py-3 rounded shadow w-64"
          >
            ✏️ 手動輸入
          </button>
        </div>
      )}

      {/* -------- 手動輸入 -------- */}
      {mode === "manual" && (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-6 text-blue-700 flex items-center gap-2">
            ✏️ 手動輸入數值
          </h2>

          <div className="space-y-4 mb-8">
            {/* 時間 */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="w-24 text-gray-700">時間</label>
              <input
                className="border rounded px-3 py-2 w-24"
                type="number"
                value={manual.timeMin}
                onChange={(e) => setManual({ ...manual, timeMin: e.target.value })}
              />
              <span>分</span>
              <input
                className="border rounded px-3 py-2 w-24"
                type="number"
                value={manual.timeSec}
                onChange={(e) => setManual({ ...manual, timeSec: e.target.value })}
              />
              <span>秒</span>
            </div>
            {/* 速度 */}
            <div className="flex items-center gap-2">
              <label className="w-24 text-gray-700">速度</label>
              <input
                className="border rounded px-3 py-2 flex-1"
                type="number"
                step="0.1"
                value={manual.speed}
                onChange={(e) => setManual({ ...manual, speed: e.target.value })}
              />
              <span>km/h</span>
            </div>
            {/* 距離 */}
            <div className="flex items-center gap-2">
              <label className="w-24 text-gray-700">距離</label>
              <input
                className="border rounded px-3 py-2 flex-1"
                type="number"
                step="0.01"
                value={manual.distance}
                onChange={(e) => setManual({ ...manual, distance: e.target.value })}
              />
              <span>km</span>
            </div>
            {/* 卡路里 */}
            <div className="flex items-center gap-2">
              <label className="w-24 text-gray-700">卡路里</label>
              <input
                className="border rounded px-3 py-2 flex-1"
                type="number"
                value={manual.calories}
                onChange={(e) => setManual({ ...manual, calories: e.target.value })}
              />
              <span>kcal</span>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            {!savedManual ? (
              <>
                <button
                  onClick={() => setMode("none")}
                  className="btn bg-gray-300 text-gray-800 px-6 py-2 rounded shadow"
                >
                  取消
                </button>
                <button
                  onClick={handleManualSave}
                  disabled={saving || !isComplete(manual)}
                  className="btn bg-purple-600 text-white px-6 py-2 rounded shadow"
                >
                  {saving ? "儲存中..." : "💾 儲存"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setMode("none")}
                className="btn bg-blue-600 text-white px-6 py-2 rounded shadow"
              >
                返回
              </button>
            )}
          </div>
        </div>
      )}

      {/* -------- 相機取景 -------- */}
      {mode === "camera" && (
        <div className="flex flex-col items-center gap-4">
          <video ref={videoRef} autoPlay playsInline className="max-w-md w-full rounded shadow" />
          <button
            onClick={capture}
            className="btn bg-indigo-600 text-white px-6 py-2 rounded shadow"
          >
            拍照
          </button>
        </div>
      )}

      {/* -------- OCR / 解析畫面 -------- */}
      {mode === "result" && (
        <>
          {image && (
            <div className="text-center mb-6">
              <img src={image} alt="" className="mx-auto max-h-80 rounded shadow" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            {!savedAuto ? (
              <>
                <button
                  onClick={runOCR}
                  disabled={busy}
                  className="btn bg-green-600 text-white px-6 py-2 rounded shadow"
                >
                  {busy ? "辨識中..." : "開始辨識"}
                </button>
                <button
                  onClick={() => {
                    setMode("none");
                    setOcr("");
                    setData(null);
                    setSavedAuto(false);
                  }}
                  className="btn bg-yellow-500 text-white px-6 py-2 rounded shadow"
                >
                  重辨
                </button>
                <button
                  onClick={handleAutoSave}
                  disabled={!isComplete(data)}
                  className="btn bg-purple-600 text-white px-6 py-2 rounded shadow"
                >
                  💾 儲存
                </button>
              </>
            ) : (
              <button
                onClick={() => setMode("none")}
                className="btn bg-blue-600 text-white px-6 py-2 rounded shadow"
              >
                返回
              </button>
            )}
          </div>

          {/* 自動解析卡片 */}
          {data && (
            <div className="bg-white p-4 rounded shadow max-w-xl mx-auto mb-6">
              <h2 className="text-lg font-semibold mb-4 text-blue-700">✅ 自動解析結果</h2>
              <div className="space-y-3">
                {/* 時間 */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-gray-700">時間</label>
                  <input
                    type="number"
                    className="border rounded px-3 py-1 w-24"
                    value={data.timeMin}
                    onChange={(e) => setData({ ...data, timeMin: e.target.value })}
                  />
                  <span>分</span>
                  <input
                    type="number"
                    className="border rounded px-3 py-1 w-24"
                    value={data.timeSec}
                    onChange={(e) => setData({ ...data, timeSec: e.target.value })}
                  />
                  <span>秒</span>
                </div>
                {/* 速度 */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-gray-700">速度</label>
                  <input
                    type="number"
                    step="0.1"
                    className="border rounded px-3 py-1 flex-1"
                    value={data.speed}
                    onChange={(e) => setData({ ...data, speed: e.target.value })}
                  />
                  <span>km/h</span>
                </div>
                {/* 距離 */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-gray-700">距離</label>
                  <input
                    type="number"
                    step="0.01"
                    className="border rounded px-3 py-1 flex-1"
                    value={data.distance}
                    onChange={(e) => setData({ ...data, distance: e.target.value })}
                  />
                  <span>km</span>
                </div>
                {/* 卡路里 */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-gray-700">卡路里</label>
                  <input
                    type="number"
                    className="border rounded px-3 py-1 flex-1"
                    value={data.calories}
                    onChange={(e) => setData({ ...data, calories: e.target.value })}
                  />
                  <span>kcal</span>
                </div>
              </div>
            </div>
          )}

          {/* OCR Text */}
          {ocr && (
            <div className="bg-white p-4 rounded shadow max-w-xl mx-auto">
              <h2 className="text-lg font-semibold mb-2 text-blue-700">📄 OCR 原始結果</h2>
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded text-gray-800">
                {ocr}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
