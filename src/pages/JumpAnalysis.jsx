// src/pages/JumpAnalysis.jsx
import React, { useState, useEffect } from "react";
import { db } from "../firebase.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";
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
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const RANGE_OPTIONS = [
  { key: "1w",   label: "近一週" },
  { key: "1m",   label: "近一個月" },
  { key: "3m",   label: "近三個月" },
  { key: "6m",   label: "近半年" },
  { key: "1y",   label: "近一年" },
  { key: "custom", label: "自訂" },
];

export default function JumpAnalysis() {
  const [records, setRecords] = useState([]);        // 原始所有记录
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("1m");         // 范围：1w/1m/3m/6m/1y/custom
  const [custom, setCustom] = useState([null, null]); // 自订日期 [start, end]

  // 1. Firebase 订阅跳绳记录
  useEffect(() => {
    const q = query(
      collection(db, "JumpRopeRecord"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setRecords(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <div className="text-center py-10">載入中…</div>;
  }

  // 2. 计算起始日期函数
  function getStartDate() {
    const now = new Date();
    switch (range) {
      case "1w":
        now.setDate(now.getDate() - 7);
        break;
      case "1m":
        now.setMonth(now.getMonth() - 1);
        break;
      case "3m":
        now.setMonth(now.getMonth() - 3);
        break;
      case "6m":
        now.setMonth(now.getMonth() - 6);
        break;
      case "1y":
        now.setFullYear(now.getFullYear() - 1);
        break;
      case "custom":
        return custom[0];
      default:
        return null;
    }
    return now;
  }

  const startDate = getStartDate();
  const endDate = range === "custom" ? custom[1] : new Date();

  // 3. 过滤并处理数据，生成图表用数组
  const data = records
    .map(r => {
      // 将 Firestore Timestamp 或字符串 date 统一处理
      const d = r.date
        ? new Date(r.date + "T00:00:00")
        : r.createdAt.toDate();
      return {
        dateObj: d,
        date: r.date || d.toISOString().slice(0, 10),
        reps: Number(r.reps) || 0,
        calories: Number(r.calories) || 0,
      };
    })
    .filter(
      ({ dateObj }) =>
        startDate &&
        endDate &&
        dateObj >= startDate &&
        dateObj <= endDate
    );

  // 如果需要按日期排序（应已排好）
  data.sort((a, b) => a.dateObj - b.dateObj);

  // 4. 两张柱状图的数据
  const repsData = data.map(({ date, reps }) => ({ date, value: reps }));
  const calData  = data.map(({ date, calories }) => ({ date, value: calories }));

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-4xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-center text-blue-800 mb-4">
        🤸‍♀️ 跳繩歷史分析
      </h2>

      {/* 範圍選擇 */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={
              "px-4 py-2 rounded-lg shadow " +
              (range === opt.key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 自訂日期 */}
      {range === "custom" && (
        <div className="flex justify-center gap-4 mb-4">
          <DatePicker
            selected={custom[0]}
            onChange={d => setCustom([d, custom[1]])}
            placeholderText="開始日期"
            className="border px-3 py-2 rounded"
          />
          <DatePicker
            selected={custom[1]}
            onChange={d => setCustom([custom[0], d])}
            placeholderText="結束日期"
            className="border px-3 py-2 rounded"
          />
        </div>
      )}

      {/* 1. 每日跳繩總次數 */}
      <div>
        <h3 className="text-xl font-semibold mb-2">每日跳繩總次數</h3>
        {repsData.length === 0 ? (
          <p className="text-center text-gray-500">此區間內無任何紀錄。</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={repsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis label={{ value: "次數", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="value" fill="#60A5FA" name="次數" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 2. 每日消耗卡路里 */}
      <div>
        <h3 className="text-xl font-semibold mb-2">每日消耗卡路里</h3>
        {calData.length === 0 ? (
          <p className="text-center text-gray-500">此區間內無任何紀錄。</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={calData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis label={{ value: "kcal", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="value" fill="#FBBF24" name="卡路里 (kcal)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
