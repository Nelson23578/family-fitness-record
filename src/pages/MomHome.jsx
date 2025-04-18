// src/pages/MomHome.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MomHome() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-white to-green-100">
      <h1 className="text-2xl font-bold mb-4 text-center">媽媽的健身紀錄</h1>
      <div className="grid gap-4 max-w-md mx-auto">
        <button
          onClick={() => nav('/mom/treadmill')}
          className="btn bg-blue-200 hover:bg-blue-300 text-black px-4 py-3 rounded-xl shadow text-lg"
        >
          🏃‍♀️ 跑步機紀錄
        </button>
        <button
          onClick={() => nav('/mom/jump')}
          className="btn bg-pink-200 hover:bg-pink-300 text-black px-4 py-3 rounded-xl shadow text-lg"
        >
          🤸‍♀️ 跳繩紀錄
        </button>
        <button
          onClick={() => nav('/mom/history')}
          className="btn bg-yellow-200 hover:bg-yellow-300 text-black px-4 py-3 rounded-xl shadow text-lg"
        >
          📊 歷史紀錄與分析
        </button>
      </div>
    </div>
  );
}
