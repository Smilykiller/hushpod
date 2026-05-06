import React, { useState } from 'react';

export default function ListenerList({
  members, currentUserId, amHost, admins,
  onMakeAdmin, onRemoveAdmin, onTransferHost,
}) {
  const [expandedId, setExpandedId] = useState(null);

  const isAdmin = (id) => (admins || []).includes(id);

  const getBadge = (m) => {
    if (m.isHost) return { label: 'HOST', color: 'var(--pink)' };
    if (isAdmin(m.id)) return { label: 'DJ', color: 'var(--cyan)' };
    return null;
  };

  return (
    <div className="card" style={{ padding: '0' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--sub)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Listeners ({members.length})
        </span>
        {amHost && (
          <span style={{ fontSize: '11px', color: 'var(--sub)' }}>Tap a member to manage</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', padding: '10px' }}>
        {members.map(m => {
          const badge     = getBadge(m);
          const isYou     = m.id === currentUserId;
          const expanded  = expandedId === m.id;
          const canManage = amHost && !isYou && !m.isHost;

          return (
            <div key={m.id} style={{ marginBottom: '6px' }}>
              {/* Member Row */}
              <div
                onClick={() => canManage && setExpandedId(expanded ? null : m.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderRadius: expanded ? '12px 12px 0 0' : '12px',
                  background: expanded ? 'var(--s3)' : 'var(--s2)',
                  border: `1px solid ${expanded ? 'var(--border)' : 'rgba(255,255,255,0.02)'}`,
                  cursor: canManage ? 'pointer' : 'default',
                  transition: 'background .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: m.isHost
                      ? 'linear-gradient(135deg, var(--pink), #7b2ff7)'
                      : isAdmin(m.id)
                      ? 'linear-gradient(135deg, var(--cyan), #0096c7)'
                      : 'var(--s3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: '800', color: '#fff', flexShrink: 0,
                  }}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                      {m.name}
                      {isYou && <span style={{ color: 'var(--sub)', fontWeight: 'normal', fontSize: '12px', marginLeft: '6px' }}>(You)</span>}
                    </div>
                    {badge && (
                      <div style={{ fontSize: '10px', fontWeight: '800', color: badge.color, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '1px' }}>
                        {badge.label}
                      </div>
                    )}
                  </div>
                </div>

                {canManage && (
                  <span style={{ color: 'var(--sub)', fontSize: '14px', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                )}
              </div>

              {/* Expanded admin controls */}
              {expanded && canManage && (
                <div style={{
                  background: 'var(--s3)', borderRadius: '0 0 12px 12px',
                  border: '1px solid var(--border)', borderTop: 'none',
                  padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px',
                }}>
                  {/* Make/Remove DJ (admin) */}
                  {!isAdmin(m.id) ? (
                    <button
                      onClick={() => { onMakeAdmin(m.id); setExpandedId(null); }}
                      style={{ flex: 1, minWidth: '120px', padding: '8px 12px', background: 'rgba(76,201,240,0.15)', border: '1px solid rgba(76,201,240,0.3)', borderRadius: '8px', color: 'var(--cyan)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      🎛️ Make DJ
                    </button>
                  ) : (
                    <button
                      onClick={() => { onRemoveAdmin(m.id); setExpandedId(null); }}
                      style={{ flex: 1, minWidth: '120px', padding: '8px 12px', background: 'rgba(247,37,133,0.1)', border: '1px solid rgba(247,37,133,0.25)', borderRadius: '8px', color: 'var(--pink)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      ✖ Remove DJ
                    </button>
                  )}

                  {/* Transfer host */}
                  <button
                    onClick={() => {
                      if (window.confirm(`Hand the HOST crown to ${m.name}? You'll become a regular listener.`)) {
                        onTransferHost(m.id);
                        setExpandedId(null);
                      }
                    }}
                    style={{ flex: 1, minWidth: '120px', padding: '8px 12px', background: 'rgba(255,214,10,0.1)', border: '1px solid rgba(255,214,10,0.3)', borderRadius: '8px', color: '#ffd60a', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    👑 Give Crown
                  </button>

                  <button
                    onClick={() => setExpandedId(null)}
                    style={{ padding: '8px 12px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--sub)', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}