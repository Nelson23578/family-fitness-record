// src/pages/History.jsx
import React, { useState } from 'react';
import CalendarView    from './CalendarView.jsx';
import RunAnalysis     from './RunAnalysis.jsx';
import JumpAnalysis    from './JumpAnalysis.jsx';
import CalorieAnalysis from './CalorieAnalysis.jsx';

const TABS = [
  { key: 'calendar', label: '單月健身紀錄',   component: CalendarView },
  { key: 'run',      label: '跑步紀錄分析',   component: RunAnalysis },
  { key: 'jump',     label: '跳繩紀錄分析',   component: JumpAnalysis },
  { key: 'calorie',  label: '熱量消耗統計',   component: CalorieAnalysis },
];

export default function History() {
  const [active, setActive] = useState(TABS[0].key);
  const ActiveComp = TABS.find(t => t.key === active).component;

  return (
    <div className="min-h-screen p-6 bg-blue-50 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-800 flex justify-center">
        <span className="mr-2">📈</span> 歷史紀錄與分析
      </h1>

      {/* tab bar */}
      <div className="flex justify-center gap-4 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={
              'btn px-4 py-2 rounded ' +
              (active === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 主內容區 */}
      <div className="max-w-4xl mx-auto">
        <ActiveComp />
      </div>
    </div>
  );
}
