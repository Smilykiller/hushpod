import React, { useEffect, useRef } from 'react';

export default function OrbitRadar({
  outLat,
  runSonarCalibration,
  amHost,
  orbitActive,
  onToggleOrbit,
  members,
  currentUserId,
  clockOff
}) {
  const orbitRafRef = useRef(null);

  // --- ORBIT UI DRAWING ENGINE ---
  useEffect(() => {
    const runOrbitUI = () => {
      orbitRafRef.current = requestAnimationFrame(runOrbitUI);
      const cvs = document.getElementById('orbit-canvas');
      if (!cvs) return; 
      
      const ctx = cvs.getContext('2d');
      const W = cvs.width = cvs.offsetWidth; 
      const H = cvs.height = cvs.offsetHeight;
      const cx = W / 2, cy = H / 2; 
      const radius = Math.min(W, H) * 0.35;
      
      // Dynamic Global Time Radar
      const total = members.length || 1;
      const speedMs = Math.max(3000, Math.min(10000, 2000 * total)); 
      const globalTime = Date.now() + clockOff;
      const radarAngle = ((globalTime % speedMs) / speedMs) * Math.PI * 2;

      ctx.fillStyle = 'rgba(10, 10, 20, 0.4)'; 
      ctx.fillRect(0, 0, W, H);
      
      ctx.beginPath(); 
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(76,201,240,0.15)'; 
      ctx.lineWidth = 1; 
      ctx.stroke();

      if (orbitActive) {
        ctx.save(); 
        ctx.translate(cx, cy); 
        ctx.rotate(radarAngle);
        ctx.beginPath(); 
        ctx.moveTo(0,0); 
        ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 0.3);
        ctx.lineTo(0,0);
        const grad = ctx.createRadialGradient(0,0,0, 0,0,radius * 1.3);
        grad.addColorStop(0, 'rgba(247,37,133,0.6)'); 
        grad.addColorStop(1, 'rgba(247,37,133,0)');
        ctx.fillStyle = grad; 
        ctx.fill(); 
        ctx.restore();
      }

      members.forEach((m, i) => {
        const a = (i / total) * Math.PI * 2;
        const x = cx + Math.cos(a) * radius; 
        const y = cy + Math.sin(a) * radius;
        
        let diff = Math.abs(radarAngle - a);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const isHit = orbitActive && diff < 0.6;
        
        ctx.beginPath(); 
        ctx.arc(x, y, isHit ? 14 : 8, 0, Math.PI * 2);
        ctx.fillStyle = m.id === currentUserId ? '#4cc9f0' : (m.isHost ? '#f72585' : '#7777aa');
        
        if (isHit) { 
          ctx.shadowColor = ctx.fillStyle; 
          ctx.shadowBlur = 20; 
        }
        ctx.fill(); 
        ctx.shadowBlur = 0;

        ctx.fillStyle = isHit ? '#fff' : 'var(--sub)'; 
        ctx.font = '11px JetBrains Mono'; 
        ctx.textAlign = 'center';
        ctx.fillText(m.id === currentUserId ? 'YOU' : m.name, x, y + 25);
      });
    };
    
    // Start the animation loop
    runOrbitUI();
    
    // Cleanup on unmount or re-render
    return () => {
      if (orbitRafRef.current) cancelAnimationFrame(orbitRafRef.current);
    };
  }, [members, currentUserId, clockOff, orbitActive]);

  return (
    <div className="card" style={{padding: '10px'}}>
      <div style={{marginBottom: '15px', padding: '5px 10px'}}>
        <div style={{fontSize: '18px', fontWeight: '800', color: 'var(--pink)', letterSpacing: '-0.5px'}}>HushPod Labs</div>
        <div style={{fontSize: '12px', color: 'var(--sub)', marginTop: '2px'}}>Phase 1: Acoustic Hardware Calibration</div>
      </div>

      <div style={{background: 'var(--s2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '15px', textAlign: 'center'}}>
        <div style={{fontSize: '12px', color: 'var(--sub)', marginBottom: '8px', textTransform: 'uppercase'}}>Local Device Latency</div>
        <div style={{fontSize: '36px', fontWeight: '900', fontFamily: 'monospace', color: 'var(--cyan)', marginBottom: '10px'}}>
          {outLat ? (outLat * 1000).toFixed(0) : 0}<span style={{fontSize: '16px', color: 'var(--sub)', marginLeft: '4px'}}>ms</span>
        </div>
        <button className="btn btn-cyan" style={{width: '100%', maxWidth: '200px', margin: '10px auto', padding: '12px', fontSize: '14px', fontWeight: '700', borderRadius: '8px'}} onClick={runSonarCalibration}>🔊 Run Sonar Ping</button>
        <p style={{fontSize: '11px', color: 'var(--sub)', marginTop: '10px', lineHeight: '1.4'}}>Only run this on the specific device connected to the Bluetooth speaker. Hold the speaker near the microphone to measure the air delay.</p>
      </div>

      <div style={{width: '100%', height: '200px', background: '#05050a', borderRadius: '12px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)'}}>
        <canvas id="orbit-canvas" style={{width: '100%', height: '100%', display: 'block'}}></canvas>
        <div style={{position: 'absolute', top: '10px', right: '10px', zIndex: 10}}>
           {amHost ? (
              <button 
                style={{
                  fontSize: '11px', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                  background: orbitActive ? 'var(--pink)' : 'rgba(0,0,0,0.8)', 
                  color: orbitActive ? '#fff' : 'var(--sub)', 
                  boxShadow: orbitActive ? '0 0 15px rgba(247,37,133,0.5)' : 'none'
                }} 
                onClick={onToggleOrbit}
              >
                {orbitActive ? 'Orbit: LIVE' : 'Orbit: OFF'}
              </button>
           ) : (
              <div style={{
                fontSize: '10px', padding: '6px 10px', background: 'rgba(0,0,0,0.8)', 
                borderRadius: '6px', color: orbitActive ? 'var(--pink)' : 'var(--sub)', fontWeight: 'bold'
              }}>
                {orbitActive ? 'Orbit: LIVE' : 'Orbit: OFF'}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}