import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

// The Brain
import useHushPodEngine from './hooks/useHushPodEngine';

// The Pages & Components
import Home from './pages/Home';
import Join from './pages/Join';
import Room from './pages/Room';
import NeonLoader from './components/NeonLoader';

function HushPodApp() {
  // 1. Fire up the engine!
  const engine = useHushPodEngine();
  const location = useLocation();

  // 2. Global UI (The animated background)
  useEffect(() => {
    let animId;
    const c = document.getElementById('bgc');
    if (!c) return; 
    const cx = c.getContext('2d');
    let W, H;
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 2000, r: Math.random() * 1.5 + .5,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      col: ['#f72585', '#4cc9f0', '#06d6a0'][Math.floor(Math.random() * 3)],
      a: Math.random() * .4 + .1
    }));
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    function draw() {
      cx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fillStyle = p.col; cx.globalAlpha = p.a; cx.fill();
      });
      cx.globalAlpha = 1; animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, [location.pathname]);

  // 3. Render the Routes
  return (
    <>
      {/* Background canvas and Global Toast */}
      <canvas id="bgc"></canvas>
      <div className={`toast ${engine.toastData.visible ? 'on' : ''} ${engine.toastData.type}`}>
        {engine.toastData.msg}
      </div>
      
      {/* Global Loader */}
      {engine.isSyncing && <NeonLoader />}

      {/* Pages */}
      {!engine.isSyncing && (
        <Routes>
          <Route path="/" element={<Home setView={engine.setView} />} />
          <Route path="/join" element={<Join {...engine} />} />
          <Route path="/room" element={<Room {...engine} />} />
        </Routes>
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