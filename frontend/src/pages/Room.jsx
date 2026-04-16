import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Import our new puzzle pieces!
import DJDesk from '../components/DJDesk';
import ListenerList from '../components/ListenerList';
import ChatBox from '../components/ChatBox';
import RoomSettings from '../components/RoomSettings';
import OrbitRadar from '../components/OrbitRadar';

export default function Room({
  roomTitle, roomCode, modals, setModals, socketRef, roomTab, setRoomTab, amHost,
  guestUploads, setGuestUploads, uploadSongs, uploadProgress, currentSong, isPlaying,
  trackReady, progFillRef, tCurRef, audioBufferRef, fmt, seekClick, isShuffle, setIsShuffle,
  handleSeek, stateRef, actxRef, togglePlay, isLooping, setIsLooping, queue, setQueue,
  draggedIdx, setDraggedIdx, handleDrop, members, chat, uname, globalVolume, 
  handleGlobalVolume, orbitActive, runSonarCalibration, syncState
}) {
  
  return (
    <>
      <div id="room" className="scr on" style={{ display: 'flex' }}>
        <div className="rhead">
          <div className="rhead-left">
            <div className="rname">{roomTitle}</div>
            <div className="rcode">Code: {roomCode}</div>
          </div>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn-ghost btn-sm" onClick={() => setModals({...modals, qr: true})}>Share</button>
            <button className="btn-red btn-sm" onClick={() => { 
              sessionStorage.removeItem('hushpod_session'); 
              if(socketRef.current) socketRef.current.disconnect(); 
              window.location.reload(); 
            }}>Leave</button>
          </div>
        </div>

        <div className="rbody">
          
          {/* --- NAVIGATION WITH ALL 5 TABS --- */}
          <div style={{display: 'flex', gap: '6px', marginBottom: '10px', background: 'var(--s1)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap'}}>
            <button onClick={() => setRoomTab('dj')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'dj' ? 'var(--s2)' : 'transparent', color: roomTab === 'dj' ? 'var(--cyan)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>DJ Desk</button>
            <button onClick={() => setRoomTab('members')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'members' ? 'var(--s2)' : 'transparent', color: roomTab === 'members' ? 'var(--text)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Listeners</button>
            <button onClick={() => setRoomTab('chat')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'chat' ? 'var(--s2)' : 'transparent', color: roomTab === 'chat' ? 'var(--text)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Chat</button>
            <button onClick={() => setRoomTab('settings')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'settings' ? 'var(--s2)' : 'transparent', color: roomTab === 'settings' ? 'var(--text)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Settings</button>
            <button onClick={() => setRoomTab('orbit')} style={{flex: 1, padding: '10px 8px', background: roomTab === 'orbit' ? 'var(--s2)' : 'transparent', color: roomTab === 'orbit' ? 'var(--pink)' : 'var(--sub)', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'}}>Labs 🧪</button>
          </div>

          {/* --- TAB CONTENT ROUTES --- */}
          <div style={{ display: roomTab === 'dj' ? 'block' : 'none' }}>
            <DJDesk 
              setRoomTab={setRoomTab} amHost={amHost} guestUploads={guestUploads} 
              currentSong={currentSong} uploadSongs={uploadSongs} uploadProgress={uploadProgress} 
              isPlaying={isPlaying} trackReady={trackReady} progFillRef={progFillRef} 
              tCurRef={tCurRef} audioBufferRef={audioBufferRef} fmt={fmt} seekClick={seekClick} 
              isShuffle={isShuffle} setIsShuffle={setIsShuffle} handleSeek={handleSeek} 
              stateRef={stateRef} actxRef={actxRef} togglePlay={togglePlay} 
              isLooping={isLooping} setIsLooping={setIsLooping} queue={queue} 
              draggedIdx={draggedIdx} setDraggedIdx={setDraggedIdx} handleDrop={handleDrop} 
              socketRef={socketRef}
            />
          </div>

          <div style={{ display: roomTab === 'members' ? 'block' : 'none' }}>
            <ListenerList 
              members={members} 
              currentUserId={socketRef.current?.id} 
              amHost={amHost} 
              admins={stateRef.current?.admins || []} 
              onMakeAdmin={(id) => socketRef.current.emit('make-admin', {targetId: id})}
              onRemoveAdmin={(id) => socketRef.current.emit('remove-admin', {targetId: id})}
              onTransferHost={(id) => socketRef.current.emit('transfer-host', {targetId: id})}
            />
          </div>

          <div style={{ display: roomTab === 'chat' ? 'block' : 'none' }}>
            <ChatBox 
              chat={chat} 
              uname={uname} 
              onSendMessage={(text) => socketRef.current.emit('chat-msg', { text })}
            />
          </div>

          <div style={{ display: roomTab === 'settings' ? 'block' : 'none' }}>
            <RoomSettings 
              amHost={amHost} 
              guestUploads={guestUploads} 
              setGuestUploads={setGuestUploads} 
              globalVolume={globalVolume} 
              handleGlobalVolume={handleGlobalVolume} 
              socketRef={socketRef} 
            />
          </div>

          <div style={{ display: roomTab === 'orbit' ? 'block' : 'none' }}>
            <OrbitRadar 
              outLat={stateRef.current?.outLat} 
              runSonarCalibration={runSonarCalibration} 
              amHost={amHost} 
              orbitActive={orbitActive} 
              onToggleOrbit={() => socketRef.current.emit('set-orbit', {active: !orbitActive})}
              members={members} 
              currentUserId={socketRef.current?.id} 
              clockOff={stateRef.current?.clockOff || 0}
            />
          </div>

        </div>
      </div>

      {!amHost && (
        <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace", padding:'8px 12px', background:'var(--s2)', borderRadius:'8px', position:'fixed', bottom:'20px', left:'20px', zIndex:100}}>
          <div className={`sync-dot ${syncState.state}`} style={{width:'6px', height:'6px', borderRadius:'50%', background:'var(--green)'}}></div><span>{syncState.label}</span>
        </div>
      )}

      {modals.qr && (
        <div style={{position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div style={{background:'var(--s1)', border:'1px solid rgba(255,214,10,.35)', borderRadius:'22px', padding:'30px 24px', maxWidth:'320px', width:'100%', textAlign:'center'}}>
            <h3 style={{color:'#fff', marginBottom:'15px', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'2px', fontSize:'28px'}}>Scan to Join</h3>
            <div style={{background:'#ffffff', padding:'15px', borderRadius:'10px', display:'inline-block', marginBottom:'15px'}}>
              <QRCodeSVG value={`${window.location.origin}/?room=${roomCode}`} size={180} bgColor="#ffffff" fgColor="#000000" level="L" includeMargin={false} />
            </div>
            <p style={{color:'var(--sub)', fontSize:'13px', marginBottom:'20px'}}>Or use code: <strong style={{color:'var(--pink)', fontSize:'18px', letterSpacing:'2px'}}>{roomCode}</strong></p>
            <button className="btn-ghost" style={{width:'100%', padding:'15px', borderRadius:'12px', fontWeight:'600', cursor:'pointer'}} onClick={() => setModals({...modals, qr: false})}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}