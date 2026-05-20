import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

import useHushPodEngine from './hooks/useHushPodEngine';
import NeonLoader from './components/NeonLoader';

const Home = lazy(() => import('./pages/Home'));
const Join = lazy(() => import('./pages/Join'));
const Room = lazy(() => import('./pages/Room'));

const TOAST_ICONS = { ok: '✅', err: '❌', inf: 'ℹ️' };

/*
 * ROOT CAUSE OF MOBILE BLANK SCREEN:
 * ─────────────────────────────────────────────────────────────────────────
 * CSS `transform` (including `will-change:transform`) on a parent element
 * creates a NEW containing block for all `position:fixed` descendants.
 * This means fixed children are positioned relative to the animated div,
 * not the viewport — so they appear in the middle of the page or off screen.
 *
 * The `pageEnter` keyframe previously used `translateY + scale`, which
 * broke EVERY fixed element inside it: the bottom tab bar, BT badge,
 * sync indicator, toast, and the #room container itself.
 *
 * THE FIX:
 *   1. AnimatedPage uses opacity-only fade (NO transform, NO will-change)
 *   2. Room route has NO AnimatedPage wrapper at all — Room is position:fixed
 *      and manages its own full-viewport layout independently
 *   3. All truly fixed UI (toast, canvas) live at the top App level,
 *      never inside any transformed ancestor
 * ─────────────────────────────────────────────────────────────────────────
 */

// Opacity-only fade — safe for pages that contain position:fixed children
function FadePage({ children }) {
  const location = useLocation();
  return (
    <div
      key={location.pathname}
      style={{
        animation: 'pageFadeIn 0.25s ease both',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        // NO transform, NO will-change — these break position:fixed children
      }}
    >
      {children}
    </div>
  );
}

function HushPodApp() {
  const engine   = useHushPodEngine();
  const location = useLocation();
  const inRoom   = location.pathname === '/room';

  const [theme, setTheme] = useState(() => localStorage.getItem('hushpod_theme') || 'dark');

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('hushpod_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // Background particle canvas — only show outside the room
  useEffect(() => {
    if (inRoom) return;
    let animId;
    const c = document.getElementById('bgc');
    if (!c) return;
    c.style.display = 'block';
    const cx = c.getContext('2d');
    let W, H;
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 2000,
      r: Math.random() * 1.5 + .5,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      col: ['#f72585', '#4cc9f0', '#06d6a0'][Math.floor(Math.random() * 3)],
      a: Math.random() * .4 + .1,
    }));
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
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
    };
    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
      if (c) c.style.display = 'none';
    };
  }, [inRoom]);

  return (
    <>
      {/* Background canvas — hidden in room (room has its own bg) */}
      <canvas id="bgc" style={{ display: inRoom ? 'none' : 'block' }} />

      {/* Toast — lives at App root, never inside a transformed parent */}
      <div className={`toast ${engine.toastData.visible ? 'on' : ''} ${engine.toastData.type}`}>
        <span className="toast-icon">{TOAST_ICONS[engine.toastData.type] || 'ℹ️'}</span>
        {engine.toastData.msg}
      </div>

      {engine.isSyncing && <NeonLoader />}

      {!engine.isSyncing && (
        <Suspense fallback={<NeonLoader text="Loading..." />}>
          <Routes>
            {/* Home and Join: use opacity fade (safe — no fixed children) */}
            <Route path="/" element={
              <FadePage><Home setView={engine.setView} /></FadePage>
            }/>
            <Route path="/join" element={
              <FadePage><Join {...engine} /></FadePage>
            }/>

            {/*
              Room: NO FadePage wrapper.
              Room uses position:fixed internally to guarantee full-viewport
              layout on ALL devices. Any transform ancestor would break it.
              Room manages its own entrance animation via CSS on #room.
            */}
            <Route path="/room" element={
              <Room {...engine} toggleTheme={toggleTheme} theme={theme} />
            }/>
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