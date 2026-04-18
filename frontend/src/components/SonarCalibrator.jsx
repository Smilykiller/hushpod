import React from 'react';

export default function SonarCalibrator({ engine }) {
  return (
    <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
      <div style={{fontSize: '12px', color: 'var(--sub)', marginBottom: '8px', textTransform: 'uppercase'}}>Local Device Latency</div>
      <div style={{fontSize: '36px', fontWeight: '900', fontFamily: 'monospace', color: 'var(--cyan)', marginBottom: '10px'}}>
        {engine.stateRef.current.outLat ? (engine.stateRef.current.outLat * 1000).toFixed(0) : 0}<span style={{fontSize: '16px', color: 'var(--sub)', marginLeft: '4px'}}>ms</span>
      </div>
      <button 
        className="btn btn-cyan" 
        style={{width: '100%', maxWidth: '200px', margin: '10px auto', padding: '12px', fontSize: '14px', fontWeight: '700', borderRadius: '8px'}} 
        onClick={engine.runSonarCalibration}
      >
        🔊 Run Sonar Ping
      </button>
      <p style={{fontSize: '11px', color: 'var(--sub)', marginTop: '10px', lineHeight: '1.4'}}>Hold the Bluetooth speaker near the microphone to measure air delay.</p>
    </div>
  );
}