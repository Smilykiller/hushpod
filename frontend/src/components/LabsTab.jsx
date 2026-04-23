import React from 'react';
import { Capacitor } from '@capacitor/core'; // <-- 1. Import Capacitor
import SonarCalibrator from './SonarCalibrator';
import OrbitVisualizer from './OrbitVisualizer';
import PartyRoulette from './PartyRoulette';
import LocalLibrary from './LocalLibrary'; 

export default function LabsTab({ engine }) {
  
  // 2. Ask Capacitor if this is running as an Android APK or iOS App
  const isNativeApp = Capacitor.isNativePlatform();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ padding: '5px 10px' }}>
        <div style={{fontSize: '18px', fontWeight: '800', color: 'var(--pink)', letterSpacing: '-0.5px'}}>HushPod Labs</div>
        <div style={{fontSize: '12px', color: 'var(--sub)', marginTop: '2px'}}>Experimental features & hardware tools</div>
      </div>

      {/* 3. Wrap the Local Library in the Native App check */}
      {isNativeApp && (
        <LocalLibrary engine={engine} />
      )}
      
      <PartyRoulette engine={engine} />
      <SonarCalibrator engine={engine} />
      <OrbitVisualizer engine={engine} />
    </div>
  );
}