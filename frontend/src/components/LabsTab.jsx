import React from 'react';
// BUG FIX: Removed `import { Capacitor } from '@capacitor/core'`
// This import crashes the web app since Capacitor is a mobile wrapper
// and the package behaves unexpectedly in a pure browser environment.
// LocalLibrary (offline folder import) is a native-only feature and is
// simply hidden on web — no Capacitor check needed.
import SonarCalibrator from './SonarCalibrator';
import OrbitVisualizer from './OrbitVisualizer';
import PartyRoulette from './PartyRoulette';

export default function LabsTab({ engine }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ padding: '5px 10px' }}>
        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--pink)', letterSpacing: '-0.5px' }}>
          HushPod Labs
        </div>
        <div style={{ fontSize: '12px', color: 'var(--sub)', marginTop: '2px' }}>
          Experimental features & hardware tools
        </div>
      </div>

      <PartyRoulette engine={engine} />
      <SonarCalibrator engine={engine} />
      <OrbitVisualizer engine={engine} />
    </div>
  );
}