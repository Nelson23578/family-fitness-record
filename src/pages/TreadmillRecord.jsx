import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const stopStream = () => {
    streamRef.current?.getTracks()?.forEach((t) => t.stop());
    streamRef.current = null;
  };

  const openCamera = async () => {
    if (!window.isSecureContext) {
      alert("⚠️ 開啟相機需 HTTPS 或 localhost 環境，請確認網址安全性");
      return;
    }
    try {
      /**
       * 為了讓 iOS Safari 能正確使用後鏡頭，需要加上 ideal 與 exact
       * Android Chrome 無此限制，若裝置無後鏡頭會自動改為前鏡頭
       */
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment", exact: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      stopStream(); // 若之前有開啟先關閉
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setMode("camera");
    } catch (e) {
      console.error(e);
      alert("無法開啟相機。若你使用的是 iOS，請至『設定→Safari→網站設定→相機』允許存取。");
    }
  };

  const capture = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    stopStream();
    setImage(c.toDataURL("image/jpeg"));
    setMode("result");
  };

  /* 離開頁面或元件卸載時，關閉相機 */
  useEffect(() => {
    return () => stopStream();
  }, []);

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
        // 簡單對比增強，提升 OCR 成功率
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const v = g > 128 ? 255 : 0; // threshold 二值化
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
      const txt = await vision(image.replace(/^data:image\/[\w+]+;base64,/, ""));
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
  /**
   * 新版 parse：
   * 1. 先把文字全部轉為單行，移除非 ASCII 字元
   * 2. 使用 RegExp 找出 time / speed / distance / calories
   * 3. 若仍缺資料，退回舊邏輯 fuzzyParse
   */
  const parse = useCallback((text) => {
    const cleaned = text
      .replace(/[\uFF01-\uFF5E]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      ) // 全形轉半形
      .replace(/[^0-9A-Za-z:.\n ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const timeMatch = cleaned.match(/(\d{1,3})[:：](\d{2})/);
    const speedMatch = cleaned.match(/(\d{1,2}\.\d)(?= ?km\/?h| ?KM\/?H| ?kph)/i);
    const distMatch = cleaned.match(/(\d{1,2}\.\d{1,2})(?= ?k?m)/i);
    const calMatch = cleaned.match(/(\d{2,4})(?= ?k?c?al)/i);

    let result = {
      timeMin: timeMatch ? timeMatch[1] : "0",
      timeSec: timeMatch ? timeMatch[2] : "0",
      speed: speedMatch ? speedMatch[1] : "",
      distance: distMatch ? distMatch[1] : "",
      calories: calMatch ? calMatch[1] : "",
    };

    // 如果還有缺欄位，使用舊邏輯補齊
    if (!isComplete(result)) {
      result = { ...result, ...fuzzyParse(cleaned) };
    }

    return result;
  }, []);

  /** 舊邏輯：盡量保持不變，但只檢查缺失欄位 */
  function fuzzyParse(text) {
    let s = text
      .replace(/S/g, "5")
      .replace(/B/g, "8")
      .replace(/O/g, "0")
      .replace(/l/g, "1")
      .replace(/：/g, ":")
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
      if (!distance && f >= 0.5 && f <= 25) {
        distance = t;
        return;
      }
      if (!calories && n >= 50 && n <= 3000) {
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
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-4 md:mb-6 text-blue-800">
        🏃‍♀️ 跑步機紀錄系統
      </h1>

      {/* -------- 首頁按鈕 -------- */}
      {mode === "none" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mb-10">
          <button
            onClick={openCamera}
            className="btn bg-blue-600 text-white px-6 py-3 rounded shadow w-full"
          >
            📷 開啟相機
          </button>

          <label className="btn bg-green-600 text-white px-6 py-3 rounded shadow w-full flex items-center justify-center cursor-pointer">
            📂 上傳圖片
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>

          <button
            onClick={() => {
              setMode("manual");
              setSavedManual(false);
            }}
            className="btn bg-yellow-500 text-white px-6 py-3 rounded shadow w-full"
          >
            ✏️ 手動輸入
          </button>
        </div>
      )}

      {/* -------- 手動輸入 -------- */}
      {mode === "manual" && (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-xl mx-auto">
          <h2 className="text-lg md:text-xl font-semibold mb-6 text-blue-700 flex items-center gap-2">
            ✏️ 手動輸入數值
          </h2>

          <div className="space-y-4 mb-8">
            {/* 時間 */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="w-20 md:w-24 text-gray-700">時間</label>
              <input
                className="border rounded px-2 py-1 w-20 md:w-24"
                type="number"
                value={manual.timeMin}
                onChange={(e) => setManual({ ...manual, timeMin: e.target.value })}
              />
              <span>分</span>
              <input
                className="border rounded px-2 py-1 w-20 md:w-24"
                type="number"
                value={manual.timeSec}
                onChange={(e) => setManual({ ...manual, timeSec: e.target.value })}
              />
              <span>秒</span>
            </div>
            {/* 速度 */}
            <div className="flex items-center gap-2">
              <label className="w-20 md:w-24 text-gray-700">速度</label>
              <input
                className="border rounded px-2 py-1 flex-1"
                type="number"
                step="0.1"
                value={manual.speed}
                onChange={(e) => setManual({ ...manual, speed: e.target.value })}
              />
              <span>km/h</span>
            </div>
            {/* 距離 */}
            <div className="flex items-center gap-2">
              <label className="w-20 md:w-24 text-gray-700">距離</label>
              <input
                className="border rounded px-2 py-1 flex-1"
                type="number"
                step="0.01"
                value={manual.distance}
                onChange={(e) => setManual({ ...manual, distance: e.target.value })}
              />
              <span>km</span>
            </div>
            {/* 卡路里 */}
            <div className="flex items-center gap-2">
              <label className="w-20 md:w-24 text-gray-700">卡路里</label>
              <input
                className="border rounded px-2 py-1 flex-1"
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
                  className="btn bg-purple-600 text-white px-6 py-2 rounded shadow disabled:opacity-50"
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
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded shadow aspect-video bg-black"
          />
          <button
            onClick={capture}
            className="btn bg-indigo-600 text-white px-6 py-2 rounded shadow"
          >
            拍照
          </button>
          <button
            onClick={() => {
              stopStream();
              setMode("none");
            }}
            className="btn bg-gray-500 text-white px-4 py-1 rounded shadow mt-2"
          >
            取消
          </button>
        </div>
      )}

      {/* -------- OCR / 解析畫面 -------- */}
      {mode === "result" && (
        <>
          {image && (
            <div className="text-center mb-6">
              <img src={image} alt="snapshot" className="mx-auto max-h-80 rounded shadow" />
            </div>
          )}

          <div className="flex flex-wrap gap-4 justify-center mb-6">
            {!savedAuto ? (
              <>
                <button
                  onClick={runOCR}
                  disabled={busy}
                  className="btn bg-green-600 text-white px-6 py-2 rounded shadow disabled:opacity-50"
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
                  重辨識
                </button>
                <button
                  onClick={handleAutoSave}
                  disabled={!isComplete(data)}
                  className="btn bg-purple-600 text-white px-6 py-2 rounded shadow disabled:opacity-50"
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
                  <label className="w-20 md:w-24 text-gray-700">時間</label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-20 md:w-24"
                    value={data.timeMin}
                    onChange={(e) => setData({ ...data, timeMin: e.target.value })}
                  />
                  <span>分</span>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-20 md:w-24"
                    value={data.timeSec}
                    onChange={(e) => setData({ ...data, timeSec: e.target.value })}
                  />
                  <span>秒</span>
                </div>
                {/* 速度 */}
                <div className="flex items-center gap-2">
                  <label className="w-20 md:w-24 text-gray-700">速度</label>
                  <input
                    type="number"
                    step="0.1"
                    className="border rounded px-2 py-1 flex-1"
                    value={data.speed}
                    onChange={(e) => setData({ ...data, speed: e.target.value })}
                  />
                  <span>km/h</span>
                </div>
                {/* 距離 */}
                <div className="flex items-center gap-2">
                  <label className="w-20 md:w-24 text-gray-700">距離</label>
                  <input
                    type="number"
                    step="0.01"
                    className="border rounded px-2 py-1 flex-1"
                    value={data.distance}
                    onChange={(e) => setData({ ...data, distance: e.target.value })}
                  />
                  <span>km</span>
                </div>
                {/* 卡路里 */}
                <div className="flex items-center gap-2">
                  <label className="w-20 md:w-24 text-gray-700">卡路里</label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 flex-1"
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
              <pre className="whitespace-pre-wrap text-xs md:text-sm bg-gray-50 p-3 rounded text-gray-800 overflow-x-auto max-h-52">
                {ocr}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
