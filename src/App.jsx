// src/App.jsx
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import UserSelect      from './pages/UserSelect.jsx';
import MomHome         from './pages/MomHome.jsx';
import TreadmillRecord from './pages/TreadmillRecord.jsx';
import JumpRopeRecord  from './pages/JumpRopeRecord.jsx';
import History         from './pages/History.jsx';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in:      { opacity: 1, y: 0 },
  out:     { opacity: 0, y: -20 },
};
const pageTransition = { duration: 0.4 };

export default function App() {
  const location = useLocation();
  return (
    <AnimatePresence exitBeforeEnter initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div initial="initial" animate="in" exit="out"
              variants={pageVariants} transition={pageTransition}>
              <UserSelect />
            </motion.div>
          }
        />
        <Route
          path="/mom"
          element={
            <motion.div initial="initial" animate="in" exit="out"
              variants={pageVariants} transition={pageTransition}>
              <MomHome />
            </motion.div>
          }
        />
        <Route
          path="/mom/treadmill"
          element={
            <motion.div initial="initial" animate="in" exit="out"
              variants={pageVariants} transition={pageTransition}>
              <TreadmillRecord />
            </motion.div>
          }
        />
        <Route
          path="/mom/jump"
          element={
            <motion.div initial="initial" animate="in" exit="out"
              variants={pageVariants} transition={pageTransition}>
              <JumpRopeRecord />
            </motion.div>
          }
        />
        <Route
          path="/mom/history"
          element={
            <motion.div initial="initial" animate="in" exit="out"
              variants={pageVariants} transition={pageTransition}>
              <History />
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
