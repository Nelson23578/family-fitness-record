// src/pages/UserSelect.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function UserSelect() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold mb-8">選擇使用者</h1>
      <div className="space-y-4">
        <button
          onClick={() => nav('/mom')}
          className="btn bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg"
        >
          媽媽
        </button>
        <button
          onClick={() => nav('/children')}
          className="btn bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg"
        >
          爸爸
        </button>
      </div>
    </div>
  );
}
