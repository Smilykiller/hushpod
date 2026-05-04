import React, { useState, useRef, useEffect } from 'react';

const REACTION_EMOJIS = ['🔥', '❤️', '🎵', '🎉', '😂', '👏'];

export default function ChatBox({ chat, uname, onSendMessage, onTyping, typingUsers, reactions, onReact }) {
  const [chatInput, setChatInput] = useState('');
  const chatBoxRef  = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [chat]);

  const handleChat = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleInputChange = (e) => {
    setChatInput(e.target.value);
    if (onTyping) {
      clearTimeout(typingTimer.current);
      onTyping();
    }
  };

  const othersTyping = (typingUsers || []).filter(n => n !== uname);

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="card-label">Room Chat</div>

      {/* Floating emoji reactions */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
        {(reactions || []).map(r => (
          <div key={r.id} style={{
            position: 'absolute', bottom: '60px',
            left: r.leftPct + '%',
            fontSize: '28px',
            animation: 'floatUp 3s ease-out forwards',
            pointerEvents: 'none',
          }}>{r.emoji}</div>
        ))}
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          70%  { opacity: 1; transform: translateY(-120px) scale(1.3); }
          100% { opacity: 0; transform: translateY(-180px) scale(0.8); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>

      {/* Emoji reaction bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', justifyContent: 'center' }}>
        {REACTION_EMOJIS.map(emoji => (
          <button key={emoji} onClick={() => onReact && onReact(emoji)}
            style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', fontSize: '18px', cursor: 'pointer', transition: 'transform 0.1s' }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >{emoji}</button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-wrap" ref={chatBoxRef} style={{ height: '240px', maxHeight: 'none' }}>
        {chat.length === 0 ? (
          <div style={{ color: 'var(--sub)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>No messages yet — say hi! 👋</div>
        ) : (
          chat.map((c, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <strong style={{ color: c.name === uname ? 'var(--cyan)' : 'var(--pink)' }}>{c.name}: </strong>
              <span style={{ color: 'var(--text)' }}>{c.text}</span>
            </div>
          ))
        )}
      </div>

      {/* Typing indicator */}
      <div style={{ height: '18px', marginBottom: '6px' }}>
        {othersTyping.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--sub)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
              {[0,1,2].map(i => <span key={i} style={{ width:'4px', height:'4px', borderRadius:'50%', background:'var(--sub)', animation:`typingDot 1.2s ${i*0.2}s infinite`, display:'inline-block' }} />)}
            </span>
            {othersTyping.slice(0, 2).join(', ')}{othersTyping.length > 2 ? ` +${othersTyping.length - 2}` : ''} typing...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input type="text" value={chatInput} onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && handleChat()}
          placeholder="Suggest a song..."
          style={{ flex: 1, padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }}
        />
        <button className="btn-cyan" style={{ width: 'auto', margin: 0, padding: '0 20px' }} onClick={handleChat}>Send</button>
      </div>
    </div>
  );
}