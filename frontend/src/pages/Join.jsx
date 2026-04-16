import React from 'react';

export default function Join({
  setView,
  uname,
  setUname,
  codeInput,
  setCodeInput,
  attemptCreateRoom,
  attemptJoinRoom,
  modals,
  setModals,
  tosChecked,
  setTosChecked,
  confirmTosAndExecute
}) {
  return (
    <>
      <div className="scr on" id="app-entry" style={{alignItems:'center', justifyContent:'center', padding:'40px 20px', textAlign:'center', flex:1}}>
        <div style={{width:'100%', maxWidth:'340px', margin:'0 auto 20px auto', textAlign:'left'}}>
          <button className="btn btn-ghost" style={{padding:'8px 16px', borderRadius:'8px', fontSize:'12px', cursor:'pointer', width:'auto'}} onClick={() => {setView('marketing'); window.scrollTo(0,0);}}>← Back to Home</button>
        </div>
        <div className="logo"><div className="logo-title" style={{marginBottom:'-5px', fontSize:'80px'}}>HUSH<br/>POD</div><div className="logo-sub">Listen together Privately</div></div>
        
        <div className="field" style={{maxWidth:'340px', margin:'0 auto'}}><label>Your name</label><input type="text" value={uname} onChange={e => setUname(e.target.value)} placeholder="Enter your name" maxLength="20" /></div>
        
        <div className="btns" style={{maxWidth:'340px', margin:'0 auto'}}>
          <button className="btn btn-pink" onClick={attemptCreateRoom}>Create Party Room</button>
          <div style={{display:'flex', alignItems:'center', gap:'9px', color:'var(--sub)', fontSize:'12px', margin:'10px 0'}}>
            <span style={{flex:1, height:'1px', background:'var(--border)'}}></span>or join one<span style={{flex:1, height:'1px', background:'var(--border)'}}></span>
          </div>
          <div style={{padding:'20px', borderRadius:'18px', border:'1px solid var(--border)', background:'var(--s1)'}}>
            <h3 style={{fontSize:'11px', fontWeight:'600', letterSpacing:'2px', textTransform:'uppercase', color:'var(--sub)', marginBottom:'12px'}}>Room Code</h3>
            <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} placeholder="ABC12" maxLength="5" style={{textAlign:'center', letterSpacing:'6px', fontFamily:'JetBrains Mono', fontWeight:'bold', marginBottom:'12px'}} />
            <button className="btn btn-cyan" style={{marginBottom:0}} onClick={attemptJoinRoom}>Join Room</button>
          </div>
        </div>
      </div>

      {modals.tos && (
        <div style={{position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div style={{background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'22px', padding:'30px 24px', maxWidth:'400px', width:'100%', textAlign:'left'}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:'28px', letterSpacing:'2px', background:'linear-gradient(135deg,var(--pink),var(--cyan))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'2px'}}>HUSHPOD</div>
            <div style={{fontSize:'11px', fontWeight:'600', color:'var(--sub)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'20px'}}>Terms of Service</div>
            <div style={{marginBottom:'14px'}}>
              <div style={{fontSize:'11px', fontWeight:'700', color:'var(--cyan)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'5px'}}>🎵 Your Content, Your Responsibility</div>
              <div style={{fontSize:'12px', color:'var(--sub)', lineHeight:'1.7'}}>By uploading audio, you confirm you own the content, hold a valid license, or have explicit permission from the copyright holder.</div>
            </div>
            <label style={{display:'flex', alignItems:'flex-start', gap:'10px', margin:'18px 0', padding:'14px', background:'var(--s2)', borderRadius:'12px', border:'1px solid var(--border)', cursor:'pointer'}}>
              <input type="checkbox" checked={tosChecked} onChange={e => setTosChecked(e.target.checked)} style={{marginTop:'2px', accentColor:'var(--cyan)', width:'16px', height:'16px', cursor:'pointer'}} />
              <span style={{fontSize:'12px', color:'var(--text)', lineHeight:'1.6', cursor:'pointer'}}>I confirm I will only upload content I own or have rights to.</span>
            </label>
            <div style={{display:'flex', gap:'10px'}}>
              <button className="btn-ghost" style={{margin:0, padding:'12px', flex:1}} onClick={() => setModals({...modals, tos: false})}>Cancel</button>
              <button className="btn-cyan" style={{margin:0, padding:'12px', flex:1, opacity: tosChecked ? 1 : 0.4}} disabled={!tosChecked} onClick={confirmTosAndExecute}>Accept</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}