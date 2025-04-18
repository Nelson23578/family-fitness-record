// src/pages/RunAnalysis.jsx
import React, { useState, useEffect } from "react";
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { db } from "../firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "firebase/firestore";

export default function RunAnalysis() {
  const [range, setRange] = useState("1m");
  const [custom, setCustom] = useState([null, null]);
  const [data, setData] = useState([]);

  // 計算起始日期
  function getStart() {
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
      default:
        return custom[0];
    }
    return now;
  }

  // 加载数据
  useEffect(() => {
    async function load() {
      const start = getStart();
      const end = range === "custom" ? custom[1] : new Date();
      if (!start || (range === "custom" && !end)) return;

      const qs = query(
        collection(db, "treadmillRecords"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(qs);
      const arr = snap.docs.map((d) => {
        const {
          date,
          distance,
          speed,
          calories,
          timeMin,
          timeSec
        } = d.data();
        // 计算总分钟数
        const duration =
          parseInt(timeMin || "0", 10) + (parseInt(timeSec || "0", 10) / 60);
        return {
          date,
          distance: parseFloat(distance),
          speed: parseFloat(speed),
          calories: parseInt(calories, 10),
          duration: Math.round(duration * 100) / 100 // 保留两位小数
        };
      });
      setData(arr);
    }
    load();
  }, [range, custom]);

  return (
    <div className="bg-white p-6 rounded shadow max-w-3xl mx-auto space-y-8">
      {/* 时间范围选择 */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {["1w", "1m", "3m", "6m", "1y", "custom"].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`btn px-3 py-1 rounded ${
              range === r
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {r === "1w"
              ? "近一週"
              : r === "1m"
              ? "近一個月"
              : r === "3m"
              ? "近三個月"
              : r === "6m"
              ? "近半年"
              : r === "1y"
              ? "近一年"
              : "自訂"}
          </button>
        ))}
      </div>

      {/* 自訂日期 */}
      {range === "custom" && (
        <div className="flex justify-center gap-4 mb-6">
          <DatePicker
            selected={custom[0]}
            onChange={(d) => setCustom([d, custom[1]])}
            placeholderText="開始日期"
            className="border px-3 py-2 rounded"
          />
          <DatePicker
            selected={custom[1]}
            onChange={(d) => setCustom([custom[0], d])}
            placeholderText="結束日期"
            className="border px-3 py-2 rounded"
          />
        </div>
      )}

      {/* 距離 vs 速度 (复合图) */}
      <div>
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <span>🏃‍♀️</span> 距離 vs 速度
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              yAxisId="left"
              label={{ value: "距離 (km)", angle: -90, position: "insideLeft" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{
                value: "速度 (km/h)",
                angle: 90,
                position: "insideRight"
              }}
            />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar
              yAxisId="left"
              dataKey="distance"
              name="距離 (km)"
              barSize={30}
              fill="#8884d8"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="speed"
              name="速度 (km/h)"
              stroke="#82ca9d"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 時間 (Bar Chart) */}
      <div>
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <span>⏱️</span> 時間 (分鐘)
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              label={{ value: "時間 (min)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar
              dataKey="duration"
              name="時間 (min)"
              barSize={30}
              fill="#ffa500"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 卡路里 (Bar Chart) */}
      <div>
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <span>🔥</span> 卡路里 (kcal)
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              label={{
                value: "卡路里 (kcal)",
                angle: -90,
                position: "insideLeft"
              }}
            />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar
              dataKey="calories"
              name="卡路里 (kcal)"
              barSize={30}
              fill="#ff6347"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
