import React, { useState } from 'react';

/**
 * BluetoothStatus — persistent floating badge showing audio device sync state.
 * Sits bottom-right on the DJ Desk tab. Tapping it expands full details.
 *
 * Props:
 *   btStatus: { connected, deviceName, latencyMs, type, synced }
 *   onRunSonar: () => void   — triggers the acoustic ping calibration
 */
export default function BluetoothStatus({ btStatus, onRunSonar }) {
  const [expanded, setExpanded] = useState(false);

  const { connected, deviceName, latencyMs, type, synced } = btStatus;

  // ── Visual config per state ──
  const cfg = (() => {
    if (type === 'detecting') return {
      dot: '#ffd60a', icon: '🔍', label: 'Detecting device...', color: '#ffd60a',
    };
    if (type === 'bluetooth' && synced) return {
      dot: '#06d6a0', icon: '🎧', label: deviceName || 'Bluetooth', color: '#06d6a0',
    };
    if (type === 'bluetooth' && !synced) return {
      dot: '#f72585', icon: '🎧', label: 'BT — sync pending', color: '#f72585',
    };
    if (type === 'wired' && synced) return {
      dot: '#4cc9f0', icon: '🔌', label: deviceName || 'Wired / Built-in', color: '#4cc9f0',
    };
    return {
      dot: '#666688', icon: '🔈', label: 'Audio device', color: '#666688',
    };
  })();

  const latencyColor =
    latencyMs < 80  ? '#06d6a0' :
    latencyMs < 160 ? '#ffd60a' :
    latencyMs < 250 ? '#f4a261' : '#f72585';

  return (
    <div
      style={{
        position: 'fixed', bottom: '80px', right: '16px', zIndex: 150,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ── Expanded panel ── */}
      {expanded && (
        <div style={{
          background: 'rgba(6,6,15,0.96)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '16px',
          width: '230px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          animation: 'pageEnter 0.2s ease both',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>{cfg.icon}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: cfg.color }}>
                {type === 'bluetooth' ? 'Bluetooth' : 'Wired / Built-in'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sub)', marginTop: '1px',
                maxWidth: '165px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deviceName || 'Default output'}
              </div>
            </div>
          </div>

          {/* Latency meter */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--sub)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Applied Latency
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '28px', fontWeight: '900', color: latencyColor }}>
                {latencyMs}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--sub)' }}>ms</span>
            </div>

            {/* Visual bar */}
            <div style={{ marginTop: '8px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${Math.min(100, (latencyMs / 400) * 100)}%`,
                background: `linear-gradient(90deg, #06d6a0, ${latencyColor})`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '9px', color: 'var(--sub)' }}>
              <span>0ms</span><span>Perfect</span><span>400ms</span>
            </div>
          </div>

          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}`, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--sub)' }}>
              {type === 'detecting' ? 'Detecting...' :
               synced ? 'Sync locked ✓' : 'Sync pending'}
            </span>
          </div>

          {/* Info blurb */}
          {type === 'bluetooth' && (
            <div style={{ fontSize: '10px', color: 'var(--sub)', lineHeight: '1.5', marginBottom: '10px', background: 'rgba(76,201,240,0.06)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(76,201,240,0.1)' }}>
              {latencyMs < 160
                ? '✅ Good BT codec detected. Sync should be tight.'
                : latencyMs < 250
                ? '⚡ Moderate latency. If audio echoes, run Acoustic Ping.'
                : '⚠️ High BT latency. Run Acoustic Ping for precise calibration.'}
            </div>
          )}

          {/* Acoustic ping button */}
          <button
            onClick={() => { onRunSonar(); setExpanded(false); }}
            style={{
              width: '100%', padding: '9px', background: 'rgba(76,201,240,0.12)',
              border: '1px solid rgba(76,201,240,0.3)', borderRadius: '8px',
              color: 'var(--cyan)', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            🔊 Run Acoustic Ping
          </button>
          <div style={{ fontSize: '10px', color: 'var(--sub)', textAlign: 'center', marginTop: '6px' }}>
            Hold speaker near mic for physical measurement
          </div>
        </div>
      )}

      {/* ── Collapsed badge (always visible) ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'rgba(6,6,15,0.92)', backdropFilter: 'blur(20px)',
          border: `1px solid ${synced ? cfg.dot + '55' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '20px', padding: '6px 12px 6px 8px',
          cursor: 'pointer', boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      >
        {/* Animated dot */}
        <div style={{ position: 'relative', width: '8px', height: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: cfg.dot,
            boxShadow: synced ? `0 0 8px ${cfg.dot}` : 'none',
            animation: type === 'detecting' ? 'fadeBlink 1s infinite' : 'none',
          }} />
        </div>

        <span style={{ fontSize: '12px' }}>{cfg.icon}</span>

        <span style={{
          fontSize: '11px', fontWeight: '700', color: cfg.color,
          maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {type === 'detecting' ? 'Detecting...' :
           deviceName ? deviceName.split(' ').slice(0, 2).join(' ') :
           type === 'bluetooth' ? 'Bluetooth' : 'Wired'}
        </span>

        {synced && latencyMs > 0 && (
          <span style={{ fontSize: '10px', color: latencyColor, fontWeight: '900' }}>
            {latencyMs}ms
          </span>
        )}
      </button>
    </div>
  );
}