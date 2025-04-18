// src/pages/CalorieAnalysis.jsx
import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend
} from "recharts";

import { db } from "../firebase.js";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

const RANGE_OPTIONS = [
  { key: "1week",  label: "近一週" },
  { key: "1month", label: "近一個月" },
  { key: "3months",label: "近三個月" },
  { key: "6months",label: "近半年" },
  { key: "1year",  label: "近一年" },
  { key: "custom", label: "自訂" },
];

export default function CalorieAnalysis() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("1month");
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);

  // 讀 Firestore
  useEffect(() => {
    const q = query(
      collection(db, "treadmillRecords"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({
        ...d.data(),
        // 確保有 Date 物件方便篩選
        _createdAt: d.data().createdAt.toDate()
      }));
      setRecords(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="text-center py-8">載入中…</div>;

  // 依選單計算起始、結束日期
  function getStartDate() {
    const now = new Date();
    switch (range) {
      case "1week":
        now.setDate(now.getDate() - 7);
        return now;
      case "1month":
        now.setMonth(now.getMonth() - 1);
        return now;
      case "3months":
        now.setMonth(now.getMonth() - 3);
        return now;
      case "6months":
        now.setMonth(now.getMonth() - 6);
        return now;
      case "1year":
        now.setFullYear(now.getFullYear() - 1);
        return now;
      case "custom":
        return customStart;
      default:
        return null;
    }
  }
  const startDate = getStartDate();
  const endDate = range === "custom" ? customEnd : new Date();

  // 準備圖表資料：過濾 + 格式化
  const data = records
    .map(r => {
      const dateStr = r.date || r._createdAt.toISOString().slice(0, 10);
      return {
        date: dateStr,
        calories: Number(r.calories) || 0,
        _d: new Date(dateStr + "T00:00:00")
      };
    })
    .filter(
      item =>
        startDate &&
        endDate &&
        item._d >= startDate &&
        item._d <= endDate
    );

  return (
    <div className="max-w-3xl mx-auto p-4 bg-white rounded shadow space-y-6">
      <h2 className="text-2xl font-bold text-blue-800">🔥 熱量消耗統計</h2>

      {/* 範圍選單 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={
              "px-4 py-2 rounded-lg shadow " +
              (range === opt.key
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 自訂日期 */}
      {range === "custom" && (
        <div className="flex gap-4 mb-6">
          <DatePicker
            selected={customStart}
            onChange={d => setCustomStart(d)}
            placeholderText="開始日期"
            className="border px-3 py-2 rounded"
          />
          <DatePicker
            selected={customEnd}
            onChange={d => setCustomEnd(d)}
            placeholderText="結束日期"
            className="border px-3 py-2 rounded"
          />
        </div>
      )}

      {/* 柱狀圖 */}
      {data.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              label={{
                value: "kcal",
                angle: -90,
                position: "insideLeft"
              }}
            />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar
              dataKey="calories"
              name="熱量消耗 (kcal)"
              fill="#f87171"
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-gray-500">此時段內無任何紀錄。</p>
      )}
    </div>
  );
}
