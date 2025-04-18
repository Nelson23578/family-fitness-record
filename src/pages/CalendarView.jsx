// src/pages/CalendarView.jsx
import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function CalendarView() {
  // map["YYYY-MM-DD"] = [ { type, ...record }, ... ]
  const [records, setRecords] = useState({});
  // Calendar 顯示哪個月份
  const [viewDate, setViewDate] = useState(new Date());
  // 使用者點了哪一天
  const [selectedDay, setSelectedDay] = useState(null);
  // 該日所有紀錄
  const [daily, setDaily] = useState([]);

  // 本地化 key helper (台灣時區)
  const formatKey = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 載入當月資料
  useEffect(() => {
    const monthStart = formatKey(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
    const nextMonth = formatKey(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    async function load() {
      const tq = query(
        collection(db, "treadmillRecords"),
        where("date", ">=", monthStart),
        where("date", "<", nextMonth)
      );
      const jq = query(
        collection(db, "JumpRopeRecord"),
        where("date", ">=", monthStart),
        where("date", "<", nextMonth)
      );
      const [tSnap, jSnap] = await Promise.all([getDocs(tq), getDocs(jq)]);
      const map = {};

      tSnap.forEach((doc) => {
        const d = doc.data();
        // date 欄位已是 YYYY-MM-DD
        map[d.date] = map[d.date] || [];
        map[d.date].push({ type: "跑步", ...d });
      });

      jSnap.forEach((doc) => {
        const d = doc.data();
        // 優先用 date 欄位，fallback 不該發生
        const key = d.date || formatKey(d.createdAt.toDate());
        map[key] = map[key] || [];
        map[key].push({ type: "跳繩", ...d });
      });

      setRecords(map);
      // 換月時重置選取
      setSelectedDay(null);
      setDaily([]);
    }

    load();
  }, [viewDate]);

  // 哪些格子要加綠底
  const tileClassName = ({ date: d, view }) => {
    if (view === "month" && records[formatKey(d)]) {
      return "react-calendar__tile--marked relative";
    }
  };

  // 標記小圓點
  const tileContent = ({ date: d, view }) => {
    if (view === "month" && records[formatKey(d)]) {
      return (
        <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
      );
    }
    return null;
  };

  // 點一天
  const onDateClick = (d) => {
    const key = formatKey(d);
    setSelectedDay(d);
    setDaily(records[key] || []);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-center">
        <Calendar
          onActiveStartDateChange={({ activeStartDate }) =>
            setViewDate(activeStartDate)
          }
          onClickDay={onDateClick}
          value={selectedDay}
          tileClassName={tileClassName}
          tileContent={tileContent}
        />
      </div>

      {selectedDay ? (
        daily.length > 0 ? (
          <div className="mt-6 space-y-4">
            {daily.map((r, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg shadow-md border ${
                  r.type === "跑步" ? "bg-green-50" : "bg-pink-50"
                }`}
              >
                <h3 className="text-xl font-semibold mb-2 flex items-center">
                  {r.type === "跑步" ? "🏃‍♀️ 跑步" : "🤸‍♀️ 跳繩"}
                </h3>
                <div className="grid grid-cols-2 gap-y-2 text-gray-700">
                  <div>時間</div>
                  <div>
                    {r.timeMin} 分 {r.timeSec} 秒
                  </div>

                  {r.type === "跑步" && (
                    <>
                      <div>速度</div>
                      <div>{r.speed} km/h</div>
                      <div>距離</div>
                      <div>{r.distance} km</div>
                    </>
                  )}

                  {r.type === "跳繩" && (
                    <>
                      <div>次數</div>
                      <div>{r.reps} 次</div>
                    </>
                  )}

                  <div>卡路里</div>
                  <div>{r.calories} kcal</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-center text-gray-500">
            該日無任何運動紀錄
          </p>
        )
      ) : (
        <p className="mt-6 text-center text-gray-500">
          請點選上方日期以查看當日紀錄
        </p>
      )}
    </div>
  );
}
