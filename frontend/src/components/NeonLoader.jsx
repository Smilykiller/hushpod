import React, { useEffect, useRef } from 'react';

/*
 * HUSHPOD — Ultra 3D Music Loader
 * 
 * Visual layers (CSS only, no Three.js — instant render, zero JS parse cost):
 *   1. Vinyl record — spinning 3D disc with grooves, CSS perspective
 *   2. Sound bars — 9 EQ bars rising from the record
 *   3. Floating musical notes — orbit around the disc
 *   4. Ripple rings — expand outward from centre
 *   5. Particle field — 20 glowing dots
 *   6. Gradient text — animated gradient Bebas Neue label
 */
export default function NeonLoader({ text = 'Syncing Audio...' }) {
  const canvasRef = useRef(null);

  // Particle canvas — lightweight canvas for bg dots
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    let W, H, raf;
    const pts = Array.from({ length: 28 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * .0004,
      vy: (Math.random() - .5) * .0004,
      r: Math.random() * 1.8 + .4,
      col: ['#f72585','#4cc9f0','#7b2ff7','#06d6a0'][Math.floor(Math.random()*4)],
      a: Math.random() * .5 + .2,
    }));
    const resize = () => { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.col;
        ctx.globalAlpha = p.a;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#050510',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@700&display=swap');

        /* ── Scroll progress shimmer ── */
        @keyframes shimmerBar {
          0%   { left: -100%; width: 40%; }
          50%  { left: 60%;   width: 40%; }
          100% { left: 150%;  width: 40%; }
        }

        /* ── Vinyl spin ── */
        @keyframes vinylSpin {
          to { transform: rotateX(68deg) rotateZ(360deg); }
        }

        /* ── Groove pulse ── */
        @keyframes groovePulse {
          0%,100% { opacity:.15; } 50% { opacity:.35; }
        }

        /* ── EQ bars ── */
        @keyframes eq1 { 0%,100%{height:8px}  50%{height:52px} }
        @keyframes eq2 { 0%,100%{height:18px} 50%{height:64px} }
        @keyframes eq3 { 0%,100%{height:12px} 50%{height:80px} }
        @keyframes eq4 { 0%,100%{height:24px} 50%{height:56px} }
        @keyframes eq5 { 0%,100%{height:6px}  50%{height:72px} }
        @keyframes eq6 { 0%,100%{height:20px} 50%{height:60px} }
        @keyframes eq7 { 0%,100%{height:14px} 50%{height:48px} }
        @keyframes eq8 { 0%,100%{height:10px} 50%{height:68px} }
        @keyframes eq9 { 0%,100%{height:16px} 50%{height:44px} }

        /* ── Ripple rings ── */
        @keyframes rippleOut {
          0%   { transform:rotateX(68deg) scale(.2); opacity:.9; }
          100% { transform:rotateX(68deg) scale(2.8); opacity:0; }
        }

        /* ── Floating notes ── */
        @keyframes noteOrbit0 { 0%{transform:rotate(0deg)   translateX(90px) rotate(0deg)}   100%{transform:rotate(360deg)  translateX(90px)  rotate(-360deg)} }
        @keyframes noteOrbit1 { 0%{transform:rotate(72deg)  translateX(90px) rotate(-72deg)} 100%{transform:rotate(432deg)  translateX(90px)  rotate(-432deg)} }
        @keyframes noteOrbit2 { 0%{transform:rotate(144deg) translateX(90px) rotate(-144deg)}100%{transform:rotate(504deg)  translateX(90px)  rotate(-504deg)} }
        @keyframes noteOrbit3 { 0%{transform:rotate(216deg) translateX(90px) rotate(-216deg)}100%{transform:rotate(576deg)  translateX(90px)  rotate(-576deg)} }
        @keyframes noteOrbit4 { 0%{transform:rotate(288deg) translateX(90px) rotate(-288deg)}100%{transform:rotate(648deg)  translateX(90px)  rotate(-648deg)} }

        /* ── Text gradient shift ── */
        @keyframes gradShift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }

        /* ── Loader label blink ── */
        @keyframes labelBlink {
          0%,100% { opacity:1; } 50% { opacity:.4; }
        }

        /* ── Centre glow pulse ── */
        @keyframes centreGlow {
          0%,100% { box-shadow:0 0 0 0 rgba(247,37,133,.4), 0 0 40px rgba(247,37,133,.2); }
          50%      { box-shadow:0 0 0 14px rgba(247,37,133,0), 0 0 80px rgba(247,37,133,.5); }
        }
      `}</style>

      {/* Particle canvas background */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .7,
      }}/>

      {/* Deep glow behind everything */}
      <div style={{
        position: 'absolute', top:'50%', left:'50%',
        transform: 'translate(-50%,-50%)',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(247,37,133,.14) 0%, rgba(76,201,240,.06) 50%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      {/* ── SCENE WRAPPER ─ perspective container ── */}
      <div style={{ position: 'relative', width: '220px', height: '220px', marginBottom: '48px' }}>

        {/* ── RIPPLE RINGS ── */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '160px', height: '160px',
            marginLeft: '-80px', marginTop: '-80px',
            border: '1px solid rgba(247,37,133,.5)',
            borderRadius: '50%',
            animation: `rippleOut 2.4s ease-out ${i * .8}s infinite`,
            transformOrigin: 'center center',
          }}/>
        ))}

        {/* ── VINYL DISC ── */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '160px', height: '160px',
          marginLeft: '-80px', marginTop: '-80px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 50% 50%,
              #1a1a2e 0%, #1a1a2e 12%,
              #f72585 13%, #f72585 14%,
              #111128 15%, #111128 30%,
              #0d0d1f 31%, #0d0d1f 32%,
              #111128 33%, #111128 48%,
              #0d0d1f 49%, #0d0d1f 50%,
              #111128 51%, #111128 66%,
              #0d0d1f 67%, #0d0d1f 68%,
              #111128 69%, #111128 84%,
              #0d0d1f 85%, #0d0d1f 86%,
              #111128 87%, #111128 100%
            )
          `,
          boxShadow: `
            0 0 0 2px rgba(247,37,133,.6),
            0 0 40px rgba(247,37,133,.25),
            inset 0 0 30px rgba(0,0,0,.8)
          `,
          animation: 'vinylSpin 2.2s linear infinite',
          transformOrigin: 'center center',
          transformStyle: 'preserve-3d',
        }}>
          {/* Groove shimmer overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(76,201,240,.08) 10%, transparent 20%, rgba(247,37,133,.06) 35%, transparent 45%, rgba(76,201,240,.08) 60%, transparent 70%, rgba(247,37,133,.06) 85%, transparent 100%)',
            animation: 'groovePulse 2s ease-in-out infinite',
          }}/>
          {/* Centre label */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '38px', height: '38px',
            marginLeft: '-19px', marginTop: '-19px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#f72585,#7b2ff7,#4cc9f0)',
            animation: 'centreGlow 1.8s ease-in-out infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px',
          }}>🎵</div>
        </div>

        {/* ── FLOATING MUSICAL NOTES ── */}
        {['♪','♫','♩','♬','♭'].map((note, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '0', height: '0',
            animation: `noteOrbit${i} ${3 + i * .4}s linear infinite`,
          }}>
            <span style={{
              fontSize: '18px',
              color: ['#f72585','#4cc9f0','#06d6a0','#ffd60a','#7b2ff7'][i],
              textShadow: `0 0 12px ${'#f72585,#4cc9f0,#06d6a0,#ffd60a,#7b2ff7'.split(',')[i]}`,
              userSelect: 'none',
              display: 'block',
              lineHeight: 1,
            }}>{note}</span>
          </div>
        ))}

        {/* ── EQ BARS (rise up from record plane) ── */}
        <div style={{
          position: 'absolute',
          bottom: '-20px', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'flex-end', gap: '5px',
          height: '90px',
        }}>
          {[
            { anim:'eq1', delay:'0s',    color:'#f72585' },
            { anim:'eq2', delay:'.12s',  color:'#f72585' },
            { anim:'eq3', delay:'.24s',  color:'#7b2ff7' },
            { anim:'eq4', delay:'.36s',  color:'#7b2ff7' },
            { anim:'eq5', delay:'.48s',  color:'#4cc9f0' },
            { anim:'eq6', delay:'.36s',  color:'#4cc9f0' },
            { anim:'eq7', delay:'.24s',  color:'#06d6a0' },
            { anim:'eq8', delay:'.12s',  color:'#06d6a0' },
            { anim:'eq9', delay:'0s',    color:'#f72585' },
          ].map((b, i) => (
            <div key={i} style={{
              width: '5px',
              height: '8px',
              borderRadius: '3px 3px 0 0',
              background: b.color,
              boxShadow: `0 0 8px ${b.color}cc`,
              animation: `${b.anim} 1.1s ease-in-out ${b.delay} infinite`,
              alignSelf: 'flex-end',
            }}/>
          ))}
        </div>

      </div>
      {/* END scene wrapper */}

      {/* ── TEXT BLOCK ── */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>

        {/* HUSHPOD wordmark */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '42px',
          letterSpacing: '8px',
          background: 'linear-gradient(90deg,#f72585,#7b2ff7,#4cc9f0,#06d6a0,#f72585)',
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'gradShift 3s ease-in-out infinite',
          marginBottom: '10px',
          lineHeight: 1,
        }}>
          HUSHPOD
        </div>

        {/* Dynamic label */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: '#4cc9f0',
          animation: 'labelBlink 1.8s ease-in-out infinite',
          marginBottom: '24px',
        }}>
          {text}
        </div>

        {/* Progress shimmer bar */}
        <div style={{
          width: '180px', height: '2px',
          background: 'rgba(255,255,255,.07)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative',
          margin: '0 auto',
        }}>
          <div style={{
            position: 'absolute', top: 0, height: '100%',
            background: 'linear-gradient(90deg,transparent,#f72585,#4cc9f0,transparent)',
            borderRadius: '2px',
            animation: 'shimmerBar 1.6s ease-in-out infinite',
          }}/>
        </div>
      </div>

      {/* Top edge progress bar (page-level) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          background: 'linear-gradient(90deg,#f72585,#7b2ff7,#4cc9f0)',
          animation: 'shimmerBar 2s ease-in-out infinite',
        }}/>
      </div>

    </div>
  );
}