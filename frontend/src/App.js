import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

const SERVER = window.location.port === '3000' ? `http://${window.location.hostname}:5000` : window.location.origin;

function App() {
  const [view, setView] = useState('marketing');
  const [openFaq, setOpenFaq] = useState(null);
  const [activeRooms, setActiveRooms] = useState(4); 
  const [toastData, setToastData] = useState({ msg: '', type: 'inf', visible: false });
  const [modals, setModals] = useState({ qr: false, tos: false });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roomTab, setRoomTab] = useState('dj'); 

  const [uname, setUname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [members, setMembers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentSong, setCurrentSong] = useState(null);
  const [syncState, setSyncState] = useState({ state: 'syncing', label: 'Waiting for host...' });
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [guestUploads, setGuestUploads] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(1.0);
  const [orbitActive, setOrbitActive] = useState(false);
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
  const pannerNodeRef = useRef(null); // ORBIT: Controls Left/Right Audio
  const analyserRef = useRef(null);
  
  const stateRef = useRef({ clockOff: 0, songOffset: 0, nodeStartTime: 0, localPlayState: false, amHost: false, queue: [], loop: false, shuffle: false, currentSongId: null, uname: '', members: [], globalVolume: 1.0, orbitActive: false });
  
  const progFillRef = useRef(null);
  const tCurRef = useRef(null);
  const chatBoxRef = useRef(null);
  const vizRafRef = useRef(null);
  const orbitRafRef = useRef(null);
  const audioOrbitRaf = useRef(null);
  const toastTmr = useRef(null);

  const toast = (msg, type = 'inf') => {
    setToastData({ msg, type, visible: true });
    clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToastData(t => ({ ...t, visible: false })), 3000);
  };

  // Safely find our user in the room list to see if we are the Host
  const myMemberData = members.find(m => m.id === socketRef.current?.id);
  const amHost = myMemberData ? myMemberData.isHost : false;

  useEffect(() => {
    stateRef.current.queue = queue;
    stateRef.current.loop = isLooping;
    stateRef.current.shuffle = isShuffle;
    stateRef.current.currentSongId = currentSong?.id;
    stateRef.current.uname = uname;
    stateRef.current.amHost = amHost;
    stateRef.current.members = members;
    stateRef.current.globalVolume = globalVolume;
    stateRef.current.orbitActive = orbitActive;
  }, [queue, isLooping, isShuffle, currentSong, uname, amHost, members, globalVolume, orbitActive]);

  useEffect(() => {
    if (view === 'marketing') {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
      }, { threshold: 0.12 });
      setTimeout(() => { document.querySelectorAll('.reveal').forEach(el => observer.observe(el)); }, 100);
      const interval = setInterval(() => { setActiveRooms(prev => Math.max(1, prev + (Math.random() > 0.5 ? 1 : -1))); }, 7000);
      return () => { observer.disconnect(); clearInterval(interval); };
    }
  }, [view]);

  useEffect(() => {
    const session = sessionStorage.getItem('hushpod_session');
    if (session) {
      const { code, name } = JSON.parse(session);
      setUname(name); setCodeInput(code);
      
      initSystem().then(() => {
        socketRef.current.emit('join-room', { code, name, claimHost: false }, (res) => {
          if (res.error) { sessionStorage.removeItem('hushpod_session'); return; }
          setRoomCode(code); setMembers(res.members); setQueue(res.queue);
          setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume); setOrbitActive(res.orbitActive || false);
          
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
    return () => window.removeEventListener('scroll', handleScroll);
  }, [view]);

  const initSystem = async () => {
    if (!actxRef.current) {
      actxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      gainNodeRef.current = actxRef.current.createGain();
      analyserRef.current = actxRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      pannerNodeRef.current = actxRef.current.createStereoPanner ? actxRef.current.createStereoPanner() : actxRef.current.createGain();
      
      // The Safe Audio Graph: Panner -> Analyser -> Gain -> Speakers
      pannerNodeRef.current.connect(analyserRef.current);
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
        const t1 = Date.now();
        const r = await fetch(SERVER + '/clocksync', { cache: 'no-store' });
        const { t } = await r.json();
        const t4 = Date.now();
        const rtt = t4 - t1;
        samples.push({ offset: t + (rtt / 2) - Date.now(), rtt });
      } catch {}
    }
    if (samples.length > 0) {
      samples.sort((a, b) => a.rtt - b.rtt);
      stateRef.current.clockOff = samples[0].offset;
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
    
    // Connect audio file directly to Orbit Panner
    sourceNodeRef.current.connect(pannerNodeRef.current);

    sourceNodeRef.current.onended = () => {
      const s = stateRef.current;
      if (s.localPlayState && actxRef.current.currentTime >= s.nodeStartTime + audioBufferRef.current.duration - s.songOffset - 0.1) {
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
    if (!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Downloading track...' });
    
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      audioBufferRef.current = await actxRef.current.decodeAudioData(arrayBuffer);
      applyPlayState(playState.playing, playState.currentTime, playState.ts, isNewJoiner);
    } catch(e) { if (!stateRef.current.amHost) setSyncState({ state: 'fixing', label: 'Error loading track' }); }
  };

  const applyPlayState = (playing, currentTime, ts, isNewJoiner = false) => {
    if (!audioBufferRef.current) return;
    const elapsed = (Date.now() + stateRef.current.clockOff - ts) / 1000;
    
    if (!playing) { 
      stopAudio(); stateRef.current.songOffset = currentTime; 
      if(!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Paused' });
      return; 
    }
    
    let expectedOffset = currentTime + elapsed;
    let startTime = actxRef.current.currentTime + 0.05;

    if (expectedOffset < 0) { startTime = actxRef.current.currentTime + Math.abs(expectedOffset); expectedOffset = 0; }
    
    if (isNewJoiner && !stateRef.current.amHost && expectedOffset > 0) {
        const delay = 3.0; expectedOffset += delay; startTime = actxRef.current.currentTime + delay; 
        setSyncState({ state: 'syncing', label: 'Locking sync... playing in 3s' });
        setTimeout(() => { if(stateRef.current.localPlayState) setSyncState({ state: 'synced', label: 'Locked Sync' }); }, delay * 1000);
    } else {
        if(!stateRef.current.amHost) setSyncState({ state: 'synced', label: 'Locked Sync' });
    }

    if (expectedOffset >= audioBufferRef.current.duration) { stopAudio(); return; }
    playAudioAt(expectedOffset, startTime);
  };

  const handleSeek = (newTime) => {
    if (!amHost || !audioBufferRef.current) return;
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

  // --- ORBIT MODE LOGIC ---
  useEffect(() => {
    const runOrbitUI = () => {
      if (roomTab !== 'orbit') return;
      orbitRafRef.current = requestAnimationFrame(runOrbitUI);
      const cvs = document.getElementById('orbit-canvas');
      if(!cvs) return; const ctx = cvs.getContext('2d');
      const W = cvs.width = cvs.offsetWidth; const H = cvs.height = cvs.offsetHeight;
      const cx = W/2, cy = H/2; const radius = Math.min(W, H) * 0.35;
      
      const speedMs = 12000;
      const radarAngle = (((Date.now() + stateRef.current.clockOff) % speedMs) / speedMs) * Math.PI * 2;

      ctx.fillStyle = 'rgba(10, 10, 20, 0.4)'; ctx.fillRect(0, 0, W, H);
      
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(76,201,240,0.15)'; ctx.lineWidth = 1; ctx.stroke();

      if (stateRef.current.orbitActive) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(radarAngle);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 0.3);
        ctx.lineTo(0,0);
        const grad = ctx.createRadialGradient(0,0,0, 0,0,radius*1.3);
        grad.addColorStop(0, 'rgba(247,37,133,0.6)'); grad.addColorStop(1, 'rgba(247,37,133,0)');
        ctx.fillStyle = grad; ctx.fill(); ctx.restore();
      }

      const total = stateRef.current.members.length || 1;
      stateRef.current.members.forEach((m, i) => {
        const a = (i / total) * Math.PI * 2;
        const x = cx + Math.cos(a) * radius; const y = cy + Math.sin(a) * radius;
        
        let diff = Math.abs(radarAngle - a);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const isHit = stateRef.current.orbitActive && diff < 0.6;
        
        ctx.beginPath(); ctx.arc(x, y, isHit ? 14 : 8, 0, Math.PI * 2);
        ctx.fillStyle = m.id === socketRef.current?.id ? '#4cc9f0' : (m.isHost ? '#f72585' : '#7777aa');
        if (isHit) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20; }
        ctx.fill(); ctx.shadowBlur = 0;

        ctx.fillStyle = isHit ? '#fff' : 'var(--sub)'; ctx.font = '11px JetBrains Mono'; ctx.textAlign = 'center';
        ctx.fillText(m.id === socketRef.current?.id ? 'YOU' : m.name, x, y + 25);
      });
    };
    if (roomTab === 'orbit') runOrbitUI();
    return () => cancelAnimationFrame(orbitRafRef.current);
  }, [roomTab]);

  useEffect(() => {
    const updateAudioOrbit = () => {
      audioOrbitRaf.current = requestAnimationFrame(updateAudioOrbit);
      if (!stateRef.current.orbitActive || !pannerNodeRef.current || !pannerNodeRef.current.pan) {
        if (pannerNodeRef.current && pannerNodeRef.current.pan) pannerNodeRef.current.pan.setTargetAtTime(0, actxRef.current.currentTime, 0.1);
        if (gainNodeRef.current) gainNodeRef.current.gain.setTargetAtTime(stateRef.current.globalVolume, actxRef.current.currentTime, 0.1);
        return;
      }
      
      const total = stateRef.current.members.length || 1;
      const myIdx = stateRef.current.members.findIndex(m => m.id === socketRef.current?.id);
      if (myIdx === -1) return;
      const myAngle = (myIdx / total) * Math.PI * 2;
      
      const speedMs = 12000;
      const radarAngle = (((Date.now() + stateRef.current.clockOff) % speedMs) / speedMs) * Math.PI * 2;
      
      let diff = Math.abs(radarAngle - myAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      
      const vol = 0.2 + 0.8 * Math.max(0, Math.cos(diff));
      gainNodeRef.current.gain.setTargetAtTime(vol * stateRef.current.globalVolume, actxRef.current.currentTime, 0.1);
      
      const panRaw = Math.sin(radarAngle - myAngle);
      pannerNodeRef.current.pan.setTargetAtTime(panRaw, actxRef.current.currentTime, 0.1);
    };
    updateAudioOrbit();
    return () => cancelAnimationFrame(audioOrbitRaf.current);
  }, []);

  const setupSocketListeners = (sock) => {
    sock.on('song-changed', ({ songId, name, streamUrl, playState }) => {
      setCurrentSong({ id: songId, name, duration: 0 });
      document.title = `HushPod | ${name}`;
      guestLoadAndSync(SERVER + streamUrl, playState, !stateRef.current.amHost);
    });

    sock.on('play-scheduled', ({ currentTime, targetTs }) => {
      if(!stateRef.current.amHost) setSyncState({ state: 'syncing', label: 'Readying...' });
      applyPlayState(true, currentTime, targetTs, false);
    });

    sock.on('playstate', ({ playing, currentTime, ts }) => { 
      if(!stateRef.current.amHost) applyPlayState(playing, currentTime, ts, false); 
    });

    sock.on('heartbeat', ({ currentTime, ts }) => {
      if (stateRef.current.amHost || !stateRef.current.localPlayState || !audioBufferRef.current) return;
      const elapsed = (sNow() - ts) / 1000;
      const expectedTime = currentTime + elapsed;
      const actualTime = stateRef.current.songOffset + (actxRef.current.currentTime - stateRef.current.nodeStartTime);
      
      if (Math.abs(expectedTime - actualTime) > 0.4) {
        applyPlayState(true, currentTime, ts, false);
      }
    });

    sock.on('queue-updated', ({ queue }) => setQueue(queue));
    
    sock.on('chat-msg', ({ name, text }) => { 
      setChat(prev => [...prev, { name, text }]); 
      if (name !== stateRef.current.uname) { toast(`💬 ${name}: ${text}`, 'inf'); }
      setTimeout(() => { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, 10); 
    });
    
    sock.on('settings-updated', (s) => {
      setGuestUploads(s.guestUploads); 
      setGlobalVolume(s.globalVolume);
      setOrbitActive(s.orbitActive);
      if (gainNodeRef.current && actxRef.current && !s.orbitActive) gainNodeRef.current.gain.setValueAtTime(s.globalVolume, actxRef.current.currentTime);
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
      setIsSyncing(true);
      await initSystem();
      socketRef.current.emit('create-room', { name: uname }, (res) => {
        setRoomCode(res.code); 
        
        // INSTANT HOST FIX
        setMembers([{ id: socketRef.current.id, name: uname, isHost: true }]);

        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: res.code, name: uname }));
        setIsSyncing(false);
        setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
        document.title = `HushPod | ${uname}'s Party`;
        setInterval(() => {
          const s = stateRef.current;
          if(s.localPlayState && socketRef.current && s.amHost) socketRef.current.emit('heartbeat', { currentTime: Math.max(0, s.songOffset + (actxRef.current.currentTime - s.nodeStartTime)) });
        }, 1000);
      });
    } 
    else if (pendingAction === 'join') {
      setIsSyncing(true);
      await initSystem();
      socketRef.current.emit('join-room', { code: codeInput, name: uname, claimHost: false }, (res) => {
        if (res.error) { setIsSyncing(false); return toast(res.error, 'err'); }
        sessionStorage.setItem('hushpod_session', JSON.stringify({ code: codeInput, name: uname }));
        setRoomCode(codeInput); setMembers(res.members); setQueue(res.queue);
        setGuestUploads(res.guestUploads); setGlobalVolume(res.globalVolume); setOrbitActive(res.orbitActive || false);
        
        const hostUser = res.members.find(m => m.isHost);
        document.title = `HushPod | ${hostUser ? hostUser.name : 'Room'}'s Party`;

        if(res.currentSong) {
          setCurrentSong({ id: res.currentSong.songId, name: res.currentSong.name });
          guestLoadAndSync(SERVER + res.currentSong.streamUrl, res.playState, true);
        }
        setIsSyncing(false);
        setRoomTab('dj'); setView('room'); window.scrollTo(0,0);
      });
    }
  };

  const togglePlay = () => {
    if (!amHost) return;
    const s = stateRef.current;
    let cur = s.localPlayState ? s.songOffset + (actxRef.current.currentTime - s.nodeStartTime) : s.songOffset;
    if (!s.localPlayState) { socketRef.current.emit('schedule-play', { currentTime: cur }); }
    else { socketRef.current.emit('playstate', { playing: false, currentTime: cur, ts: sNow() }); applyPlayState(false, cur, sNow(), false); }
  };

  const seekClick = (e) => {
    if (!amHost || !audioBufferRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - r.left) / r.width;
    const t = Math.max(0, Math.min(audioBufferRef.current.duration, percent * audioBufferRef.current.duration));
    handleSeek(t);
  };

  const uploadSongs = (files) => {
    if (!files || files.length === 0) return;
    if (!amHost && !guestUploads) return toast('Host has locked uploads', 'err');
    
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
    if(!amHost) return;
    const val = parseFloat(e.target.value);
    setGlobalVolume(val);
    socketRef.current.emit('set-global-volume', { volume: val });
    if (gainNodeRef.current && actxRef.current && !orbitActive) gainNodeRef.current.gain.setValueAtTime(val, actxRef.current.currentTime);
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
      
      {isSyncing && (
        <div className="loader-overlay">
          <div className="eq-container">
            <div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div><div className="eq-bar"></div>
          </div>
          <div className="loader-text">Syncing Audio...</div>
        </div>
      )}

      {view === 'marketing' && (
        <div className="scr on" id="landing" style={{ display: 'block' }}>
          
          <nav>
            <a href="#marketing" className="nav-logo" onClick={e => { e.preventDefault(); window.scrollTo(0,0); }}>HUSHPOD</a>
            <div className="nav-links">
              <a href="#how" onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({behavior: 'smooth'}); }}>How it works</a>
              <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({behavior: 'smooth'}); }}>Features</a>
              <a href="#usecases" onClick={e => { e.preventDefault(); document.getElementById('usecases')?.scrollIntoView({behavior: 'smooth'}); }}>Use Cases</a>
              <a href="#tech" onClick={e => { e.preventDefault(); document.getElementById('tech')?.scrollIntoView({behavior: 'smooth'}); }}>Tech</a>
              <a href="#faq" onClick={e => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({behavior: 'smooth'}); }}>FAQ</a>
            </div>
            <a href="#app" className="nav-cta" onClick={(e) => { e.preventDefault(); setView('app-entry'); window.scrollTo(0,0); }}>Start Listening Free →</a>
          </nav>

          <div className="wrap">
            {/* ══ HERO ══ */}
            <section className="hero">
              <div className="hero-eyebrow"><span></span> Live · Synchronized · Private</div>
              <h1 className="hero-title"><span className="line1">HEAR</span><span className="line2">TOGETHER</span></h1>
              <p className="hero-sub">
                Real-time synchronized audio for groups.<br/>
                <strong>No app. No account. No lag.</strong> Just open, create a room, and everyone hears the same song at the exact same millisecond.
              </p>
              <div className="hero-btns">
                <button className="btn-hero-primary" onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>🎉 Create a Room Free</button>
                <a href="#how" className="btn-hero-secondary" onClick={e => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({behavior: 'smooth'}); }}>See How It Works</a>
              </div>

              <div className="hero-proof">
                <div className="proof-item"><div className="proof-num">{activeRooms}</div><div className="proof-label">Active Rooms</div></div>
                <div className="proof-div"></div>
                <div className="proof-item"><div className="proof-num">&lt;100ms</div><div className="proof-label">Sync Precision</div></div>
                <div className="proof-div"></div>
                <div className="proof-item"><div className="proof-num">15</div><div className="proof-label">Listeners Free</div></div>
                <div className="proof-div"></div>
                <div className="proof-item"><div className="proof-num">0</div><div className="proof-label">Data Stored</div></div>
              </div>

              <div className="waveform-demo reveal">
                <div className="wf-header">
                  <div className="wf-title">Live Session</div>
                  <div className="wf-status">4 devices in sync</div>
                </div>
                <div className="wf-bars">
                  {[...Array(38)].map((_, i) => {
                    const h = 6 + Math.random() * 50;
                    const d = 0.3 + Math.random() * 0.7;
                    return <div key={i} className="wf-bar" style={{ '--d': `${d}s`, '--h': `${h}px`, height: `${h}px` }}></div>
                  })}
                </div>
                <div className="wf-devices">
                  <div className="wf-device active"><div className="wf-device-dot"></div>Host · iPhone 15</div>
                  <div className="wf-device active"><div className="wf-device-dot"></div>Priya · Galaxy S24</div>
                  <div className="wf-device active"><div className="wf-device-dot"></div>Arjun · Pixel 8</div>
                  <div className="wf-device active"><div className="wf-device-dot"></div>Meera · OnePlus</div>
                </div>
              </div>
            </section>

            {/* ══ HOW IT WORKS ══ */}
            <section id="how">
              <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">⚡ Three Steps</div>
                <h2 className="section-title">Zero friction.<br/>Instant sync.</h2>
                <p className="section-sub" style={{ margin: '0 auto' }}>No downloads. No sign-up. Works in any browser on any phone.</p>
              </div>
              <div className="steps-grid">
                <div className="step-card reveal"><div className="step-icon">🎙️</div><div className="step-num">01</div><div className="step-title">Create a Room</div><div className="step-desc">Enter your name, tap "Create Party Room". You get a unique 5-character room code instantly. Upload up to 10 songs from your device.</div></div>
                <div className="step-card reveal" style={{ transitionDelay: '.1s' }}><div className="step-icon">📲</div><div className="step-num">02</div><div className="step-title">Share the Code</div><div className="step-desc">Send your room code or QR code to friends. They open HushPod in their browser, type the code, and they're in.</div></div>
                <div className="step-card reveal" style={{ transitionDelay: '.2s' }}><div className="step-icon">🎧</div><div className="step-num">03</div><div className="step-title">Listen Together</div><div className="step-desc">Everyone hears the same audio at the same millisecond. The host controls play, pause, and the queue.</div></div>
                <div className="step-card reveal" style={{ transitionDelay: '.3s' }}><div className="step-icon">🔄</div><div className="step-num">04</div><div className="step-title">Pass the Aux</div><div className="step-desc">If the host leaves, the next listener becomes DJ automatically — the party never stops.</div></div>
              </div>
            </section>

            {/* ══ FEATURES ══ */}
            <section id="features" style={{ background: 'linear-gradient(180deg,var(--bg),var(--s1) 50%,var(--bg))' }}>
              <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">✨ Everything Included</div>
                <h2 className="section-title">Built for real<br/>group experiences</h2>
              </div>
              <div className="features-grid" style={{ maxWidth: '1100px', margin: '64px auto 0' }}>
                <div className="feat-card reveal"><div className="feat-icon pink">🔴</div><div className="feat-title">Dead Reckoning Sync</div><div className="feat-desc">Between heartbeats, guests mathematically calculate the host's exact position.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.05s' }}><div className="feat-icon cyan">⚡</div><div className="feat-title">Seeked Recalculation</div><div className="feat-desc">After every seek, we recalculate position — eliminating mobile seek latency.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.1s' }}><div className="feat-icon green">🗓️</div><div className="feat-title">Scheduled Playback</div><div className="feat-desc">All devices receive a future server timestamp to begin playback simultaneously.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.15s' }}><div className="feat-icon yellow">📦</div><div className="feat-title">Batch Upload (10 Songs)</div><div className="feat-desc">Upload your entire setlist at once. Auto-advance plays the next song seamlessly.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.2s' }}><div className="feat-icon purple">💬</div><div className="feat-title">Song Suggestions Chat</div><div className="feat-desc">Built-in chat so guests can suggest what to play next in real-time.</div><span className="feat-badge badge-live">Live</span></div>
                <div className="feat-card reveal" style={{ transitionDelay: '.25s' }}><div className="feat-icon indigo">🔗</div><div className="feat-title">QR Code Sharing</div><div className="feat-desc">One tap generates a QR code for your room. Anyone can scan it to join instantly.</div><span className="feat-badge badge-live">Live</span></div>
              </div>
            </section>

            {/* ══ USE CASES ══ */}
            <section id="usecases">
              <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">🌍 Use Cases</div>
                <h2 className="section-title">Made for every<br/>shared moment</h2>
              </div>
              <div className="cases-grid" style={{ maxWidth: '1100px', margin: '64px auto 0' }}>
                <div className="case-card c1 reveal"><div className="case-emoji">🎉</div><div className="case-title">Silent Disco Parties</div><div className="case-desc">Replace expensive FM transmitters with HushPod. Everyone dances to the same beat.</div></div>
                <div className="case-card c2 reveal" style={{ transitionDelay: '.08s' }}><div className="case-emoji">📚</div><div className="case-title">Synchronized Study</div><div className="case-desc">Study in sync with your friend group. Everyone hears the same lo-fi playlist.</div></div>
                <div className="case-card c3 reveal" style={{ transitionDelay: '.16s' }}><div className="case-emoji">🚗</div><div className="case-title">Road Trips</div><div className="case-desc">Everyone in different cars hearing the exact same song at the same time.</div></div>
              </div>
            </section>

            {/* ══ FAQ ══ */}
            <section id="faq" style={{ padding: '100px 24px' }}>
              <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
                <div className="section-label">❓ FAQ</div>
                <h2 className="section-title">Common questions</h2>
              </div>
              <div className="faq-grid">
                {[
                  { q: "Do guests need to download an app?", a: "No. HushPod works entirely in the browser. Guests simply open the link, enter the room code, and they're synced." },
                  { q: "Does everyone need to be on the same WiFi?", a: "No. HushPod works over the internet — different WiFi networks, mobile data, different cities, different countries." },
                  { q: "What happens if the host leaves?", a: "If the host disconnects, the longest-connected listener automatically becomes the new host. The room stays alive, playback continues." }
                ].map((faq, i) => (
                  <div key={i} className={`faq-item reveal ${openFaq === i ? 'open' : ''}`} style={{ transitionDelay: `${i * 0.05}s` }}>
                    <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{faq.q} <span className="faq-arrow">▾</span></div>
                    <div className="faq-a">{faq.a}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ══ CTA ══ */}
            <section id="cta">
              <div className="cta-glow"></div>
              <div className="reveal" style={{ position: 'relative' }}>
                <div className="section-label" style={{ justifyContent: 'center' }}>🎧 Start Free</div>
                <div className="cta-title"><span>LISTEN</span><br/>TOGETHER<br/><span>NOW</span></div>
                <p className="cta-sub">Create your first room in under 10 seconds. No sign-up. No credit card.</p>
                <button className="btn-hero-primary" style={{ fontSize: '18px', padding: '18px 44px' }} onClick={() => { setView('app-entry'); window.scrollTo(0,0); }}>🎉 Create a Free Room</button>
              </div>
            </section>

            {/* ══ FOOTER ══ */}
            <footer>
              <div className="footer-inner">
                <div className="footer-top">
                  <div className="footer-brand">
                    <a href="#marketing" className="footer-logo" onClick={e => { e.preventDefault(); window.scrollTo(0,0); }}>HUSHPOD</a>
                    <p className="footer-tagline">Synchronized private group audio. Listen together in perfect sync — no app, no account, no lag.</p>
                  </div>
                  <div className="footer-col">
                    <h4>Product</h4>
                    <a href="#app" onClick={(e) => { e.preventDefault(); setView('app-entry'); window.scrollTo(0,0); }}>Launch App</a>
                    <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({behavior: 'smooth'}); }}>Features</a>
                  </div>
                </div>
              </div>
            </footer>
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
            <button className="btn-pink" onClick={attemptCreateRoom}>Create Party Room</button>
            <div style={{display:'flex', alignItems:'center', gap:'9px', color:'var(--sub)', fontSize:'12px', margin:'10px 0'}}>
              <span style={{flex:1, height:'1px', background:'var(--border)'}}></span>or join one<span style={{flex:1, height:'1px', background:'var(--border)'}}></span>
            </div>
            <div style={{padding:'20px', borderRadius:'18px', border:'1px solid var(--border)', background:'var(--s1)'}}>
              <h3 style={{fontSize:'11px', fontWeight:'600', letterSpacing:'2px', textTransform:'uppercase', color:'var(--sub)', marginBottom:'12px'}}>Room Code</h3>
              <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} placeholder="ABC12" maxLength="5" style={{textAlign:'center', letterSpacing:'6px', fontFamily:'JetBrains Mono', fontWeight:'bold', marginBottom:'12px'}} />
              <button className="btn-cyan" style={{marginBottom:0}} onClick={attemptJoinRoom}>Join Room</button>
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
            <button className="btn-sm btn-red" onClick={() => { sessionStorage.removeItem('hushpod_session'); window.location.reload(); }} style={{margin: 0, width:'auto'}}>Leave</button>
          </div>
          
          <div className="rbody" style={{flex:1, padding:'16px', maxWidth:'660px', margin:'0 auto', width:'100%', display:'flex', flexDirection:'column', gap:'14px', zIndex:1}}>
            
            <div style={{display:'flex', background:'var(--s2)', borderRadius:'12px', padding:'4px', border:'1px solid var(--border)'}}>
              <button onClick={()=>setRoomTab('party')} style={{flex:1, padding:'10px 5px', background: roomTab === 'party' ? 'var(--s1)' : 'transparent', color: roomTab==='party' ? 'var(--cyan)' : 'var(--sub)', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer', fontSize:'13px'}}>Party Hall</button>
              <button onClick={()=>setRoomTab('dj')} style={{flex:1, padding:'10px 5px', background: roomTab === 'dj' ? 'var(--s1)' : 'transparent', color: roomTab==='dj' ? 'var(--cyan)' : 'var(--sub)', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer', fontSize:'13px'}}>DJ Console</button>
              <button onClick={()=>setRoomTab('orbit')} style={{flex:1, padding:'10px 5px', background: roomTab === 'orbit' ? 'var(--s1)' : 'transparent', color: roomTab==='orbit' ? 'var(--pink)' : 'var(--sub)', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer', fontSize:'13px'}}>Orbit 3D</button>
              <button onClick={()=>setRoomTab('settings')} style={{flex:1, padding:'10px 5px', background: roomTab === 'settings' ? 'var(--s1)' : 'transparent', color: roomTab==='settings' ? 'var(--cyan)' : 'var(--sub)', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer', fontSize:'13px'}}>Settings</button>
            </div>

            {!amHost && (
              <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace", padding:'8px 12px', background:'var(--s2)', borderRadius:'8px'}}>
                <div className={`sync-dot ${syncState.state}`} style={{width:'6px', height:'6px', borderRadius:'50%', background:'var(--green)'}}></div><span>{syncState.label}</span>
              </div>
            )}

            {roomTab === 'orbit' && (
              <div className="card" style={{padding: '10px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px'}}>
                  <div>
                    <div style={{fontSize: '16px', fontWeight: '700', color: 'var(--pink)'}}>Spatial Orbit Engine</div>
                    <div style={{fontSize: '12px', color: 'var(--sub)', marginTop: '4px'}}>Music physically travels around the room.</div>
                  </div>
                  {amHost && (
                     <button className={orbitActive ? 'btn-pink' : 'btn-ghost'} style={{width: 'auto', margin: 0, padding: '8px 16px', borderRadius: '8px', fontSize: '12px'}} onClick={() => socketRef.current.emit('set-orbit', {active: !orbitActive})}>
                       {orbitActive ? 'Active' : 'Turn On'}
                     </button>
                  )}
                </div>
                <div style={{width: '100%', height: '350px', background: '#0a0a14', borderRadius: '16px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)'}}>
                  <canvas id="orbit-canvas" style={{width: '100%', height: '100%', display: 'block'}}></canvas>
                  {!orbitActive && (
                    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,20,0.8)', color: 'var(--sub)', fontSize: '13px', fontWeight: '600', letterSpacing: '1px'}}>
                      ORBIT IS OFFLINE
                    </div>
                  )}
                </div>
              </div>
            )}

            {roomTab === 'party' && (
              <>
                <div className="card">
                  <div className="card-label">Listeners <span style={{background:'var(--s3)', borderRadius:'20px', padding:'2px 8px', fontSize:'11px', color:'var(--cyan)'}}>{members.length}</span></div>
                  <div style={{display:'flex', flexDirection:'column', gap:'7px'}}>
                    {members.map((m, i) => (
                      <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--s2)', border: m.isHost ? '1px solid rgba(247,37,133,.35)' : '1px solid var(--border)', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', fontWeight:'500'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                          <div style={{width:'7px', height:'7px', borderRadius:'50%', background: m.isHost ? 'var(--pink)' : 'var(--green)', flexShrink:0}}></div>
                          <span>{m.name}</span>
                          {m.isHost && <span style={{fontSize:'10px', background:'rgba(247,37,133,.12)', color:'var(--pink)', borderRadius:'4px', padding:'1px 5px', fontWeight:'600'}}>HOST</span>}
                        </div>
                      </div>
                    ))}
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
                      
                      <div style={{width:'100%', height:'70px', margin:'15px 0', background:'transparent', borderRadius:'8px', border:'1px solid var(--border)', overflow:'hidden'}}><canvas id="viz-canvas" style={{width:'100%', height:'100%', display:'block'}}></canvas></div>

                      <div style={{marginBottom:'14px'}}>
                        <div style={{width:'100%', height:'30px', display:'flex', alignItems:'center', cursor:'pointer', marginBottom:'6px'}} onClick={seekClick}>
                          <div style={{width:'100%', height:'6px', background:'var(--s3)', borderRadius:'5px', overflow:'hidden'}}>
                            <div ref={progFillRef} style={{height:'100%', background:'linear-gradient(90deg,var(--pink),var(--cyan))', width:'0%'}}></div>
                          </div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--sub)', fontFamily:"'JetBrains Mono',monospace"}}><span ref={tCurRef}>0:00</span><span>{audioBufferRef.current ? fmt(audioBufferRef.current.duration) : '0:00'}</span></div>
                      </div>
                      
                      {amHost && (
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
                  <div className="card-label">Queue {(amHost || guestUploads) && currentSong && <button className="btn-ghost" style={{margin:0, padding: '4px 10px', width:'auto', borderRadius:'6px', fontSize:'11px'}} onClick={() => document.getElementById('q-file')?.click()}>+ Add</button>}</div>
                  {(amHost || guestUploads) && <input type="file" id="q-file" style={{display:'none'}} accept="audio/*" multiple onChange={e => uploadSongs(e.target.files)} />}
                  
                  <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                    {queue.length === 0 ? <div style={{fontSize:'13px', color:'var(--sub)', textAlign:'center', padding:'12px 0'}}>No songs queued</div> : queue.map((s, i) => (
                      <div key={s.id} 
                        draggable={amHost}
                        onDragStart={() => setDraggedIdx(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, i)}
                        style={{background:'var(--s2)', padding:'10px 14px', borderRadius:'12px', fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', border: currentSong?.id === s.id ? '1px solid var(--pink)' : '1px solid var(--border)', fontWeight:'500', cursor: amHost ? 'grab' : 'default', opacity: draggedIdx === i ? 0.5 : 1}}
                      >
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
            )}

            {roomTab === 'settings' && (
              <>
                {amHost ? (
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
                  </>
                ) : (
                  <div className="card" style={{textAlign:'center', padding:'30px'}}>
                    <div style={{fontSize:'32px', marginBottom:'10px'}}>🔒</div>
                    <div style={{fontSize:'16px', fontWeight:'600'}}>Settings Locked</div>
                    <div style={{fontSize:'13px', color:'var(--sub)', marginTop:'5px'}}>Only the Host can change room settings.</div>
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
    </>
  );
}

export default App;