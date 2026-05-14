import React, { useEffect, useRef } from 'react';

export default function NeonLoader({ text = 'Syncing Audio...' }) {
  const ringRef = useRef(null);

  useEffect(() => {
    const el = ringRef.current; if (!el) return;
    let angle = 0, raf;
    const spin = () => {
      raf = requestAnimationFrame(spin);
      angle += 2.5;
      el.style.transform = `rotate(${angle}deg)`;
    };
    spin();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#050510',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '32px',
    }}>
      <style>{`
        @keyframes eqPulse {
          0%,40%,100% { transform: scaleY(.3); opacity:.4; }
          20%          { transform: scaleY(1); opacity:1; }
        }
        @keyframes loaderGlow {
          0%,100% { box-shadow: 0 0 30px rgba(247,37,133,.4); }
          50%      { box-shadow: 0 0 60px rgba(76,201,240,.6); }
        }
        @keyframes textBlink {
          0%,100% { opacity: 1; }
          50%      { opacity: .4; }
        }
        @keyframes orbDrift {
          0%,100% { transform: translate(0,0); }
          33%      { transform: translate(20px,-15px); }
          66%      { transform: translate(-15px,20px); }
        }
      `}</style>

      {/* Background glow orbs */}
      <div style={{ position:'absolute', top:'30%', left:'30%', width:'400px', height:'400px', background:'radial-gradient(circle,rgba(247,37,133,.08),transparent 65%)', pointerEvents:'none', animation:'orbDrift 8s ease-in-out infinite' }} />
      <div style={{ position:'absolute', bottom:'25%', right:'25%', width:'300px', height:'300px', background:'radial-gradient(circle,rgba(76,201,240,.07),transparent 65%)', pointerEvents:'none', animation:'orbDrift 11s ease-in-out infinite reverse' }} />

      {/* Main spinner ring */}
      <div style={{ position:'relative', width:'100px', height:'100px', animation:'loaderGlow 2s ease-in-out infinite' }}>
        {/* Outer decorative ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1px solid rgba(247,37,133,.15)',
        }} />
        {/* Spinning gradient arc */}
        <div ref={ringRef} style={{
          position: 'absolute', inset: '6px', borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #f72585, #7b2ff7, #4cc9f0, transparent 75%)',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), white calc(100% - 3px))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), white calc(100% - 3px))',
        }} />
        {/* Inner logo */}
        <div style={{
          position: 'absolute', inset: '18px', borderRadius: '50%',
          background: 'linear-gradient(135deg,rgba(247,37,133,.2),rgba(76,201,240,.2))',
          border: '1px solid rgba(255,255,255,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px',
        }}>
          🎧
        </div>
      </div>

      {/* EQ bars */}
      <div style={{ display:'flex', alignItems:'center', gap:'5px', height:'40px' }}>
        {[
          { h:28, delay:'-1.2s', color:'#f72585' },
          { h:40, delay:'-1.0s', color:'#f72585' },
          { h:36, delay:'-0.8s', color:'#4cc9f0' },
          { h:48, delay:'-0.6s', color:'#4cc9f0' },
          { h:36, delay:'-0.4s', color:'#06d6a0' },
          { h:40, delay:'-0.2s', color:'#06d6a0' },
          { h:28, delay:'0.0s',  color:'#7b2ff7' },
        ].map((bar, i) => (
          <div key={i} style={{
            width: '5px', height: `${bar.h}px`,
            borderRadius: '3px', background: bar.color,
            animation: `eqPulse 1.2s ${bar.delay} ease-in-out infinite`,
            boxShadow: `0 0 10px ${bar.color}88`,
          }} />
        ))}
      </div>

      {/* Text */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '16px', letterSpacing: '5px', textTransform: 'uppercase',
          background: 'linear-gradient(135deg,#f72585,#4cc9f0)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          animation: 'textBlink 2s ease-in-out infinite',
        }}>
          {text}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px', color: '#333355', letterSpacing: '2px',
        }}>
          HUSHPOD
        </div>
      </div>

      {/* Bottom progress bar */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'2px', background:'transparent' }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg,#f72585,#7b2ff7,#4cc9f0)',
          animation: 'shimmerBar 1.8s ease-in-out infinite',
          backgroundSize: '200% 100%',
        }} />
        <style>{`@keyframes shimmerBar{0%{background-position:200% 0;width:0}50%{background-position:0 0;width:100%}100%{background-position:-200% 0;width:0}}`}</style>
      </div>
    </div>
  );
}