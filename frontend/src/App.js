import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

const SERVER = window.location.port === '3000' ? `http://${window.location.hostname}:5000` : window.location.origin;

function App() {
  const [view, setView] = useState('marketing'); 
  const [toastData, setToastData] = useState({ msg: '', type: 'inf', visible: false });
  const [modals, setModals] = useState({ qr: false, tos: false });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roomTab, setRoomTab] = useState('dj'); 

  const [uname, setUname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [members, setMembers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentSong, setCurrentSong] = useState(null);
  const [syncState, setSyncState] = useState({ state: 'syncing', label: 'Waiting for host...' });
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [admins, setAdmins] = useState([]);
  const [guestUploads, setGuestUploads] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const [tosChecked, setTosChecked] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const socketRef = useRef(null);
  const actxRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  
  // FIX 1 & 4: State updates for Shuffle Fix and Chat Popups
  const stateRef = useRef({ clockOff: 0, songOffset: 0, nodeStartTime: 0, localPlayState: false, amAdmin: false, amHost: false, queue: [], loop: false, shuffle: false, currentSongId: null, uname: '' });
  
  const progFillRef = useRef(null);
  const tCurRef = useRef(null);
  const chatBoxRef = useRef(null);
  const vizRafRef = useRef(null);
  const toastTmr = useRef(null);

  const toast = (msg, type = 'inf') => {
    setToastData({ msg, type, visible: true });
    clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToastData(t => ({ ...t, visible: false })), 3000);
  };

  const amAdmin = socketRef.current && admins.includes(socketRef.current.id);
  const amHost = socketRef.current && admins[0] === socketRef.current.id;

  useEffect(() => {
    stateRef.current.queue = queue;
    stateRef.current.loop = isLooping;
    stateRef.current.shuffle = isShuffle;
    stateRef.current.currentSongId = currentSong?.id;
    stateRef.current.uname = uname;
    stateRef.current.amHost = amHost;
  }, [queue, isLooping, isShuffle, currentSong, uname, amHost]);

  // FIX 2: PAGE REFRESH AUTO-RECONNECT
  useEffect(() => {
    const session = sessionStorage.getItem('hushpod_session');
    if (session) {
      const { code, name } = JSON.parse(session);
      setUname(name); setCodeInput(code);
      
      initSystem().then(() => {
        socketRef.current.emit('join-room', { code, name, claimHost: false }, (res) => {
          if (res.error) { sessionStorage.removeItem('hushpod_session'); return; }
          setRoomCode(code); setMembers(res.members); setQueue(res.queue);
          setAdmins(res.admins); setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume);
          stateRef.current.amAdmin = res.admins.includes(socketRef.current.id);
          
          const hostUser = res.members.find(m => m.isHost);
          document.title = `HushPod | ${hostUser ? hostUser.name : 'Room'}'s Party`;

          if(res.currentSong) {
            setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
            guestLoadAndSync(SERVER + res.currentSong.streamUrl, res.playState, true);
          }
          setRoomTab('dj'); setView('room');
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setCodeInput(roomFromUrl.toUpperCase());
      setView('app-entry');
      toast(`Scanned! Enter your name to join room ${roomFromUrl.toUpperCase()}`, 'ok');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let animId;
    const c = document.getElementById('bgc');
    if (!c) return; 
    const cx = c.getContext('2d');
    let W, H;
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 2000, r: Math.random() * 1.5 + .5,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      col: ['#f72585', '#4cc9f0', '#06d6a0'][Math.floor(Math.random() * 3)],
      a: Math.random() * .4 + .1
    }));
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    function draw() {
      cx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fillStyle = p.col; cx.globalAlpha = p.a; cx.fill();
      });
      cx.globalAlpha = 1; animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, [view]);

  useEffect(() => {
    if (view !== 'marketing') return;
    const handleScroll = () => {
      const nav = document.querySelector('nav');
      if (!nav) return;
      if (window.scrollY > 60) {
        nav.style.background = 'rgba(6,6,15,0.95)';
        nav.style.borderBottomColor = 'rgba(255,255,255,0.1)';
      } else {
        nav.style.background = 'rgba(6,6,15,0.7)';
        nav.style.borderBottomColor = 'var(--border)';
      }
    };
    window.addEventListener('scroll', handleScroll);

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
    }, { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const counterEl = document.getElementById('counter-rooms');
    let counterInterval, fluctuateInterval;
    if (counterEl) {
      let val = 0; let target = Math.floor(Math.random() * 8) + 3;
      counterInterval = setInterval(() => {
        val++; counterEl.textContent = val;
        if (val >= target) clearInterval(counterInterval);
      }, 120);
      fluctuateInterval = setInterval(() => {
        const delta = (Math.random() > .5 ? 1 : -1);
        target = Math.max(1, target + delta);
        counterEl.textContent = target;
      }, 7000);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      clearInterval(counterInterval);
      clearInterval(fluctuateInterval);
    };
  }, [view]);

  const navToApp = (e) => {
    e.preventDefault();
    setView('app-entry');
    window.scrollTo(0,0);
  };

  const initSystem = async () => {
    if (!actxRef.current) {
      actxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = actxRef.current.createGain();
      analyserRef.current = actxRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      
      // Reverted Audio Routing
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(actxRef.current.destination);
    }
    if (actxRef.current.state === 'suspended') actxRef.current.resume();

    const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    const bgKeepAlive = new Audio(silentWav);
    bgKeepAlive.loop = true; bgKeepAlive.play().catch(() => {});

    await syncClock();
    if (!socketRef.current) {
      socketRef.current = io(SERVER, { transports: ['websocket', 'polling'] });
      setupSocketListeners(socketRef.current);
    }
  };

  const syncClock = async () => {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      try {
        const t1 = performance.now();
        const r = await fetch(SERVER + '/clocksync', { cache: 'no-store' });
        const t4 = performance.now();
        const { t } = await r.json();
        const rtt = t4 - t1;
        if (rtt < 150) samples.push({ offset: t + rtt / 2 - Date.now(), rtt });
      } catch {}
      await new Promise(r => setTimeout(r, 40));
    }
    if (samples.length) {
      samples.sort((a, b) => a.rtt - b.rtt);
      const offs = samples.slice(0, 3).map(s => s.offset).sort((a, b) => a - b);
      stateRef.current.clockOff = offs[Math.floor(offs.length / 2)];
    }
  };

  const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  const sNow = () => Date.now() + stateRef.current.clockOff;

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current.disconnect(); sourceNodeRef.current = null;
    }
    stateRef.current.localPlayState = false; setIsPlaying(false);
    cancelAnimationFrame(vizRafRef.current);
  };

  const playAudioAt = (songTime, actxTime) => {
    stopAudio(); if (!audioBufferRef.current) return;
    sourceNodeRef.current = actxRef.current.createBufferSource();
    sourceNodeRef.current.buffer = audioBufferRef.current;
    
    sourceNodeRef.current.connect(analyserRef.current);

    sourceNodeRef.current.onended = () => {
      const s = stateRef.current;
      if (s.localPlayState && actxRef.current.currentTime >= s.nodeStartTime + audioBufferRef.current.duration - s.songOffset - 0.1) {
        // FIX 1: ONLY the Host triggers the next song. This solves the Shuffle mismatch issue when admins change!
        if (s.amHost) {
          const q = s.queue;
          if (q.length > 0) {
            if (s.loop) {
              socketRef.current.emit('play-song', { songId: s.currentSongId, autoPlay: true });
            } else if (s.shuffle) {
              const randomSong = q[Math.floor(Math.random() * q.length)];
              socketRef.current.emit('play-song', { songId: randomSong.id, autoPlay: true });
            } else {
              const idx = q.findIndex(x => x.id === s.currentSongId);
              if (idx !== -1 && idx < q.length - 1) socketRef.current.emit('play-song', { songId: q[idx + 1].id, autoPlay: true });
              else { socketRef.current.emit('song-ended', {}); setCurrentSong(null); }
            }
          } else { socketRef.current.emit('song-ended', {}); setCurrentSong(null); }
        }
      }
    };

    sourceNodeRef.current.start(actxTime, songTime);
    stateRef.current.songOffset = songTime; stateRef.current.nodeStartTime = actxTime;
    stateRef.current.localPlayState = true; setIsPlaying(true); drawVisualizer();
  };

  const guestLoadAndSync = async (url, playState, isNewJoiner = false) => {
    stopAudio(); audioBufferRef.current = null;
    if (!stateRef.current.amAdmin) setSyncState({ state: 'syncing', label: 'Downloading track...' });
    
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      audioBufferRef.current = await actxRef.current.decodeAudioData(arrayBuffer);
      applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
    } catch(e) { if (!stateRef.current.amAdmin) setSyncState({ state: 'fixing', label: 'Error loading track' }); }
  };

  const applyPlayState = (playing, currentTime, ts, isNewJoiner = false) => {
    if (!audioBufferRef.current) return;
    const elapsed = (Date.now() + stateRef.current.clockOff - ts) / 1000;
    
    if (!playing) { 
      stopAudio(); stateRef.current.songOffset = currentTime; 
      if(!stateRef.current.amAdmin) setSyncState({ state: 'synced', label: 'Paused' });
      return; 
    }
    
    let expectedOffset = currentTime + elapsed;
    let startTime = actxRef.current.currentTime + 0.05;

    if (expectedOffset < 0) { startTime = actxRef.current.currentTime + Math.abs(expectedOffset); expectedOffset = 0; }
    
    if (isNewJoiner && !stateRef.current.amAdmin && expectedOffset > 0) {
        const delay = 3.0; expectedOffset += delay; startTime = actxRef.current.currentTime + delay; 
        setSyncState({ state: 'syncing', label: 'Locking sync... playing in 3s' });
        setTimeout(() => { if(stateRef.current.localPlayState) setSyncState({ state: 'synced', label: 'Locked Sync' }); }, delay * 1000);
    } else {
        if(!stateRef.current.amAdmin) setSyncState({ state: 'synced', label: 'Locked Sync' });
    }

    if (expectedOffset >= audioBufferRef.current.duration) { stopAudio(); return; }
    playAudioAt(expectedOffset, startTime);
  };

  const handleSeek = (newTime) => {
    if (!amAdmin || !audioBufferRef.current) return;
    socketRef.current.emit('playstate', { playing: stateRef.current.localPlayState, currentTime: newTime, ts: sNow() });
    applyPlayState(stateRef.current.localPlayState, newTime, sNow(), false);
  };

  const drawVisualizer = () => {
    if (!stateRef.current.localPlayState || !analyserRef.current) return;
    vizRafRef.current = requestAnimationFrame(drawVisualizer);
    
    const cvs = document.getElementById('viz-canvas');
    if(!cvs) return; const ctx = cvs.getContext('2d'); if(!ctx) return;
    
    const W = cvs.width = cvs.offsetWidth; const H = cvs.height = cvs.offsetHeight;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data); ctx.clearRect(0, 0, W, H);
    
    const style = getComputedStyle(document.body);
    const pColor = style.getPropertyValue('--cyan').trim() || '#4cc9f0';
    
    const bw = (W / data.length) * 2.5; let x = 0;
    for(let i=0; i<data.length; i++) {
      const bh = (data[i] / 255) * H;
      ctx.fillStyle = pColor; ctx.fillRect(x, H - bh, bw, bh); x += bw + 1;
    }
    
    let currentPos = Math.max(0, Math.min(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime), audioBufferRef.current?.duration || 1));
    if (progFillRef.current) progFillRef.current.style.width = (currentPos / (audioBufferRef.current?.duration || 1) * 100) + '%';
    if (tCurRef.current) tCurRef.current.textContent = fmt(currentPos);
  };

  const setupSocketListeners = (sock) => {
    sock.on('song-changed', ({ songId, name, streamUrl, playState }) => {
      setCurrentSong({ id: songId, name, duration: 0 });
      document.title = `HushPod | ${name}`;
      guestLoadAndSync(SERVER + streamUrl, playState, !stateRef.current.amAdmin);
    });

    sock.on('play-scheduled', ({ currentTime, targetTs }) => {
      if(!stateRef.current.amAdmin) setSyncState({ state: 'syncing', label: 'Readying...' });
      applyPlayState(true, currentTime, targetTs, false);
    });

    sock.on('playstate', ({ playing, currentTime, ts }) => { 
      if(!stateRef.current.amAdmin) applyPlayState(playing, currentTime, ts, false); 
    });

    sock.on('queue-updated', ({ queue }) => setQueue(queue));
    
    sock.on('chat-msg', ({ name, text }) => { 
      setChat(prev => [...prev, { name, text }]); 
      // FIX 4: CHAT POPUP TOAST
      if (name !== stateRef.current.uname) {
        toast(`💬 ${name}: ${text}`, 'inf');
      }
      setTimeout(() => { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, 10); 
    });
    
    sock.on('settings-updated', (s) => {
      setAdmins(s.admins); setGuestUploads(s.guestUploads); 
      setGlobalVolume(s.globalVolume);
      if (gainNodeRef.current && actxRef.current) gainNodeRef.current.gain.setValueAtTime(s.globalVolume, actxRef.current.currentTime);
      stateRef.current.amAdmin = s.admins.includes(sock.id);
    });

    sock.on('member-joined', ({ members }) => { setMembers(members); });
    sock.on('member-left', ({ members }) => { setMembers(members); });
    sock.on('host-left', () => { 
      sessionStorage.removeItem('hushpod_session');
      toast('Host ended the room', 'err'); 
      setTimeout(() => window.location.reload(), 2000); 
    });
  };

  const attemptCreateRoom = () => {
    if (!uname.trim()) return toast('Enter your name first', 'err');
    setPendingAction('create');
    setTosChecked(false);
    setModals({ ...modals, tos: true });
  };

  const attemptJoinRoom = () => {
    if (!uname.trim() || codeInput.length < 3) return toast('Enter name and code', 'err');
    setPendingAction('join');
    setTosChecked(false);
    setModals({ ...modals, tos: true });
  };

  const confirmTosAndExecute = async () => {
    if (!tosChecked) return;
    setModals({ ...modals, tos: false });
    
    if (pendingAction === 'create') {
      await initSystem();
      socketRef.current.emit('create-room', { name: uname }, (res) => {
        setRoomCode(res.code); setAdmins([socketRef.current.id]); stateRef.current.amAdmin = true;
        
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: res.code, name: uname }));

        setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
        document.title = `HushPod | ${uname}'s Party`;
        setInterval(() => {
          const s = stateRef.current;
          if(s.localPlayState && socketRef.current && s.amAdmin) socketRef.current.emit('heartbeat', { currentTime: Math.max(0, s.songOffset + (actxRef.current.currentTime - s.nodeStartTime)) });
        }, 1000);
      });
    } 
    else if (pendingAction === 'join') {
      await initSystem();
      socketRef.current.emit('join-room', { code: codeInput, name: uname, claimHost: false }, (res) => {
        if (res.error) return toast(res.error, 'err');
        
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: codeInput, name: uname }));

        setRoomCode(codeInput); setMembers(res.members); setQueue(res.queue);
        setAdmins(res.admins); setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume);
        stateRef.current.amAdmin = res.admins.includes(socketRef.current.id);
        
        const hostUser = res.members.find(m => m.isHost);
        document.title = `HushPod | ${hostUser ? hostUser.name : 'Room'}'s Party`;

        if(res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          guestLoadAndSync(SERVER + res.currentSong.streamUrl, res.playState, true);
        }
        setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
      });
    }
  };

  const togglePlay = () => {
    if (!amAdmin) return;
    const s = stateRef.current;
    let cur = s.localPlayState ? s.songOffset + (actxRef.current.currentTime - s.nodeStartTime) : s.songOffset;
    if (!s.localPlayState) { socketRef.current.emit('schedule-play', { currentTime: cur }); }
    else { socketRef.current.emit('playstate', { playing: false, currentTime: cur, ts: sNow() }); applyPlayState(false, cur, sNow(), false); }
  };

  const seekClick = (e) => {
    if (!amAdmin || !audioBufferRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - r.left) / r.width;
    const t = Math.max(0, Math.min(audioBufferRef.current.duration, percent * audioBufferRef.current.duration));
    handleSeek(t);
  };

  const uploadSongs = (files) => {
    if (!files || files.length === 0) return;
    if (!amAdmin && !guestUploads) return toast('Host has locked uploads', 'err');
    
    let filesToUpload = Array.from(files);
    if (filesToUpload.length > 10) {
      toast('Max 10 files allowed. Slicing list.', 'inf');
      filesToUpload = filesToUpload.slice(0, 10);
    }

    setUploadProgress(1); const fd = new FormData();
    for (let i = 0; i < filesToUpload.length; i++) fd.append('songs', filesToUpload[i]);
    fd.append('uploaderId', socketRef.current.id);
    
    const xhr = new XMLHttpRequest(); xhr.open('POST', SERVER + '/upload/' + roomCode);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => { 
      setUploadProgress(0); 
      if (xhr.status !== 200) toast('Upload failed', 'err'); 
      const fileInput = document.getElementById('q-file');
      if (fileInput) fileInput.value = "";
    };
    xhr.send(fd);
  };

  const handleGlobalVolume = (e) => {
    if(!amAdmin) return;
    const val = parseFloat(e.target.value);
    setGlobalVolume(val);
    socketRef.current.emit('set-global-volume', { volume: val });
    if (gainNodeRef.current && actxRef.current) gainNodeRef.current.gain.setValueAtTime(val, actxRef.current.currentTime);
  };

  const handleChat = () => { if (!chatInput.trim()) return; socketRef.current.emit('chat-msg', { text: chatInput.trim() }); setChatInput(''); };
  
  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newQ = [...queue];
    const [moved] = newQ.splice(draggedIdx, 1);
    newQ.splice(index, 0, moved);
    setQueue(newQ);
    socketRef.current.emit('reorder-queue', { newOrder: newQ.map(q => q.id) });
    setDraggedIdx(null);
  };

  const hostUser = members.find(m => m.isHost);
  const roomTitle = hostUser ? `${hostUser.name}'s Party` : 'ROOM';

  return (
    <>
      <canvas id="bgc"></canvas>
      <div className={`toast ${toastData.visible ? 'on' : ''} ${toastData.type}`}>{toastData.msg}</div>

      {view === 'marketing' && (
        <div className="scr on" id="landing" style={{display:'block'}}>
          <nav>
            <a href="#marketing" className="nav-logo" onClick={e => {e.preventDefault(); window.scrollTo(0,0);}}>HUSHPOD</a>
            <div className="nav-links">
              <a href="#how" onClick={e => {e.preventDefault(); document.getElementById('how').scrollIntoView();}}>How it works</a>
              <a href="#features" onClick={e => {e.preventDefault(); document.getElementById('features').scrollIntoView();}}>Features</a>
              <a href="#usecases" onClick={e => {e.preventDefault(); document.getElementById('usecases').scrollIntoView();}}>Use Cases</a>
            </div>
            <a href="#app" className="nav-cta" onClick={(e) => { e.preventDefault(); setView('app-entry'); window.scrollTo(0,0); }}>Start Listening Free →</a>
          </nav>

          <div className="wrap">
            <section className="hero">
              <div className="hero-eyebrow"><span></span> Live · Synchronized · Private</div>
              <h1 className="hero-title"><span className="line1">HEAR</span><span className="line2">TOGETHER</span></h1>
              <p className="hero-sub">Real-time synchronized audio for groups.<br/><strong>No app. No account. No lag.</strong></p>
              <div className="hero-btns">
                <button className="btn-hero-primary" onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>🎉 Create a Room Free</button>
              </div>
            </section>
          </div>
        </div>
      )}

      {view === 'app-entry' && (
        <div className="scr on" id="app-entry" style={{alignItems:'center', justifyContent:'center', padding:'40px 20px', textAlign:'center', flex:1}}>
          <div style={{width:'100%', maxWidth:'340px', margin:'0 auto 20px auto', textAlign:'left'}}>
            <button className="btn-ghost" style={{padding:'8px 16px', borderRadius:'8px', fontSize:'12px', cursor:'pointer', width:'auto'}} onClick={() => {setView('marketing'); window.scrollTo(0,0);}}>← Back to Home</button>
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
      )}

      {view === 'room' && (
        <div className="scr on" id="room" style={{padding:0, minHeight:'calc(100vh - 300px)', display:'flex', flexDirection:'column'}}>
          <div className="rhead" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', background:'rgba(6,6,15,.9)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:10, borderBottom:'1px solid var(--border)'}}>
            <div className="rhead-left" style={{display:'flex', flexDirection:'column', gap:'3px'}}>
              <div className="rname" style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:'22px', letterSpacing:'2px', background:'linear-gradient(90deg,var(--pink),var(--cyan))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>{roomTitle}</div>
              
              <div className="rcode" style={{fontFamily:"'JetBrains Mono',monospace", fontSize:'13px', color:'var(--sub)', display:'flex', alignItems:'center', gap:'10px'}}>
                CODE: <strong style={{color:'var(--text)', fontSize:'16px'}}>{roomCode}</strong> 
                <button className="btn-ghost" style={{padding:'4px 8px', fontSize:'12px', width:'auto', borderRadius:'6px', margin:0, color:'var(--cyan)', borderColor:'var(--cyan)'}} onClick={() => setModals({...modals, qr: true})}>
                  📲 Show QR
                </button>
              </div>

            </div>
            <button className="btn btn-sm btn-red" onClick={() => { sessionStorage.removeItem('hushpod_session'); window.location.reload(); }} style={{margin: 0, width:'auto'}}>Leave</button>
          </div>
          
          <div className="rbody" style={{flex:1, padding:'16px', maxWidth:'660px', margin:'0 auto', width:'100%', display:'flex', flexDirection:'column', gap:'14px', zIndex:1}}>
            
            <div style={{display:'flex', background:'var(--s2)', borderRadius:'12px', padding:'4px', border:'1px solid var(--border)'}}>
              <button onClick={()=>setRoomTab('party')} style={{flex:1, padding:'10px', background: roomTab === 'party' ? 'var(--s1)' : 'transparent', color: roomTab==='party' ? 'var(--cyan)' : 'var(--sub)', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer'}}>Party Hall</button>
              <button onClick={()=>setRoomTab('dj')} style={{flex:1, padding:'10px', background: roomTab === 'dj' ? 'var(--s1)' : 'transparent', color: roomTab==='dj' ? 'var(--cyan)' : 'var(--sub)', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer'}}>DJ Console</button>
              <button onClick={()=>setRoomTab('settings')} style={{flex:1, padding:'10px', background: roomTab === 'settings' ? 'var(--s1)' : 'transparent', color: roomTab==='settings' ? 'var(--cyan)' : 'var(--sub)', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer'}}>Settings</button>
            </div>

            {!amAdmin && (
              <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace", padding:'8px 12px', background:'var(--s2)', borderRadius:'8px'}}>
                <div className={`sync-dot ${syncState.state}`} style={{width:'6px', height:'6px', borderRadius:'50%', background:'var(--green)'}}></div><span>{syncState.label}</span>
              </div>
            )}

            {roomTab === 'party' && (
              <>
                <div className="card">
                  <div className="card-label">Listeners <span style={{background:'var(--s3)', borderRadius:'20px', padding:'2px 8px', fontSize:'11px', color:'var(--cyan)'}}>{members.length}</span></div>
                  <div style={{display:'flex', flexDirection:'column', gap:'7px'}}>
                    {members.map((m, i) => {
                      const isTargetAdmin = admins.includes(m.id);
                      return (
                      <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--s2)', border: m.isHost ? '1px solid rgba(247,37,133,.35)' : '1px solid var(--border)', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', fontWeight:'500'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                          <div style={{width:'7px', height:'7px', borderRadius:'50%', background: m.isHost ? 'var(--pink)' : isTargetAdmin ? 'var(--cyan)' : 'var(--green)', flexShrink:0}}></div>
                          <span>{m.name}</span>
                          {m.isHost && <span style={{fontSize:'10px', background:'rgba(247,37,133,.12)', color:'var(--pink)', borderRadius:'4px', padding:'1px 5px', fontWeight:'600'}}>HOST</span>}
                          {!m.isHost && isTargetAdmin && <span style={{fontSize:'10px', background:'rgba(76,201,240,.12)', color:'var(--cyan)', borderRadius:'4px', padding:'1px 5px', fontWeight:'600'}}>ADMIN</span>}
                        </div>
                        
                        <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                          {amHost && !isTargetAdmin && (
                            <button className="btn-ghost" style={{padding:'4px 10px', fontSize:'11px', width:'auto', margin:0, borderRadius:'6px'}} onClick={() => socketRef.current.emit('make-admin', { targetId: m.id })}>⭐ Admin</button>
                          )}
                        </div>

                      </div>
                    )})}
                  </div>
                </div>

                <div className="card">
                  <div className="card-label">Room Chat</div>
                  <div ref={chatBoxRef} className="chat-wrap" style={{maxHeight:'200px'}}>
                    {chat.length === 0 && <div style={{color:'var(--sub)', textAlign:'center', padding:'10px'}}>Say hello!</div>}
                    {chat.map((m, i) => <div key={i} style={{marginBottom:'5px', lineHeight:'1.4', wordWrap:'break-word'}}><span style={{fontWeight:'600', color:'var(--cyan)', marginRight:'4px'}}>{m.name}:</span> {m.text}</div>)}
                  </div>
                  <div className="chat-input-wrap" style={{display:'flex', gap:'8px'}}>
                    <input type="text" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} style={{flex:1, padding:'10px 12px', background:'var(--s3)', border:'1px solid var(--border)', borderRadius:'8px', color:'#fff', fontSize:'13px', outline:'none'}} />
                    <button className="btn-cyan" style={{margin:0, width:'auto', padding:'9px 16px', borderRadius:'8px', fontSize:'13px'}} onClick={handleChat}>Send</button>
                  </div>
                </div>
              </>
            )}

            {roomTab === 'dj' && (
              <>
                {(amAdmin || guestUploads) && !currentSong && (
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
                    <div style={{textAlign:'center', padding:'28px 16px'}}><div style={{fontSize:'44px', marginBottom:'10px'}}>🎧</div><h3 style={{fontSize:'17px', fontWeight:'700', marginBottom:'5px'}}>No song yet</h3><p style={{fontSize:'13px', color:'var(--sub)'}}>{(amAdmin||guestUploads) ? 'Upload a song to start!' : 'Waiting for admin to add a song'}</p></div>
                  ) : (
                    <div>
                      <div style={{fontSize:'20px', fontWeight:'700', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:'3px'}}>{currentSong.name}</div>
                      <div style={{fontSize:'13px', color:'var(--sub)', fontWeight:'300', marginBottom:'16px'}}>Status: <span style={{color: isPlaying ? 'var(--green)' : 'var(--sub)', fontWeight:'600'}}>{isPlaying ? 'Playing' : 'Paused'}</span></div>
                      
                      <div style={{width:'100%', height:'70px', margin:'15px 0', background:'transparent', borderRadius:'8px', border:'1px solid var(--border)', overflow:'hidden'}}><canvas id="viz-canvas" style={{width:'100%', height:'100%', display:'block'}}></canvas></div>

                      <div style={{marginBottom:'14px'}}>
                        <div style={{width:'100%', height:'30px', display:'flex', alignItems:'center', cursor:'pointer', marginBottom:'6px'}} onClick={seekClick}>
                          <div style={{width:'100%', height:'6px', background:'var(--s3)', borderRadius:'5px', overflow:'hidden'}}>
                            <div ref={progFillRef} style={{height:'100%', background:'linear-gradient(90deg,var(--pink),var(--cyan))', width:'0%'}}></div>
                          </div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace"}}><span ref={tCurRef}>0:00</span><span>{audioBufferRef.current ? fmt(audioBufferRef.current.duration) : '0:00'}</span></div>
                      </div>
                      
                      {amAdmin && (
                        <>
                          <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'15px', marginTop:'10px'}}>
                            <button className="btn-ghost" style={{color: isShuffle ? 'var(--pink)' : 'var(--sub)', borderColor: isShuffle ? 'var(--pink)' : 'var(--border)', width:'40px', height:'40px', borderRadius:'8px', padding:0, fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => setIsShuffle(!isShuffle)}>🔀</button>
                            
                            <button className="btn-ghost" style={{width:'44px', height:'44px', borderRadius:'50%', padding:0, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => handleSeek(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime) - 10)}>⏮</button>
                            <button className="btn-pink" style={{width:'60px', height:'60px', borderRadius:'50%', padding:0, fontSize:'24px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                            <button className="btn-ghost" style={{width:'44px', height:'44px', borderRadius:'50%', padding:0, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => handleSeek(stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime) + 10)}>⏭</button>
                            
                            <button className="btn-ghost" style={{color: isLooping ? 'var(--pink)' : 'var(--sub)', borderColor: isLooping ? 'var(--pink)' : 'var(--border)', width:'40px', height:'40px', borderRadius:'8px', padding:0, fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', margin:0}} onClick={() => setIsLooping(!isLooping)}>🔁</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-label">Queue {(amAdmin || guestUploads) && currentSong && <button className="btn-ghost" style={{margin:0, padding: '4px 10px', width:'auto', borderRadius:'6px', fontSize:'11px'}} onClick={() => document.getElementById('q-file')?.click()}>+ Add</button>}</div>
                  {(amAdmin || guestUploads) && <input type="file" id="q-file" style={{display:'none'}} accept="audio/*" multiple onChange={e => uploadSongs(e.target.files)} />}
                  
                  <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                    {queue.length === 0 ? <div style={{fontSize:'13px', color:'var(--sub)', textAlign:'center', padding:'12px 0'}}>No songs queued</div> : queue.map((s, i) => (
                      <div key={s.id} 
                        draggable={amAdmin}
                        onDragStart={() => setDraggedIdx(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, i)}
                        style={{background:'var(--s2)', padding:'10px 14px', borderRadius:'12px', fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', border: currentSong?.id === s.id ? '1px solid var(--pink)' : '1px solid var(--border)', fontWeight:'500', cursor: amAdmin ? 'grab' : 'default', opacity: draggedIdx === i ? 0.5 : 1}}
                      >
                        {amAdmin && <span style={{marginRight:'10px', cursor:'grab', color:'var(--sub)'}}>☰</span>}
                        <div style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{s.name}</div>
                        {amAdmin && currentSong?.id !== s.id && <button className="btn-ghost" style={{fontSize:'12px', color:'var(--cyan)', fontWeight:'600', padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(76,201,240,.3)', background:'var(--s3)', cursor:'pointer', flexShrink:0, width:'auto', margin:0}} onClick={() => socketRef.current.emit('play-song', { songId: s.id, autoPlay: true })}>Play</button>}
                        {currentSong?.id === s.id && <span style={{fontSize:'11px', color:'var(--cyan)', fontWeight:'bold'}}>NOW</span>}
                        {currentSong?.id !== s.id && !amAdmin && <button className="btn-ghost" style={{background:'var(--s3)', color:'var(--cyan)', border:'1px solid rgba(76,201,240,.3)', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontWeight:'700', fontSize:'11px', width:'auto', margin:0}} onClick={() => socketRef.current.emit('upvote', { songId: s.id })}>▲ {s.upvotes || 0}</button>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {roomTab === 'settings' && (
              <>
                {amAdmin ? (
                  <>
                    <div className="card">
                      <div className="card-label">Audio Settings</div>
                      <label style={{fontSize:'13px', color:'var(--text)', display:'block', marginBottom:'8px', fontWeight:'600'}}>Global Master Volume</label>
                      <div style={{display:'flex', alignItems:'center', gap:'10px', padding: '10px 15px', background: 'var(--s2)', borderRadius: '12px', border: '1px solid var(--border)'}}>
                        <span style={{fontSize: '16px'}}>🔉</span>
                        <input type="range" min="0" max="1" step="0.05" value={globalVolume} onChange={handleGlobalVolume} style={{flex: 1, cursor: 'pointer', accentColor: 'var(--cyan)'}} />
                        <span style={{fontSize: '16px'}}>🔊</span>
                      </div>
                      <p style={{fontSize:'11px', color:'var(--sub)', marginTop:'8px'}}>This adjusts the volume for everyone in the room instantly.</p>
                    </div>

                    {amHost && (
                      <div className="card">
                        <div className="card-label">Host Permissions</div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--s2)', padding:'15px', borderRadius:'12px', border:'1px solid var(--border)'}}>
                          <div>
                            <div style={{fontWeight:'600', fontSize:'14px'}}>Allow Guests to Upload</div>
                            <div style={{fontSize:'11px', color:'var(--sub)', marginTop:'2px'}}>Let listeners add songs to the queue</div>
                          </div>
                          <button className={guestUploads ? 'btn-cyan' : 'btn-ghost'} style={{width:'auto', margin:0, padding:'8px 16px', borderRadius:'8px', fontSize:'13px'}} onClick={() => socketRef.current.emit('toggle-guest-uploads', {allowed: !guestUploads})}>
                            {guestUploads ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="card" style={{textAlign:'center', padding:'30px'}}>
                    <div style={{fontSize:'32px', marginBottom:'10px'}}>🔒</div>
                    <div style={{fontSize:'16px', fontWeight:'600'}}>Settings Locked</div>
                    <div style={{fontSize:'13px', color:'var(--sub)', marginTop:'5px'}}>Only Admins can change room settings.</div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}

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

      {modals.qr && (
        <div style={{position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div style={{background:'var(--s1)', border:'1px solid rgba(255,214,10,.35)', borderRadius:'22px', padding:'30px 24px', maxWidth:'320px', width:'100%', textAlign:'center'}}>
            <h3 style={{color:'#fff', marginBottom:'15px', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'2px', fontSize:'28px'}}>Scan to Join</h3>
            <div style={{background:'#ffffff', padding:'15px', borderRadius:'10px', display:'inline-block', marginBottom:'15px'}}>
              <QRCodeSVG 
                value={`${window.location.origin}/?room=${roomCode}`} 
                size={180} 
                bgColor="#ffffff"
                fgColor="#000000"
                level="L"
                includeMargin={false}
              />
            </div>
            <p style={{color:'var(--sub)', fontSize:'13px', marginBottom:'20px'}}>Or use code: <strong style={{color:'var(--pink)', fontSize:'18px', letterSpacing:'2px'}}>{roomCode}</strong></p>
            <button className="btn-ghost" style={{width:'100%', padding:'15px', borderRadius:'12px', fontWeight:'600', cursor:'pointer'}} onClick={() => setModals({...modals, qr: false})}>Close</button>
          </div>
        </div>
      )}

      <footer style={{ background:'var(--s1)', borderTop:'1px solid var(--border)', padding:'60px 40px 36px', marginTop:'auto' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'48px', paddingBottom:'48px', borderBottom:'1px solid var(--border)', justifyContent:'space-between' }}>
            <div style={{ flex:'1 1 260px' }}>
              <a href="#" className="nav-logo" onClick={e => {e.preventDefault(); setView('marketing'); window.scrollTo(0,0);}} style={{fontFamily:"'Bebas Neue',sans-serif", fontSize:'36px', letterSpacing:'3px', background:'linear-gradient(135deg,var(--pink),var(--cyan))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', display:'block', marginBottom:'12px', textDecoration:'none'}}>HUSHPOD</a>
              <p style={{fontSize:'13px', color:'var(--sub)', lineHeight:'1.7', maxWidth:'260px'}}>Synchronized private group audio. Listen together in perfect sync — no app, no account, no lag.</p>
              <p style={{marginTop:'12px', fontSize:'12px', color:'var(--sub)'}}>Engineered by <span style={{color:'#bb86fc', fontWeight:'700'}}>Zentry Hub Pvt Ltd</span></p>
            </div>
            <div>
              <h4 style={{fontSize:'11px', fontWeight:'700', color:'var(--sub)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'18px'}}>Product</h4>
              <a style={{display:'block', fontSize:'13px', color:'var(--sub)', textDecoration:'none', marginBottom:'10px', cursor:'pointer'}} onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>Launch App</a>
            </div>
            <div>
              <h4 style={{fontSize:'11px', fontWeight:'700', color:'var(--sub)', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'18px'}}>Company</h4>
              <a style={{display:'block', fontSize:'13px', color:'var(--sub)', textDecoration:'none', marginBottom:'10px', cursor:'pointer'}}>FAQ</a>
              <a style={{display:'block', fontSize:'13px', color:'var(--sub)', textDecoration:'none', marginBottom:'10px', cursor:'pointer'}}>Terms of Service</a>
            </div>
          </div>
          <div style={{ paddingTop:'28px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
            <div style={{fontSize:'12px', color:'var(--sub)'}}>© 2026 HushPod · Built with ♥ in India</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace", fontSize:'11px', color:'var(--sub)'}}>v2.0.0 · Node.js + React · Zero data retention</div>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;