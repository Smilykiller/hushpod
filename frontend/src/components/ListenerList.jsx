import React from 'react';

export default function ListenerList({ 
  members, 
  currentUserId, 
  amHost, 
  admins = [], 
  onMakeAdmin, 
  onRemoveAdmin, 
  onTransferHost 
}) {
  return (
    <div className="card">
      <div className="card-label">Listeners ({members.length})</div>
      <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
        {members.map(m => (
          <div key={m.id} style={{background:'var(--s2)', padding:'10px 14px', borderRadius:'12px', fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid var(--border)'}}>
            <div>
              <span style={{fontWeight:'600'}}>{m.name}</span> 
              {m.id === currentUserId && <span style={{fontSize:'11px', color:'var(--sub)', marginLeft:'6px'}}>(You)</span>}
              {m.isHost && <span style={{fontSize:'11px', color:'var(--pink)', marginLeft:'6px', fontWeight:'bold'}}>HOST</span>}
              {!m.isHost && admins.includes(m.id) && <span style={{fontSize:'11px', color:'var(--cyan)', marginLeft:'6px', fontWeight:'bold'}}>DJ</span>}
            </div>
            
            {amHost && m.id !== currentUserId && (
              <div style={{display:'flex', gap:'6px'}}>
                {!admins.includes(m.id) ? 
                  <button 
                    className="btn-ghost" 
                    style={{padding:'4px 8px', fontSize:'11px', margin:0, width:'auto'}} 
                    onClick={() => onMakeAdmin(m.id)}
                  >
                    Make DJ
                  </button> :
                  <button 
                    className="btn-ghost" 
                    style={{padding:'4px 8px', fontSize:'11px', margin:0, width:'auto', color:'var(--yellow)'}} 
                    onClick={() => onRemoveAdmin(m.id)}
                  >
                    Remove DJ
                  </button>
                }
                <button 
                  className="btn-red" 
                  style={{padding:'4px 8px', fontSize:'11px', margin:0, width:'auto'}} 
                  onClick={() => onTransferHost(m.id)}
                >
                  Make Host
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}