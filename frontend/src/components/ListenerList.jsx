import React from 'react';

export default function ListenerList({ members, currentUserId }) {
  return (
    <div className="card" style={{ padding: '0' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: '700', color: 'var(--sub)', letterSpacing: '1px', textTransform: 'uppercase' }}>
        Listeners ({members.length})
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', padding: '10px' }}>
        {members.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '12px', marginBottom: '6px', background: 'var(--s2)', border: '1px solid rgba(255,255,255,0.02)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>
                {m.name} 
                {m.id === currentUserId && <span style={{ color: 'var(--sub)', fontWeight: 'normal', fontSize: '13px', marginLeft: '6px' }}>(You)</span>}
              </span>
            </div>

            {m.isHost && (
              <span style={{ fontSize: '11px', color: 'var(--pink)', fontWeight: '800', letterSpacing: '1px' }}>HOST</span>
            )}

          </div>
        ))}
      </div>
    </div>
  );
} 