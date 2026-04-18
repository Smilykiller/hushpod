import React, { useEffect, useRef } from 'react';

export default function OrbitVisualizer({ engine }) {
  const orbitRafRef = useRef(null);

  useEffect(() => {
    const runOrbitUI = () => {
      orbitRafRef.current = requestAnimationFrame(runOrbitUI);
      const cvs = document.getElementById('orbit-canvas');
      if (!cvs) return; 
      
      const ctx = cvs.getContext('2d');
      const W = cvs.width = cvs.offsetWidth; const H = cvs.height = cvs.offsetHeight;
      const cx = W / 2, cy = H / 2; const radius = Math.min(W, H) * 0.35;
      
      const total = engine.members.length || 1;
      const speedMs = Math.max(3000, Math.min(10000, 2000 * total)); 
      const globalTime = Date.now() + (engine.stateRef.current?.clockOff || 0);
      const radarAngle = ((globalTime % speedMs) / speedMs) * Math.PI * 2;

      ctx.fillStyle = 'rgba(10, 10, 20, 0.4)'; ctx.fillRect(0, 0, W, H);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(76,201,240,0.15)'; ctx.stroke();

      if (engine.orbitActive) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(radarAngle); ctx.beginPath(); 
        ctx.moveTo(0,0); ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 0.3); ctx.lineTo(0,0);
        const grad = ctx.createRadialGradient(0,0,0, 0,0,radius * 1.3);
        grad.addColorStop(0, 'rgba(247,37,133,0.6)'); grad.addColorStop(1, 'rgba(247,37,133,0)');
        ctx.fillStyle = grad; ctx.fill(); ctx.restore();
      }

      engine.members.forEach((m, i) => {
        const a = (i / total) * Math.PI * 2;
        const x = cx + Math.cos(a) * radius; const y = cy + Math.sin(a) * radius;
        
        let diff = Math.abs(radarAngle - a);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const isHit = engine.orbitActive && diff < 0.6;
        
        ctx.beginPath(); ctx.arc(x, y, isHit ? 14 : 8, 0, Math.PI * 2);
        ctx.fillStyle = m.id === engine.socketRef.current?.id ? '#4cc9f0' : (m.isHost ? '#f72585' : '#7777aa');
        if (isHit) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20; }
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = isHit ? '#fff' : 'var(--sub)'; ctx.font = '11px JetBrains Mono'; ctx.textAlign = 'center';
        ctx.fillText(m.id === engine.socketRef.current?.id ? 'YOU' : m.name, x, y + 25);
      });
    };
    runOrbitUI();
    return () => { if (orbitRafRef.current) cancelAnimationFrame(orbitRafRef.current); };
  }, [engine.members, engine.orbitActive]);

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{width: '100%', height: '200px', background: '#05050a', position: 'relative'}}>
        <canvas id="orbit-canvas" style={{width: '100%', height: '100%', display: 'block'}}></canvas>
        <div style={{position: 'absolute', top: '10px', right: '10px', zIndex: 10}}>
           {engine.amHost ? (
              <button 
                style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', background: engine.orbitActive ? 'var(--pink)' : 'rgba(0,0,0,0.8)', color: engine.orbitActive ? '#fff' : 'var(--sub)', boxShadow: engine.orbitActive ? '0 0 15px rgba(247,37,133,0.5)' : 'none' }} 
                onClick={() => engine.socketRef.current.emit('set-orbit', {active: !engine.orbitActive})}
              >
                {engine.orbitActive ? 'Orbit: 3D LIVE' : 'Orbit: OFF'}
              </button>
           ) : (
              <div style={{ fontSize: '10px', padding: '6px 10px', background: 'rgba(0,0,0,0.8)', borderRadius: '6px', color: engine.orbitActive ? 'var(--pink)' : 'var(--sub)', fontWeight: 'bold' }}>
                {engine.orbitActive ? 'Orbit: 3D LIVE' : 'Orbit: OFF'}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}