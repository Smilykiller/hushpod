import React from 'react';

export default function DJDesk({
  setRoomTab,
  amHost,
  guestUploads,
  currentSong,
  uploadSongs,
  uploadProgress,
  isPlaying,
  trackReady,
  progFillRef,
  tCurRef,
  audioBufferRef,
  fmt,
  seekClick,
  isShuffle,
  setIsShuffle,
  handleSeek,
  stateRef,
  actxRef,
  togglePlay,
  isLooping,
  setIsLooping,
  queue,
  draggedIdx,
  setDraggedIdx,
  handleDrop,
  socketRef
}) {
  return (
    <>
      <div style={{
        background: 'rgba(247,37,133,0.05)', 
        border: '1px solid rgba(247,37,133,0.2)', 
        borderRadius: '8px', 
        padding: '10px 14px', 
        marginBottom: '15px', 
        fontSize: '12px', 
        color: 'var(--sub)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px'
      }}>
        <span style={{fontSize: '16px'}}>🔊</span>
        <div style={{flex: 1, lineHeight: '1.4'}}>
          <strong style={{color: 'var(--text)'}}>Using a Bluetooth speaker?</strong><br/>
          Bluetooth creates an audio echo. Go to the <span onClick={() => setRoomTab('orbit')} style={{color: 'var(--pink)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline'}}>Labs 🧪 tab</span> to calibrate this specific device.
        </div>
      </div>

      {(amHost || guestUploads) && !currentSong && (
        <div className="upload-wrap" style={{border:'2px dashed var(--border)', borderRadius:'14px', padding:'26px 18px', textAlign:'center', cursor:'pointer', background:'var(--s2)', position:'relative'}}>
          <input type="file" accept="audio/*" multiple onChange={e => uploadSongs(e.target.files)} style={{position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%'}} />
          <div style={{fontSize:'32px', marginBottom:'8px'}}>🎧</div><h3 style={{fontSize:'14px', fontWeight:'600', marginBottom:'3px'}}>Add up to 10 songs</h3><p style={{fontSize:'12px', color:'var(--sub)'}}>MP3 WAV FLAC AAC</p>
        </div>
      )}
      
      {uploadProgress > 0 && (
        <div style={{marginTop:'10px'}}><div style={{height:'4px', background:'var(--s3)', borderRadius:'4px', overflow:'hidden', marginBottom:'5px'}}><div style={{height:'100%', background:'linear-gradient(90deg,var(--pink),var(--cyan))', width: `${uploadProgress}%`, transition:'width .15s'}}></div></div><div style={{fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace"}}>Uploading {uploadProgress}%</div></div>
      )}
      
      <div className="card">
        {!currentSong ? (
          <div style={{textAlign:'center', padding:'28px 16px'}}><div style={{fontSize:'44px', marginBottom:'10px'}}>🎧</div><h3 style={{fontSize:'17px', fontWeight:'700', marginBottom:'5px'}}>No song yet</h3><p style={{fontSize:'13px', color:'var(--sub)'}}>{(amHost||guestUploads) ? 'Upload a song to start!' : 'Waiting for host to add a song'}</p></div>
        ) : (
          <div>
            <div style={{fontSize:'20px', fontWeight:'700', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:'3px'}}>{currentSong.name}</div>
            <div style={{fontSize:'13px', color:'var(--sub)', fontWeight:'300', marginBottom:'16px'}}>Status: <span style={{color: isPlaying ? 'var(--green)' : 'var(--sub)', fontWeight:'600'}}>{isPlaying ? 'Playing' : 'Paused'}</span></div>
            
            <div style={{width:'100%', height:'70px', margin:'15px 0', background:'transparent', borderRadius:'8px', border:'1px solid var(--border)', overflow:'hidden', position: 'relative'}}>
              {!trackReady && (
                <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 5}}>
                  <div className="eq-container" style={{transform: 'scale(0.5)'}}>
                    <div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div>
                  </div>
                  <span style={{fontSize: '11px', color: 'var(--cyan)', marginLeft: '10px', fontWeight: 'bold', letterSpacing: '2px'}}>DECODING AUDIO...</span>
                </div>
              )}
              <canvas id="viz-canvas" style={{width:'100%', height:'100%', display:'block'}}></canvas>
            </div>

            <div style={{marginBottom:'14px'}}>
              <div style={{width:'100%', height:'30px', display:'flex', alignItems:'center', cursor:'pointer', marginBottom:'6px'}} onClick={seekClick}>
                <div style={{width:'100%', height:'6px', background:'var(--s3)', borderRadius:'5px', overflow:'hidden'}}>
                  <div ref={progFillRef} style={{height:'100%', background:'linear-gradient(90deg,var(--pink),var(--cyan))', width:'0%'}}></div>
                </div>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace"}}><span ref={tCurRef}>0:00</span><span>{audioBufferRef.current ? fmt(audioBufferRef.current.duration) : '0:00'}</span></div>
            </div>
            
            {amHost && (
              <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'15px', marginTop:'10px'}}>
                <button className="btn-ghost" style={{color: isShuffle ? 'var(--pink)' : 'var(--sub)', borderColor: isShuffle ? 'var(--pink)' : 'var(--border)', width:'40px', height:'40px', borderRadius:'8px', padding:0, fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => setIsShuffle(!isShuffle)}>🔀</button>
                <button className="btn-ghost" style={{width:'44px', height:'44px', borderRadius:'50%', padding:0, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => handleSeek(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime) - 10)}>⏮</button>
                <button className="btn-pink" style={{width:'60px', height:'60px', borderRadius:'50%', padding:0, fontSize:'24px', display:'flex', alignItems:'center', justifyContent:'center', margin:0, opacity: trackReady ? 1 : 0.4, cursor: trackReady ? 'pointer' : 'not-allowed', transition: 'all 0.3s'}} onClick={() => { if (trackReady) togglePlay(); }} disabled={!trackReady}>{isPlaying ? '⏸' : '▶'}</button>
                <button className="btn-ghost" style={{width:'44px', height:'44px', borderRadius:'50%', padding:0, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => handleSeek(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime) + 10)}>⏭</button>
                <button className="btn-ghost" style={{color: isLooping ? 'var(--pink)' : 'var(--sub)', borderColor: isLooping ? 'var(--pink)' : 'var(--border)', width:'40px', height:'40px', borderRadius:'8px', padding:0, fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => setIsLooping(!isLooping)}>🔁</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-label">Queue {(amHost || guestUploads) && currentSong && <button className="btn-ghost" style={{margin:0, padding: '4px 10px', width:'auto', borderRadius:'6px', fontSize:'11px'}} onClick={() => document.getElementById('q-file')?.click()}>+ Add</button>}</div>
        {(amHost || guestUploads) && <input type="file" id="q-file" style={{display:'none'}} accept="audio/*" multiple onChange={e => uploadSongs(e.target.files)} />}
        <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
          {queue.length === 0 ? <div style={{fontSize:'13px', color:'var(--sub)', textAlign:'center', padding:'12px 0'}}>No songs queued</div> : queue.map((s, i) => (
            <div key={s.id} draggable={amHost} onDragStart={() => setDraggedIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, i)} style={{background:'var(--s2)', padding:'10px 14px', borderRadius:'12px', fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', border: currentSong?.id === s.id ? '1px solid var(--pink)' : '1px solid var(--border)', fontWeight:'500', cursor: amHost ? 'grab' : 'default', opacity: draggedIdx === i ? 0.5 : 1}}>
              {amHost && <span style={{marginRight:'10px', cursor:'grab', color:'var(--sub)'}}>☰</span>}
              <div style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{s.name}</div>
              {amHost && currentSong?.id !== s.id && <button className="btn-ghost" style={{fontSize:'12px', color:'var(--cyan)', fontWeight:'600', padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(76,201,240,.3)', background:'var(--s3)', cursor:'pointer', flexShrink:0, width:'auto', margin:0}} onClick={() => socketRef.current.emit('play-song', { songId: s.id, autoPlay: true })}>Play</button>}
              {currentSong?.id === s.id && <span style={{fontSize:'11px', color:'var(--cyan)', fontWeight:'bold'}}>NOW</span>}
              {currentSong?.id !== s.id && !amHost && <button className="btn-ghost" style={{background:'var(--s3)', color:'var(--cyan)', border:'1px solid rgba(76,201,240,.3)', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontWeight:'700', fontSize:'11px', width:'auto', margin:0}} onClick={() => socketRef.current.emit('upvote', { songId: s.id })}>▲ {s.upvotes || 0}</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}