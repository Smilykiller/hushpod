import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/* ─────────────────────────────────────────────
   HOOK: tilt effect on any card
───────────────────────────────────────────── */
function useTilt(strength = 12) {
  const ref = useRef(null);
  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const dx = (e.clientX - cx) / (r.width  / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    el.style.transform = `perspective(600px) rotateY(${dx * strength}deg) rotateX(${-dy * strength}deg) translateZ(10px)`;
    el.style.transition = 'transform 0.1s ease';
  }, [strength]);
  const onLeave = useCallback(() => {
    if (ref.current) {
      ref.current.style.transform = 'perspective(600px) rotateY(0) rotateX(0) translateZ(0)';
      ref.current.style.transition = 'transform 0.5s ease';
    }
  }, []);
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave };
}

/* ─────────────────────────────────────────────
   COMPONENT: Tilt Card
───────────────────────────────────────────── */
function TiltCard({ children, style, className, strength }) {
  const tilt = useTilt(strength || 10);
  return (
    <div {...tilt} style={{ transformStyle: 'preserve-3d', ...style }} className={className}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENT: 3D Hero Canvas (Three.js)
───────────────────────────────────────────── */
function HeroCanvas() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const isMobile = window.innerWidth < 600;

    // Scene
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
    camera.position.set(0, 0, isMobile ? 22 : 16);

    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    sceneRef.current = { scene, camera, renderer };

    // ── WAVEFORM RING ──────────────────────────────────────────
    const POINTS = isMobile ? 80 : 160;
    const RADIUS = 7;
    const waveGeo = new THREE.BufferGeometry();
    const wavePos = new Float32Array(POINTS * 3);
    const waveBase= new Float32Array(POINTS); // original Y
    for (let i = 0; i < POINTS; i++) {
      const a = (i / POINTS) * Math.PI * 2;
      wavePos[i * 3]     = Math.cos(a) * RADIUS;
      wavePos[i * 3 + 1] = 0;
      wavePos[i * 3 + 2] = Math.sin(a) * RADIUS;
      waveBase[i] = a;
    }
    waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePos, 3));
    const waveMat = new THREE.LineBasicMaterial({ color: 0xf72585, linewidth: 2 });
    const waveLoop = new THREE.LineLoop(waveGeo, waveMat);
    scene.add(waveLoop);

    // Second ring (cyan, offset)
    const waveGeo2 = waveGeo.clone();
    const waveMat2 = new THREE.LineBasicMaterial({ color: 0x4cc9f0, linewidth: 2 });
    const waveLoop2 = new THREE.LineLoop(waveGeo2, waveMat2);
    waveLoop2.rotation.x = Math.PI / 6;
    waveLoop2.scale.setScalar(0.75);
    scene.add(waveLoop2);

    // Third ring (green)
    const waveGeo3 = waveGeo.clone();
    const waveMat3 = new THREE.LineBasicMaterial({ color: 0x06d6a0, linewidth: 1 });
    const waveLoop3 = new THREE.LineLoop(waveGeo3, waveMat3);
    waveLoop3.rotation.x = -Math.PI / 5;
    waveLoop3.scale.setScalar(0.55);
    scene.add(waveLoop3);

    // ── TORUS KNOT (center piece) ──────────────────────────────
    const knotGeo = new THREE.TorusKnotGeometry(2.2, 0.4, 120, 16, 3, 5);
    const knotMat = new THREE.MeshStandardMaterial({
      color: 0xf72585, emissive: 0xf72585, emissiveIntensity: 0.4,
      metalness: 0.8, roughness: 0.2,
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    scene.add(knot);

    // ── FLOATING PARTICLES ─────────────────────────────────────
    const NPART = isMobile ? 200 : 500;
    const pGeo  = new THREE.BufferGeometry();
    const pPos  = new Float32Array(NPART * 3);
    const pCol  = new Float32Array(NPART * 3);
    const COLORS = [[0xf7, 0x25, 0x85], [0x4c, 0xc9, 0xf0], [0x06, 0xd6, 0xa0]];
    for (let i = 0; i < NPART; i++) {
      const r = 6 + Math.random() * 14;
      const θ = Math.random() * Math.PI * 2;
      const φ = Math.acos(2 * Math.random() - 1);
      pPos[i*3]   = r * Math.sin(φ) * Math.cos(θ);
      pPos[i*3+1] = r * Math.sin(φ) * Math.sin(θ);
      pPos[i*3+2] = r * Math.cos(φ);
      const c = COLORS[Math.floor(Math.random() * 3)];
      pCol[i*3] = c[0]/255; pCol[i*3+1] = c[1]/255; pCol[i*3+2] = c[2]/255;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({ size: isMobile ? 0.12 : 0.09, vertexColors: true, transparent: true, opacity: 0.85 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ── LIGHTS ────────────────────────────────────────────────
    const amb = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(amb);
    const ptPink = new THREE.PointLight(0xf72585, 4, 30);
    ptPink.position.set(6, 4, 4);
    scene.add(ptPink);
    const ptCyan = new THREE.PointLight(0x4cc9f0, 4, 30);
    ptCyan.position.set(-6, -4, 4);
    scene.add(ptCyan);

    // ── MOUSE PARALLAX ────────────────────────────────────────
    let mx = 0, my = 0;
    const onMouse = (e) => {
      mx = (e.clientX / window.innerWidth  - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    // ── ANIMATE ───────────────────────────────────────────────
    let frameId, t = 0;
    const amp = [1.2, 0.8, 0.6, 1.0, 0.9, 1.3];
    const frq = [1.2, 2.1, 3.0, 1.7, 2.5, 0.9];

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.016;

      // Waveform pulse
      [waveGeo, waveGeo2, waveGeo3].forEach((geo, gi) => {
        const pos = geo.attributes.position;
        const scale = gi === 0 ? RADIUS : gi === 1 ? RADIUS * 0.75 : RADIUS * 0.55;
        for (let i = 0; i < POINTS; i++) {
          const a = waveBase[i];
          const wave = Math.sin(a * 6 + t * 2 + gi * 1.2) * amp[i % 6] * 0.5
                     + Math.sin(a * 3 - t * 1.5 + gi * 0.8) * 0.3;
          const r = scale + wave;
          pos.setXYZ(i,
            Math.cos(a) * r + (gi === 0 ? wave * 0.2 : 0),
            Math.sin(a * 4 + t * 1.2 + gi) * amp[i % 6] * 0.3,
            Math.sin(a) * r
          );
        }
        pos.needsUpdate = true;
      });

      // Rotate rings
      waveLoop.rotation.y  = t * 0.18;
      waveLoop.rotation.z  = t * 0.06;
      waveLoop2.rotation.y = -t * 0.22;
      waveLoop2.rotation.z = t * 0.10;
      waveLoop3.rotation.y = t * 0.28;
      waveLoop3.rotation.x = -Math.PI / 5 + Math.sin(t * 0.3) * 0.2;

      // Torus knot
      knot.rotation.x = t * 0.25;
      knot.rotation.y = t * 0.35;
      knot.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04);

      // Particles drift
      particles.rotation.y = t * 0.04;
      particles.rotation.x = Math.sin(t * 0.1) * 0.05;

      // Mouse parallax
      scene.rotation.y += (mx * 0.2 - scene.rotation.y) * 0.05;
      scene.rotation.x += (-my * 0.1 - scene.rotation.x) * 0.05;

      // Light pulse
      ptPink.intensity = 3 + Math.sin(t * 2.1) * 1.5;
      ptCyan.intensity = 3 + Math.sin(t * 1.7 + 1) * 1.5;

      renderer.render(scene, camera);
    };
    animate();

    // ── RESIZE ───────────────────────────────────────────────
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={mountRef} style={{
      position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
    }} />
  );
}

/* ─────────────────────────────────────────────
   COMPONENT: Scroll Reveal Wrapper
───────────────────────────────────────────── */
function Reveal({ children, delay = 0, y = 40, style }) {
  const ref  = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      transform: vis ? 'none' : `translateY(${y}px)`,
      opacity:   vis ? 1 : 0,
      transition: `transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s, opacity 0.6s ease ${delay}s`,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENT: 3D Stat Counter
───────────────────────────────────────────── */
function StatCounter({ value, unit, label, color, delay }) {
  const [count, setCount] = useState(0);
  const [vis, setVis]     = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!vis || isNaN(parseInt(value))) return;
    const target = parseInt(value);
    const dur = 1400, steps = 50;
    let step = 0;
    const id = setInterval(() => {
      step++;
      setCount(Math.round(target * (step / steps)));
      if (step >= steps) clearInterval(id);
    }, dur / steps);
    return () => clearInterval(id);
  }, [vis, value]);

  const display = isNaN(parseInt(value)) ? value : count;

  return (
    <div ref={ref} style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}33`,
      borderRadius: '20px',
      padding: '28px 24px',
      textAlign: 'center',
      backdropFilter: 'blur(20px)',
      transform: vis ? `perspective(600px) rotateX(0deg) translateY(0)` : `perspective(600px) rotateX(20deg) translateY(30px)`,
      opacity: vis ? 1 : 0,
      transition: `all 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      boxShadow: vis ? `0 0 30px ${color}22, inset 0 0 20px ${color}08` : 'none',
    }}>
      <div style={{
        fontSize: '42px', fontWeight: '900',
        fontFamily: "'Bebas Neue', sans-serif",
        letterSpacing: '2px', color,
        textShadow: `0 0 20px ${color}88`,
      }}>
        {display}<span style={{ fontSize: '20px' }}>{unit}</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--sub)', marginTop: '6px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENT: Floating 3D Device Card
───────────────────────────────────────────── */
function FloatingDevice({ name, device, color, delay, x, y }) {
  const [vis, setVis] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVis(true);
    }, { threshold: 0.1 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      position: 'absolute', left: x, top: y,
      transform: vis ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
      opacity: vis ? 1 : 0,
      transition: `all 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      animation: vis ? `float3d ${2.5 + delay}s ease-in-out ${delay}s infinite alternate` : 'none',
    }}>
      <div style={{
        background: `rgba(${color},0.08)`,
        border: `1px solid rgba(${color},0.3)`,
        borderRadius: '12px',
        padding: '8px 14px',
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace",
        color: `rgba(${color},1)`,
        backdropFilter: 'blur(10px)',
        whiteSpace: 'nowrap',
        boxShadow: `0 0 20px rgba(${color},0.15)`,
      }}>
        <span style={{ marginRight: '6px' }}>●</span>{name} · {device}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN HOME PAGE
═══════════════════════════════════════════ */
export default function Home({ setView }) {
  const [stats,   setStats]   = useState({ rooms: 0, listeners: 0 });
  const [openFaq, setOpenFaq] = useState(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    fetch('/stats').then(r => r.json()).then(setStats).catch(() => {});
    const id = setInterval(() => fetch('/stats').then(r => r.json()).then(setStats).catch(() => {}), 30000);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearInterval(id); window.removeEventListener('scroll', onScroll); };
  }, []);

  const parallax = (speed) => ({ transform: `translateY(${scrollY * speed}px)` });

  return (
    <div style={{ background: '#06060f', color: 'var(--text)', overflowX: 'hidden' }}>

      <style>{`
        @keyframes float3d {
          from { transform: translateY(0px) rotateX(0deg); }
          to   { transform: translateY(-10px) rotateX(3deg); }
        }
        @keyframes spin3d {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 30px #f7258555, 0 0 60px #f7258522; }
          50%      { box-shadow: 0 0 60px #f7258588, 0 0 120px #f7258544; }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .hp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 64px;
          background: rgba(6,6,15,0.75);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: background 0.3s;
        }
        .hp-nav-logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px; letter-spacing: 3px;
          background: linear-gradient(135deg, #f72585, #4cc9f0);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          text-decoration: none;
        }
        .hp-nav-links { display: flex; gap: 28px; }
        .hp-nav-links a {
          font-size: 13px; font-weight: 600; color: var(--sub);
          text-decoration: none; letter-spacing: 0.5px;
          transition: color 0.2s;
        }
        .hp-nav-links a:hover { color: var(--text); }
        .hp-nav-cta {
          background: linear-gradient(135deg, #f72585, #7b2ff7);
          color: #fff; border: none; border-radius: 10px;
          padding: 10px 22px; font-size: 13px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.5px;
          box-shadow: 0 0 20px #f7258555;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .hp-nav-cta:hover { transform: scale(1.05); box-shadow: 0 0 40px #f7258577; }
        @media(max-width:768px) {
          .hp-nav-links { display: none; }
          .hp-nav { padding: 0 20px; }
        }

        .hero-3d {
          position: relative; min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          overflow: hidden; padding: 100px 24px 60px;
        }
        .hero-content { position: relative; z-index: 2; text-align: center; max-width: 800px; }
        .hero-eyebrow-3d {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(247,37,133,0.1); border: 1px solid rgba(247,37,133,0.3);
          border-radius: 20px; padding: 6px 16px; margin-bottom: 32px;
          font-size: 12px; font-weight: 700; letter-spacing: 2px;
          text-transform: uppercase; color: #f72585;
        }
        .hero-title-3d {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(72px, 15vw, 160px);
          line-height: 0.9; margin: 0 0 24px; letter-spacing: -2px;
          background: linear-gradient(135deg, #fff 0%, #f72585 50%, #4cc9f0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 40px rgba(247,37,133,0.4));
        }
        .hero-sub-3d {
          font-size: clamp(15px, 2.5vw, 19px); color: var(--sub);
          line-height: 1.7; max-width: 600px; margin: 0 auto 40px;
        }
        .hero-btns-3d { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .btn-3d-primary {
          background: linear-gradient(135deg, #f72585, #7b2ff7);
          border: none; border-radius: 14px; padding: 16px 36px;
          font-size: 16px; font-weight: 800; color: #fff; cursor: pointer;
          box-shadow: 0 8px 32px #f7258555, 0 0 0 1px rgba(255,255,255,0.1) inset;
          animation: pulseGlow 3s ease-in-out infinite;
          transition: transform 0.2s;
        }
        .btn-3d-primary:hover { transform: translateY(-3px) scale(1.03); }
        .btn-3d-ghost {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
          padding: 16px 36px; font-size: 16px; font-weight: 700;
          color: var(--text); cursor: pointer;
          backdrop-filter: blur(10px); transition: all 0.2s;
        }
        .btn-3d-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); }

        .stats-3d {
          display: grid; grid-template-columns: repeat(4,1fr); gap: 16px;
          max-width: 800px; margin: 60px auto 0; width: 100%;
        }
        @media(max-width:600px) {
          .stats-3d { grid-template-columns: repeat(2,1fr); }
        }

        .section-3d { padding: 120px 24px; position: relative; }
        .section-label-3d {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 700; letter-spacing: 3px;
          text-transform: uppercase; color: #f72585; margin-bottom: 16px;
        }
        .section-title-3d {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(40px, 7vw, 80px);
          line-height: 0.95; letter-spacing: -1px; color: #fff;
          margin: 0 0 20px;
        }
        .section-sub-3d { font-size: 16px; color: var(--sub); line-height: 1.7; max-width: 500px; }

        .steps-3d {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr));
          gap: 20px; max-width: 1100px; margin: 64px auto 0;
        }
        .step-3d {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px; padding: 32px 28px;
          position: relative; overflow: hidden;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .step-3d::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(247,37,133,0.06), transparent);
          opacity: 0; transition: opacity 0.3s;
        }
        .step-3d:hover::before { opacity: 1; }
        .step-3d:hover { border-color: rgba(247,37,133,0.3); box-shadow: 0 20px 60px rgba(247,37,133,0.12); }
        .step-num-3d {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 80px; line-height: 1;
          background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          position: absolute; top: 16px; right: 20px;
        }
        .step-icon-3d { font-size: 36px; margin-bottom: 16px; }
        .step-title-3d { font-size: 18px; font-weight: 800; margin-bottom: 10px; }
        .step-desc-3d { font-size: 14px; color: var(--sub); line-height: 1.65; }

        .features-3d {
          display: grid; grid-template-columns: repeat(auto-fit,minmax(300px,1fr));
          gap: 20px; max-width: 1100px; margin: 64px auto 0;
        }
        .feat-3d {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 28px;
          position: relative; overflow: hidden;
          transition: all 0.3s;
        }
        .feat-3d:hover {
          border-color: rgba(76,201,240,0.35);
          box-shadow: 0 20px 60px rgba(76,201,240,0.10), 0 0 0 1px rgba(76,201,240,0.15);
        }
        .feat-icon-3d { font-size: 28px; margin-bottom: 14px; }
        .feat-title-3d { font-size: 16px; font-weight: 800; margin-bottom: 8px; }
        .feat-desc-3d { font-size: 13px; color: var(--sub); line-height: 1.6; }
        .feat-badge-3d {
          display: inline-block; margin-top: 12px; padding: 3px 10px;
          border-radius: 20px; font-size: 10px; font-weight: 800; letter-spacing: 1px;
        }
        .badge-live { background: rgba(6,214,160,0.15); color: #06d6a0; border: 1px solid rgba(6,214,160,0.3); }
        .badge-soon { background: rgba(255,214,10,0.1); color: #ffd60a; border: 1px solid rgba(255,214,10,0.25); }

        .cases-3d {
          display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr));
          gap: 20px; max-width: 1100px; margin: 64px auto 0;
        }
        .case-3d {
          border-radius: 24px; padding: 36px 28px; position: relative; overflow: hidden;
          transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s;
        }

        .faq-3d { max-width: 760px; margin: 48px auto 0; }
        .faq-item-3d {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; margin-bottom: 12px; overflow: hidden;
          transition: border-color 0.3s;
        }
        .faq-item-3d:hover { border-color: rgba(247,37,133,0.3); }
        .faq-q-3d {
          padding: 20px 24px; font-size: 15px; font-weight: 700;
          cursor: pointer; display: flex; justify-content: space-between;
          align-items: center; user-select: none;
        }
        .faq-a-3d {
          padding: 0 24px; font-size: 14px; color: var(--sub); line-height: 1.7;
          max-height: 0; overflow: hidden; transition: max-height 0.4s ease, padding 0.3s;
        }
        .faq-a-3d.open { max-height: 200px; padding: 0 24px 20px; }
        .faq-arrow-3d { transition: transform 0.3s; font-size: 18px; color: var(--sub); }
        .faq-arrow-3d.open { transform: rotate(180deg); color: #f72585; }

        .cta-3d {
          padding: 140px 24px; text-align: center; position: relative; overflow: hidden;
        }
        .cta-glow-3d {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(247,37,133,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .cta-title-3d {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(60px, 12vw, 130px);
          line-height: 0.9; letter-spacing: -2px;
          background: linear-gradient(135deg, #fff, #f72585 60%, #4cc9f0);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 24px;
        }

        .footer-3d {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 60px 24px 40px; max-width: 1100px; margin: 0 auto;
        }
        .footer-grid-3d {
          display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 48px; margin-bottom: 48px;
        }
        @media(max-width: 768px) {
          .footer-grid-3d { grid-template-columns: 1fr; gap: 32px; }
        }
        .footer-col-3d h4 { font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--sub); margin-bottom: 16px; }
        .footer-col-3d a { display: block; font-size: 14px; color: var(--sub); text-decoration: none; margin-bottom: 10px; transition: color 0.2s; }
        .footer-col-3d a:hover { color: var(--text); }
      `}</style>

      {/* ══════════ NAV ══════════ */}
      <nav className="hp-nav">
        <a href="#top" className="hp-nav-logo" onClick={e => { e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'}); }}>HUSHPOD</a>
        <div className="hp-nav-links">
          {[['#how','How It Works'],['#features','Features'],['#usecases','Use Cases'],['#tech','Tech'],['#faq','FAQ']].map(([href,label]) => (
            <a key={href} href={href} onClick={e => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({behavior:'smooth'}); }}>{label}</a>
          ))}
        </div>
        <button className="hp-nav-cta" onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>Start Free →</button>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section className="hero-3d">
        <HeroCanvas />

        {/* Scanline effect */}
        <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)', pointerEvents:'none', zIndex:1 }} />

        <div className="hero-content">
          <div style={parallax(-0.05)}>
            <Reveal>
              <div className="hero-eyebrow-3d">
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#f72585', animation:'pulseGlow 2s infinite' }} />
                Live · Synchronized · Private
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h1 className="hero-title-3d">HEAR<br/>TOGETHER</h1>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="hero-sub-3d">
                Real-time synchronized audio for groups.<br/>
                <strong style={{ color:'#fff' }}>No app. No account. No lag.</strong> Just open, create a room, and everyone hears the same song at the exact same millisecond.
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="hero-btns-3d">
                <button className="btn-3d-primary" onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>🎉 Create a Room Free</button>
                <button className="btn-3d-ghost" onClick={() => document.getElementById('how')?.scrollIntoView({behavior:'smooth'})}>See How It Works</button>
              </div>
            </Reveal>
          </div>

          {/* Live stats */}
          <div className="stats-3d">
            <StatCounter value={stats.rooms}     unit=""      label="Active Rooms"    color="#f72585" delay={0.4} />
            <StatCounter value={stats.listeners} unit=""      label="Live Listeners"  color="#4cc9f0" delay={0.5} />
            <StatCounter value="100"             unit="ms"    label="Sync Precision"  color="#06d6a0" delay={0.6} />
            <StatCounter value="0"               unit="MB"    label="Data Stored"     color="#ffd60a" delay={0.7} />
          </div>

          {/* Floating device tags */}
          <div style={{ position:'relative', height:'120px', maxWidth:'700px', margin:'40px auto 0', display:'none' }} className="devices-demo">
            <FloatingDevice name="Arjun" device="iPhone 15"   color="247,37,133"  delay={0.8} x="5%"  y="20px" />
            <FloatingDevice name="Priya" device="Galaxy S24"  color="76,201,240"  delay={0.9} x="30%" y="60px" />
            <FloatingDevice name="Meera" device="Pixel 8"     color="6,214,160"   delay={1.0} x="55%" y="10px" />
            <FloatingDevice name="Ravi"  device="OnePlus 12"  color="255,214,10"  delay={1.1} x="78%" y="50px" />
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position:'absolute', bottom:'32px', left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', opacity:0.5 }}>
          <span style={{ fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', color:'var(--sub)' }}>Scroll</span>
          <div style={{ width:'1px', height:'40px', background:'linear-gradient(to bottom, var(--sub), transparent)' }} />
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how" className="section-3d" style={{ background:'linear-gradient(180deg, #06060f, #0d0d20 50%, #06060f)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <Reveal>
            <div className="section-label-3d">⚡ Three Steps</div>
            <h2 className="section-title-3d">Zero friction.<br/>Instant sync.</h2>
            <p className="section-sub-3d">No downloads. No sign-up. Works in any browser on any phone.</p>
          </Reveal>

          <div className="steps-3d">
            {[
              { icon:'🎙️', n:'01', t:'Create a Room', d:'Enter your name, tap "Create Party Room". Get a unique 5-char room code. Upload up to 10 songs — MP3, WAV, FLAC, AAC supported.', color:'#f72585' },
              { icon:'📲', n:'02', t:'Share the Code', d:'Send your room code or QR to friends. They open HushPod in any browser, type the code, and they\'re in — no installation required.', color:'#4cc9f0' },
              { icon:'🎧', n:'03', t:'Listen Together', d:'Everyone hears the same audio at the same millisecond. Host controls play, pause, queue. Guests suggest songs via chat.', color:'#06d6a0' },
              { icon:'🔄', n:'04', t:'Pass the Aux', d:'Guests can request host privileges. Pass control with one tap. If host leaves, next listener auto-promotes — party never stops.', color:'#ffd60a' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <TiltCard className="step-3d" style={{ borderColor: `rgba(255,255,255,0.07)` }}>
                  <div className="step-num-3d">{s.n}</div>
                  <div className="step-icon-3d">{s.icon}</div>
                  <div className="step-title-3d" style={{ color: s.color }}>{s.t}</div>
                  <div className="step-desc-3d">{s.d}</div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" className="section-3d">
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <Reveal style={{ textAlign:'center' }}>
            <div className="section-label-3d">✨ Everything Included</div>
            <h2 className="section-title-3d">Built for real<br/>group experiences</h2>
            <p className="section-sub-3d" style={{ margin:'0 auto', textAlign:'center' }}>Every feature engineered for low latency and high reliability.</p>
          </Reveal>

          <div className="features-3d">
            {[
              { icon:'🔴', t:'Dead Reckoning Sync',    d:'Between heartbeats, guests mathematically calculate the host\'s exact position — eliminating drift accumulation.', live:true },
              { icon:'⚡', t:'Seeked Recalculation',   d:'After every seek, we recalculate position — eliminating 100–200ms mobile seek latency from the sync equation.', live:true },
              { icon:'🗓️', t:'Scheduled Playback',    d:'All devices receive a future timestamp to begin playback simultaneously — true atomic sync from the first beat.', live:true },
              { icon:'📦', t:'Batch Upload (10 Songs)',d:'Upload your entire setlist at once. Auto-advance plays next seamlessly. Drag and drop supported on desktop.', live:true },
              { icon:'💬', t:'Emoji Reactions + Chat', d:'Built-in chat with floating emoji reactions. Real-time messages delivered to everyone via WebSocket instantly.', live:true },
              { icon:'🔗', t:'QR Code Sharing',        d:'One tap generates a QR for your room. Anyone can scan to join instantly. URL auto-fills the room code on landing.', live:true },
              { icon:'🌙', t:'Screen-off Resilience',  d:'Wake Lock API keeps your screen active. If it turns off, reconnection re-syncs audio to exact position in ms.', live:true },
              { icon:'🎧', t:'BT Auto-Sync',           d:'Bluetooth headphones and speakers are auto-detected. Latency is measured and applied. Mid-session swaps handled.', live:true },
              { icon:'🔒', t:'Zero Data Retention',    d:'Audio lives in server RAM only. When the room ends, everything deleted. No logs. No storage. No accounts.', live:true },
              { icon:'🔔', t:'Lock Screen Controls',   d:'Full Media Session API — play, pause, skip from your lock screen or notification shade. Custom artwork per room.', live:true },
              { icon:'🌐', t:'Works Anywhere',         d:'Same WiFi, different cities, across the world. HushPod works wherever internet reaches. Variance handled auto.', live:true },
              { icon:'♾️', t:'Unlimited Listeners',    d:'Free tier: 15 listeners. Premium coming soon with unlimited participants, rooms, and lossless quality.', live:false },
            ].map((f, i) => (
              <Reveal key={f.t} delay={(i % 4) * 0.08}>
                <TiltCard className="feat-3d" strength={6}>
                  <div className="feat-icon-3d">{f.icon}</div>
                  <div className="feat-title-3d">{f.t}</div>
                  <div className="feat-desc-3d">{f.d}</div>
                  <span className={`feat-badge-3d ${f.live ? 'badge-live' : 'badge-soon'}`}>{f.live ? 'Live' : 'Coming Soon'}</span>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ USE CASES ══════════ */}
      <section id="usecases" className="section-3d" style={{ background:'linear-gradient(180deg,#06060f,#0d0d20 50%,#06060f)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <Reveal style={{ textAlign:'center' }}>
            <div className="section-label-3d">🌍 Use Cases</div>
            <h2 className="section-title-3d">Made for every<br/>shared moment</h2>
            <p className="section-sub-3d" style={{ margin:'0 auto', textAlign:'center' }}>From silent discos to study halls — HushPod makes group audio effortless.</p>
          </Reveal>

          <div className="cases-3d">
            {[
              { e:'🎉', t:'Silent Disco Parties',   d:'Replace expensive FM transmitters. Everyone dances to the same beat through their own earphones. No hardware, no frequency clashes.', g:'linear-gradient(135deg, rgba(247,37,133,0.15), rgba(123,47,247,0.15))', b:'rgba(247,37,133,0.25)' },
              { e:'📚', t:'Synchronized Study',     d:'Study with your friend group. Everyone hears the same lo-fi playlist at the same moment — shared focus atmosphere across locations.', g:'linear-gradient(135deg, rgba(76,201,240,0.15), rgba(0,180,216,0.15))', b:'rgba(76,201,240,0.25)' },
              { e:'🚗', t:'Road Trips',             d:'Different cars, same song, same millisecond. The convoy moves to one beat. Host controls the vibe for the whole group.', g:'linear-gradient(135deg, rgba(6,214,160,0.15), rgba(0,168,107,0.15))', b:'rgba(6,214,160,0.25)' },
              { e:'🏋️', t:'Gym Classes',           d:'Sync workout music to every participant simultaneously. No expensive sound system — just HushPod and everyone\'s earphones.', g:'linear-gradient(135deg, rgba(255,214,10,0.15), rgba(247,127,0,0.15))', b:'rgba(255,214,10,0.25)' },
              { e:'🎬', t:'Remote Watch Parties',   d:'Sync background music for remote events. Everyone feels like they\'re in the same room even when apart.', g:'linear-gradient(135deg, rgba(247,37,133,0.12), rgba(76,201,240,0.12))', b:'rgba(247,37,133,0.2)' },
              { e:'🏛️', t:'Audio Tours',           d:'Museums and galleries sync audio guides to every visitor simultaneously. The guide controls the pace. Everyone hears the same thing.', g:'linear-gradient(135deg, rgba(123,47,247,0.15), rgba(76,201,240,0.15))', b:'rgba(123,47,247,0.25)' },
            ].map((c, i) => (
              <Reveal key={c.t} delay={(i % 3) * 0.1}>
                <TiltCard
                  className="case-3d"
                  style={{ background: c.g, border: `1px solid ${c.b}` }}
                >
                  <div style={{ fontSize:'40px', marginBottom:'16px' }}>{c.e}</div>
                  <div style={{ fontSize:'17px', fontWeight:'800', marginBottom:'10px' }}>{c.t}</div>
                  <div style={{ fontSize:'14px', color:'var(--sub)', lineHeight:'1.65' }}>{c.d}</div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TECH STATS ══════════ */}
      <section id="tech" className="section-3d">
        <div style={{ maxWidth:'1100px', margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'80px', alignItems:'center' }}>
          <Reveal>
            <div className="section-label-3d">🔬 Under the Hood</div>
            <h2 className="section-title-3d">Engineered for<br/>precision</h2>
            <p className="section-sub-3d" style={{ marginBottom:'40px' }}>Every millisecond matters. Our sync engine is built from first principles.</p>
            {[
              { icon:'⏱️', t:'Server-stamped timestamps', d:'Every event stamped with server Date.now() — all guests reference the same clock, eliminating per-device offset errors.' },
              { icon:'📐', t:'Seeked-event recalculation', d:'After seeking, we wait for the browser\'s seeked confirmation then recalculate — absorbing 100–200ms mobile seek latency.' },
              { icon:'🧭', t:'Dead reckoning sync', d:'Between heartbeats, the sync loop calculates the host\'s exact position mathematically — drift never accumulates.' },
              { icon:'🔇', t:'Glitch-free correction', d:'Small drifts never corrected mid-play. Only catastrophic drift triggers a seek. Smooth audio always wins.' },
            ].map((item, i) => (
              <Reveal key={item.t} delay={i * 0.1}>
                <div style={{ display:'flex', gap:'16px', marginBottom:'24px', padding:'16px', borderRadius:'14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:'24px', flexShrink:0 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight:'800', marginBottom:'4px', fontSize:'14px' }}>{item.t}</div>
                    <div style={{ fontSize:'13px', color:'var(--sub)', lineHeight:'1.6' }}>{item.d}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </Reveal>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            <StatCounter value="100" unit="ms"    label="Sync Precision"     color="#f72585" delay={0.1} />
            <StatCounter value="500" unit="ms"    label="Heartbeat Interval" color="#4cc9f0" delay={0.2} />
            <StatCounter value="150" unit="MB"    label="Max File Size"      color="#06d6a0" delay={0.3} />
            <StatCounter value="10"  unit=""      label="Songs Per Batch"    color="#ffd60a" delay={0.4} />
            <StatCounter value="8"   unit="x"     label="Clock Sync Samples" color="#7b2ff7" delay={0.5} />
            <StatCounter value="0"   unit="MB"    label="Data Retained"      color="#f72585" delay={0.6} />
          </div>
        </div>

        <style>{`@media(max-width:768px){#tech .inner-grid{grid-template-columns:1fr!important;}}`}</style>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" className="section-3d" style={{ background:'linear-gradient(180deg,#06060f,#0d0d20 50%,#06060f)' }}>
        <div style={{ maxWidth:'760px', margin:'0 auto', textAlign:'center' }}>
          <Reveal>
            <div className="section-label-3d">❓ FAQ</div>
            <h2 className="section-title-3d">Common questions</h2>
          </Reveal>
        </div>

        <div className="faq-3d">
          {[
            { q:'Do guests need to download an app?',         a:'No. HushPod works entirely in the browser. Guests open the link, enter the room code, and they\'re synced instantly. No installation, no account.' },
            { q:'Does everyone need the same WiFi?',          a:'No. HushPod works over the internet — different networks, mobile data, different cities, countries. The sync engine handles network variance automatically.' },
            { q:'What audio formats are supported?',          a:'MP3, WAV, FLAC, AAC and most common audio formats. Files up to 150MB each. Upload up to 10 songs at a time.' },
            { q:'Is my music stored on HushPod servers?',     a:'Never permanently. Audio is held in server RAM only during your active session. When your room ends, everything is deleted immediately.' },
            { q:'Can I use copyrighted music?',               a:'You are responsible for any content you upload. By accepting our Terms of Service, you confirm you own or have rights to any audio you share.' },
            { q:'What happens if the host leaves?',           a:'The longest-connected listener auto-promotes to host. Hosts get a 30-second grace period to reconnect and reclaim their crown.' },
            { q:'How many people can join a room?',           a:'Free rooms support 15 simultaneous listeners. Premium plans with unlimited listeners are coming soon.' },
          ].map((f, i) => (
            <Reveal key={i} delay={i * 0.04}>
              <div className="faq-item-3d" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="faq-q-3d">
                  <span>{f.q}</span>
                  <span className={`faq-arrow-3d ${openFaq === i ? 'open' : ''}`}>▾</span>
                </div>
                <div className={`faq-a-3d ${openFaq === i ? 'open' : ''}`}>{f.a}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="cta-3d">
        <div className="cta-glow-3d" />
        <Reveal style={{ position:'relative', zIndex:1 }}>
          <div className="section-label-3d" style={{ justifyContent:'center', display:'flex' }}>🎧 Start Free Today</div>
          <div className="cta-title-3d">LISTEN<br/>TOGETHER<br/>NOW</div>
          <p style={{ fontSize:'18px', color:'var(--sub)', marginBottom:'40px', lineHeight:'1.7' }}>
            Create your first room in under 10 seconds.<br/>No sign-up. No credit card. Just music, perfectly in sync.
          </p>
          <button className="btn-3d-primary" style={{ fontSize:'18px', padding:'18px 52px' }} onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>
            🎉 Create a Free Room
          </button>
        </Reveal>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'60px 24px 40px' }}>
        <div className="footer-3d">
          <div className="footer-grid-3d">
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'32px', letterSpacing:'3px', background:'linear-gradient(135deg,#f72585,#4cc9f0)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'14px' }}>HUSHPOD</div>
              <p style={{ fontSize:'14px', color:'var(--sub)', lineHeight:'1.7', maxWidth:'300px' }}>Synchronized private group audio. Listen together in perfect sync — no app, no account, no lag.</p>
              <p style={{ marginTop:'14px', fontSize:'12px', color:'var(--sub)' }}>Built by <span style={{ color:'#bb86fc', fontWeight:'700' }}>Zentry Hub Pvt Ltd</span></p>
            </div>
            <div className="footer-col-3d">
              <h4>Product</h4>
              <a href="#app" onClick={e => { e.preventDefault(); setView('app-entry'); window.scrollTo(0,0); }}>Launch App</a>
              <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({behavior:'smooth'}); }}>Features</a>
              <a href="#how" onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({behavior:'smooth'}); }}>How It Works</a>
              <a href="#tech" onClick={e => { e.preventDefault(); document.getElementById('tech')?.scrollIntoView({behavior:'smooth'}); }}>Technology</a>
            </div>
            <div className="footer-col-3d">
              <h4>Company</h4>
              <a href="#faq" onClick={e => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({behavior:'smooth'}); }}>FAQ</a>
              <a href="#terms">Terms of Service</a>
              <a href="mailto:contact@hushpod.app">Contact Us</a>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px', paddingTop:'24px', borderTop:'1px solid rgba(255,255,255,0.05)', fontSize:'12px', color:'var(--sub)' }}>
            <span>© 2026 HushPod · Built with ♥ in India</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace" }}>v2.0.0 · Node.js + Socket.io · Zero data retention</span>
          </div>
        </div>
      </footer>

    </div>
  );
}