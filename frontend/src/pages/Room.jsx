import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import DJDesk from '../components/DJDesk';
import ListenerList from '../components/ListenerList';
import ChatBox from '../components/ChatBox';
import RoomSettings from '../components/RoomSettings';
import LabsTab from '../components/LabsTab';
import ErrorBoundary from '../components/ErrorBoundary';

// POLISH: Marquee component — scrolls only when text overflows
function MarqueeSongName({ name }) {
  const wrapRef  = useRef(null);
  const innerRef = useRef(null);
  const [scrolling, setScrolling] = useState(false);
  const [dist, setDist]           = useState(0);

  useEffect(() => {
    const wrap  = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const overflow = inner.scrollWidth - wrap.clientWidth;
    if (overflow > 10) {
      setScrolling(true);
      setDist(overflow);
    } else {
      setScrolling(false);
    }
  }, [name]);

  return (
    <div ref={wrapRef} className="marquee-wrap" style={{ fontSize: '20px', fontWeight: '700', marginBottom: '3px' }}>
      <span
        ref={innerRef}
        className={`marquee-inner ${scrolling ? 'scrolling' : ''}`}
        style={{ '--scroll-dist': scrolling ? `-${dist}px` : '0' }}
      >
        {name}
      </span>
    </div>
  );
}

const TABS = [
  { id: 'dj',       icon: '🎛️',  label: 'DJ',       color: 'var(--cyan)' },
  { id: 'members',  icon: '👥',  label: 'Listeners', color: 'var(--text)' },
  { id: 'chat',     icon: '💬',  label: 'Chat',      color: 'var(--text)' },
  { id: 'settings', icon: '⚙️',  label: 'Settings',  color: 'var(--text)' },
  { id: 'orbit',    icon: '🧪',  label: 'Labs',      color: 'var(--pink)' },
];

export default function Room({
  roomTitle, roomCode, modals, setModals, socketRef, roomTab, setRoomTab, amHost,
  guestUploads, setGuestUploads, uploadSongs, uploadProgress, currentSong, isPlaying,
  trackReady, progFillRef, tCurRef, audioBufferRef, fmt, seekClick, isShuffle, setIsShuffle,
  handleSeek, stateRef, actxRef, togglePlay, loopMode, toggleLoopMode, queue, setQueue,
  draggedIdx, setDraggedIdx, handleDrop, members, chat, uname, globalVolume,
  handleGlobalVolume, localVolume, handleLocalVolume, orbitActive, runSonarCalibration,
  syncState, playNext, playPrev, musicalChairActive, toggleMusicalChairs,
  typingUsers, reactions, sendReaction, sendTyping,
  toggleTheme, theme, playHistory, isOnline,
}) {
  const [copied, setCopied] = useState(false);
  const joinLink = `${window.location.origin}/?room=${roomCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div id="room" className="scr on" style={{ display: 'flex' }}>

        {/* ── HEADER ── */}
        <div className="rhead">
          <div className="rhead-left">
            <div className="rname">{roomTitle}</div>
            <div className="rcode">Code: <strong style={{ color: 'var(--pink)', letterSpacing: '2px' }}>{roomCode}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* POLISH: theme toggle */}
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setModals({ ...modals, qr: true })}>Share</button>
            <button className="btn-red btn-sm" onClick={() => {
              sessionStorage.removeItem('hushpod_session');
              if (socketRef.current) socketRef.current.disconnect();
              window.location.href = '/';
            }}>Leave</button>
          </div>
        </div>

        <div className="rbody">

          {/* ── INLINE TAB BAR (desktop) — hidden on mobile via CSS ── */}
          <div className="room-tabs-inline" style={{ gap: '6px', marginBottom: '10px', background: 'var(--s1)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setRoomTab(t.id)} style={{
                flex: 1, padding: '10px 8px',
                background: roomTab === t.id ? 'var(--s2)' : 'transparent',
                color: roomTab === t.id ? t.color : 'var(--sub)',
                border: 'none', borderRadius: '8px', fontWeight: '600',
                cursor: 'pointer', fontSize: '13px', transition: 'all .2s',
              }}>
                {t.label} {t.id === 'orbit' ? '🧪' : ''}
              </button>
            ))}
          </div>

          {/* ── TAB CONTENT ── */}
          <div style={{ display: roomTab === 'dj' ? 'block' : 'none' }}>
            <ErrorBoundary name="DJ Desk">
              <DJDesk
                setRoomTab={setRoomTab} amHost={amHost} guestUploads={guestUploads}
                currentSong={currentSong} uploadSongs={uploadSongs} uploadProgress={uploadProgress}
                isPlaying={isPlaying} trackReady={trackReady} progFillRef={progFillRef}
                tCurRef={tCurRef} audioBufferRef={audioBufferRef} fmt={fmt} seekClick={seekClick}
                isShuffle={isShuffle} setIsShuffle={setIsShuffle} handleSeek={handleSeek}
                stateRef={stateRef} actxRef={actxRef} togglePlay={togglePlay}
                loopMode={loopMode} toggleLoopMode={toggleLoopMode} queue={queue}
                setQueue={setQueue} draggedIdx={draggedIdx} setDraggedIdx={setDraggedIdx}
                handleDrop={handleDrop} socketRef={socketRef} playNext={playNext} playPrev={playPrev}
                MarqueeSongName={MarqueeSongName} playHistory={playHistory} isOnline={isOnline}
              />
            </ErrorBoundary>
          </div>

          <div style={{ display: roomTab === 'members' ? 'block' : 'none' }}>
            <ErrorBoundary name="Listener List">
              <ListenerList
                members={members}
                currentUserId={socketRef.current?.id}
                amHost={amHost}
                admins={stateRef.current?.admins || []}
                onMakeAdmin={(id) => socketRef.current.emit('make-admin', { targetId: id })}
                onRemoveAdmin={(id) => socketRef.current.emit('remove-admin', { targetId: id })}
                onTransferHost={(id) => socketRef.current.emit('transfer-host', { targetId: id })}
              />
            </ErrorBoundary>
          </div>

          <div style={{ display: roomTab === 'chat' ? 'block' : 'none' }}>
            <ErrorBoundary name="Chat">
              <ChatBox
                chat={chat}
                uname={uname}
                amHost={amHost}
                typingUsers={typingUsers}
                reactions={reactions}
                onSendMessage={(text) => socketRef.current.emit('chat-msg', { roomCode, code: roomCode, name: uname, text })}
                onTyping={sendTyping}
                onReact={sendReaction}
              />
            </ErrorBoundary>
          </div>

          <div style={{ display: roomTab === 'settings' ? 'block' : 'none' }}>
            <ErrorBoundary name="Settings">
              <RoomSettings
                amHost={amHost}
                guestUploads={guestUploads}
                setGuestUploads={setGuestUploads}
                globalVolume={globalVolume}
                handleGlobalVolume={handleGlobalVolume}
                localVolume={localVolume}
                handleLocalVolume={handleLocalVolume}
                socketRef={socketRef}
              />
            </ErrorBoundary>
          </div>

          <div style={{ display: roomTab === 'orbit' ? 'block' : 'none' }}>
            <ErrorBoundary name="Labs">
              <LabsTab engine={{
                amHost, queue, currentSong, isPlaying, musicalChairActive,
                toggleMusicalChairs, playNext, playPrev, togglePlay,
                stateRef, runSonarCalibration, orbitActive, members, socketRef,
              }} />
            </ErrorBoundary>
          </div>

        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR — hidden on desktop via CSS ── */}
      <nav className="room-tabs-bottom">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn-bottom ${roomTab === t.id ? 'active' : ''} ${t.id === 'orbit' ? 'pink' : ''}`}
            onClick={() => setRoomTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ── SYNC STATUS (guests only) ── */}
      {!amHost && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--sub)', fontFamily: "'JetBrains Mono',monospace", padding: '8px 12px', background: 'var(--s2)', borderRadius: '8px', position: 'fixed', bottom: '70px', left: '16px', zIndex: 100, border: '1px solid var(--border)' }}>
          <div className={`sync-dot ${syncState.state}`}></div>
          <span>{syncState.label}</span>
        </div>
      )}

      {/* ── QR / SHARE MODAL ── */}
      {modals.qr && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(255,214,10,.35)', borderRadius: '22px', padding: '30px 24px', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px', fontSize: '28px' }}>Scan to Join</h3>
            <div style={{ background: '#ffffff', padding: '15px', borderRadius: '10px', display: 'inline-block', marginBottom: '15px' }}>
              <QRCodeSVG value={joinLink} size={180} bgColor="#ffffff" fgColor="#000000" level="L" includeMargin={false} />
            </div>
            <p style={{ color: 'var(--sub)', fontSize: '13px', marginBottom: '12px' }}>
              Or use code: <strong style={{ color: 'var(--pink)', fontSize: '18px', letterSpacing: '2px' }}>{roomCode}</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--s2)', padding: '6px 8px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <input type="text" readOnly value={joinLink} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--sub)', fontSize: '11px', outline: 'none', textOverflow: 'ellipsis' }} />
              <button className="btn-cyan" style={{ width: 'auto', margin: 0, padding: '8px 14px', fontSize: '11px', borderRadius: '8px' }} onClick={handleCopyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button className="btn-ghost" style={{ width: '100%', padding: '15px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }} onClick={() => setModals({ ...modals, qr: false })}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}