import React, { useState, useRef, useEffect } from 'react';

export default function ChatBox({ chat, uname, onSendMessage }) {
  const [chatInput, setChatInput] = useState('');
  const chatBoxRef = useRef(null);

  // Auto-scroll to the bottom when a new message arrives
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chat]);

  const handleChat = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="card">
      <div className="card-label">Room Chat</div>
      <div className="chat-wrap" ref={chatBoxRef} style={{height:'300px', maxHeight:'none'}}>
        {chat.length === 0 ? (
          <div style={{color:'var(--sub)', fontSize:'13px', textAlign:'center', marginTop:'20px'}}>
            No messages yet
          </div>
        ) : (
          chat.map((c, i) => (
            <div key={i} style={{marginBottom:'8px'}}>
              <strong style={{color: c.name === uname ? 'var(--cyan)' : 'var(--pink)'}}>{c.name}: </strong>
              <span style={{color:'var(--text)'}}>{c.text}</span>
            </div>
          ))
        )}
      </div>
      <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
        <input 
          type="text" 
          value={chatInput} 
          onChange={e => setChatInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleChat()} 
          placeholder="Suggest a song..." 
          style={{flex:1, padding:'10px 14px', background:'var(--s2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', outline:'none'}} 
        />
        <button className="btn-cyan" style={{width:'auto', margin:0, padding:'0 20px'}} onClick={handleChat}>
          Send
        </button>
      </div>
    </div>
  );
}