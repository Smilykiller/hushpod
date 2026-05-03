import React from 'react';

export default function RoomSettings({
  amHost,
  guestUploads,
  setGuestUploads,
  globalVolume,
  handleGlobalVolume,
  localVolume,
  handleLocalVolume,
  socketRef,
}) {
  return (
    <div className="card">
      <div className="card-label">Room Settings</div>

      {/* ── MY VOLUME (every user sees this) ── */}
      <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>My Volume</div>
          <div style={{ fontSize: '12px', color: 'var(--cyan)', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700' }}>
            {Math.round(localVolume * 100)}%
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--sub)', marginBottom: '12px' }}>
          Your personal volume — only affects your device
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.02"
          value={localVolume}
          onChange={handleLocalVolume}
          style={{ width: '100%', accentColor: 'var(--cyan)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--sub)', marginTop: '4px' }}>
          <span>🔇</span><span>🔊</span>
        </div>
      </div>

      {/* ── GLOBAL VOLUME (host controls, everyone sees the value) ── */}
      <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>Room Volume</div>
          <div style={{ fontSize: '12px', color: amHost ? 'var(--pink)' : 'var(--sub)', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700' }}>
            {Math.round(globalVolume * 100)}%
            {!amHost && <span style={{ fontSize: '10px', color: 'var(--sub)', marginLeft: '6px' }}>host only</span>}
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--sub)', marginBottom: '12px' }}>
          Max volume cap for everyone in the room
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={globalVolume}
          onChange={handleGlobalVolume}
          disabled={!amHost}
          style={{ width: '100%', accentColor: 'var(--pink)', cursor: amHost ? 'pointer' : 'not-allowed', opacity: amHost ? 1 : 0.5 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--sub)', marginTop: '4px' }}>
          <span>🔇</span><span>🔊</span>
        </div>
      </div>

      {/* ── GUEST UPLOADS (host controls) ── */}
      <div style={{ background: 'var(--s2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Guest Uploads</div>
            <div style={{ fontSize: '11px', color: 'var(--sub)', marginTop: '2px' }}>Allow listeners to add songs to queue</div>
          </div>
          {amHost ? (
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={guestUploads}
                onChange={e => {
                  setGuestUploads(e.target.checked);
                  socketRef.current.emit('toggle-guest-uploads', { allowed: e.target.checked });
                }}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                background: guestUploads ? 'var(--green)' : 'var(--s3)',
                borderRadius: '24px', transition: '.4s',
              }}>
                <span style={{
                  position: 'absolute', height: '18px', width: '18px',
                  left: guestUploads ? '22px' : '3px', bottom: '3px',
                  background: 'white', borderRadius: '50%', transition: '.4s',
                }} />
              </span>
            </label>
          ) : (
            <div style={{
              fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '6px',
              background: guestUploads ? 'rgba(6,214,160,0.15)' : 'rgba(247,37,133,0.1)',
              color: guestUploads ? 'var(--green)' : 'var(--pink)',
              border: `1px solid ${guestUploads ? 'rgba(6,214,160,0.3)' : 'rgba(247,37,133,0.3)'}`,
            }}>
              {guestUploads ? 'OPEN' : 'LOCKED'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}