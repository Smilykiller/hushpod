import React from 'react';

export default function RoomSettings({
  amHost,
  guestUploads,
  setGuestUploads,
  globalVolume,
  handleGlobalVolume,
  socketRef
}) {
  return (
    <div className="card">
      <div className="card-label">Room Settings</div>
      
      <div style={{background:'var(--s2)', padding:'16px', borderRadius:'12px', border:'1px solid var(--border)', marginBottom:'12px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
          <div>
            <div style={{fontSize:'14px', fontWeight:'600'}}>Guest Uploads</div>
            <div style={{fontSize:'11px', color:'var(--sub)'}}>Allow listeners to add songs to queue</div>
          </div>
          {amHost ? (
            <label style={{position:'relative', display:'inline-block', width:'44px', height:'24px'}}>
              <input 
                type="checkbox" 
                checked={guestUploads} 
                onChange={e => { 
                  setGuestUploads(e.target.checked); 
                  socketRef.current.emit('toggle-guest-uploads', {allowed: e.target.checked}); 
                }} 
                style={{opacity:0, width:0, height:0}} 
              />
              <span style={{position:'absolute', cursor:'pointer', top:0, left:0, right:0, bottom:0, background: guestUploads ? 'var(--green)' : 'var(--s3)', borderRadius:'24px', transition:'.4s'}}>
                <span style={{position:'absolute', height:'18px', width:'18px', left: guestUploads ? '22px' : '3px', bottom:'3px', background:'white', borderRadius:'50%', transition:'.4s'}}></span>
              </span>
            </label>
          ) : (
            <div style={{fontSize:'12px', fontWeight:'bold', color: guestUploads ? 'var(--green)' : 'var(--pink)'}}>
              {guestUploads ? 'ENABLED' : 'LOCKED'}
            </div>
          )}
        </div>
      </div>

      <div style={{background:'var(--s2)', padding:'16px', borderRadius:'12px', border:'1px solid var(--border)'}}>
        <div style={{fontSize:'14px', fontWeight:'600', marginBottom:'4px'}}>Global Volume ({Math.round(globalVolume * 100)}%)</div>
        <div style={{fontSize:'11px', color:'var(--sub)', marginBottom:'12px'}}>Adjust max volume for everyone</div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          value={globalVolume} 
          onChange={handleGlobalVolume} 
          disabled={!amHost} 
          style={{width:'100%', accentColor:'var(--cyan)', cursor: amHost ? 'pointer' : 'default'}} 
        />
      </div>
    </div>
  );
}