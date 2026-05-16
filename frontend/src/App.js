import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

import useHushPodEngine from './hooks/useHushPodEngine';
import NeonLoader from './components/NeonLoader';

const Home = lazy(() => import('./pages/Home'));
const Join = lazy(() => import('./pages/Join'));
const Room = lazy(() => import('./pages/Room'));

const TOAST_ICONS = { ok: '✅', err: '❌', inf: 'ℹ️' };

// FIX: AnimatedPage must be a proper flex column root.
// Using height:100vh caused the room content to overflow below the fold on mobile.
// flex:1 + min-height:0 lets #room fill exactly the available space.
function AnimatedPage({ children }) {
  const location = useLocation();
  return (
    <div
      key={location.pathname}
      className="page-enter"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,        // critical — prevents double-height on mobile
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}

function HushPodApp() {
  const engine   = useHushPodEngine();
  const location = useLocation();

  const [theme, setTheme] = useState(() => localStorage.getItem('hushpod_theme') || 'dark');

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('hushpod_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // Animated background canvas
  useEffect(() => {
    let animId;
    const c = document.getElementById('bgc');
    if (!c) return;
    const cx = c.getContext('2d');
    let W, H;
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 2000,
      r: Math.random() * 1.5 + .5,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      col: ['#f72585', '#4cc9f0', '#06d6a0'][Math.floor(Math.random() * 3)],
      a: Math.random() * .4 + .1,
    }));
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    function draw() {
      cx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        cx.fillStyle = p.col; cx.globalAlpha = p.a; cx.fill();
      });
      cx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, [location.pathname]);

  return (
    <>
      <canvas id="bgc" />

      {/* Toast */}
      <div className={`toast ${engine.toastData.visible ? 'on' : ''} ${engine.toastData.type}`}>
        <span className="toast-icon">{TOAST_ICONS[engine.toastData.type] || 'ℹ️'}</span>
        {engine.toastData.msg}
      </div>

      {engine.isSyncing && <NeonLoader />}

      {!engine.isSyncing && (
        <Suspense fallback={<NeonLoader text="Loading..." />}>
          <Routes>
            <Route path="/"     element={<AnimatedPage><Home setView={engine.setView} /></AnimatedPage>} />
            <Route path="/join" element={<AnimatedPage><Join {...engine} /></AnimatedPage>} />
            <Route path="/room" element={<AnimatedPage><Room {...engine} toggleTheme={toggleTheme} theme={theme} /></AnimatedPage>} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <HushPodApp />
    </Router>
  );
}