import React, { useState, useEffect } from 'react';

export default function SonarCalibrator({ engine }) {
  const [displayLat, setDisplayLat] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState("Unknown Hardware");

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayLat(engine.stateRef.current.outLat || 0);
    }, 500);
    return () => clearInterval(interval);
  }, [engine.stateRef]);

  const manualAdjust = (amount) => {
    const newLat = Math.max(0, (engine.stateRef.current.outLat || 0) + amount);
    engine.stateRef.current.outLat = newLat;
    setDisplayLat(newLat);
  };

  // THE NEW AUTO-DETECT ENGINE
  const autoDetectHardware = async () => {
    if (!engine.actxRef.current) return engine.toast("Play audio first to wake up hardware", "err");
    
    try {
      // 1. We MUST request mic access for a split second. 
      // If we don't, the browser hides all the device names to prevent tracking.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      stream.getTracks().forEach(t => t.stop()); // Kill mic instantly

      const outputs = devices.filter(d => d.kind === 'audiooutput');
      const activeOut = outputs.find(d => d.deviceId === 'default') || outputs[0];

      if (!activeOut) return engine.toast("Couldn't read hardware info", "err");

      const label = activeOut.label.toLowerCase();
      let guessMs = 50; 
      let typeName = "Wired / Internal Speaker";

      // 2. Grab what the OS *thinks* the latency is
      const osLatency = (engine.actxRef.current.outputLatency || engine.actxRef.current.baseLatency || 0.05) * 1000;

      // 3. Scan the label for Bluetooth clues. 
      // If it's Bluetooth, the OS latency is wrong. We must manually inject air-delay math.
      if (label.includes('bluetooth') || label.includes('airpods') || label.includes('buds') || label.includes('bose') || label.includes('bt')) {
         guessMs = Math.max(180, osLatency + 120); 
         typeName = "Bluetooth Audio";
      } else {
         guessMs = Math.max(40, osLatency);
      }

      // 4. Apply the math instantly
      setDeviceInfo(`${typeName} (${activeOut.label || 'Default'})`);
      engine.stateRef.current.outLat = guessMs / 1000;
      setDisplayLat(guessMs / 1000);
      engine.toast(`Hardware Sniffed: ${guessMs.toFixed(0)}ms applied`, "ok");

    } catch (err) {
      engine.toast("Need mic permission to read device labels!", "err");
    }
  };

  return (
    <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
      <div style={{fontSize: '12px', color: 'var(--sub)', marginBottom: '4px', textTransform: 'uppercase'}}>Hardware Latency</div>
      
      {/* NEW: Displays what the code detected */}
      <div style={{fontSize: '11px', color: 'var(--pink)', marginBottom: '15px', fontWeight: 'bold', minHeight: '15px'}}>
        {deviceInfo}
      </div>
      
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '15px'}}>
        <button className="btn-ghost" style={{width: '40px', height: '40px', borderRadius: '8px', fontSize: '18px', padding: 0, margin: 0}} onClick={() => manualAdjust(-0.010)}>-</button>
        
        <div style={{fontSize: '36px', fontWeight: '900', fontFamily: 'monospace', color: 'var(--cyan)', width: '100px'}}>
          {(displayLat * 1000).toFixed(0)}<span style={{fontSize: '16px', color: 'var(--sub)', marginLeft: '4px'}}>ms</span>
        </div>
        
        <button className="btn-ghost" style={{width: '40px', height: '40px', borderRadius: '8px', fontSize: '18px', padding: 0, margin: 0}} onClick={() => manualAdjust(0.010)}>+</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
        <button 
          className="btn-ghost" 
          style={{flex: 1, padding: '12px 8px', fontSize: '12px', fontWeight: '700', borderRadius: '8px', margin: 0, border: '1px solid var(--border)'}} 
          onClick={autoDetectHardware}
        >
          🔍 Auto-Detect
        </button>

        <button 
          className="btn-cyan" 
          style={{flex: 1, padding: '12px 8px', fontSize: '12px', fontWeight: '700', borderRadius: '8px', margin: 0}} 
          onClick={engine.runSonarCalibration}
        >
          🔊 Acoustic Ping
        </button>
      </div>

      <p style={{fontSize: '11px', color: 'var(--sub)', marginTop: '15px', lineHeight: '1.4'}}>
        <strong>Auto-Detect</strong> reads your hardware profile. If it's still echoing, use <strong>Acoustic Ping</strong> to measure the physical air delay.
      </p>
    </div>
  );
}