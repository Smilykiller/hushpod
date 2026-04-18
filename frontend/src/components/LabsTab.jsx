import React from 'react';
import SonarCalibrator from './SonarCalibrator';
import OrbitVisualizer from './OrbitVisualizer';
import PartyRoulette from './PartyRoulette';

export default function LabsTab({ engine }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ padding: '5px 10px' }}>
        <div style={{fontSize: '18px', fontWeight: '800', color: 'var(--pink)', letterSpacing: '-0.5px'}}>HushPod Labs</div>
        <div style={{fontSize: '12px', color: 'var(--sub)', marginTop: '2px'}}>Experimental features & hardware tools</div>
      </div>

      <PartyRoulette engine={engine} />
      <SonarCalibrator engine={engine} />
      <OrbitVisualizer engine={engine} />
    </div>
  );
}