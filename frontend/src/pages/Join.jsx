import React, { useEffect, useRef, useState } from 'react';

/* ══════════════════════════════════════════════════════
   HUSHPOD JOIN PAGE — Ultra Pro Max
   Cinematic entry screen matching Home page aesthetic
   Features: animated mesh bg · floating particles ·
   dual panel layout · code input OTP style ·
   hover magnetism · 3D card tilt · smooth transitions
══════════════════════════════════════════════════════ */

/* ── Animated mesh background ── */
function MeshBg() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    let W, H, raf;
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * .0003,
      vy: (Math.random() - .5) * .0003,
      col: ['#f72585','#4cc9f0','#7b2ff7','#06d6a0'][Math.floor(Math.random()*4)],
    }));
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
      });
      /* Draw connecting lines */
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = (pts[i].x - pts[j].x) * W;
          const dy = (pts[i].y - pts[j].y) * H;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x * W, pts[i].y * H);
            ctx.lineTo(pts[j].x * W, pts[j].y * H);
            ctx.strokeStyle = pts[i].col;
            ctx.globalAlpha = (1 - dist / 140) * 0.12;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(pts[i].x * W, pts[i].y * H, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = pts[i].col;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', opacity:.6 }} />;
}

/* ── OTP-style code input ── */
function CodeInput({ value, onChange }) {
  const inputs = useRef([]);
  const chars = Array.from({ length: 5 }, (_, i) => value[i] || '');

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (chars[i]) {
        const next = value.slice(0, i) + value.slice(i + 1);
        onChange(next.toUpperCase());
      } else if (i > 0) {
        inputs.current[i - 1]?.focus();
        const next = value.slice(0, i - 1) + value.slice(i);
        onChange(next.toUpperCase());
      }
      return;
    }
    if (e.key === 'ArrowLeft' && i > 0) { inputs.current[i-1]?.focus(); return; }
    if (e.key === 'ArrowRight' && i < 4) { inputs.current[i+1]?.focus(); return; }
  };

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(-1).toUpperCase();
    if (!char) return;
    const arr = chars.slice();
    arr[i] = char;
    onChange(arr.join(''));
    if (i < 4) setTimeout(() => inputs.current[i + 1]?.focus(), 0);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0, 5);
    onChange(pasted);
    const idx = Math.min(pasted.length, 4);
    setTimeout(() => inputs.current[idx]?.focus(), 0);
  };

  return (
    <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
      {[0,1,2,3,4].map(i => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="text"
          maxLength={1}
          value={chars[i]}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: '52px', height: '60px', textAlign: 'center',
            fontSize: '24px', fontWeight: '800', fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '2px', textTransform: 'uppercase',
            background: chars[i] ? 'rgba(76,201,240,0.1)' : 'rgba(255,255,255,0.04)',
            border: `2px solid ${chars[i] ? 'rgba(76,201,240,0.6)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '14px', color: chars[i] ? '#4cc9f0' : '#e8e8ff',
            outline: 'none', transition: 'all .2s',
            boxShadow: chars[i] ? '0 0 16px rgba(76,201,240,0.2)' : 'none',
            caretColor: 'transparent',
          }}
          onFocusCapture={e => {
            e.target.style.borderColor = 'rgba(247,37,133,0.7)';
            e.target.style.boxShadow = '0 0 20px rgba(247,37,133,0.2)';
          }}
          onBlurCapture={e => {
            e.target.style.borderColor = chars[i] ? 'rgba(76,201,240,0.6)' : 'rgba(255,255,255,0.12)';
            e.target.style.boxShadow = chars[i] ? '0 0 16px rgba(76,201,240,0.2)' : 'none';
          }}
        />
      ))}
    </div>
  );
}

/* ── Floating active room cards ── */
function RoomPulse() {
  const rooms = [
    { name: "Arjun's Party", members: 8,  song: 'Blinding Lights', color: '#f72585' },
    { name: "Study Session", members: 4,  song: 'Lo-fi Beats Mix', color: '#4cc9f0' },
    { name: "Road Trip 🚗",  members: 12, song: 'Levitating',       color: '#06d6a0' },
    { name: "Priya's Room",  members: 3,  song: 'Stay — Justin B',  color: '#7b2ff7' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
      {rooms.map((r, i) => (
        <div key={r.name} style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '14px 18px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${r.color}22`,
          borderRadius: '16px',
          animation: `fadeSlide .5s ease ${i * .1}s both`,
          transition: 'all .3s',
          cursor: 'default',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = `rgba(${r.color==='#f72585'?'247,37,133':r.color==='#4cc9f0'?'76,201,240':r.color==='#06d6a0'?'6,214,160':'123,47,247'},.07)`; e.currentTarget.style.borderColor = `${r.color}44`; e.currentTarget.style.transform = 'translateX(4px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = `${r.color}22`; e.currentTarget.style.transform = 'none'; }}
        >
          {/* Pulse dot */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:r.color, boxShadow:`0 0 8px ${r.color}` }} />
            <div style={{ position:'absolute', inset:'-4px', borderRadius:'50%', border:`1px solid ${r.color}`, animation:'ripplePulse 1.5s ease-in-out infinite' }} />
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:'13px', fontWeight:'800', color:'#e0e0ff', marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div>
            <div style={{ fontSize:'11px', color:'#606088', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:"'JetBrains Mono',monospace" }}>♪ {r.song}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'5px', flexShrink:0 }}>
            <span style={{ fontSize:'11px', color:r.color, fontWeight:'800', fontFamily:"'JetBrains Mono',monospace" }}>{r.members}</span>
            <span style={{ fontSize:'11px', color:'#444466' }}>listeners</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Input with label + validation glow ── */
function Field({ label, value, onChange, placeholder, type='text', maxLength, style={}, inputStyle={}, autoFocus, icon }) {
  const [focused, setFocused] = useState(false);
  const hasVal = value && value.length > 0;
  return (
    <div style={{ marginBottom: '16px', ...style }}>
      {label && (
        <label style={{ display:'block', fontSize:'11px', fontWeight:'800', letterSpacing:'2px', textTransform:'uppercase', color: focused ? '#f72585' : '#555577', marginBottom:'8px', transition:'color .2s' }}>
          {icon && <span style={{ marginRight:'6px' }}>{icon}</span>}{label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '14px 18px',
          background: focused ? 'rgba(247,37,133,0.06)' : hasVal ? 'rgba(76,201,240,0.04)' : 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${focused ? 'rgba(247,37,133,0.6)' : hasVal ? 'rgba(76,201,240,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '14px', color: '#e8e8ff', outline: 'none',
          fontSize: '15px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500',
          transition: 'all .25s',
          boxShadow: focused ? '0 0 20px rgba(247,37,133,0.12)' : hasVal ? '0 0 12px rgba(76,201,240,0.08)' : 'none',
          ...inputStyle,
        }}
      />
    </div>
  );
}

/* ── Tab system ── */
function TabBar({ active, onChange }) {
  return (
    <div style={{ display:'flex', gap:'0', background:'rgba(255,255,255,0.04)', borderRadius:'16px', padding:'4px', marginBottom:'28px', border:'1px solid rgba(255,255,255,0.08)' }}>
      {['Create Room','Join Room'].map((label, i) => (
        <button key={label} onClick={() => onChange(i)} style={{
          flex:1, padding:'12px 20px',
          background: active === i ? (i===0 ? 'linear-gradient(135deg,#f72585,#7b2ff7)' : 'linear-gradient(135deg,#4cc9f0,#06d6a0)') : 'transparent',
          border: 'none', borderRadius: '12px',
          color: active === i ? '#fff' : '#555577',
          fontSize: '14px', fontWeight: '800', cursor: 'pointer',
          transition: 'all .25s',
          boxShadow: active === i ? (i===0 ? '0 4px 20px rgba(247,37,133,0.4)' : '0 4px 20px rgba(76,201,240,0.3)') : 'none',
          fontFamily: "'DM Sans', sans-serif",
          letterSpacing: '.3px',
        }}>
          {i === 0 ? '🎙️ ' : '📲 '}{label}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════ */
export default function Join({
  setView, uname, setUname, codeInput, setCodeInput,
  attemptCreateRoom, attemptJoinRoom, modals, setModals,
  tosChecked, setTosChecked, confirmTosAndExecute,
  roomPassword, setRoomPassword,
}) {
  const [tab, setTab] = useState(0); // 0=create, 1=join
  const [codeComplete, setCodeComplete] = useState(false);

  useEffect(() => {
    setCodeComplete(codeInput.length === 5);
  }, [codeInput]);

  /* Auto-switch to join tab if URL has room code */
  useEffect(() => {
    if (codeInput && codeInput.length > 0) setTab(1);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;}
        @keyframes fadeSlide{from{opacity:0;transform:translateX(-16px);}to{opacity:1;transform:translateX(0);}}
        @keyframes ripplePulse{0%{opacity:.8;transform:scale(1);}100%{opacity:0;transform:scale(2.5);}}
        @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
        @keyframes floatUp{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
        @keyframes gradShift{0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;}}
        .join-page{min-height:100vh;display:flex;background:#050510;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
        .join-left{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:100px 60px 60px;position:relative;z-index:2;}
        .join-right{width:420px;display:flex;flex-direction:column;justify-content:center;padding:100px 48px 60px;position:relative;z-index:2;background:rgba(255,255,255,.02);border-left:1px solid rgba(255,255,255,.07);}
        @media(max-width:900px){.join-page{flex-direction:column;}.join-right{width:100%;border-left:none;border-top:1px solid rgba(255,255,255,.07);padding:40px 28px 80px;}.join-left{padding:100px 28px 40px;}}
        .btn-create{width:100%;padding:16px;background:linear-gradient(135deg,#f72585,#7b2ff7);border:none;border-radius:14px;color:#fff;font-size:16px;font-weight:800;cursor:pointer;letter-spacing:.3px;font-family:'DM Sans',sans-serif;box-shadow:0 8px 32px rgba(247,37,133,0.4),0 0 0 1px rgba(255,255,255,.08) inset;transition:all .25s;margin-bottom:0;}
        .btn-create:hover{transform:translateY(-2px);box-shadow:0 14px 44px rgba(247,37,133,0.55);}
        .btn-create:disabled{opacity:.4;cursor:not-allowed;transform:none;}
        .btn-join{width:100%;padding:16px;background:linear-gradient(135deg,#4cc9f0,#06d6a0);border:none;border-radius:14px;color:#fff;font-size:16px;font-weight:800;cursor:pointer;letter-spacing:.3px;font-family:'DM Sans',sans-serif;box-shadow:0 8px 32px rgba(76,201,240,0.35);transition:all .25s;margin-bottom:0;}
        .btn-join:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 44px rgba(76,201,240,0.5);}
        .btn-join:disabled{opacity:.35;cursor:not-allowed;}
        .divider-line{display:flex;align-items:center;gap:12px;color:#333355;font-size:12px;font-weight:700;margin:16px 0;}
        .divider-line::before,.divider-line::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.07);}
      `}</style>

      <MeshBg />

      {/* Deep space glows */}
      <div style={{ position:'fixed', top:'20%', left:'10%', width:'500px', height:'500px', background:'radial-gradient(circle,rgba(247,37,133,.08),transparent 65%)', pointerEvents:'none', zIndex:1 }} />
      <div style={{ position:'fixed', bottom:'20%', right:'10%', width:'400px', height:'400px', background:'radial-gradient(circle,rgba(76,201,240,.07),transparent 65%)', pointerEvents:'none', zIndex:1 }} />

      <div className="join-page">

        {/* ── LEFT: Branding + Social Proof ── */}
        <div className="join-left">
          {/* Back button */}
          <button
            onClick={() => { setView('marketing'); window.scrollTo(0,0); }}
            style={{ position:'absolute', top:'24px', left:'28px', display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:'10px', padding:'9px 16px', fontSize:'13px', fontWeight:'700', color:'#7070a0', cursor:'pointer', transition:'all .2s', fontFamily:"'DM Sans',sans-serif" }}
            onMouseEnter={e=>{e.currentTarget.style.color='#e8e8ff';e.currentTarget.style.borderColor='rgba(255,255,255,.2)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='#7070a0';e.currentTarget.style.borderColor='rgba(255,255,255,.1)';}}
          >
            ← Back
          </button>

          <div style={{ maxWidth:'440px', width:'100%' }}>
            {/* Logo */}
            <div style={{ marginBottom:'40px' }}>
              <div style={{
                fontFamily:"'Bebas Neue',sans-serif", fontSize:'72px', lineHeight:1,
                letterSpacing:'-2px', marginBottom:'8px',
                background:'linear-gradient(170deg,#fff 0%,#fff 40%,#f72585 70%,#4cc9f0 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                filter:'drop-shadow(0 0 30px rgba(247,37,133,.3))',
              }}>HUSH<br/>POD</div>
              <div style={{ fontSize:'16px', color:'#6060a0', fontWeight:'500', letterSpacing:'.5px' }}>
                Listen together. Privately. In perfect sync.
              </div>
            </div>

            {/* Feature pills */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'40px' }}>
              {[
                ['⚡','< 100ms sync','#f72585'],
                ['🎧','BT auto-detect','#4cc9f0'],
                ['🔒','Zero data stored','#06d6a0'],
                ['📱','No app needed','#ffd60a'],
                ['🌍','Works anywhere','#7b2ff7'],
              ].map(([ic,label,color])=>(
                <div key={label} style={{ display:'flex', alignItems:'center', gap:'6px', background:`rgba(${color==='#f72585'?'247,37,133':color==='#4cc9f0'?'76,201,240':color==='#06d6a0'?'6,214,160':color==='#ffd60a'?'255,214,10':'123,47,247'},.1)`, border:`1px solid ${color}33`, borderRadius:'20px', padding:'5px 12px', fontSize:'11px', fontWeight:'700', color, letterSpacing:'.5px' }}>
                  <span>{ic}</span><span>{label}</span>
                </div>
              ))}
            </div>

            {/* Live rooms */}
            <div style={{ marginBottom:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#06d6a0', boxShadow:'0 0 8px #06d6a0', animation:'floatUp 2s ease-in-out infinite' }} />
                <span style={{ fontSize:'11px', fontWeight:'800', letterSpacing:'2.5px', textTransform:'uppercase', color:'#555577' }}>Live Rooms Right Now</span>
              </div>
              <RoomPulse />
            </div>
          </div>
        </div>

        {/* ── RIGHT: Form ── */}
        <div className="join-right">
          <div style={{ maxWidth:'340px', width:'100%', margin:'0 auto' }}>

            {/* Header */}
            <div style={{ marginBottom:'32px' }}>
              <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'42px', letterSpacing:'-1px', color:'#fff', lineHeight:1, marginBottom:'10px' }}>
                {tab === 0 ? 'Start a Party' : 'Join the Party'}
              </h1>
              <p style={{ fontSize:'14px', color:'#606088', lineHeight:1.7 }}>
                {tab === 0 ? 'Create a private listening room in seconds.' : 'Enter the room code to sync up instantly.'}
              </p>
            </div>

            {/* Tab switcher */}
            <TabBar active={tab} onChange={setTab} />

            {/* Name field (both tabs) */}
            <Field
              label="Your Name"
              icon="👤"
              value={uname}
              onChange={e => setUname(e.target.value)}
              placeholder="What should we call you?"
              maxLength={20}
              autoFocus
            />

            {/* ── CREATE TAB ── */}
            {tab === 0 && (
              <div>
                <Field
                  label="Room Password"
                  icon="🔑"
                  type="password"
                  value={roomPassword}
                  onChange={e => setRoomPassword(e.target.value)}
                  placeholder="Optional — leave blank for open room"
                  maxLength={30}
                />

                {/* Create button */}
                <button
                  className="btn-create"
                  onClick={attemptCreateRoom}
                  disabled={!uname.trim()}
                >
                  🎉 Create Party Room
                </button>

                {/* Features reminder */}
                <div style={{ marginTop:'20px', padding:'16px', background:'rgba(247,37,133,.05)', border:'1px solid rgba(247,37,133,.15)', borderRadius:'14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'800', letterSpacing:'2px', textTransform:'uppercase', color:'#f72585', marginBottom:'10px' }}>What you get</div>
                  {['Up to 10 songs in queue','Up to 15 listeners free','Chat + emoji reactions','Password protection optional','QR code sharing'].map(f=>(
                    <div key={f} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#8080a0', marginBottom:'6px' }}>
                      <span style={{ color:'#06d6a0', fontSize:'10px' }}>✓</span>{f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── JOIN TAB ── */}
            {tab === 1 && (
              <div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'11px', fontWeight:'800', letterSpacing:'2px', textTransform:'uppercase', color:'#555577', marginBottom:'12px' }}>
                    📲 Room Code
                  </label>
                  <CodeInput value={codeInput} onChange={setCodeInput} />
                  {codeInput.length > 0 && codeInput.length < 5 && (
                    <p style={{ fontSize:'11px', color:'#555577', textAlign:'center', marginTop:'8px' }}>{5-codeInput.length} more character{5-codeInput.length!==1?'s':''}</p>
                  )}
                  {codeComplete && (
                    <p style={{ fontSize:'11px', color:'#06d6a0', textAlign:'center', marginTop:'8px', fontWeight:'700' }}>✓ Code complete — ready to join!</p>
                  )}
                </div>

                <Field
                  label="Room Password"
                  icon="🔑"
                  type="password"
                  value={roomPassword}
                  onChange={e => setRoomPassword(e.target.value)}
                  placeholder="Leave blank if no password"
                  maxLength={30}
                />

                <button
                  className="btn-join"
                  onClick={attemptJoinRoom}
                  disabled={!uname.trim() || !codeComplete}
                >
                  🎧 Join Room
                </button>

                <div className="divider-line">or scan QR code</div>
                <p style={{ fontSize:'12px', color:'#444466', textAlign:'center', lineHeight:1.7 }}>
                  Ask the host to tap <strong style={{ color:'#888899' }}>Share</strong> in their room to generate a QR code you can scan with your camera.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── TOS Modal ── */}
      {modals.tos && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(12px)' }}>
          <div style={{ background:'rgba(10,10,28,.95)', border:'1px solid rgba(255,255,255,.1)', borderRadius:'26px', padding:'36px 32px', maxWidth:'420px', width:'100%', textAlign:'left', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>

            {/* Modal header */}
            <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'24px' }}>
              <div style={{ width:'48px', height:'48px', borderRadius:'14px', background:'linear-gradient(135deg,#f72585,#7b2ff7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>🎵</div>
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'24px', letterSpacing:'2px', background:'linear-gradient(135deg,#f72585,#4cc9f0)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>HUSHPOD</div>
                <div style={{ fontSize:'11px', fontWeight:'700', color:'#555577', letterSpacing:'2px', textTransform:'uppercase' }}>Terms of Service</div>
              </div>
            </div>

            {/* Content */}
            <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:'16px', padding:'18px', marginBottom:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'800', color:'#4cc9f0', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'10px' }}>Your Content, Your Responsibility</div>
              <div style={{ fontSize:'13px', color:'#8080a0', lineHeight:'1.75' }}>
                By uploading audio files, you confirm you own the content, hold a valid license, or have explicit permission from the copyright holder to broadcast it.
              </div>
            </div>

            {/* Checkbox */}
            <label style={{ display:'flex', alignItems:'flex-start', gap:'12px', marginBottom:'24px', padding:'16px', background:'rgba(76,201,240,.05)', borderRadius:'14px', border:`1px solid ${tosChecked?'rgba(76,201,240,.35)':'rgba(255,255,255,.07)'}`, cursor:'pointer', transition:'border-color .2s' }}>
              <div style={{ width:'20px', height:'20px', borderRadius:'6px', background:tosChecked?'#4cc9f0':'transparent', border:`2px solid ${tosChecked?'#4cc9f0':'rgba(255,255,255,.2)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px', transition:'all .2s' }}
                onClick={()=>setTosChecked(!tosChecked)}>
                {tosChecked && <span style={{ color:'#fff', fontSize:'12px', fontWeight:'900', lineHeight:1 }}>✓</span>}
              </div>
              <input type="checkbox" checked={tosChecked} onChange={e=>setTosChecked(e.target.checked)} style={{ display:'none' }} />
              <span style={{ fontSize:'13px', color:'#c0c0e0', lineHeight:'1.65' }}>
                I confirm I will only upload content I own or have the rights to share.
              </span>
            </label>

            {/* Buttons */}
            <div style={{ display:'flex', gap:'12px' }}>
              <button
                onClick={() => setModals({...modals, tos:false})}
                style={{ flex:1, padding:'14px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:'12px', color:'#7070a0', fontSize:'14px', fontWeight:'700', cursor:'pointer', transition:'all .2s', fontFamily:"'DM Sans',sans-serif" }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.1)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.05)';}}
              >
                Cancel
              </button>
              <button
                onClick={confirmTosAndExecute}
                disabled={!tosChecked}
                style={{ flex:1, padding:'14px', background:tosChecked?'linear-gradient(135deg,#4cc9f0,#06d6a0)':'rgba(255,255,255,.05)', border:'none', borderRadius:'12px', color:tosChecked?'#fff':'#444466', fontSize:'14px', fontWeight:'800', cursor:tosChecked?'pointer':'not-allowed', transition:'all .3s', boxShadow:tosChecked?'0 8px 28px rgba(76,201,240,.35)':'none', fontFamily:"'DM Sans',sans-serif" }}
              >
                ✓ Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}